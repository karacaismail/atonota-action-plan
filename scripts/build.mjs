import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from '../plan.mjs';
import { validatePlan } from '../model.mjs';
import { renderPage } from './page.mjs';
import { guideFiles, renderRoleGuide, renderGeneralGuide } from './docs.mjs';

const root = new URL('../', import.meta.url);
const errors = validatePlan(plan);
if (errors.length) throw new Error(errors.join('\n'));
const output = new URL('site/', root);
const modules = ['app.mjs', 'plan.mjs', 'model.mjs', 'render.mjs'];
const clientFiles = [...modules, 'styles.css', 'favicon.svg'];
const sources = new Map(await Promise.all(clientFiles.map(async file => [file, await readFile(new URL(file, root))])));
for (const role of plan.roles) sources.set(`docs/${guideFiles[role.id]}`, Buffer.from(renderRoleGuide(plan, role.id)));
sources.set('docs/genel-yol.md', Buffer.from(renderGeneralGuide(plan)));
const html = renderPage(plan);
const digest = createHash('sha256');
for (const [file, source] of [['index.html', Buffer.from(html)], ...sources].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  digest.update(file + '\0' + source.length + '\0');
  digest.update(source);
}
const version = digest.digest('hex').slice(0, 12);

function versionURL(value, importer, required = false) {
  const fragmentAt = value.indexOf('#');
  const fragment = fragmentAt < 0 ? '' : value.slice(fragmentAt);
  const withoutFragment = fragmentAt < 0 ? value : value.slice(0, fragmentAt);
  const queryAt = withoutFragment.indexOf('?');
  const path = queryAt < 0 ? withoutFragment : withoutFragment.slice(0, queryAt);
  const file = posix.normalize(posix.join(posix.dirname(importer), path));
  if (!sources.has(file)) {
    if (required) throw new Error(`Relative module dependency is not emitted: ${importer} -> ${value}`);
    return value;
  }
  const query = new URLSearchParams(queryAt < 0 ? '' : withoutFragment.slice(queryAt + 1));
  query.set('v', version);
  return path + '?' + query + fragment;
}

function versionModule(source, file) {
  return source.replace(/(\b(?:import|export)\s+(?:[^;"'`]*?\bfrom\s*)?)(["'])(\.{1,2}\/[^"']+)\2/gu,
    (_, prefix, quote, value) => prefix + quote + versionURL(value, file, true) + quote)
    .replace(/(\bimport\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2/gu,
      (_, prefix, quote, value) => prefix + quote + versionURL(value, file, true) + quote);
}

await mkdir(new URL('docs/', output), { recursive: true });
const renderedHTML = html.replace(/\b(src|href)=(["'])(\.\/[^"']+)\2/gu,
  (_, attribute, quote, value) => attribute + '=' + quote + versionURL(value, 'index.html') + quote);
await writeFile(new URL('index.html', output), renderedHTML);
const assets = [];
const documents = [];
for (const [file, original] of sources) {
  const emitted = modules.includes(file) ? versionModule(original.toString('utf8'), file)
    : file.endsWith('.css') ? original.toString('utf8').replace(/(url\(\s*)(["'])(\.\/[^"']+)\2(\s*\))/gu,
      (_, prefix, quote, value, suffix) => prefix + quote + versionURL(value, file) + quote + suffix) : original;
  await writeFile(new URL(file, output), emitted);
  const record = {
    file, url: `./${file}?v=${version}`, rawBytes: Buffer.byteLength(emitted),
    sha256: createHash('sha256').update(emitted).digest('hex'),
  };
  if (file.startsWith('docs/')) documents.push({ ...record, delivery: 'on-demand' });
  else assets.push(record);
}
await writeFile(new URL('build-manifest.json', output), JSON.stringify({
  contentVersion: version,
  entry: { file: 'index.html', rawBytes: Buffer.byteLength(renderedHTML), sha256: createHash('sha256').update(renderedHTML).digest('hex') },
  initialAssets: assets,
  documents,
}, null, 2) + '\n');
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built ${fileURLToPath(output)}; ${plan.tasks.length} tasks; content version ${version}; 4 on-demand guides.`);
