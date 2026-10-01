import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, statusOf, transition, validatePlan } from '../model.mjs';

const plan = {
  options: [{ id: 'form' }],
  tasks: [
    { id: 'a', depends: [] },
    { id: 'b', depends: ['a'] },
    { id: 'c', depends: ['b'] },
    { id: 'f', depends: ['a'], when: 'form' },
    { id: 'g', depends: ['f'], when: 'form' },
  ],
};
const fresh = () => normalizeState(null, plan);

test('first action ready, downstream waiting, optional path inactive', () => {
  assert.equal(statusOf(plan.tasks[0], fresh(), plan), 'ready');
  assert.equal(statusOf(plan.tasks[1], fresh(), plan), 'waiting');
  assert.equal(statusOf(plan.tasks[3], fresh(), plan), 'inactive');
});
test('blocked action cannot be completed; prerequisites unlock it', () => {
  assert.deepEqual(transition(fresh(), { type: 'task', id: 'b', checked: true }, plan).completed, []);
  const state = transition(fresh(), { type: 'task', id: 'a', checked: true }, plan);
  assert.equal(statusOf(plan.tasks[1], state, plan), 'ready');
});
test('reopening a prerequisite invalidates downstream completion, not unrelated work', () => {
  let state = fresh();
  for (const id of ['a', 'b', 'c']) state = transition(state, { type: 'task', id, checked: true }, plan);
  state = transition(state, { type: 'task', id: 'b', checked: false }, plan);
  assert.deepEqual(state.completed, ['a']);
  assert.equal(statusOf(plan.tasks[2], state, plan), 'waiting');
});
test('conditional branch opens and closes without preserving stale completion', () => {
  let state = transition(fresh(), { type: 'option', id: 'form', checked: true }, plan);
  for (const id of ['a', 'f', 'g']) state = transition(state, { type: 'task', id, checked: true }, plan);
  assert.equal(statusOf(plan.tasks[4], state, plan), 'done');
  state = transition(state, { type: 'option', id: 'form', checked: false }, plan);
  assert.deepEqual(state.completed, ['a']);
});
test('storage is sanitized and impossible completions are discarded', () => {
  const state = normalizeState({ completed: ['b', 'bogus', 'a', 'a'], options: { form: 'yes', alien: true } }, plan);
  assert.deepEqual(state.completed, ['a', 'b']);
  assert.deepEqual(state.options, { form: false });
  assert.deepEqual(normalizeState({ completed: {}, options: null }, plan), fresh());
});
test('graph validator rejects missing dependencies, duplicates and cycles', () => {
  assert.deepEqual(validatePlan(plan), []);
  assert.ok(validatePlan({ ...plan, tasks: [{ id: 'a', depends: ['x'] }] }).length);
  assert.ok(validatePlan({ ...plan, tasks: [plan.tasks[0], plan.tasks[0]] }).length);
  assert.ok(validatePlan({ ...plan, tasks: [{ id: 'a', depends: ['b'] }, { id: 'b', depends: ['a'] }] }).length);
});
