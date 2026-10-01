import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../plan.mjs';
import { renderTask, renderDependencyLinks } from '../render.mjs';
import { renderPage } from '../scripts/page.mjs';
import { normalizeState, statusOf } from '../model.mjs';

const byID = id => plan.tasks.find(task => task.id === id);

test('DevOps starts with a holding PoC, not a finished corporate website or company inventory', () => {
  assert.match(plan.scope?.summary ?? '', /PoC/);
  assert.match(byID('U01').title, /PoC/);
  assert.doesNotMatch(byID('U01').title, /şirket.*adlarını|girişim.*adlarını/);
  assert.match(plan.projects.find(project => project.name === 'Holding').action, /PoC|index/);
  assert.doesNotMatch(byID('E13').accept, /frontend.*eksiksiz.*ön koşul/);
});

test('all applications and Linux management are MCP work, not an opt-in Blender intent question', () => {
  assert.equal(plan.options.some(option => option.id === 'blenderCloud'), false);
  for (const id of ['B01', 'B02', 'B03']) assert.equal(byID(id).when, undefined);
  const mcp = [byID('E05'), byID('E06')].map(task => [task.title, task.output, task.accept, ...(task.steps ?? [])].join(' ')).join(' ');
  assert.match(mcp, /Linux|linux/);
  assert.match(mcp, /deploy|geri al|rollback/);
  assert.match(mcp, /Affinity/);
  assert.equal(statusOf(byID('B01'), normalizeState(null, plan), plan), 'waiting');
});

test('private service access has an authenticated web path and a conditional private-network fallback', () => {
  const access = [byID('U03'), byID('H03'), byID('H05'), byID('H06')].map(task => [task.title, task.output, task.accept, ...(task.steps ?? [])].join(' ')).join(' ');
  assert.match(access, /Nginx.*Basic Auth|Basic Auth.*Nginx/);
  assert.match(access, /Tailscale/);
  assert.match(access, /WebSocket|WS/);
  assert.match(access, /origin|doğrudan port/);
  assert.match(access, /Funnel/);
  assert.match(access, /noindex|robots/);
  const pen = [byID('E02').output, byID('E02').accept, ...(byID('E02').steps ?? [])].join(' ');
  assert.match(pen, /Storybook/);
  assert.match(pen, /kopya|sız|anonim|koru/);
});

test('Blender records work in progress without claiming installation acceptance', () => {
  const blender = plan.projects.find(project => project.name === 'Blender');
  assert.match(blender.status ?? '', /Sürüyor|sürüyor|devam/);
  assert.doesNotMatch(blender.status ?? '', /Tamamlandı|Kurulum bekliyor/);
  assert.doesNotMatch(byID('H06').title, /Blender.*olarak kur/);
  assert.equal(normalizeState(null, plan).completed.includes('H06'), false);
});

test('DNS preflight uses privately started packages before public DNS and TLS acceptance', () => {
  assert.ok(byID('H03').depends.includes('E13'));
  assert.match(byID('H03').steps.join(' '), /özel ağ|loopback/);
  assert.ok(byID('H04').depends.includes('H03'));
  assert.match(byID('H04').steps.join(' '), /DNS.*önce|DNS.*öncesi/);
  assert.ok(byID('A02').depends.includes('H04'));
  assert.ok(byID('H05').depends.includes('A02'));
  assert.doesNotMatch(byID('H05').steps.join(' '), /paketleri.*kur/);
});

test('every task exposes actionable steps outside optional delivery detail', () => {
  for (const task of plan.tasks) {
    assert.ok(Array.isArray(task.steps) && task.steps.length >= 2, task.id);
    const html = renderTask(task, normalizeState(null, plan), plan);
    assert.match(html, /class="task-steps"/);
    assert.ok(html.indexOf('class="task-steps"') < html.indexOf('<details'), task.id);
    assert.match(html, /Teslim ve kontrol/);
  }
  const html = renderPage(plan);
  for (const file of ['ismail-karaca', 'huseyin-cengiz', 'asistan-huseyin']) assert.ok(html.includes(`docs/${file}.md`), file);
  const dependencies = renderDependencyLinks(byID('E02'), normalizeState(null, plan), plan);
  assert.ok(dependencies.includes(byID('E01').title));
  assert.ok(dependencies.includes('İsmail Karaca'));
});
