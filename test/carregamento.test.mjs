// Carregamento sob demanda: o cenário de cada fase (world/) fica fora do pacote inicial e só chega pelo
// `load()` da definição (docs/ARQUITETURA.md §3 e §4.1). Vale para fases novas automaticamente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const rel = (f) => relative(ROOT, f).split('\\').join('/');

/** Arquivos alcançados por imports ESTÁTICOS a partir de `entry` (os `import()` ficam de fora). */
function staticGraph(entry) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+\.js)['"]|^\s*import\s*['"](\.[^'"]+\.js)['"]/gm)) {
      visit(resolve(dirname(file), m[1] || m[2]));
    }
  };
  visit(resolve(ROOT, entry));
  return [...seen].map(rel);
}

test('carregamento: toda fase tem cenário, direto (build) ou sob demanda (load)', async () => {
  for (const def of [...LEVELS, ...DEV_LEVELS]) {
    const build = def.load ? (await def.load()).build : def.build;
    assert.equal(typeof build, 'function', `${def.id}: build ou load() → { build }`);
  }
});

test('carregamento: o cenário das fases não entra no pacote inicial (src/main.js)', () => {
  const graph = staticGraph('src/main.js');
  assert.ok(graph.includes('src/levels/index.js') && graph.includes('src/levels/fase1/puzzle.js'), 'o grafo segue os imports');
  const scenery = graph.filter((f) => /^src\/levels\/[^/]+\/world(\/|\.js$)/.test(f));
  assert.deepEqual(scenery, [], 'cenário importado estaticamente: use load: async () => ({ build: (await import(…)).buildWorld })');
});
