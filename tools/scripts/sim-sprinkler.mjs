// Equilíbrio do irrigador da fase 2 (headless, mesmo código do jogo: colisão, controle, irrigador).
// Para cada omega candidato e cada trajetória reta (desvio lateral do centro), mede a fração das fases
// iniciais dos jatos em que a dog atravessa seca. Imprime a MELHOR trajetória de cada estratégia.
//   node tools/scripts/sim-sprinkler.mjs [--omega 2.4] [--phases]
// As funções exportadas (crossing, bestWindow, goodPhases) são usadas por test/irrigador.test.mjs.
import { pathToFileURL } from 'node:url';
import layout from '../../src/levels/fase2/layout.js';
import { createCollisionWorld } from '../../src/game/collision.js';
import { createController, placeController, steer, integrate, startDash, canDash } from '../../src/game/dogController.js';
import { createSprinkler } from '../../src/game/mechanics/sprinkler.js';
import { createDogEffects } from '../../src/game/mechanics/dogEffects.js';

export const BASE = layout.SPRINKLER;
// Entrada (perto do portão) e direção geral (para o registro); variamos o desvio lateral.
const E = { x: -1.45, z: 0.85 };
const U = (() => { const dx = 0.476, dz = -0.88; const L = Math.hypot(dx, dz); return { x: dx / L, z: dz / L }; })();

/**
 * Uma travessia em linha reta. mode 'dash' | 'walk'; phase = ângulo inicial do 1º jato; off = desvio lateral.
 * → true (atravessou seca), false (molhou) ou null (trajetória inválida/bloqueada).
 */
export function crossing(SP, name, mode, phase, off) {
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

/** Melhor trajetória (desvio lateral) para uma estratégia: { frac (0..1 das fases), off, window (s) }. */
export function bestWindow(SP, name, mode, N = 120) {
  const period = (2 * Math.PI) / SP.jets / SP.omega;
  let best = { frac: 0, off: null };
  for (let off = -1.2; off <= 1.21; off += 0.1) {
    let ok = 0;
    let valid = 0;
    for (let i = 0; i < N; i++) {
      const r = crossing(SP, name, mode, (i / N) * ((2 * Math.PI) / SP.jets), off);
      if (r === null) continue;
      valid++;
      if (r) ok++;
    }
    if (valid > N * 0.8 && ok / N > best.frac) best = { frac: ok / N, off };
  }
  return { ...best, window: best.frac * period };
}

/** Fases iniciais dos jatos em que a arrancada da Radhija pela trajetória das partidas automatizadas (desvio −0,3) passa seca. */
export function goodPhases(SP = BASE, N = 180) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const ph = (i / N) * ((2 * Math.PI) / SP.jets);
    if (crossing(SP, 'radhija', 'dash', ph, -0.3)) out.push(ph);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argOmega = process.argv.includes('--omega') ? +process.argv[process.argv.indexOf('--omega') + 1] : null;
  const omegas = argOmega ? [argOmega] : [1.25, 1.8, 2.2, 2.6, 3.0];
  for (const omega of omegas) {
    const SP = { ...BASE, omega };
    const period = (2 * Math.PI) / SP.jets / omega;
    const row = [];
    for (const [name, mode] of [['radhija', 'dash'], ['radhija', 'walk'], ['rhaenyra', 'walk']]) {
      const best = bestWindow(SP, name, mode);
      row.push(`${name}/${mode}: ${(100 * best.frac).toFixed(0)}% (janela ${best.window.toFixed(2)} s, desvio ${best.off?.toFixed(1)})`);
    }
    console.log(`omega ${omega.toFixed(2)} (jato a cada ${period.toFixed(2)} s)  ${row.join('  |  ')}`);
  }

  // --phases: intervalos de fase bons para a trajetória usada no teste automatizado (desvio −0,3, arrancada)
  if (process.argv.includes('--phases')) {
    console.log(`fases boas (rad): ${goodPhases().map((p) => p.toFixed(3)).join(' ')}`);
    console.log(`início: (${(E.x - U.z * -0.3).toFixed(3)}, ${(E.z + U.x * -0.3).toFixed(3)})`);
  }
}
