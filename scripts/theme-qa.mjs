import assert from 'node:assert/strict';
import { join } from 'node:path';

const ready = page => page.waitForFunction(() => !document.querySelector('[data-option]').disabled);
const background = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const colors = { light: 'rgb(244, 245, 239)', dark: 'rgb(18, 23, 25)' };

async function contrastEvidence(page) {
  return page.evaluate(() => {
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); };
    const backdrop = element => {
      for (let node = element; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const text = ['body', '.rail-link[aria-current]', '.shortcut-note', '.overview-action', '.flow-step a', '.flow-label', '.flow-node-state', '.flow-dependencies a', '.task-status', '.task-step-heading', '.role-phase [data-group-status]', '.dependency-meta', '.theme-toggle'].flatMap(selector => [...document.querySelectorAll(selector)].map(element => ({ selector, ratio: ratio(getComputedStyle(element).color, backdrop(element)) })));
    const probe = document.createElement('span');
    document.body.append(probe);
    probe.style.color = 'var(--color-focus)';
    const focusColor = getComputedStyle(probe).color;
    const focus = ['--color-page', '--color-surface', '--color-surface-hover', '--color-surface-selected', '--color-flow-node'].map(token => { probe.style.background = `var(${token})`; return { token, ratio: ratio(focusColor, getComputedStyle(probe).backgroundColor) }; });
    probe.style.color = 'var(--color-control-border)';
    const border = ratio(getComputedStyle(probe).color, getComputedStyle(document.body).backgroundColor);
    probe.remove();
    return { text, focus, border };
  });
}

