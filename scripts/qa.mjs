import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const directory = fileURLToPath(new URL('../site/', import.meta.url));
const out = process.env.QA_DIR || fileURLToPath(new URL('../qa-results/', import.meta.url));
await mkdir(out, { recursive: true });
const allowed = new Set(['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'plan.mjs', 'render.mjs', 'favicon.svg']);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!allowed.has(file)) { response.writeHead(404); response.end(); return; }
  try {
    const data = await readFile(join(directory, file));
    response.setHeader('Content-Type', file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = process.env.QA_URL || `http://127.0.0.1:${server.address().port}/`;
const results = [];
const widths = [320,360,375,390,639,640,641,768,1023,1024,1025,1311,1312,1313,1440];

try {
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    const browser = await playwright[engine].launch(engine === 'chromium' ? { executablePath: playwright.chromium.executablePath() } : {});
    try {
      const context = await browser.newContext({ viewport: { width: 320, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      const badResponses = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
      page.on('request', request => requests.push(request.url()));
      await page.goto(url);
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${engine} overflow ${width}`);
        assert.equal(await page.locator('h1').count(), 1);
        if ([320,390,1440].includes(width)) await page.screenshot({ path: join(out, `${engine}-${width}.png`), fullPage: width === 1440 });
        results.push({ engine, viewport: `${width}x800`, input: 'touch + keyboard', layout: 'pass' });
      }
      await page.setViewportSize({ width: 320, height: 800 });
      await page.locator('.stage [href="#role-asistan-phase-2"]').click();
      await page.waitForFunction(() => document.querySelector('#role-asistan-phase-2').open);
      assert.equal(await page.locator('#role-asistan-phase-2').getAttribute('open'), '');
      assert.equal(await page.evaluate(() => document.activeElement.parentElement.id), 'role-asistan-phase-2');
      assert.equal(await page.locator('[data-complete="A02"]').isDisabled(), true);
      await page.locator('#genel [href="#role-sen-phase-0"]').click();
      const first = page.locator('[data-complete="U01"]');
      await first.focus();
      await page.keyboard.press('Space');
      assert.equal(await first.isChecked(), true);
      assert.equal(await page.locator('[data-complete="U02"]').isDisabled(), false);
      await page.locator('[data-complete="U02"]').check();
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      assert.equal(await first.isChecked(), true);
      assert.equal(await page.locator('[data-complete="U02"]').isChecked(), true);
      await first.uncheck();
      assert.equal(await page.locator('[data-complete="U02"]').isChecked(), false);
      assert.equal(await page.locator('[data-complete="U02"]').isDisabled(), true);
      await page.locator('[data-option="form"]').check();
      assert.equal(await page.locator('#task-F01').getAttribute('hidden'), null);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.option), 'form');
      await page.locator('[data-option="form"]').uncheck();
      assert.equal(await page.locator('#task-F01').getAttribute('hidden'), '');
      await page.locator('#genel [href="#role-sen-phase-0"]').click();
      const target = page.locator('[data-complete="U04"]');
      await target.check(); await target.focus();
      await page.setViewportSize({ width: 844, height: 390 });
      assert.equal(await page.evaluate(() => document.activeElement.dataset.complete), 'U04');
      assert.equal(await target.isChecked(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const focus = await target.evaluate(element => {
        const style = getComputedStyle(element);
        const parent = getComputedStyle(element.closest('.task'));
        return { outline: style.outlineWidth, parentOutline: parent.outlineWidth, target: element.closest('label').getBoundingClientRect().height };
      });
      assert.ok(focus.target >= 44);
      await page.screenshot({ path: join(out, `${engine}-landscape.png`) });
      const reset = page.locator('#reset-progress');
      await reset.click(); await page.keyboard.press('Escape');
      assert.equal(await reset.textContent(), 'Yerel işaretleri sıfırla');
      assert.equal(await target.isChecked(), true);
      await reset.click(); await reset.click();
      assert.equal(await target.isChecked(), false);
      await page.locator('[data-owner-filter="sen"]').click();
      assert.equal(await page.locator('[data-owner-filter="sen"]').getAttribute('aria-pressed'), 'true');
      assert.ok((await page.locator('#next-actions .next-meta').allTextContents()).every(text => text.includes('Sen')));
      await page.evaluate(() => localStorage.setItem('atonota-action-plan:v1', '{broken'));
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      assert.equal(await target.isChecked(), false);
      assert.match(await page.locator('#storage-note').textContent(), /kullanılamadı/);
      const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(errors, []);
      assert.deepEqual(badResponses, []);
      assert.ok(requests.every(request => new URL(request).origin === new URL(url).origin));
      const bytes = (await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, bytes: entry.encodedBodySize }))));
      results.push({ engine, interactions: 'pass', focus, resources: bytes, scriptErrors: errors, networkErrors: badResponses, physicalDevice: 'not_run' });
      await context.close();
      const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
      const staticPage = await noJS.newPage(); await staticPage.goto(url);
      assert.ok(await staticPage.locator('.task').count() > 30);
      assert.equal(await staticPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      results.push({ engine, noJavaScript: 'pass' });
      await noJS.close();
    } finally { await browser.close(); }
  }
  const files = await Promise.all([...allowed].map(async file => ({ file, bytes: (await stat(join(directory, file))).size })));
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  assert.ok(total <= 200 * 1024, `Raw delivered page+assets exceed 200KiB: ${total}`);
  await writeFile(join(out, 'results.json'), JSON.stringify({ url, version: require(`${process.env.PLAYWRIGHT_PATH || 'playwright'}/package.json`).version, node: process.version, rawBytes: total, files, results, physicalDevices: 'not_run', screenReader: 'not_run' }, null, 2));
  console.log(JSON.stringify({ result: 'pass', cases: results.length, rawBytes: total, evidence: out }));
} finally { await new Promise(resolve => server.close(resolve)); }
