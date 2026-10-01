import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../plan.mjs';
import { validatePlan, normalizeState, statusOf, transition } from '../model.mjs';
import { renderTask, renderDependencyLinks, escapeHTML } from '../render.mjs';
import { renderPage } from '../scripts/page.mjs';

test('actual plan has unique IDs, known roles/phases/options and an acyclic graph', () => {
  assert.deepEqual(validatePlan(plan), []);
  for (const task of plan.tasks) {
    assert.ok(plan.roles.some(role => role.id === task.role));
    assert.ok(plan.phases.some(phase => phase.id === task.phase));
    assert.ok(task.title && task.output && task.accept);
  }
});
test('each branch can finish and final acceptance waits for active optional work', () => {
  let state = normalizeState(null, plan);
  for (const option of plan.options) state = transition(state, { type: 'option', id: option.id, checked: true }, plan);
  for (let pass = 0; pass < plan.tasks.length; pass++) {
    for (const task of plan.tasks) {
      if (task.id !== 'U08') state = transition(state, { type: 'task', id: task.id, checked: true }, plan);
    }
  }
  assert.equal(state.completed.length, plan.tasks.length - 1);
  assert.equal(statusOf(plan.tasks.find(task => task.id === 'U08'), state, plan), 'ready');
  state = transition(state, { type: 'task', id: 'U08', checked: true }, plan);
  assert.equal(state.completed.length, plan.tasks.length);
  state = transition(state, { type: 'task', id: 'S01', checked: false }, plan);
  assert.equal(statusOf(plan.tasks.find(task => task.id === 'H05'), state, plan), 'waiting');
  assert.equal(statusOf(plan.tasks.find(task => task.id === 'U08'), state, plan), 'waiting');
});
test('static page has one ID for every internal destination, readable without JS', () => {
  const html = renderPage(plan);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `missing ${id}`);
  assert.match(html, /<html lang="tr">/);
  assert.match(html, /<noscript>/);
  assert.ok(plan.tasks.every(task => html.includes(task.title.replaceAll('→', '→'))));
});
test('rendering escapes untrusted strings; no third-party scripts or event attributes', () => {
  assert.equal(escapeHTML('<script>"\'&'), '&lt;script&gt;&quot;&#39;&amp;');
  const html = renderPage(plan);
  assert.doesNotMatch(html, /<script[^>]+src="https?:|\bonclick=|\bonerror=/);
});
test('flow and decision owners follow the shared role registry', () => {
  const renamed = {
    ...plan,
    roles: plan.roles.map(role => ({ ...role, name: role.id === 'sen' ? 'Karar ve geliştirme sahibi' : role.name })),
  };
  const html = renderPage(renamed);
  assert.ok(html.includes('Karar ve geliştirme sahibi · Claude iOS'));
  assert.ok(html.includes('Karar ve geliştirme sahibi: kurulum paketini teslim et.'));
  assert.ok(html.includes('Karar ve geliştirme sahibi: Linux ve uygulamalar için MCP’yi geliştir.'));
});
test('one Ismail roadmap owns decisions and development without losing task progress', () => {
  assert.deepEqual(plan.roles.map(role => role.id), ['sen', 'cengiz', 'asistan']);
  for (const id of ['U01', 'E01', 'E13', 'U08', 'F02', 'B02', 'N02']) {
    assert.equal(plan.tasks.find(task => task.id === id).role, 'sen', id);
  }
  assert.ok(plan.projects.every(project => project.owner !== 'ekip'));
  const completed = ['U01', 'U02', 'E01', 'E02'];
  const completionRevisions = Object.fromEntries(completed.map(id => [id, plan.tasks.find(task => task.id === id).revision ?? 1]));
  assert.deepEqual(new Set(normalizeState({ completed, completionRevisions }, plan).completed), new Set(completed));
  const html = renderPage(plan);
  assert.equal([...html.matchAll(/class="role-section"/g)].length, 3);
  assert.doesNotMatch(html, /id="role-ekip"|data-owner-filter="ekip"/);
});
test('DevOps CI waits for the installation package and old completion cannot skip it', () => {
  const previous = {
    completed: ['U01', 'U02', 'H01', 'U03', 'U05', 'E01', 'E02', 'E03', 'H02'],
    completionRevisions: Object.fromEntries(['U01', 'U02', 'H01', 'U03', 'U05', 'E01', 'E02', 'E03', 'H02'].map(id => [id, plan.tasks.find(task => task.id === id).revision ?? 1])),
  };
  let state = normalizeState(previous, plan);
  const ci = plan.tasks.find(task => task.id === 'H02');
  assert.equal(statusOf(ci, state, plan), 'waiting');
  assert.equal(state.completed.includes('H02'), false);
  state = transition(state, { type: 'task', id: 'E13', checked: true }, plan);
  assert.equal(statusOf(ci, state, plan), 'ready');
  state = transition(state, { type: 'task', id: 'H02', checked: true }, plan);
  assert.equal(statusOf(ci, state, plan), 'done');
});
test('known application routes and upstream repos are recorded, not requested again', () => {
  const expectedAddresses = {
    Workbench: 'wb.atonota.net',
    Pen: 'pen.atonota.net',
    'Open Design': 'wb.atonota.net/od',
    Penpot: 'wb.atonota.net/pp',
    Blender: 'wb.atonota.net/b3d',
    'Affinity Designer': 'wb.atonota.net/ad',
    'Storybook Beta / RC': 'wb.atonota.net/sbbeta · wb.atonota.net/sbrc',
  };
  for (const [name, address] of Object.entries(expectedAddresses)) {
    assert.equal(plan.projects.find(project => project.name === name).address, address, name);
  }
  assert.match(plan.projects.find(project => project.name === 'Open Design').repo, /https:\/\/github\.com\/nexu-io\/open-design/);
  assert.match(plan.projects.find(project => project.name === 'Penpot').repo, /https:\/\/github\.com\/penpot\/penpot/);
  const sourcePreparation = plan.tasks.find(task => task.id === 'E01');
  assert.match(sourcePreparation.output, /Hazır uygulama upstream/);
  assert.match(sourcePreparation.output, /karacaismail/);
  assert.match(sourcePreparation.accept, /Upstream yazarlığı\/lisansı korunur/);
});
test('pending business inventory and license do not block known Workbench preparation', () => {
  let state = normalizeState(null, plan);
  assert.deepEqual(state.completed, []);
  const sourcePreparation = plan.tasks.find(task => task.id === 'E01');
  const workbench = plan.tasks.find(task => task.id === 'E03');
  const license = plan.tasks.find(task => task.id === 'U02');
  assert.equal(statusOf(sourcePreparation, state, plan), 'ready');
  assert.equal(statusOf(license, state, plan), 'ready');
  assert.equal(statusOf(workbench, state, plan), 'waiting');
  state = transition(state, { type: 'task', id: 'E01', checked: true }, plan);
  assert.equal(statusOf(workbench, state, plan), 'ready');
  state = transition(state, { type: 'task', id: 'E03', checked: true }, plan);
  assert.deepEqual(new Set(state.completed), new Set(['E01', 'E03']));
  assert.equal(state.completed.includes('U01'), false);
  assert.equal(state.completed.includes('U02'), false);
  assert.equal(state.completed.includes('U05'), false);
});
test('license selection stays an explicit user task without repo arrangement approval', () => {
  const license = plan.tasks.find(task => task.id === 'U02');
  assert.match(plan.scope.later, /Şirket listesi.*bekletmez/);
  assert.match(license.title, /özgün kod.*lisans/);
  assert.doesNotMatch(license.title, /repo.*onayla/);
  assert.match(license.accept, /Public görünürlük lisans değildir/);
  assert.match(license.accept, /onaysız lisans seçme/);
});
test('original-code license remains a final acceptance gate, not a preparation gate', () => {
  let state = normalizeState(null, plan);
  for (let pass = 0; pass < plan.tasks.length; pass++) {
    for (const task of plan.tasks) {
      if (!['U02', 'U08'].includes(task.id)) state = transition(state, { type: 'task', id: task.id, checked: true }, plan);
    }
  }
  const acceptance = plan.tasks.find(task => task.id === 'U08');
  assert.equal(state.completed.includes('E03'), true);
  assert.equal(statusOf(acceptance, state, plan), 'waiting');
  state = transition(state, { type: 'task', id: 'U02', checked: true }, plan);
  assert.equal(statusOf(acceptance, state, plan), 'ready');
});
test('Workbench uses the separate declared dedicated server, leaving Frappe hosts untouched', () => {
  const inventory = plan.tasks.find(task => task.id === 'H01');
  const facts = plan.knownDecisions.find(decision => decision.label === 'Sunucu ayrı').text;
  assert.match(facts, /Dedicated AMD EPYC, 128 GB RAM kullanıcı beyanıdır/);
  assert.match(facts, /Kurulu dört press-\* Frappe sunucusu kapsam dışıdır/);
  assert.match(inventory.accept, /Frappe sunucusuna dokunulmaz/);
  assert.match(inventory.accept, /cloud teklif ekranı dedicated kanıtı değildir/);
  assert.match(inventory.steps.join(' '), /IP\/secret ve ham ekranı public plana koyma/);
});
test('technical actions use known decisions without asking Ismail to pick them again', () => {
  assert.equal(plan.tasks.find(task => task.id === 'U03').role, 'cengiz');
  assert.equal(plan.tasks.find(task => task.id === 'U05').role, 'cengiz');
  const brief = plan.tasks.find(task => task.id === 'U04');
  assert.match(brief.output, /Mobile-first lingerie product ecommerce home/);
  assert.match(brief.output, /sonuç URL/);
  assert.doesNotMatch(brief.title, /hedef.*seç|çıktı.*seç/);
  assert.match(plan.tasks.find(task => task.id === 'U05').output, /Windows\/Mac host/);
});
test('task output and acceptance are disclosed while status and dependencies stay visible', () => {
  const task = plan.tasks.find(task => task.id === 'E02');
  const html = renderTask(task, normalizeState(null, plan), plan);
  assert.match(html, /<details class="task-detail"[^>]*><summary>Teslim ve kontrol/);
  assert.doesNotMatch(html, /<details class="task-detail"[^>]*\bopen\b/);
  assert.match(html, /<\/details>\s*<div class="dependencies"/);
  assert.match(html, /data-task-status="E02"/);
  assert.match(html, /href="#task-E01"/);
});
test('flow diagram states and conditional branches derive from actual plan progress', () => {
  const initial = renderPage(plan);
  assert.match(initial, /<li[^>]*data-flow-task="E01"[^>]*data-status="ready"/);
  assert.match(initial, /data-flow-status="E01"/);
  for (const option of plan.options) {
    assert.match(initial, new RegExp(`class="branch-node"[^>]*data-branch="${option.id}"[^>]*hidden`));
  }
  let state = transition(normalizeState(null, plan), { type: 'task', id: 'E01', checked: true }, plan);
  state = transition(state, { type: 'option', id: 'form', checked: true }, plan);
  const progressed = renderPage(plan, state);
  assert.match(progressed, /data-flow-task="E01"[^>]*data-status="done"/);
  assert.match(renderTask(plan.tasks.find(task => task.id === 'E01'), state, plan), /data-status="done"/);
  assert.equal(statusOf(plan.tasks.find(task => task.id === 'E03'), state, plan), 'ready');
  assert.doesNotMatch(progressed, /class="branch-node"[^>]*data-branch="form"[^>]*hidden/);
  assert.match(progressed, /data-flow-task="F01"[^>]*data-status="ready"/);
  for (const [, id] of progressed.matchAll(/data-flow-task="([^"]+)"/g)) assert.ok(plan.tasks.some(task => task.id === id));
});
test('overview links to the real Workbench site and records known facts separately', () => {
  const html = renderPage(plan);
  assert.match(html, /class="overview-action" href="https:\/\/karacaismail\.github\.io\/atonota-workbench\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /class="known-decisions"/);
  assert.match(html, /Kurulu dört press-\* Frappe sunucusu kapsam dışıdır/);
  assert.doesNotMatch(html, /Şirket\/girişim listesi, domain sahipliği, lisans, erişim sınırları, ilk iş\/çıktı türü/);
});
test('branch map uses actual prerequisites, not adjacent same-phase tasks', () => {
  let state = transition(normalizeState(null, plan), { type: 'option', id: 'form', checked: true }, plan);
  const formBuild = plan.tasks.find(task => task.id === 'F02');
  const dnsApply = plan.tasks.find(task => task.id === 'FA01');
  const source = renderDependencyLinks(formBuild, state, plan);
  assert.match(source, /href="#task-F01"/);
  assert.match(source, /href="#task-E06"/);
  assert.doesNotMatch(source, /href="#task-FA01"|href="#task-FH01"/);
  assert.match(renderDependencyLinks(dnsApply, state, plan), /href="#task-FH01"/);
  state = transition(state, { type: 'task', id: 'F01', checked: true }, plan);
  assert.match(renderDependencyLinks(formBuild, state, plan), /İsmail Karaca · F01 · tamam<\/span><\/a>/);
  assert.match(renderPage(plan, state), /class="flow-list dependency-map"/);
});
test('old v1 decisions do not silently complete the new dedicated-server technical checks', () => {
  const legacy = {
    completed: ['U01', 'U02', 'A01', 'E01', 'E03', 'H01', 'U03', 'U04', 'U05', 'H03'],
    options: { form: true },
  };
  const state = normalizeState(legacy, plan);
  assert.deepEqual(new Set(state.completed), new Set(['U02', 'A01', 'E01']));
  assert.equal(state.options.form, true);
  for (const id of ['H01', 'U03', 'U04', 'U05']) {
    assert.equal(plan.tasks.find(task => task.id === id).revision, 3);
    assert.equal(state.completed.includes(id), false);
  }
  assert.equal(statusOf(plan.tasks.find(task => task.id === 'H03'), state, plan), 'waiting');
  let current = transition(state, { type: 'task', id: 'H01', checked: true }, plan);
  current = transition(current, { type: 'task', id: 'U03', checked: true }, plan);
  assert.equal(current.completionRevisions.H01, 3);
  assert.equal(current.completionRevisions.U03, 3);
  assert.equal(statusOf(plan.tasks.find(task => task.id === 'H03'), current, plan), 'waiting');
  for (const id of ['U01', 'E02', 'E03', 'E13']) {
    current = transition(current, { type: 'task', id, checked: true }, plan);
  }
  assert.equal(statusOf(plan.tasks.find(task => task.id === 'H03'), current, plan), 'ready');
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(current)), plan), current);
});
