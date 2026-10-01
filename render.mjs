import { statusOf, dependenciesOf } from './model.mjs';

export const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
export const statusLabels = { ready: 'Hazır', waiting: 'Ön koşul bekliyor', done: 'Tamamlandı', inactive: 'Koşul kapalı' };
const link = (href, label, className = '') => `<a class="${className}" href="${escapeHTML(href)}">${escapeHTML(label)}</a>`;

export function renderDependencyLinks(task, state, plan) {
  const dependencies = dependenciesOf(task, state, plan);
  return dependencies.length ? `<span class="dependency-caption">Önce tamamla</span>${dependencies.map(id => {
    const prerequisite = plan.tasks.find(task => task.id === id);
    const owner = plan.roles.find(role => role.id === prerequisite.role);
    return `<a class="dependency-link" href="#task-${id}"><span>${escapeHTML(prerequisite.title)}</span><span class="dependency-meta">${escapeHTML(owner.name)} · ${id}${state.completed.includes(id) ? ' · tamam' : ' · bekliyor'}</span></a>`;
  }).join('')}` : '<span class="dependency-caption">Ön koşul yok; başlayabilirsin.</span>';
}

export function renderTask(task, state, plan) {
  const status = statusOf(task, state, plan);
  return `<li class="task" id="task-${task.id}" data-task="${task.id}" data-status="${status}" ${status === 'inactive' ? 'hidden' : ''}>
    <label class="task-check"><input type="checkbox" tabindex="0" data-complete="${task.id}" disabled ${status === 'done' ? 'checked' : ''} aria-describedby="status-${task.id} deps-${task.id}"><span class="sr-only">${task.id}: ${escapeHTML(task.title)} — tamamlandı olarak işaretle</span></label>
    <div class="task-heading"><div class="task-topline"><span class="task-id">${task.id}</span><span class="task-status" id="status-${task.id}" data-task-status="${task.id}">${statusLabels[status]}</span></div><h4 class="task-title">${escapeHTML(task.title)}</h4></div>
    <div class="task-copy">${task.steps?.length ? `<h5 class="task-step-heading">Yapılacaklar</h5><ol class="task-steps">${task.steps.map(step => `<li>${escapeHTML(step)}</li>`).join('')}</ol>` : ''}
    <details class="task-detail" id="detail-${task.id}"><summary>Teslim ve kontrol<span class="sr-only">: ${task.id}</span></summary><div class="task-meta" id="meta-${task.id}"><p><strong>Teslim:</strong> ${escapeHTML(task.output)}</p><p><strong>Kontrol:</strong> ${escapeHTML(task.accept)}</p></div></details>
    <div class="dependencies" id="deps-${task.id}" data-dependencies="${task.id}">${renderDependencyLinks(task, state, plan)}</div></div></li>`;
}

export function renderNext(plan, state, role = 'all') {
  const ready = plan.tasks.filter(task => statusOf(task, state, plan) === 'ready' && (role === 'all' || task.role === role))
    .sort((left, right) => Number(left.decision === true) - Number(right.decision === true));
  if (!ready.length) {
    const waiting = plan.tasks.filter(task => statusOf(task, state, plan) === 'waiting' && (role === 'all' || task.role === role));
    return `<p class="empty-state">${waiting.length ? 'Hazır iş yok. Bekleyen görevdeki ön koşula git.' : 'Bu kapsamda açık iş yok. Genel yoldan durumu kontrol et.'}</p>`;
  }
  return `<ol class="next-actions">${ready.slice(0, 5).map(task => {
    const owner = plan.roles.find(item => item.id === task.role);
    return `<li class="next-item"><div class="next-meta">${escapeHTML(owner.name)} <span>· ${task.id}</span></div>${link(`#task-${task.id}`, task.title)}${task.steps?.[0] ? `<p>${escapeHTML(task.steps[0])}</p>` : ''}</li>`;
  }).join('')}</ol>${ready.length > 5 ? `<p>${ready.length - 5} hazır işi daha ${link('#kisiler', 'kişisel yol haritalarında gör')}.</p>` : ''}`;
}
