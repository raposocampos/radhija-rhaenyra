// Equilíbrio do irrigador da fase 2 (headless, mesmo código do jogo: colisão, controle, irrigador).
// Para cada omega candidato e cada trajetória reta (desvio lateral do centro), mede a fração das fases
// iniciais dos jatos em que a dog atravessa seca. Imprime a MELHOR trajetória de cada estratégia.
//   node tools/scripts/sim-sprinkler.mjs [--omega 2.4]
import layout from '../../src/levels/fase2/layout.js';
import { createCollisionWorld } from '../../src/game/collision.js';
import { createController, placeController, steer, integrate, startDash, canDash } from '../../src/game/dogController.js';
import { createSprinkler } from '../../src/game/mechanics/sprinkler.js';
import { createDogEffects } from '../../src/game/mechanics/dogEffects.js';

const argOmega = process.argv.includes('--omega') ? +process.argv[process.argv.indexOf('--omega') + 1] : null;
const BASE = layout.SPRINKLER;
// Entrada (perto do portão) e direção geral (para o registro); variamos o desvio lateral.
const E = { x: -1.45, z: 0.85 };
const U = (() => { const dx = 0.476, dz = -0.88; const L = Math.hypot(dx, dz); return { x: dx / L, z: dz / L }; })();

function run(SP, name, mode, phase, off) {
  const world = createCollisionWorld(layout);
  const effects = createDogEffects({ world, dogs: {} });
  const spr = createSprinkler({ cfg: SP, world, emit: () => {}, effects });
  const c = createController(name, layout.DOGS[name]);
  const sx = E.x - U.z * off;
  const sz = E.z + U.x * off;
  const wallX = layout.WALL_AB.x + layout.WALL_AB.thickness / 2;
  if (sx < wallX + c.r + 0.02 || world.overlaps(sx, sz, c.r, c.size)) return null;
  if (Math.hypot(sx - SP.x, sz - SP.z) < SP.r + c.r + 0.1) return null;
  placeController(c, sx, sz, Math.atan2(U.x, U.z));
  spr.angle = phase;
  const ctrls = { [name]: c };
  const dt = 1 / 60;
  for (let f = 0; f < 60 * 6; f++) {
    const d = Math.hypot(c.x - SP.x, c.z - SP.z);
    if (mode === 'dash' && canDash(c) && d < SP.r + c.r + 0.25) startDash(c, U.x, U.z);
    steer(c, dt, { dx: U.x, dz: U.z, speed: c.cfg.walkSpeed });
    integrate(c, dt, world);
    if (spr.update(dt, ctrls)) return false;
    const d2 = Math.hypot(c.x - SP.x, c.z - SP.z);
    const along = (c.x - SP.x) * U.x + (c.z - SP.z) * U.z;
    if (along > 0 && d2 > SP.r + c.r + 0.05) return true;
    if (f > 60 && c.animSpeed < 0.05) return null; // trajetória bloqueada por parede
  }
  return null;
}

const omegas = argOmega ? [argOmega] : [1.25, 1.8, 2.2, 2.6, 3.0];
for (const omega of omegas) {
  const SP = { ...BASE, omega };
  const period = (2 * Math.PI) / SP.jets / omega;
  const row = [];
  for (const [name, mode] of [['radhija', 'dash'], ['radhija', 'walk'], ['rhaenyra', 'walk']]) {
    let best = { frac: 0, off: null };
    for (let off = -1.2; off <= 1.21; off += 0.1) {
      let ok = 0;
      let valid = 0;
      const N = 120;
      for (let i = 0; i < N; i++) {
        const r = run(SP, name, mode, (i / N) * ((2 * Math.PI) / SP.jets), off);
        if (r === null) continue;
        valid++;
        if (r) ok++;
      }
      if (valid > N * 0.8 && ok / N > best.frac) best = { frac: ok / N, off };
    }
    row.push(`${name}/${mode}: ${(100 * best.frac).toFixed(0)}% (janela ${(best.frac * period).toFixed(2)} s, desvio ${best.off?.toFixed(1)})`);
  }
  console.log(`omega ${omega.toFixed(2)} (jato a cada ${period.toFixed(2)} s)  ${row.join('  |  ')}`);
}

// --phases: intervalos de fase bons para a trajetória usada no teste automatizado (desvio −0,3, arrancada)
if (process.argv.includes('--phases')) {
  const SP = { ...BASE };
  const N = 180;
  const res = [];
  for (let i = 0; i < N; i++) res.push(run(SP, 'radhija', 'dash', (i / N) * ((2 * Math.PI) / SP.jets), -0.3));
  const good = res.map((r, i) => (r ? ((i / N) * ((2 * Math.PI) / SP.jets)).toFixed(3) : null)).filter(Boolean);
  console.log(`fases boas (rad): ${good.join(' ')}`);
  console.log(`início: (${(E.x - U.z * -0.3).toFixed(3)}, ${(E.z + U.x * -0.3).toFixed(3)})`);
}
