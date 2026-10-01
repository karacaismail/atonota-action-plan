import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, statusOf, transition, validatePlan, canonicalAnchor, changedCompletionIDs } from '../model.mjs';

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
test('old development links target the single Ismail roadmap only', () => {
  assert.equal(canonicalAnchor('role-ekip'), 'role-sen');
  assert.equal(canonicalAnchor('role-ekip-phase-1'), 'role-sen-phase-1');
  for (const id of ['role-sen-phase-0', 'task-E13', 'role-cengiz', 'role-ekip-other', '']) assert.equal(canonicalAnchor(id), id);
});

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
test('legacy completion cannot prove a revised scope or its downstream work', () => {
  const revised = {
    options: [{ id: 'form' }],
    tasks: [
      { id: 'scope', revision: 2, depends: [] },
      { id: 'downstream', depends: ['scope'] },
      { id: 'kept', depends: [] },
      { id: 'optional', depends: ['kept'], when: 'form' },
    ],
  };
  const state = normalizeState({ completed: ['scope', 'downstream', 'kept', 'optional'], options: { form: true } }, revised);
  assert.deepEqual(state.completed, ['kept', 'optional']);
  assert.deepEqual(state.options, { form: true });
  assert.deepEqual(state.completionRevisions, { kept: 1, optional: 1 });
  assert.equal(statusOf(revised.tasks[1], state, revised), 'waiting');
  assert.deepEqual(changedCompletionIDs({ completed: ['scope', 'downstream', 'kept', 'unknown'] }, revised), ['scope']);
  assert.deepEqual(changedCompletionIDs(state, revised), []);
});

test('new completions stamp the current scope and survive serialization and peer normalization', () => {
  const revised = { options: [], tasks: [{ id: 'scope', revision: 2, depends: [] }, { id: 'child', depends: ['scope'] }, { id: 'kept', depends: [] }] };
  let state = normalizeState({ completed: ['scope', 'child', 'kept'] }, revised);
  for (const id of ['scope', 'child']) state = transition(state, { type: 'task', id, checked: true }, revised);
  assert.deepEqual(state.completionRevisions, { scope: 2, child: 1, kept: 1 });
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state)), revised), state);
  assert.deepEqual(changedCompletionIDs(state, revised), []);
  state = transition(state, { type: 'task', id: 'scope', checked: false }, revised);
  assert.deepEqual(state.completed, ['kept']);
  assert.deepEqual(state.completionRevisions, { kept: 1 });
});

test('completion revisions reject invalid and future evidence and prune unrelated map entries', () => {
  const revised = { options: [], tasks: [{ id: 'scope', revision: 2, depends: [] }, { id: 'kept', depends: [] }] };
  for (const invalid of [null, false, '2', 0, -1, 2.5, 3, Number.MAX_SAFE_INTEGER + 1]) {
    const state = normalizeState({ completed: ['scope', 'kept'], completionRevisions: { scope: invalid, kept: 1, unknown: 2 } }, revised);
    assert.deepEqual(state.completed, ['kept'], String(invalid));
    assert.deepEqual(state.completionRevisions, { kept: 1 });
  }
  const polluted = JSON.parse('{"scope":2,"kept":1,"unknown":2,"__proto__":{"polluted":true}}');
  const state = normalizeState({ completed: ['scope'], completionRevisions: polluted }, revised);
  assert.deepEqual(state.completionRevisions, { scope: 2 });
  assert.equal(Object.hasOwn(state.completionRevisions, '__proto__'), false);
  assert.equal({}.polluted, undefined);
  for (const malformed of [null, false, [], 'invalid']) {
    assert.deepEqual(normalizeState({ completed: ['scope', 'kept'], completionRevisions: malformed }, revised).completed, ['kept']);
  }
});

test('graph validator requires explicit revisions to be positive safe integers', () => {
  for (const revision of [null, false, '2', 0, -1, 2.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match(validatePlan({ options: [], tasks: [{ id: 'scope', revision, depends: [] }] }).join(), /Invalid revision: scope/);
  }
  assert.deepEqual(validatePlan({ options: [], tasks: [{ id: 'scope', revision: 2, depends: [] }] }), []);
});
