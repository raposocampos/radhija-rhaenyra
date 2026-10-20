// Objetos do cenário na altura das dogs têm colisor, em TODAS as fases (registradas e de desenvolvimento): nenhuma
// dog pode ficar com o corpo por cima de um vaso, da perna de um móvel ou de uma pilha de coisas. Retorno do usuário
// na prévia do PR #48 (2026-10-20): "muitos objetos dos mapas ainda permanecem sem colisão".
// O cenário é montado DE VERDADE (test/helpers/worldBuild.mjs) e varrido por test/helpers/obstaculos.mjs contra o
// mundo de colisão do jogo na etapa inicial (estáticos do layout e dinâmicos do puzzle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { createHeadlessGame } from './helpers/headless.mjs';
import { findLooseObstacles } from './helpers/obstaculos.mjs';

const ALL = [...LEVELS, ...DEV_LEVELS];

// Atravessáveis de propósito: capim, florzinhas soltas no gramado e os ossinhos (as dogs passam por cima para pegar).
const SKIP = /^(grama-baixa|grama-alta|grama-do-morrinho|florzinhas|osso-.*)$/;
const skipped = (o) => {
  for (let p = o; p; p = p.parent) if (p.name && SKIP.test(p.name)) return true;
  return false;
};

const fmt = (f) => {
  const s = f.suggest;
  const sug = s.shape === 'circle' ? `circle x ${s.x} z ${s.z} r ${s.r}` : `box x ${s.x} z ${s.z} hx ${s.hx} hz ${s.hz}`;
  return `\n  • (${f.center.x}, ${f.center.z}) alcançado x[${f.box.minX}, ${f.box.maxX}] z[${f.box.minZ}, ${f.box.maxZ}]`
    + ` · desenho x[${f.foot.minX}, ${f.foot.maxX}] z[${f.foot.minZ}, ${f.foot.maxZ}] · y ${f.y[0]}–${f.y[1]}`
    + ` · entra ${f.depth} m (${f.sizes.join(', ')}) · ${f.points} pts\n    ${f.meshes.join('\n    ')}\n    sugestão: ${sug}`;
};

for (const [idx, def] of ALL.entries()) {
  test(`${def.id}: objetos do cenário na altura das dogs têm colisor`, async () => {
    const h = await createHeadlessGame({ level: idx + 1, levels: ALL });
    const { root, dispose } = await buildLevelWorld(def);
    try {
      const L = def.layout;
      const dogs = ['radhija', 'rhaenyra'].map((name) => ({
        name, size: L.DOGS[name].size, r: L.DOGS[name].radius, yMax: L.DOGS[name].visual.headTop * 0.85,
      }));
      const t0 = performance.now();
      const found = findLooseObstacles(root, h.world, { dogs, skip: skipped });
      const ms = Math.round(performance.now() - t0);
      console.log(`\n#### AUDITORIA ${def.id}: ${found.length} achado(s) em ${ms} ms; colisores ${h.world.statics.length} estáticos, ${h.world.dynamics.length} dinâmicos${found.map(fmt).join('')}\n#### FIM ${def.id}`);
      assert.equal(found.length, 0, `${found.length} desenho(s) na altura das dogs sem colisor`);
    } finally {
      dispose();
    }
  });
}
