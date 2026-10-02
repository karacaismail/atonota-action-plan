import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderRoleGuide, renderGeneralGuide } from '../scripts/docs.mjs';
import { plan } from '../plan.mjs';
import { normalizeState, transition, statusOf, dependenciesOf } from '../model.mjs';
import { navigationTarget, renderNext, renderDependencyLinks, renderTask } from '../render.mjs';

const source = new URL('../', import.meta.url);
const clientFiles = ['app.mjs', 'plan.mjs', 'model.mjs', 'render.mjs', 'styles.css', 'favicon.svg'];

test('emitted plan omits build-only metadata without changing tasks or runtime outcomes', async t => {
  const fixture = await buildFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const { plan: emitted } = await import(join(fixture.output, 'plan.mjs'));
  assert.equal(emitted.projects, undefined);
  assert.equal(emitted.scope, undefined);
  assert.deepEqual(emitted.tasks, JSON.parse(JSON.stringify(plan.tasks)));
  assert.equal(emitted.version, plan.version);
  for (let mask = 0; mask < 2 ** plan.options.length; mask++) {
    const options = Object.fromEntries(plan.options.map((option, i) => [option.id, Boolean(mask & (1 << i))]));
    for (const completed of [[], plan.tasks.map(task => task.id), ['U02', 'E01', 'H01', 'unknown']]) {
      const raw = { options, completed };
      const fullState = normalizeState(raw, plan);
      const state = normalizeState(raw, emitted);
      assert.deepEqual(state, fullState);
      for (const role of ['all', ...plan.roles.map(role => role.id)]) assert.equal(renderNext(emitted, state, role), renderNext(plan, fullState, role));
      for (const task of plan.tasks) {
        const clientTask = emitted.tasks.find(item => item.id === task.id);
        assert.equal(statusOf(clientTask, state, emitted), statusOf(task, fullState, plan));
        assert.deepEqual(dependenciesOf(clientTask, state, emitted), dependenciesOf(task, fullState, plan));
        assert.equal(renderDependencyLinks(clientTask, state, emitted), renderDependencyLinks(task, fullState, plan));
        assert.equal(renderTask(clientTask, state, emitted), renderTask(task, fullState, plan));
        assert.equal(navigationTarget(`task-${task.id}`, emitted), navigationTarget(`task-${task.id}`, plan));
        for (const checked of [true, false]) assert.deepEqual(transition(state, { type: 'task', id: task.id, checked }, emitted), transition(fullState, { type: 'task', id: task.id, checked }, plan));
      }
      for (const option of plan.options) assert.deepEqual(transition(state, { type: 'option', id: option.id, checked: !state.options[option.id] }, emitted), transition(fullState, { type: 'option', id: option.id, checked: !fullState.options[option.id] }, plan));
    }
  }
});

async function buildFixture() {
  const root = await mkdtemp(join(tmpdir(), 'atonota-delivery-'));
  try {
    await mkdir(join(root, 'scripts'));
    for (const file of clientFiles) await copyFile(new URL(file, source), join(root, file));
    for (const file of ['build.mjs', 'docs.mjs', 'page.mjs']) {
      try { await copyFile(new URL(`scripts/${file}`, source), join(root, 'scripts', file)); }
      catch (error) { if (file !== 'docs.mjs' || error.code !== 'ENOENT') throw error; }
    }
    const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return { root, output: join(root, 'site') };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

test('production HTML and every module dependency use the same content version', async t => {
  const fixture = await buildFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const html = await readFile(join(fixture.output, 'index.html'), 'utf8');
  const version = /styles\.css\?v=([a-f0-9]{12})/.exec(html)?.[1];
  assert.ok(version, 'stylesheet needs a content version so a normal reload cannot reuse the previous release');
  for (const file of ['app.mjs', 'favicon.svg']) assert.ok(html.includes(`./${file}?v=${version}`));
  for (const file of clientFiles.filter(file => file.endsWith('.mjs'))) {
    const module = await readFile(join(fixture.output, file), 'utf8');
    for (const [, path] of module.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
      assert.equal(new URL(path, 'https://example.test/plan/').searchParams.get('v'), version, `${file}: ${path}`);
    }
  }
  const manifest = JSON.parse(await readFile(join(fixture.output, 'build-manifest.json'), 'utf8'));
  assert.equal(manifest.contentVersion, version);
  assert.deepEqual(manifest.initialAssets.map(asset => asset.file).sort(), [...clientFiles].sort());
  assert.ok(manifest.initialAssets.every(asset => asset.sha256.length === 64 && asset.rawBytes > 0));
});

test('content version is deterministic and a changed asset invalidates the whole release graph', async t => {
  const fixture = await buildFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const manifestPath = join(fixture.output, 'build-manifest.json');
  const before = await readFile(manifestPath, 'utf8');
  const rerun = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture.root, encoding: 'utf8' });
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.equal(await readFile(manifestPath, 'utf8'), before);
  const { appendFile } = await import('node:fs/promises');
  await appendFile(join(fixture.root, 'styles.css'), '\n/* release-test */\n');
  const changed = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture.root, encoding: 'utf8' });
  assert.equal(changed.status, 0, changed.stderr);
  const after = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.notEqual(after.contentVersion, JSON.parse(before).contentVersion);
  const app = await readFile(join(fixture.output, 'app.mjs'), 'utf8');
  assert.ok(app.includes(`./model.mjs?v=${after.contentVersion}`));
});

test('build rejects relative module dependencies that cannot be delivered', async t => {
  const fixture = await buildFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const { appendFile } = await import('node:fs/promises');
  await appendFile(join(fixture.root, 'app.mjs'), '\nimport "./missing-feature.mjs";\n');
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture.root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Relative module dependency is not emitted: app\.mjs -> \.\/missing-feature\.mjs/);
});

