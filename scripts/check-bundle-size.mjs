// Fails the build when the JS loaded at startup exceeds the budget (SPEC §7).
// "Startup" = scripts referenced by dist/index.html + their static imports;
// lazily imported chunks (e.g. the planetary system scene) are not counted.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
// Provisional: the SPEC's 350 KB predates the WebGPU switch (three/webgpu alone ≈ 300 KB).
const BUDGET_KB = 450;

/** Script URLs referenced by the page: <script src>, island component/renderer URLs. */
function entryUrls(html) {
  const attr = /(?:src|component-url|renderer-url|before-hydration-url)="(\/_astro\/[^"]+\.js)"/g;
  const inlineImport = /import\s*(?:[^'"]*from\s*)?["'](\/_astro\/[^"']+\.js)["']/g;
  return [...html.matchAll(attr), ...html.matchAll(inlineImport)].map((m) => m[1]);
}

/** Static imports of a built chunk, as absolute /_astro/ URLs. */
function staticImports(code) {
  const re = /(?:import|export)\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g;
  return [...code.matchAll(re)].map((m) => `/_astro/${m[1]}`);
}

function collectStartupChunks(html) {
  const seen = new Set();
  const queue = entryUrls(html);
  while (queue.length > 0) {
    const url = queue.pop();
    if (url === undefined || seen.has(url)) continue;
    seen.add(url);
    queue.push(...staticImports(readFileSync(join(DIST, url), 'utf8')));
  }
  return [...seen];
}

const chunks = collectStartupChunks(readFileSync(join(DIST, 'index.html'), 'utf8'));
let totalKb = 0;
for (const url of chunks) {
  const kb = gzipSync(readFileSync(join(DIST, url)), { level: 9 }).length / 1024;
  totalKb += kb;
  console.log(`${kb.toFixed(1).padStart(8)} KB  ${url}`);
}
console.log(`${totalKb.toFixed(1).padStart(8)} KB  startup JS (gzip), budget ${BUDGET_KB} KB`);
if (totalKb > BUDGET_KB) {
  console.error('Bundle budget exceeded (SPEC §7).');
  process.exit(1);
}
