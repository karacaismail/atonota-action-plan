import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { plan } from '../plan.mjs';
import { renderPage } from '../scripts/page.mjs';

test('theme choice is an accessible enhancement, without duplicating the plan', () => {
  const html = renderPage(plan);
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /<button[^>]+data-theme-toggle[^>]+hidden/);
  assert.match(html, /id="theme-note"[^>]+role="status"/);
  assert.equal((html.match(/data-theme-toggle/g) ?? []).length, 1);
  assert.equal((html.match(/data-task="/g) ?? []).length, plan.tasks.length);
});

test('stored theme applies before stylesheet; invalid or inaccessible storage safely follows system', () => {
  const html = renderPage(plan);
  const bootstrap = /<script id="theme-bootstrap">([\s\S]*?)<\/script>/u.exec(html);
  assert.ok(bootstrap, 'saved theme needs a pre-paint bootstrap');
  assert.ok(html.indexOf('id="theme-bootstrap"') < html.indexOf('rel="stylesheet"'));
  for (const value of ['light', 'dark', 'unexpected', null]) {
    const dataset = {};
    runInNewContext(bootstrap[1], { document: { documentElement: { dataset } }, localStorage: { getItem(key) { assert.equal(key, 'atonota-theme'); return value; } } });
    assert.equal(dataset.theme, ['light', 'dark'].includes(value) ? value : undefined);
  }
  const dataset = {};
  assert.doesNotThrow(() => runInNewContext(bootstrap[1], { document: { documentElement: { dataset } }, localStorage: { getItem() { throw new Error('blocked'); } } }));
  assert.equal(dataset.theme, undefined);
});

test('theme accessible name contains its visible label and the next action', async () => {
  const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  const controller = source.slice(source.indexOf('// Theme is independent'), source.indexOf('\nconst key ='));
  assert.ok(controller.length > 0);
  for (const theme of ['light', 'dark']) {
    const attributes = {};
    const listeners = {};
    const button = { hidden: true, setAttribute(name, value) { attributes[name] = value; }, addEventListener(name, handler) { listeners[name] = handler; } };
    const dataset = { theme };
    runInNewContext(controller, {
      document: { documentElement: { dataset }, querySelector(selector) { return selector === '[data-theme-toggle]' ? button : {}; } },
      matchMedia() { return { matches: theme === 'dark', addEventListener() {} }; },
      window: { addEventListener() {} },
      localStorage: { setItem() {} },
    });
    for (let iteration = 0; iteration < 2; iteration++) {
      assert.ok(attributes['aria-label'].startsWith(button.textContent), 'voice input can address the visible label');
      assert.ok(attributes['aria-label'].includes(dataset.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'));
      assert.equal(button.hidden, false);
      listeners.click();
    }
  }
});
