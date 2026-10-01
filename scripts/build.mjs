import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { plan } from '../plan.mjs';
import { validatePlan } from '../model.mjs';
import { renderPage } from '../render.mjs';

const root = new URL('../', import.meta.url);
const errors = validatePlan(plan);
if (errors.length) throw new Error(errors.join('\n'));
await mkdir(new URL('site/', root), { recursive: true });
await writeFile(new URL('site/index.html', root), renderPage(plan));
for (const file of ['app.mjs', 'plan.mjs', 'model.mjs', 'render.mjs', 'styles.css', 'favicon.svg']) {
  await copyFile(new URL(file, root), new URL(`site/${file}`, root));
}
await writeFile(new URL('site/.nojekyll', root), '');
console.log(`Built ${fileURLToPath(new URL('site/', root))}; ${plan.tasks.length} tasks.`);
