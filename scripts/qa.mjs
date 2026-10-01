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
    console.log(`QA ${engine}: 320-first layout and critical journey`);
    const browser = await playwright[engine].launch(engine === 'chromium' ? { executablePath: playwright.chromium.executablePath() } : {});
    try {
      const context = await browser.newContext({ viewport: { width: 320, height: 800 }, hasTouch: true, reducedMotion: 'reduce', locale: 'tr-TR', timezoneId: 'Europe/Istanbul', deviceScaleFactor: 1, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      const badResponses = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
      page.on('request', request => requests.push(request.url()));
      await page.goto(url);
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      const coldResources = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map(entry => ({ name: entry.name, encodedBytes: entry.encodedBodySize, transferBytes: entry.transferSize })));
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${engine} overflow ${width}`);
        assert.equal(await page.locator('h1').count(), 1);
        if ([320,390,1440].includes(width)) await page.screenshot({ path: join(out, `${engine}-${width}.png`), fullPage: width === 1440 });
        results.push({ engine, viewport: `${width}x800`, input: 'touch + keyboard', layout: 'pass' });
      }
      for (const viewport of [{width:320,height:480},{width:320,height:568},{width:480,height:320},{width:568,height:320},{width:1024,height:559},{width:1024,height:560},{width:1024,height:561}]) {
        await page.setViewportSize(viewport);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${engine} short viewport ${JSON.stringify(viewport)}`);
        results.push({ engine, viewport, shortHeight: 'pass', capabilities: await page.evaluate(() => ({ coarse:matchMedia('(any-pointer:coarse)').matches, fine:matchMedia('(any-pointer:fine)').matches, hover:matchMedia('(hover:hover)').matches })) });
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
      const focusStyle = await first.evaluate(element => ({ outline:getComputedStyle(element).outlineWidth, outlineStyle:getComputedStyle(element).outlineStyle, parent:getComputedStyle(element.closest('.task')).outlineWidth, parentStyle:getComputedStyle(element.closest('.task')).outlineStyle, shadow:getComputedStyle(element).boxShadow }));
      assert.equal(focusStyle.outline, '2px');
      assert.equal(focusStyle.outlineStyle, 'solid');
      assert.equal(focusStyle.parentStyle, 'none');
      assert.equal(focusStyle.shadow, 'none');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.complete), 'U01');
      await page.locator('[data-complete="U02"]').check();
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      assert.equal(await first.isChecked(), true);
      assert.equal(await page.locator('[data-complete="U02"]').isChecked(), true);
      await first.uncheck();
      assert.equal(await page.locator('[data-complete="U02"]').isChecked(), false);
      assert.equal(await page.locator('[data-complete="U02"]').isDisabled(), true);
      await page.locator('[data-option="form"]').focus();
      await page.keyboard.press('Space');
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
      // Real same-origin second tab update must not detach a focused owner chip.
      const ownerChip = page.locator('[data-phase="0"] [href="#role-cengiz-phase-0"]');
      await ownerChip.focus();
      const peer = await context.newPage();
      await peer.goto(url);
      await peer.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      await peer.locator('[data-complete="U01"]').check();
      await page.waitForFunction(() => document.querySelector('[data-complete="U01"]').checked);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#role-cengiz-phase-0');
      await peer.close();
      await page.locator('#rail-menu summary').click();
      await page.locator('.rail [href="#role-cengiz"]').click();
      assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
      assert.equal(await page.evaluate(() => document.activeElement.closest('.role-section').id), 'role-cengiz');
      const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(errors, []);
      assert.deepEqual(badResponses, []);
      assert.ok(requests.every(request => new URL(request).origin === new URL(url).origin));
      const bytes = (await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, bytes: entry.encodedBodySize }))));
      results.push({ engine, browserVersion:browser.version(), os:process.platform, interactions: 'pass', focus, keyboardFocus:focusStyle, coldResources, warmResources:bytes, scriptErrors: errors, networkErrors: badResponses, physicalDevice: 'not_run' });
      await context.close();
      const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
      const staticPage = await noJS.newPage(); await staticPage.goto(url);
      assert.ok(await staticPage.locator('.task').count() > 30);
      assert.equal(await staticPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      results.push({ engine, noJavaScript: 'pass' });
      await noJS.close();
      const blocked = await browser.newContext({ viewport: { width: 320, height: 800 } });
      await blocked.addInitScript(() => {
        Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('Blocked for regression', 'QuotaExceededError'); } });
      });
      const blockedPage = await blocked.newPage();
      await blockedPage.goto(url);
      await blockedPage.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      await blockedPage.locator('[data-complete="U01"]').check();
      assert.equal(await blockedPage.locator('[data-complete="U01"]').isChecked(), true);
      assert.match(await blockedPage.locator('#feedback').textContent(), /kalıcı kayıt başarısız/);
      assert.doesNotMatch(await blockedPage.locator('#feedback').textContent(), /ilerleme kaydedildi/);
      await blocked.close();
      results.push({ engine, failedStorageWrite: 'pass', crossTabFocus: 'pass', closedRoleNavigation: 'pass' });
      for (const width of [320,1440]) {
        const fineContext = await browser.newContext({ viewport:{width,height:800},hasTouch:false,reducedMotion:'reduce',locale:'tr-TR',deviceScaleFactor:1,serviceWorkers:'block' });
        const finePage = await fineContext.newPage(); await finePage.goto(url);
        await finePage.waitForFunction(() => !document.querySelector('[data-option]').disabled);
        const capabilities = await finePage.evaluate(() => ({ coarse:matchMedia('(any-pointer:coarse)').matches,fine:matchMedia('(any-pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches }));
        assert.equal(capabilities.fine,true); assert.equal(capabilities.coarse,false);
        const firstTask = finePage.locator('[data-complete="U01"]');
        await firstTask.focus(); await finePage.keyboard.press('Space');
        assert.equal(await firstTask.isChecked(),true);
        for(const selector of ['.task-check','[data-option="form"]','[data-phase="0"] .owner-link']) {
          const target = finePage.locator(selector).first();
          const dimensions = await target.evaluate(element => (element.matches('input') ? element.closest('label') : element).getBoundingClientRect().toJSON());
          const minimum = capabilities.coarse ? 48 : 44;
          assert.ok(dimensions.height >=minimum && dimensions.width >=minimum, `${engine} critical hit area ${selector}`);
        }
        if(width===1440) {
          await finePage.screenshot({path:join(out,`${engine}-desktop-top.png`)});
          await finePage.locator('#akislar').scrollIntoViewIfNeeded();
          await finePage.screenshot({path:join(out,`${engine}-desktop-flows.png`)});
        }
        results.push({engine,width,input:'precision + keyboard',capabilities,criticalJourney:'pass'});
        await fineContext.close();
      }
    } finally { await browser.close(); }
  }
  const files = await Promise.all([...allowed].map(async file => ({ file, bytes: (await stat(join(directory, file))).size })));
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  assert.ok(total <= 200 * 1024, `Raw delivered page+assets exceed 200KiB: ${total}`);
  await writeFile(join(out, 'results.json'), JSON.stringify({ url, version: require(`${process.env.PLAYWRIGHT_PATH || 'playwright'}/package.json`).version, node: process.version, rawBytes: total, files, results, physicalDevices: 'not_run', screenReader: 'not_run' }, null, 2));
  console.log(JSON.stringify({ result: 'pass', cases: results.length, rawBytes: total, evidence: out }));
} finally { await new Promise(resolve => server.close(resolve)); }
