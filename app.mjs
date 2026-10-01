import { plan } from './plan.mjs';
import { normalizeState, transition, statusOf, dependenciesOf, isActive } from './model.mjs';
import { escapeHTML, renderNext, statusLabels } from './render.mjs';

const key = 'atonota-action-plan:v1';
let state = normalizeState(null, plan);
let owner = 'all';
let resetArmed = false;
let resetTimer;
const feedback = document.querySelector('#feedback');
const menu = document.querySelector('#rail-menu');
if (matchMedia('(min-width: 64rem) and (min-height: 35rem)').matches) menu.open = true;

try { state = normalizeState(JSON.parse(localStorage.getItem(key)), plan); }
catch { document.querySelector('#storage-note').textContent = 'Kalıcı kayıt kullanılamadı. İşaretler bu açık sayfada çalışır; sayfa yenilenince kaybolabilir.'; }

function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch {
    document.querySelector('#storage-note').textContent = 'Kayıt yapılamadı. İlerlemeyi indir; bu oturumdaki işaretler yenilenince kaybolabilir.';
    return false;
  }
}

function updateNext() {
  const container = document.querySelector('#next-actions');
  const focused = container.contains(document.activeElement) ? document.activeElement.getAttribute('href') : null;
  container.innerHTML = renderNext(plan, state, owner);
  if (focused) {
    const replacement = [...container.querySelectorAll('a')].find(anchor => anchor.getAttribute('href') === focused);
    (replacement ?? document.querySelector('[data-owner-filter][aria-pressed="true"]')).focus({ preventScroll: true });
  }
}

function update() {
  for (const task of plan.tasks) {
    const status = statusOf(task, state, plan);
    const row = document.querySelector(`[data-task="${task.id}"]`);
    row.hidden = status === 'inactive';
    row.dataset.status = status;
    const input = row.querySelector('input');
    input.checked = status === 'done';
    input.disabled = status === 'waiting' || status === 'inactive';
    row.querySelector('[data-task-status]').textContent = statusLabels[status];
    const dependencies = dependenciesOf(task, state, plan);
    row.querySelector('[data-dependencies]').innerHTML = dependencies.length
      ? `Ön koşul: ${dependencies.map(id => `<a class="dependency-link" href="#task-${id}" aria-label="${id}: ${escapeHTML(plan.tasks.find(item => item.id === id).title)}">${id}${state.completed.includes(id) ? ' · tamam' : ' · bekliyor'}</a>`).join(' ')}`
      : 'Ön koşul yok; başlayabilirsin.';
  }
  const active = plan.tasks.filter(task => isActive(task, state));
  document.querySelector('[data-metric="done"]').textContent = `${state.completed.length} / ${active.length}`;
  document.querySelector('[data-metric="ready"]').textContent = active.filter(task => statusOf(task, state, plan) === 'ready').length;
  for (const phase of plan.phases) {
    const tasks = active.filter(task => task.phase === phase.id);
    const complete = tasks.filter(task => state.completed.includes(task.id)).length;
    document.querySelector(`[data-phase-status="${phase.id}"]`).textContent = `${complete} / ${tasks.length}${complete === tasks.length ? ' · tamam' : ''}`;
    const links = document.querySelector(`[data-phase="${phase.id}"] .owner-links`);
    // Keep existing anchors mounted so updates in another tab cannot steal focus.
    for (const role of plan.roles) {
      const href = `#role-${role.id}-phase-${phase.id}`;
      const existing = [...links.querySelectorAll('a')].find(anchor => anchor.getAttribute('href') === href);
      const count = tasks.filter(task => task.role === role.id).length;
      if (count) {
        const anchor = existing ?? document.createElement('a');
        anchor.className = 'owner-link'; anchor.href = href;
        anchor.textContent = `${role.name} · ${count} görev`;
        if (!existing) links.append(anchor);
      } else if (existing) {
        const focused = document.activeElement === existing;
        existing.remove();
        if (focused) document.querySelector('[data-owner-filter][aria-pressed="true"]').focus({ preventScroll: true });
      }
    }
  }
  for (const role of plan.roles) {
    const tasks = active.filter(task => task.role === role.id);
    document.querySelector(`[data-role-status="${role.id}"]`).textContent = `${tasks.filter(task => state.completed.includes(task.id)).length} / ${tasks.length}`;
  }
  for (const group of document.querySelectorAll('[data-role-phase]')) {
    const [role, phase] = group.dataset.rolePhase.split(':');
    const tasks = active.filter(task => task.role === role && task.phase === Number(phase));
    group.hidden = tasks.length === 0;
    group.querySelector('[data-group-status]').textContent = `${tasks.filter(task => state.completed.includes(task.id)).length} / ${tasks.length}`;
  }
  updateNext();
  for (const input of document.querySelectorAll('[data-option]')) {
    input.disabled = false;
    input.checked = state.options[input.dataset.option];
  }
}

