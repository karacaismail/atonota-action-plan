export const isActive = (task, state) => !task.when || state.options[task.when] === true;
// Older shared development URLs now lead to Ismail's single roadmap.
export const canonicalAnchor = id => /^role-ekip(?:-phase-\d+)?$/.test(id) ? id.replace('role-ekip', 'role-sen') : id;

export function dependenciesOf(task, state, plan) {
  const optional = (task.optionalDepends ?? []).filter(id => {
    const dependency = plan.tasks.find(item => item.id === id);
    return dependency && isActive(dependency, state);
  });
  return [...task.depends, ...optional];
}

export function normalizeState(raw, plan) {
  const options = Object.fromEntries(plan.options.map(option => [option.id, raw?.options?.[option.id] === true]));
  const requested = new Set(Array.isArray(raw?.completed) ? raw.completed.filter(id => typeof id === 'string') : []);
  const state = { completed: [], options };
  // Resolve in dependency order, not storage order. Invalid and stale work is dropped.
  for (let pass = 0; pass < plan.tasks.length; pass++) {
    let changed = false;
    for (const task of plan.tasks) {
      if (requested.has(task.id) && !state.completed.includes(task.id) && statusOf(task, state, plan) === 'ready') {
        state.completed.push(task.id);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return state;
}

export function statusOf(task, state, plan) {
  if (!isActive(task, state)) return 'inactive';
  const ready = dependenciesOf(task, state, plan).every(id => state.completed.includes(id));
  if (!ready) return 'waiting';
  return state.completed.includes(task.id) ? 'done' : 'ready';
}

export function transition(previous, action, plan) {
  const state = normalizeState(previous, plan);
  if (action.type === 'option' && plan.options.some(option => option.id === action.id)) {
    state.options[action.id] = action.checked === true;
  }
  if (action.type === 'task') {
    const task = plan.tasks.find(item => item.id === action.id);
    if (task && !action.checked) state.completed = state.completed.filter(id => id !== task.id);
    else if (task && statusOf(task, state, plan) === 'ready') state.completed.push(task.id);
  }
  return normalizeState(state, plan);
}

export function validatePlan(plan) {
  const errors = [];
  const ids = new Set();
  const options = new Set(plan.options.map(option => option.id));
  for (const task of plan.tasks) {
    if (ids.has(task.id)) errors.push(`Duplicate task: ${task.id}`);
    ids.add(task.id);
    if (task.when && !options.has(task.when)) errors.push(`Unknown option: ${task.when}`);
  }
  const visited = new Set();
  const visiting = new Set();
  const visit = task => {
    if (visiting.has(task.id)) { errors.push(`Cycle at: ${task.id}`); return; }
    if (visited.has(task.id)) return;
    visiting.add(task.id);
    for (const id of [...task.depends, ...(task.optionalDepends ?? [])]) {
      const dependency = plan.tasks.find(item => item.id === id);
      if (!dependency) errors.push(`Missing dependency: ${task.id} -> ${id}`);
      else visit(dependency);
    }
    visiting.delete(task.id);
    visited.add(task.id);
  };
  plan.tasks.forEach(visit);
  return errors;
}
