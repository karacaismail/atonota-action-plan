import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { platform, release, arch } from 'node:os';
import { plan } from '../plan.mjs';
import { verifyThemes } from './theme-qa.mjs';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const directory = fileURLToPath(new URL('../site/', import.meta.url));
const out = process.env.QA_DIR || fileURLToPath(new URL('../qa-results/', import.meta.url));
await mkdir(out, { recursive: true });
const allowed = new Set(['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'plan.mjs', 'render.mjs', 'favicon.svg']);
const guides = ['ismail-karaca', 'huseyin-cengiz', 'asistan-huseyin', 'genel-yol'].map(name => `docs/${name}.md`);
const served = new Set([...allowed, ...guides, 'build-manifest.json']);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!served.has(file)) { response.writeHead(404); response.end(); return; }
  try {
    const data = await readFile(join(directory, file));
    response.setHeader('Content-Type', file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.md') ? 'text/markdown; charset=utf-8' : file.endsWith('.json') ? 'application/json' : 'text/html');
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = process.env.QA_URL || `http://127.0.0.1:${server.address().port}/`;
const results = [];
const browserVersions = {};
const startedAt = new Date().toISOString();
const localManifest = JSON.parse(await readFile(join(directory, 'build-manifest.json'), 'utf8'));
const widths = [320,360,375,390,639,640,641,768,1023,1024,1025,1311,1312,1313,1440];
const stylesheet = await readFile(join(directory, 'styles.css'), 'utf8');
const flowBoundaryRem = Number(/@container flow \(min-width: ([\d.]+)rem\)/u.exec(stylesheet)?.[1]);
assert.ok(flowBoundaryRem > 0, 'flow breakpoint must come from the shipped stylesheet');

try {
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    console.log(`QA ${engine}: 320-first layout and critical journey`);
    const browser = await playwright[engine].launch(engine === 'chromium' ? { executablePath: playwright.chromium.executablePath() } : {});
    browserVersions[engine] = browser.version();
    try {
      const context = await browser.newContext({ viewport: { width: 320, height: 800 }, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce', locale: 'tr-TR', timezoneId: 'Europe/Istanbul', deviceScaleFactor: 1, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      const badResponses = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
      page.on('request', request => requests.push(request.url()));
      await page.goto(url);
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      assert.equal(await page.locator('.role-shortcut').count(), 3, `${engine} direct personal journeys`);
      for (const role of plan.roles) {
        const shortcut = page.locator(`.role-shortcut[href="#role-${role.id}"]`);
        const dimensions = await shortcut.boundingBox();
        assert.ok(dimensions.width >= 48 && dimensions.height >= 48, `${engine} personal journey touch area`);
        await shortcut.click();
        assert.equal(await page.evaluate(() => document.activeElement.closest('.role-section')?.id), `role-${role.id}`);
        assert.equal(await page.locator('.rail-link[aria-current="location"]').getAttribute('href'), `#role-${role.id}`);
      }
      await page.locator('.overview-action[href="#simdi"]').click();
      assert.equal(await page.locator('.rail-link[aria-current="location"]').getAttribute('href'), '#simdi');
      await page.evaluate(() => { location.hash = '#main'; });
      await page.waitForFunction(() => document.activeElement.getAttribute('href') === '#simdi');
      assert.equal(await page.locator('#plan-progress').getAttribute('value'), '0');
      results.push({ engine, personalShortcuts: 'pass', currentURLNavigation: 'pass', accessibleLocalProgress: 'pass' });
      assert.equal(await page.locator('#heading-sen').textContent(), 'İsmail Karaca');
      assert.equal(await page.locator('.role-section').count(), 3);
      assert.equal(await page.locator('main').getAttribute('tabindex'), null);
      assert.equal(await page.locator('#heading-ekip, [data-owner-filter="ekip"]').count(), 0);
      assert.equal(await page.locator('#role-sen #task-U01, #role-sen #task-E13').count(), 2);
      assert.match(await page.locator('#role-sen > p').textContent(), /Codex ve Claude Code/);
      assert.equal(await page.getByRole('link', { name: 'Sen', exact: true }).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Geliştirme ekibi', exact: true }).count(), 0);
      assert.equal(await page.locator('#akislar > .flow').count(), 4);
      assert.equal(await page.locator('#detail-U01').getAttribute('open'), null);
      assert.equal(await page.locator('#meta-U01').isVisible(), false);
      assert.equal(await page.locator('#task-U01 .task-steps').isVisible(), true);
      assert.ok(await page.locator('#task-U01 .task-steps li').count() >= 2);
      const readableSteps = await page.locator('#task-U01 .task-steps').evaluate(element => ({ fontSize: parseFloat(getComputedStyle(element).fontSize), width: element.getBoundingClientRect().width, taskWidth: element.closest('.task').getBoundingClientRect().width }));
      assert.ok(readableSteps.fontSize >= 16 && readableSteps.width >= readableSteps.taskWidth - 32, `${engine} 320px full-width reading steps`);
      assert.match(await page.locator('#task-U01 .task-title').textContent(), /PoC/);
      assert.equal(await page.locator('[data-option="blenderCloud"]').count(), 0);
      assert.match(await page.locator('.project').filter({ hasText: 'wb.atonota.net/b3d' }).textContent(), /Sürüyor|sürüyor|devam/);
      for (const file of guides) {
        assert.equal(await page.locator(`a[href^="./${file}"][download]`).count(), 1, `${engine} guide download ${file}`);
        const response = await page.request.get(new URL(file, url).href);
        assert.equal(response.status(), 200, file);
        const guide = await response.text();
        if (file === 'docs/genel-yol.md') {
          assert.ok(guide.includes('DNS akışı:') && guide.includes('Aşama bittiğinde:'), `${engine} general guide has the handoff and phase exits`);
        } else {
          assert.ok(guide.includes('Teslim:') && guide.includes('Kime ilet:') && guide.includes('İşi kapatmadan kontrol et:'), `${engine} person guide has actionable delivery and acceptance`);
        }
      }
      await page.locator('#detail-U01 > summary').click();
      assert.equal(await page.locator('#meta-U01').isVisible(), true);
      await page.locator('#detail-U01 > summary').click();
      assert.equal(await page.locator('#meta-U01').isVisible(), false);
      assert.equal(await page.locator('#akislar [data-flow-task="E01"]').getAttribute('data-status'), 'ready');
      assert.equal(await page.locator('[data-branch="form"]').isVisible(), false);
      await page.evaluate(() => scrollTo({ top:0, behavior:'instant' }));
      await page.screenshot({ path: join(out, `${engine}-mobile-top.png`) });
      const coldResources = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map(entry => ({ name: entry.name, encodedBytes: entry.encodedBodySize, transferBytes: entry.transferSize })));
      assert.equal(coldResources.some(resource => new URL(resource.name).pathname.includes('/docs/')), false, `${engine} guides are on-demand`);
      const manifestResponse = await page.request.get(new URL('build-manifest.json', url).href);
      assert.equal(manifestResponse.status(), 200);
      const manifest = await manifestResponse.json();
      assert.equal(manifest.contentVersion, localManifest.contentVersion, `${engine} serves the current built release`);
      const versionedRequests = coldResources.filter(resource => /\.(mjs|css|svg)$/.test(new URL(resource.name).pathname));
      assert.ok(versionedRequests.length >= 5);
      assert.ok(versionedRequests.every(resource => new URL(resource.name).searchParams.get('v') === manifest.contentVersion), `${engine} one release version across all client assets`);
      await page.keyboard.press('Tab');
      // WebKit's default link tabbing policy differs; test activation from the
      // actual skip control without pretending to cover real Safari settings.
      await page.locator('.skip-link').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => location.hash), '#main');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#simdi');
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        if (overflow) {
          const diagnostics = await page.evaluate(() => ({ viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].map(element=>{ const bounds=element.getBoundingClientRect();const style=getComputedStyle(element);return {tag:element.tagName,id:element.id,class:element.className,text:element.textContent.slice(0,140),left:bounds.left,right:bounds.right,width:bounds.width,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,font:style.fontFamily,minWidth:style.minWidth,display:style.display}; }).filter(element=>element.right>innerWidth || element.left<0).slice(0,50) }));
          await writeFile(join(out,`${engine}-overflow-${width}.json`),JSON.stringify(diagnostics,null,2));
          await page.screenshot({path:join(out,`${engine}-overflow-${width}.png`),fullPage:true});
          console.error(JSON.stringify(diagnostics));
        }
        assert.equal(overflow, false, `${engine} overflow ${width}`);
        assert.equal(await page.locator('h1').count(), 1);
        const gutters = await page.locator('#role-sen .role-heading, #role-sen > p, #role-sen .role-phase > summary, #role-sen #task-U01').evaluateAll(elements => elements.map(element => ({ left:parseFloat(getComputedStyle(element).paddingLeft), right:parseFloat(getComputedStyle(element).paddingRight) })));
        assert.ok(gutters.every(gutter => gutter.left >= 12 && gutter.right >= 12), `${engine} role surface gutters ${width}`);
        if ([320,390,1440].includes(width)) await page.screenshot({ path: join(out, `${engine}-${width}.png`), fullPage: width === 1440 });
        results.push({ engine, viewport: `${width}x800`, input: 'touch + keyboard', layout: 'pass' });
      }
      for (const viewport of [{width:320,height:480},{width:320,height:568},{width:480,height:320},{width:568,height:320},{width:1024,height:559},{width:1024,height:560},{width:1024,height:561}]) {
        await page.setViewportSize(viewport);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${engine} short viewport ${JSON.stringify(viewport)}`);
        results.push({ engine, viewport, shortHeight: 'pass', capabilities: await page.evaluate(() => ({ coarse:matchMedia('(any-pointer:coarse)').matches, fine:matchMedia('(any-pointer:fine)').matches, hover:matchMedia('(hover:hover)').matches })) });
      }
      // Exercise N-1/N/N+1 of the actual content container, not a device label.
      await page.setViewportSize({ width: 1440, height: 800 });
      const flow = page.locator('#akislar > .flow').last();
      const flowLink = flow.locator('.flow-step a').first();
      await flowLink.focus();
      const flowState = await flow.locator('[data-flow-status]').allTextContents();
      const boundary = flowBoundaryRem * await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      for (const delta of [-1, 0, 1]) {
        const evidence = await flow.evaluate((element, contentWidth) => {
          const style = getComputedStyle(element);
          element.style.inlineSize = `${contentWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)}px`;
          const list = element.querySelector('.flow-list');
          const bounds = list.getBoundingClientRect();
          return { contentWidth: bounds.width, direction: getComputedStyle(list).gridAutoFlow, overflow: list.scrollWidth > list.clientWidth,
            nodes: [...list.children].map(node => { const box = node.getBoundingClientRect(); return {left:box.left, right:box.right}; }), left:bounds.left, right:bounds.right,
            hitAreas: [...list.querySelectorAll('a')].map(link => { const box = link.getBoundingClientRect(); return {width:box.width,height:box.height}; }),
            focusHref: document.activeElement.getAttribute('href'), minimum: matchMedia('(any-pointer:coarse)').matches ? 48 : 44 };
        }, boundary + delta);
        assert.equal(evidence.direction, delta < 0 ? 'row' : 'column', `${engine} content flow direction ${delta}`);
        assert.equal(evidence.overflow, false, `${engine} container flow overflow ${delta}`);
        assert.ok(evidence.nodes.every(node => node.left >= evidence.left - 1 && node.right <= evidence.right + 1));
        assert.ok(evidence.hitAreas.every(area => area.width >= evidence.minimum && area.height >= evidence.minimum), `${engine} flow controls preserve hit areas ${delta}`);
        assert.equal(evidence.focusHref, await flowLink.getAttribute('href'));
        assert.deepEqual(await flow.locator('[data-flow-status]').allTextContents(), flowState);
        results.push({ engine, flowContainerBoundary: boundary + delta, contentDrivenLayout: 'pass', evidence });
      }
      await flow.evaluate(element => element.style.removeProperty('inline-size'));
      await page.setViewportSize({ width: 320, height: 800 });
      await page.locator('.stage [href="#role-sen-phase-1"]').click();
      assert.equal(await page.locator('#role-sen-phase-1').getAttribute('open'), '');
      assert.equal(await page.evaluate(() => document.activeElement.parentElement.id), 'role-sen-phase-1');
      // Shared development links keep working after owner consolidation.
      await page.goto(`${url}#role-ekip-phase-1`);
      await page.waitForFunction(() => location.hash === '#role-sen-phase-1');
      assert.equal(await page.locator('#role-sen-phase-1').getAttribute('open'), '');
      assert.equal(await page.evaluate(() => document.activeElement.parentElement.id), 'role-sen-phase-1');
      const sectionFrames = await page.locator('main, #kisiler, #role-sen, #role-sen-phase-1').evaluateAll(elements => elements.map(element => { const style=getComputedStyle(element); return { outline:style.outlineStyle,left:parseFloat(style.borderLeftWidth),right:parseFloat(style.borderRightWidth),shadow:style.boxShadow }; }));
      assert.ok(sectionFrames.every(frame => frame.outline === 'none' && frame.left === 0 && frame.right === 0 && frame.shadow === 'none'), `${engine} no section-wide frame`);
      assert.match(await page.locator('#task-E13').textContent(), /linux\/amd64/);
      await page.screenshot({ path: join(out, `${engine}-vibecoding-320.png`) });
      await page.locator('#rail-menu summary').click();
      await page.screenshot({ path: join(out, `${engine}-people-320.png`) });
      await page.locator('#rail-menu summary').click();
      await page.locator('.stage [href="#role-asistan-phase-2"]').click();
      await page.waitForFunction(() => document.querySelector('#role-asistan-phase-2').open);
      assert.equal(await page.locator('#role-asistan-phase-2').getAttribute('open'), '');
      assert.equal(await page.evaluate(() => document.activeElement.parentElement.id), 'role-asistan-phase-2');
      assert.equal(await page.locator('[data-complete="A02"]').isDisabled(), true);
      await page.locator('#genel .stage [href="#role-sen-phase-0"]').click();
      assert.equal(await page.locator('[data-complete="U02"]').isDisabled(), false);
      assert.equal(await page.locator('[data-complete="E01"]').isDisabled(), false);
      const first = page.locator('[data-complete="U01"]');
      await first.focus();
      await page.keyboard.press('Space');
      assert.equal(await first.isChecked(), true);
      assert.equal(await page.locator('#plan-progress').getAttribute('value'), '1');
      assert.match(await page.locator('[data-progress-label]').textContent(), /^1 \/ /);
      assert.equal(await page.locator('[data-complete="U02"]').isDisabled(), false);
      // Acquire focus by real keyboard navigation; programmatic focus after a mouse
      // click is not focus-visible in every engine.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.complete), 'U01');
      const focusStyle = await first.evaluate(element => ({ outline:getComputedStyle(element).outlineWidth, outlineStyle:getComputedStyle(element).outlineStyle, parent:getComputedStyle(element.closest('.task')).outlineWidth, parentStyle:getComputedStyle(element.closest('.task')).outlineStyle, shadow:getComputedStyle(element).boxShadow }));
      assert.equal(focusStyle.outline, '2px');
      assert.equal(focusStyle.outlineStyle, 'solid');
      assert.equal(focusStyle.parentStyle, 'none');
      assert.equal(focusStyle.shadow, 'none');
      await page.locator('[data-complete="U02"]').check();
      if (await page.locator('#role-sen-phase-1').getAttribute('open') === null) await page.locator('#role-sen-phase-1 > summary').click();
      await page.locator('[data-complete="E01"]').check();
      assert.equal(await page.locator('#akislar [data-flow-task="E01"]').getAttribute('data-status'), 'done');
      assert.equal(await page.locator('#akislar [data-flow-status="E01"]').textContent(), 'Tamamlandı');
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      assert.equal(await first.isChecked(), true);
      assert.equal(await page.locator('[data-complete="U02"]').isChecked(), true);
      assert.equal(await page.locator('[data-complete="E01"]').isChecked(), true);
      await page.evaluate(() => { location.hash = '#role-ekip'; });
      await page.waitForFunction(() => location.hash === '#role-sen');
      assert.equal(await page.evaluate(() => document.activeElement.closest('.role-section').id), 'role-sen');
      assert.equal(await page.locator('#role-ekip').count(), 0);
      await first.uncheck();
      assert.equal(await page.locator('[data-complete="U02"]').isChecked(), true);
      assert.equal(await page.locator('[data-complete="U02"]').isDisabled(), false);
      assert.equal(await page.locator('[data-complete="E01"]').isChecked(), true);
      assert.equal(await page.locator('[data-complete="E03"]').isDisabled(), false);
      await page.locator('[data-option="form"]').focus();
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#plan-progress').getAttribute('max'), String(plan.tasks.filter(task => !task.when || task.when === 'form').length));
      assert.equal(await page.locator('#task-F01').getAttribute('hidden'), null);
      assert.equal(await page.locator('[data-branch="form"]').isVisible(), true);
      const formDependencies = page.locator('[data-flow-dependencies="F02"] a');
      assert.deepEqual(await formDependencies.evaluateAll(elements => elements.map(element => element.getAttribute('href'))), ['#task-F01', '#task-E06']);
      const misleadingArrows = await page.locator('.dependency-map > li').evaluateAll(elements => elements.map(element => ({before:getComputedStyle(element,'::before').content,after:getComputedStyle(element,'::after').content})));
      assert.ok(misleadingArrows.every(styles => ['none','normal'].includes(styles.before) && ['none','normal'].includes(styles.after)), `${engine} parallel branches must not imply adjacent dependencies`);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.option), 'form');
      await page.locator('[data-option="form"]').uncheck();
      assert.equal(await page.locator('#task-F01').getAttribute('hidden'), '');
      assert.equal(await page.locator('[data-branch="form"]').isVisible(), false);
      await page.locator('#genel .stage [href="#role-sen-phase-0"]').click();
      const target = page.locator('[data-complete="U04"]');
      await target.check(); await target.focus();
      await page.setViewportSize({ width: 844, height: 390 });
      assert.equal(await page.evaluate(() => document.activeElement.dataset.complete), 'U04');
      assert.equal(await target.isChecked(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const focus = await target.evaluate(element => {
        const style = getComputedStyle(element);
        const parent = getComputedStyle(element.closest('.task'));
        const bounds = element.closest('label').getBoundingClientRect();
        return { outline: style.outlineWidth, parentOutline: parent.outlineWidth, target: bounds.height, width: bounds.width, coarse: matchMedia('(any-pointer:coarse)').matches };
      });
      const touchMinimum = focus.coarse ? 48 : 44;
      assert.ok(focus.target >= touchMinimum && focus.width >= touchMinimum);
      await page.screenshot({ path: join(out, `${engine}-landscape.png`) });
      const reset = page.locator('#reset-progress');
      await reset.click(); await page.keyboard.press('Escape');
      assert.equal(await reset.textContent(), 'Yerel işaretleri sıfırla');
      assert.equal(await target.isChecked(), true);
      await reset.click(); await reset.click();
      assert.equal(await target.isChecked(), false);
      await page.locator('[data-owner-filter="sen"]').click();
      assert.equal(await page.locator('[data-owner-filter="sen"]').getAttribute('aria-pressed'), 'true');
      assert.ok((await page.locator('#next-actions .next-meta').allTextContents()).every(text => text.includes('İsmail Karaca')));
      await page.evaluate(() => localStorage.setItem('atonota-action-plan:v1', '{broken'));
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      assert.equal(await target.isChecked(), false);
      assert.match(await page.locator('#storage-note').textContent(), /kullanılamadı/);
      // Reload restores the hash on the next animation frame after controls enable.
      // Finish that navigation before establishing the focus tested across tabs.
      assert.equal(await page.evaluate(() => location.hash), '#role-sen-phase-0');
      await page.waitForFunction(() => document.activeElement.tagName === 'SUMMARY' && document.activeElement.parentElement.id === 'role-sen-phase-0');
      // Real same-origin second tab update must not detach a focused owner chip.
      const ownerChip = page.locator('[data-phase="0"] [href="#role-cengiz-phase-0"]');
      const peer = await context.newPage();
      await peer.goto(url);
      await peer.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      await ownerChip.focus();
      assert.equal(await ownerChip.evaluate(element => element === document.activeElement), true);
      await peer.locator('[data-complete="U01"]').check();
      await page.waitForFunction(() => document.querySelector('[data-complete="U01"]').checked);
      const crossTabFocus = await page.evaluate(() => ({ hash:location.hash, tag:document.activeElement.tagName, id:document.activeElement.id, href:document.activeElement.getAttribute('href'), phase:document.activeElement.closest('[data-role-phase]')?.id ?? null }));
      if (crossTabFocus.href !== '#role-cengiz-phase-0') await writeFile(join(out,`${engine}-cross-tab-focus.json`),JSON.stringify(crossTabFocus,null,2));
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#role-cengiz-phase-0');
      if (await page.locator('#role-sen-phase-1').getAttribute('open') === null) await page.locator('#role-sen-phase-1 > summary').click();
      const dependency = page.locator('#task-E02 .dependency-link').first();
      await dependency.focus();
      await peer.locator('[data-complete="U04"]').check();
      await page.waitForFunction(() => document.querySelector('[data-complete="U04"]').checked);
      assert.equal(await page.evaluate(() => document.activeElement.closest('[data-task]')?.id), 'task-E02');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#task-E01');
      // Another tab closing a conditional branch returns focus to its own toggle.
      await page.locator('[data-option="form"]').check();
      await peer.waitForFunction(() => document.querySelector('[data-option="form"]').checked);
      await formDependencies.first().focus();
      await peer.locator('[data-option="form"]').uncheck();
      await page.waitForFunction(() => !document.querySelector('[data-option="form"]').checked);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.option), 'form');
      assert.equal(await page.locator('[data-branch="form"]').isVisible(), false);
      await peer.close();
      await page.setViewportSize({ width: 320, height: 800 });
      await page.locator('#rail-menu summary').click();
      await page.locator('.rail [href="#role-cengiz"]').click();
      assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
      assert.equal(await page.evaluate(() => document.activeElement.closest('.role-section').id), 'role-cengiz');
      if (await page.locator('#role-cengiz-phase-0').getAttribute('open') === null) await page.locator('#role-cengiz-phase-0 > summary').click();
      assert.equal(await page.evaluate(() => innerWidth), 320, `${engine} Cengiz screenshot is genuinely 320 CSS px`);
      await page.screenshot({ path: join(out, `${engine}-devops-320.png`) });
      const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(errors, []);
      assert.deepEqual(badResponses, []);
      assert.ok(requests.every(request => new URL(request).origin === new URL(url).origin));
      const bytes = (await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, bytes: entry.encodedBodySize }))));
      results.push({ engine, browserVersion:browser.version(), os:process.platform, interactions: 'pass', readableSteps, onDemandGuides:'pass', contentVersion:manifest.contentVersion, versionedAssets:'pass', focus, keyboardFocus:focusStyle, coldResources, warmResources:bytes, scriptErrors: errors, networkErrors: badResponses, physicalDevice: 'not_run' });
      await context.close();
      const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
      const staticPage = await noJS.newPage(); await staticPage.goto(url);
      assert.ok(await staticPage.locator('.task').count() > 30);
      assert.equal(await staticPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      results.push({ engine, noJavaScript: 'pass' });
      await noJS.close();
      // Legacy decisions must not complete newly expanded technical acceptance.
      const legacy = await browser.newContext({ viewport:{width:320,height:800},reducedMotion:'reduce',locale:'tr-TR' });
      const legacyPage = await legacy.newPage();
      await legacyPage.goto(url);
      await legacyPage.evaluate(() => localStorage.setItem('atonota-action-plan:v1', JSON.stringify({ completed:['H01','U03','U04','U05','H03','U01','U02','A01','E01','E03'],options:{form:true} })));
      await legacyPage.reload();
      await legacyPage.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      for(const id of ['H01','U03','U04','U05','H03','U01','E03']) assert.equal(await legacyPage.locator(`[data-complete="${id}"]`).isChecked(),false,`${engine} legacy ${id} requires renewed acceptance`);
      for(const id of ['U02','A01','E01']) assert.equal(await legacyPage.locator(`[data-complete="${id}"]`).isChecked(),true,`${engine} unrelated valid ${id} survives migration`);
      assert.equal(await legacyPage.locator('[data-option="form"]').isChecked(),true);
      assert.equal(await legacyPage.locator('[data-complete="H03"]').isDisabled(),true);
      assert.match(await legacyPage.locator('#feedback').textContent(),/yeniden/i);
      await legacyPage.locator('#role-cengiz-phase-0 > summary').click();
      await legacyPage.locator('[data-complete="H01"]').check();
      await legacyPage.locator('[data-complete="U03"]').check();
      await legacyPage.reload();
      await legacyPage.waitForFunction(() => !document.querySelector('[data-option]').disabled);
      assert.equal(await legacyPage.locator('[data-complete="H01"]').isChecked(),true);
      assert.equal(await legacyPage.locator('[data-complete="U03"]').isChecked(),true);
      assert.equal(await legacyPage.locator('[data-complete="H03"]').isDisabled(),true);
      // Private package start must also wait for the actual versioned PoC handoff.
      for (const id of ['U01','E02','E03','E13']) {
        const phase = legacyPage.locator(`#task-${id}`).locator('xpath=ancestor::details[contains(@class,"role-phase")]');
        if (!(await phase.evaluate(element => element.open))) await phase.locator(':scope > summary').click();
        await legacyPage.locator(`[data-complete="${id}"]`).check();
      }
      assert.equal(await legacyPage.locator('[data-complete="H03"]').isDisabled(),false);
      const migrated = await legacyPage.evaluate(() => JSON.parse(localStorage.getItem('atonota-action-plan:v1')));
      assert.equal(migrated.completionRevisions.H01,plan.tasks.find(task => task.id === 'H01').revision);
      assert.equal(migrated.completionRevisions.U03,plan.tasks.find(task => task.id === 'U03').revision);
      await legacy.close();
      results.push({engine,legacyTaskRevisionMigration:'pass',unrelatedProgressPreserved:'pass',renewedCompletionReload:'pass'});
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
      results.push({ engine, failedStorageWrite: 'pass', crossTabFocus: 'pass', closedRoleNavigation: 'pass', collapsedTaskMetadata:'pass', dynamicFlowState:'pass', conditionalDependencyMap:'pass', closingBranchFocus:'pass' });
      for (const width of [320,1440]) {
        const fineContext = await browser.newContext({ viewport:{width,height:800},hasTouch:false,colorScheme:'dark',reducedMotion:'reduce',locale:'tr-TR',deviceScaleFactor:1,serviceWorkers:'block' });
        const finePage = await fineContext.newPage(); await finePage.goto(url);
        await finePage.waitForFunction(() => !document.querySelector('[data-option]').disabled);
        const capabilities = await finePage.evaluate(() => ({ coarse:matchMedia('(any-pointer:coarse)').matches,fine:matchMedia('(any-pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches }));
        assert.equal(capabilities.fine,true); assert.equal(capabilities.coarse,false);
        if(width===320) {
          const fallback = await finePage.addStyleTag({content:':root { --font-reading: monospace; }'});
          const overflow = await finePage.evaluate(() => document.documentElement.scrollWidth > innerWidth);
          const diagnosis = await finePage.locator('.project-note, .role-phase, .flow-list').evaluateAll(elements => elements.map(element=>({class:element.className,text:element.textContent.slice(0,160),width:element.clientWidth,scrollWidth:element.scrollWidth,font:getComputedStyle(element).fontFamily})).filter(element=>element.scrollWidth>element.width));
          await writeFile(join(out,`${engine}-fallback-font-320.json`),JSON.stringify({overflow,diagnosis},null,2));
          assert.equal(overflow,false,`${engine} 320px fallback font must not overflow: ${JSON.stringify(diagnosis)}`);
          await fallback.evaluate(element=>element.remove());
        }
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
          await finePage.evaluate(() => scrollTo({ top:0, behavior:'instant' }));
          await finePage.screenshot({path:join(out,`${engine}-desktop-top.png`)});
          await finePage.locator('.rail [href="#akislar"]').click();
          await finePage.screenshot({path:join(out,`${engine}-desktop-flows.png`)});
        }
        results.push({engine,width,input:'precision + keyboard',capabilities,criticalJourney:'pass',fallbackFontNoOverflow:width===320 ? 'pass' : 'not_applicable'});
        await fineContext.close();
      }
      await verifyThemes(browser, engine, url, out, results);
    } finally { await browser.close(); }
  }
  const files = await Promise.all([...allowed].map(async file => ({ file, bytes: (await stat(join(directory, file))).size })));
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  assert.ok(total <= 200 * 1024, `Raw delivered page+assets exceed 200KiB: ${total}`);
  await writeFile(join(out, 'results.json'), JSON.stringify({ url, startedAt, completedAt: new Date().toISOString(), contentVersion: localManifest.contentVersion, environment: { platform: platform(), release: release(), arch: arch(), browserVersions, emulated: true }, version: require(`${process.env.PLAYWRIGHT_PATH || 'playwright'}/package.json`).version, node: process.version, rawBytes: total, rawByteBasis: 'local production build; live manifest version and cold browser requests checked separately', files, results, physicalDevices: 'not_run', screenReader: 'not_run' }, null, 2));
  console.log(JSON.stringify({ result: 'pass', cases: results.length, rawBytes: total, evidence: out }));
} finally { await new Promise(resolve => server.close(resolve)); }
