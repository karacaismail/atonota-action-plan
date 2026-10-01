import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../plan.mjs';
import { validatePlan, normalizeState, statusOf, transition } from '../model.mjs';
import { renderPage, escapeHTML } from '../render.mjs';

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
  assert.ok(html.includes('Karar ve geliştirme sahibi: eksik kararları tamamla.'));
  assert.ok(html.includes('Karar ve geliştirme sahibi: eksik köprüleri geliştir.'));
});
test('one Ismail roadmap owns decisions and development without losing task progress', () => {
  assert.deepEqual(plan.roles.map(role => role.id), ['sen', 'cengiz', 'asistan']);
  for (const id of ['U01', 'E01', 'E13', 'U08', 'F02', 'B02', 'N02']) {
    assert.equal(plan.tasks.find(task => task.id === id).role, 'sen', id);
  }
  assert.ok(plan.projects.every(project => project.owner !== 'ekip'));
  const completed = ['U01', 'U02', 'E01', 'E02'];
  assert.deepEqual(new Set(normalizeState({ completed }, plan).completed), new Set(completed));
  const html = renderPage(plan);
  assert.equal([...html.matchAll(/class="role-section"/g)].length, 3);
  assert.doesNotMatch(html, /id="role-ekip"|data-owner-filter="ekip"/);
});
test('DevOps CI waits for the installation package and old completion cannot skip it', () => {
  const previous = { completed: ['U01', 'U02', 'H01', 'U03', 'U05', 'E01', 'E02', 'E03', 'H02'] };
  let state = normalizeState(previous, plan);
  const ci = plan.tasks.find(task => task.id === 'H02');
  assert.equal(statusOf(ci, state, plan), 'waiting');
  assert.equal(state.completed.includes('H02'), false);
  state = transition(state, { type: 'task', id: 'E13', checked: true }, plan);
  assert.equal(statusOf(ci, state, plan), 'ready');
  state = transition(state, { type: 'task', id: 'H02', checked: true }, plan);
  assert.equal(statusOf(ci, state, plan), 'done');
});