export async function verifyThemes(browser, engine, url, out, results) {
  for (const initial of ['light', 'dark']) {
    const other = initial === 'light' ? 'dark' : 'light';
    const context = await browser.newContext({ viewport: { width: 320, height: 800 }, hasTouch: true, colorScheme: initial, reducedMotion: 'reduce', locale: 'tr-TR', timezoneId: 'Europe/Istanbul', deviceScaleFactor: 1, serviceWorkers: 'block' });
    try {
      const scriptErrors = [];
      const networkErrors = [];
      context.on('page', page => {
        page.on('pageerror', error => scriptErrors.push(error.message));
        page.on('response', response => { if (response.status() >= 400) networkErrors.push(response.url()); });
      });
      const page = await context.newPage();
      await page.goto(url); await ready(page);
      assert.equal(await page.evaluate(() => CSS.supports('color', 'light-dark(white, black)')), true);
      assert.equal(await page.locator('html').getAttribute('data-theme'), null);
      assert.equal(await background(page), colors[initial]);
      const button = page.locator('[data-theme-toggle]');
      assert.equal(await button.getAttribute('aria-label'), initial === 'dark' ? 'Koyu tema. Açık temaya geç' : 'Açık tema. Koyu temaya geç');
      const hit = await button.boundingBox();
      assert.ok(hit.width >= 48 && hit.height >= 48);
      const first = page.locator('[data-complete="U01"]');
      await first.check(); await first.focus();
      await page.emulateMedia({ colorScheme: other });
      await page.waitForFunction(text => document.querySelector('[data-theme-toggle]').textContent === text, other === 'dark' ? 'Koyu tema' : 'Açık tema');
      assert.equal(await background(page), colors[other]);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.complete), 'U01');
      assert.equal(await first.isChecked(), true);
      await page.emulateMedia({ colorScheme: initial });
      await page.waitForFunction(text => document.querySelector('[data-theme-toggle]').textContent === text, initial === 'dark' ? 'Koyu tema' : 'Açık tema');
      const evidence = await contrastEvidence(page);
      assert.ok(evidence.text.every(item => item.ratio >= 4.5), `${engine}/${initial} text contrast ${JSON.stringify(evidence.text.filter(item => item.ratio < 4.5))}`);
      assert.ok(evidence.focus.every(item => item.ratio >= 3), `${engine}/${initial} focus contrast`);
      assert.ok(evidence.border >= 3, `${engine}/${initial} control border contrast`);
      for (const width of [320, 360, 375, 390, 640, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        if (width === 320 || width === 1440) await page.screenshot({ path: join(out, `${engine}-${initial}-${width}.png`) });
      }
      await page.locator('.role-shortcut[href="#role-cengiz"]').click();
      await page.setViewportSize({ width: 320, height: 800 });
      await page.locator('#role-cengiz').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.screenshot({ path: join(out, `${engine}-${initial}-devops-320.png`) });
      await page.setViewportSize({ width: 1440, height: 800 });
      if (!(await page.locator('#rail-menu').evaluate(element => element.open))) await page.locator('#rail-menu > summary').click();
      await page.locator('.rail [href="#akislar"]').click();
      await page.screenshot({ path: join(out, `${engine}-${initial}-flows-1440.png`) });
      await page.setViewportSize({ width: 320, height: 800 });
      // macOS WebKit follows Safari's default limited Tab navigation. Option-Tab
      // includes native buttons; do not override the user's browser preference.
      const forward = engine === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
      const backward = engine === 'webkit' && process.platform === 'darwin' ? 'Alt+Shift+Tab' : 'Shift+Tab';
      await button.focus(); await page.keyboard.press(forward); await page.keyboard.press(backward);
      const focus = await button.evaluate(element => ({ active: element === document.activeElement, outline: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle, shadow: getComputedStyle(element).boxShadow }));
      assert.deepEqual(focus, { active: true, outline: '2px', style: 'solid', shadow: 'none' });
      await page.keyboard.press('Space');
      assert.equal(await page.locator('html').getAttribute('data-theme'), other);
      assert.equal(await button.evaluate(element => element === document.activeElement), true);
      assert.equal(await page.evaluate(() => localStorage.getItem('atonota-theme')), other);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('html').getAttribute('data-theme'), initial);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('html').getAttribute('data-theme'), other);
      assert.equal(await button.evaluate(element => element === document.activeElement), true);
      await page.reload(); await ready(page);
      assert.equal(await page.locator('html').getAttribute('data-theme'), other);
      assert.equal(await background(page), colors[other]);
      assert.equal(await first.isChecked(), true);
      await page.emulateMedia({ colorScheme: other });
      await page.emulateMedia({ colorScheme: initial });
      assert.equal(await background(page), colors[other]);
      const peer = await context.newPage(); await peer.goto(url); await ready(peer);
      await button.focus();
      const hash = await page.evaluate(() => location.hash);
      await peer.locator('[data-theme-toggle]').click();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, initial);
      assert.equal(await button.evaluate(element => element === document.activeElement), true);
      assert.equal(await page.evaluate(() => location.hash), hash);
      assert.equal(await first.isChecked(), true);
      await peer.evaluate(() => localStorage.removeItem('atonota-theme'));
      await page.waitForFunction(() => !document.documentElement.dataset.theme);
      assert.equal(await background(page), colors[initial]);
      await peer.close();
      await button.click();
      await page.locator('#reset-progress').click(); await page.locator('#reset-progress').click();
      assert.equal(await first.isChecked(), false);
      assert.equal(await page.locator('html').getAttribute('data-theme'), other);
      await page.setViewportSize({ width: 568, height: 320 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await background(page), 'rgb(255, 255, 255)');
      assert.equal(await button.isVisible(), false);
      await page.emulateMedia({ media: 'screen' });
      assert.deepEqual(scriptErrors, []);
      assert.deepEqual(networkErrors, []);
      results.push({ engine, theme: initial, layouts: 'pass', systemChanges: 'pass', preferenceReload: 'pass', crossTabThemeFocusAndProgress: 'pass', resetPreservesTheme: 'pass', printOverride: 'pass', keyboardFocus: focus, keyboardNavigation: `${forward} / ${backward}, Space, Enter`, contrast: evidence, scriptErrors, networkErrors });
    } finally { await context.close(); }
    const staticContext = await browser.newContext({ javaScriptEnabled: false, colorScheme: initial, viewport: { width: 320, height: 800 } });
    try {
      const page = await staticContext.newPage(); await page.goto(url);
      assert.equal(await background(page), colors[initial]);
      assert.equal(await page.locator('[data-theme-toggle]').isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      results.push({ engine, noJavaScriptTheme: initial, systemFallback: 'pass' });
    } finally { await staticContext.close(); }
  }
  // Abort only app.mjs: saved preference must already apply before enhancement.
  const prepaint = await browser.newContext({ colorScheme: 'dark', viewport: { width: 320, height: 800 } });
  try {
    await prepaint.addInitScript(() => localStorage.setItem('atonota-theme', 'light'));
    await prepaint.route('**/app.mjs*', route => route.abort());
    const page = await prepaint.newPage(); await page.goto(url);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await background(page), colors.light);
    assert.equal(await page.locator('[data-theme-toggle]').isVisible(), false);
    results.push({ engine, savedThemeBeforeApp: 'pass' });
  } finally { await prepaint.close(); }
  const invalid = await browser.newContext({ colorScheme: 'light', viewport: { width: 320, height: 800 } });
  try {
    await invalid.addInitScript(() => localStorage.setItem('atonota-theme', 'invalid'));
    const page = await invalid.newPage(); await page.goto(url); await ready(page);
    assert.equal(await page.locator('html').getAttribute('data-theme'), null);
    assert.equal(await background(page), colors.light);
    results.push({ engine, invalidThemeFallback: 'pass' });
  } finally { await invalid.close(); }
  const blocked = await browser.newContext({ colorScheme: 'light', viewport: { width: 320, height: 800 } });
  try {
    await blocked.addInitScript(() => {
      for (const method of ['getItem', 'setItem']) Object.defineProperty(Storage.prototype, method, { value() { throw new Error('Storage blocked'); } });
    });
    const page = await blocked.newPage(); await page.goto(url); await ready(page);
    await page.locator('[data-theme-toggle]').click();
    assert.equal(await background(page), colors.dark);
    assert.match(await page.locator('#theme-note').textContent(), /kaydedilemedi/);
    await page.locator('[data-complete="U01"]').check();
    assert.equal(await page.locator('[data-complete="U01"]').isChecked(), true);
    assert.match(await page.locator('#feedback').textContent(), /kalıcı kayıt başarısız/);
    results.push({ engine, blockedThemeStorage: 'pass', independentProgress: 'pass' });
  } finally { await blocked.close(); }
}