document.addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const id = input.dataset.complete ?? input.dataset.option;
  if (!id) return;
  const previousCount = state.completed.length;
  state = transition(state, { type: input.dataset.complete ? 'task' : 'option', id, checked: input.checked }, plan);
  const saved = save();
  update();
  const removed = previousCount - state.completed.length;
  feedback.textContent = !saved ? 'Bu oturumda güncellendi; kalıcı kayıt başarısız. İlerlemeyi indir. Yenilemede işaretler kaybolabilir.' : removed > 0
    ? `${removed} işaret kaldırıldı. Değişen ön koşula bağlı işler yeniden bekliyor.`
    : input.dataset.option ? 'İş kolu güncellendi. Genel yol ve kişisel görevler yenilendi.' : 'Yerel ilerleme kaydedildi. Hazır işleri kontrol et.';
});

for (const button of document.querySelectorAll('[data-owner-filter]')) {
  button.addEventListener('click', () => {
    owner = button.dataset.ownerFilter;
    for (const peer of document.querySelectorAll('[data-owner-filter]')) peer.setAttribute('aria-pressed', String(peer === button));
    updateNext();
  });
}

function goToHash() {
  const id = location.hash.slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target || target.hidden) return;
  const details = target.matches('details') ? target : target.closest('details');
  if (details) {
    details.open = true;
    if (details.hidden) return;
  }
  // Focus an actual control, not a section-wide outline. Preserve task check state.
  const control = target.matches('details, .role-section') ? target.querySelector('summary')
    : target.querySelector('input:not(:disabled), a, summary');
  target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  control?.focus({ preventScroll: true });
}
document.addEventListener('click', event => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor || !anchor.hash) return;
  event.preventDefault();
  if (anchor.hash !== location.hash) history.pushState(null, '', anchor.hash);
  goToHash();
});
window.addEventListener('hashchange', goToHash);
window.addEventListener('popstate', goToHash);
window.addEventListener('storage', event => {
  if (event.key !== key) return;
  try { state = normalizeState(JSON.parse(event.newValue), plan); update(); feedback.textContent = 'İlerleme aynı tarayıcının diğer sekmesinden güncellendi.'; }
  catch { feedback.textContent = 'Diğer sekmedeki takip verisi okunamadı; mevcut işaretler korundu.'; }
});

const reset = document.querySelector('#reset-progress');
reset.disabled = false;
reset.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    reset.textContent = 'Sıfırlamayı onayla';
    feedback.textContent = 'Yalnız yerel işaretler ve kol seçimleri silinecek. İptal için Escape; onay için tekrar tıkla.';
    resetTimer = setTimeout(cancelReset, 10000);
    return;
  }
  state = normalizeState(null, plan);
  const saved = save(); update(); cancelReset();
  feedback.textContent = saved ? 'Yerel işaretler sıfırlandı. Sunucuda veya GitHub’da değişiklik yapılmadı.'
    : 'Bu oturumdaki işaretler sıfırlandı; kalıcı kayıt başarısız. Önceki işaretler yenilemede geri gelebilir.';
});
function cancelReset() {
  clearTimeout(resetTimer);
  resetArmed = false;
  reset.textContent = 'Yerel işaretleri sıfırla';
}
document.addEventListener('keydown', event => { if (event.key === 'Escape') cancelReset(); });
const download = document.querySelector('#export-progress');
download.disabled = false;
download.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ planVersion: plan.version, localOnly: true, ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'atonota-yerel-ilerleme.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  feedback.textContent = 'Yerel ilerleme dosyası indirildi. Dosya gerçek onay/deploy kanıtı değildir.';
});

update();
if (location.hash) requestAnimationFrame(goToHash);
