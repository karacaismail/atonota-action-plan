import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../plan.mjs';
import { normalizeState, transition, isActive } from '../model.mjs';
import * as render from '../render.mjs';
import { renderPage } from '../scripts/page.mjs';

test('entry exposes the three personal paths before secondary scope details', () => {
  const html = renderPage(plan);
  const shortcuts = /<div class="shortcut-list">(.*?)<\/div>/s.exec(html)?.[1];
  assert.ok(shortcuts, 'personal journeys must not be buried below the whole roadmap');
  for (const role of plan.roles) {
    assert.ok(shortcuts.includes(`href="#role-${role.id}"`));
    assert.ok(shortcuts.includes(render.escapeHTML(role.name)));
  }
  assert.equal([...shortcuts.matchAll(/class="role-shortcut"/g)].length, 3);
  assert.ok(html.indexOf('class="role-shortcuts"') < html.indexOf('class="hero-support"'));
});

test('navigation resolves deep task and legacy role links to one real person', () => {
  assert.equal(typeof render.navigationTarget, 'function');
  const target = render.navigationTarget;
  for (const task of plan.tasks) assert.equal(target(`task-${task.id}`, plan), `#role-${task.role}`);
  assert.equal(target('role-ekip-phase-1', plan), '#role-sen');
  assert.equal(target('role-cengiz-phase-2', plan), '#role-cengiz');
  assert.equal(target('akislar', plan), '#akislar');
  assert.equal(target('main', plan), '#simdi');
  assert.equal(target('', plan), '#simdi');
  assert.equal(target('not-a-destination', plan), null);
});

test('accessible progress reports only local completions and follows active branches', () => {
  let state = transition(normalizeState(null, plan), { type: 'task', id: 'E01', checked: true }, plan);
  state = transition(state, { type: 'option', id: 'form', checked: true }, plan);
  const activeCount = plan.tasks.filter(task => isActive(task, state)).length;
  const html = renderPage(plan, state);
  assert.match(html, new RegExp(`<progress id="plan-progress" value="1" max="${activeCount}"`));
  assert.match(html, /<label for="plan-progress">Yerel ilerleme/);
  assert.ok(html.includes(`1 / ${activeCount}`));
  assert.match(html, /sunucuda kurulum veya gerçek onay yapmaz/);
});