test('person guide orders actual owned actions and explains a cross-person prerequisite', () => {
  const fixture = {
    date: '1 Ekim 2026',
    roles: [
      { id: 'sen', name: 'İsmail Karaca', description: 'Kodu hazırla.' },
      { id: 'cengiz', name: 'Hüseyin Cengiz', description: 'Kurulumu doğrula.' },
      { id: 'asistan', name: 'Asistan Hüseyin', description: 'DNS listesini uygula.' },
    ],
    phases: [{ id: 0, title: 'Hazırla', exit: 'Liste hazır.' }, { id: 1, title: 'Uygula', exit: 'Adres çalışıyor.' }],
    options: [{ id: 'form', title: 'Form ekle' }],
    projects: [],
    tasks: [
      { id: 'DNS', role: 'asistan', phase: 1, title: 'Kayıtları gir', steps: ['Verilen adı gir.', 'Cengiz’e sonucu gönder.'], output: 'Uygulanan liste', accept: 'Adres doğrulansın.', depends: ['PREP'] },
      { id: 'PREP', role: 'cengiz', phase: 0, title: 'DNS föyünü hazırla', output: 'Föy', accept: 'Değerler tam.', depends: [] },
      { id: 'FORM', role: 'asistan', phase: 0, title: 'Form kaydını gir', steps: ['Enter kaydını gir.'], output: 'DNS', accept: 'Doğrula.', depends: [], when: 'form' },
    ],
  };
  const guide = renderRoleGuide(fixture, 'asistan');
  assert.ok(guide.indexOf('## 01') < guide.indexOf('## 02'));
  assert.match(guide, /1\. Verilen adı gir\.\n2\. Cengiz’e sonucu gönder\./);
  assert.match(guide, /Başlamadan: \[PREP · DNS föyünü hazırla\].* — Hüseyin Cengiz/);
  assert.match(guide, /Koşul: Form ekle\. Bu kol açılmadıysa bu görev yapılmaz/);
  assert.doesNotMatch(guide, /### PREP/);
  assert.throws(() => renderRoleGuide(fixture, 'unknown'), /Unknown guide owner/);
  const general = renderGeneralGuide(fixture);
  assert.match(general, /DNS föyünü hazırla.* — Hüseyin Cengiz/);
  assert.match(general, /Kayıtları gir.* — Asistan Hüseyin/);
});

test('build emits separate readable person guides and one general guide, not an extra client bundle', async t => {
  const fixture = await buildFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  assert.deepEqual((await readdir(join(fixture.output, 'docs'))).sort(), [
    'asistan-huseyin.md', 'genel-yol.md', 'huseyin-cengiz.md', 'ismail-karaca.md',
  ]);
  const guide = await readFile(join(fixture.output, 'docs/asistan-huseyin.md'), 'utf8');
  assert.match(guide, /^# Asistan Hüseyin/m);
  assert.match(guide, /Kime ilet: Hüseyin Cengiz/);
  assert.match(guide, /İşi kapatmadan kontrol et:/);
  assert.match(guide, /Kayıtlı bilgi.*gerçek kurulum/s);
  const manifest = JSON.parse(await readFile(join(fixture.output, 'build-manifest.json'), 'utf8'));
  assert.equal(manifest.documents.length, 4);
  assert.ok(manifest.documents.every(document => document.delivery === 'on-demand'));
  assert.ok(manifest.initialAssets.every(asset => !asset.file.startsWith('docs/')));
});

test('browser receives only interactive render helpers, not the build-time page renderer', async t => {
  const fixture = await buildFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const renderer = await readFile(join(fixture.output, 'render.mjs'), 'utf8');
  assert.doesNotMatch(renderer, /renderPage|<!doctype html>|known-decisions|source-notes/);
  assert.match(renderer, /export function renderNext\(/);
  assert.match(renderer, /export function renderDependencyLinks\(/);
  assert.match(renderer, /export const statusLabels/);
  const manifest = JSON.parse(await readFile(join(fixture.output, 'build-manifest.json'), 'utf8'));
  const initialBytes = manifest.entry.rawBytes + manifest.initialAssets.reduce((bytes, asset) => bytes + asset.rawBytes, 0);
  assert.ok(initialBytes <= 200 * 1024, `initial delivery ${initialBytes} bytes exceeds 200 KiB`);
  assert.ok(manifest.initialAssets.every(asset => !asset.file.startsWith('scripts/')));
  assert.ok(!(await readdir(fixture.output)).includes('scripts'));
});

test('changed build-time page content versions the HTML and unchanged client modules together', async t => {
  const fixture = await buildFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const manifestPath = join(fixture.output, 'build-manifest.json');
  const before = JSON.parse(await readFile(manifestPath, 'utf8'));
  const pagePath = join(fixture.root, 'scripts/page.mjs');
  const page = await readFile(pagePath, 'utf8');
  assert.ok(page.includes('Teknik kaynaklar'));
  await writeFile(pagePath, page.replace('Teknik kaynaklar', 'Bağlantı kaynakları'));
  const changed = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture.root, encoding: 'utf8' });
  assert.equal(changed.status, 0, changed.stderr);
  const after = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.notEqual(after.contentVersion, before.contentVersion);
  const html = await readFile(join(fixture.output, 'index.html'), 'utf8');
  assert.ok(html.includes('Bağlantı kaynakları'));
  assert.ok(html.includes(`./app.mjs?v=${after.contentVersion}`));
  const app = await readFile(join(fixture.output, 'app.mjs'), 'utf8');
  assert.ok(app.includes(`./render.mjs?v=${after.contentVersion}`));
});
