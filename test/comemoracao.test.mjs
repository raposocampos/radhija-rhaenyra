// Comemoração: a voltinha andando é só visual (o controle da dog fica parado no lugar dela), então o jogo escolhe
// antes o lado e o tamanho que cabem (src/game/celebrateLoop.js). Aqui, em todas as fases e arenas: o círculo não
// encosta em colisor nem na irmã e não passa por cima da borda de uma caminha (GOAL.celebrateRim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { DOG_PARAMS } from '../src/dogs/dogModel.js';
import { planCelebrateLoop, celebrateLoopPath } from '../src/game/celebrateLoop.js';

const ALL = [...LEVELS, ...DEV_LEVELS];
const NAMES = /** @type {const} */ (['radhija', 'rhaenyra']);

test('comemoração: a voltinha cabe no cenário em todas as fases (sem móvel, parede, irmã nem borda de caminha)', async (t) => {
  const plans = {};
  for (const [idx, def] of ALL.entries()) {
    const h = await createHeadlessGame({ level: idx + 1, levels: ALL });
    const L = h.layout;
    const G = L.GOAL;
    const cp = L.CAMERA.celebrate.pos;
    for (const n of NAMES) {
      const c = h.ctrls[n];
      const o = n === 'radhija' ? 'rhaenyra' : 'radhija';
      const spot = G.celebrate[n];
      // como no jogo: no lugar dela, virada para a câmera da comemoração
      const yaw = Math.atan2(cp[0] + (n === 'radhija' ? -0.6 : 0.6) - spot.x, cp[2] - spot.z);
      const s = DOG_PARAMS[n].s;
      const sister = { ...G.celebrate[o], r: h.ctrls[o].r };
      const plan = planCelebrateLoop({ ...spot, r: c.r, size: c.size, s, yaw, sister, rim: G.celebrateRim, overlaps: h.world.overlaps });
      plans[`${def.id}/${n}`] = plan.loop;
      if (plan.loop === 0) continue;
      // conferido bem mais fino que o plano (64 pontos por volta)
      for (const p of celebrateLoopPath({ ...spot, yaw, s, side: plan.side, loop: plan.loop }, 64)) {
        assert.ok(!h.world.overlaps(p.x, p.z, c.r, c.size), `${def.id}/${n}: a voltinha encosta num colisor em (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
        assert.ok(Math.hypot(p.x - sister.x, p.z - sister.z) > c.r + sister.r, `${def.id}/${n}: a voltinha encosta na irmã`);
        const rim = G.celebrateRim;
        if (rim) {
          const g = Math.hypot(p.x - rim.x, p.z - rim.z) - rim.r, g0 = Math.hypot(spot.x - rim.x, spot.z - rim.z) - rim.r;
          assert.ok(Math.sign(g) === Math.sign(g0), `${def.id}/${n}: a voltinha passa por cima da borda da caminha`);
          assert.ok(Math.abs(g) > Math.min(Math.abs(g0), c.r + (rim.tube ?? 0.1)) - 0.03, `${def.id}/${n}: a voltinha sobe na borda da caminha`);
        }
      }
    }
  }
  // as duas comemoram dentro da caminha da fase 5: não cabe voltinha (ficam nos pulinhos)
  assert.equal(plans['fase5/radhija'], 0, 'fase 5: Radhija na caminha, sem voltinha');
  assert.equal(plans['fase5/rhaenyra'], 0, 'fase 5: Rhaenyra na caminha, sem voltinha');
  // chão livre (o pátio do Canil): voltinha inteira
  assert.equal(plans['canil/radhija'], 1, 'Canil: voltinha inteira');
  assert.equal(plans['canil/rhaenyra'], 1, 'Canil: voltinha inteira');
  t.diagnostic(`tamanho da voltinha por fase/dog (0 = pulinhos): ${JSON.stringify(plans)}`);
});

test('comemoração: o lado da voltinha é o de longe da irmã quando cabe; encostada num móvel, vai para o outro lado', () => {
  const base = { x: 0, z: 0, r: 0.17, size: /** @type {const} */ ('small'), s: 1, yaw: 0, sister: { x: -0.7, z: 0, r: 0.22 } };
  // olhando para +z, a esquerda dela é +x: a irmã está à direita (−x), a voltinha vai para a esquerda
  assert.deepEqual(planCelebrateLoop({ ...base, overlaps: () => false }), { side: 1, loop: 1 });
  // uma parede à esquerda (x > 0,3): vai para a direita, e menor, para não encostar na irmã
  const wall = (x) => x + 0.17 > 0.3;
  const p = planCelebrateLoop({ ...base, overlaps: (x) => wall(x) });
  assert.equal(p.side, -1);
  assert.ok(p.loop > 0 && p.loop < 1, `voltinha menor do lado da irmã (${p.loop})`);
  // espremida dos dois lados: só pulinhos
  assert.equal(planCelebrateLoop({ ...base, overlaps: (x) => Math.abs(x) + 0.17 > 0.25 }).loop, 0);
});
