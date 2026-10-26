// Copies the built site (dist/) to the repository root, which is what
// GitHub Pages serves from the `main` branch. Previously published files
// are removed first so stale hashed assets don't pile up. Model files are
// not published (too large for git); the app downloads them from their
// original hosts on first use and caches them for offline use.
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) throw new Error('Run `npm run build` first');

const isPublished = (name) =>
  ['index.html', 'assets', 'sw.js', 'manifest.webmanifest', 'icon.svg'].includes(name) ||
  /^workbox-.*\.js$/.test(name);

for (const name of readdirSync(root)) {
  if (isPublished(name)) rmSync(join(root, name), { recursive: true, force: true });
}
for (const name of readdirSync(dist)) {
  if (name === 'models') continue;
  cpSync(join(dist, name), join(root, name), { recursive: true });
}
// Serve files as-is (no Jekyll processing of the repository).
writeFileSync(join(root, '.nojekyll'), '');
console.log('Published dist/ to the repository root');
