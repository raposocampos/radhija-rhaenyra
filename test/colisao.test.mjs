// Colisão: os testes de primitivas da fase 1 (tools/scripts/test-collision.mjs) e a regressão
// "arrancada atravessando a cerca", agora para TODAS as paredes finas de todas as fases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createController, placeController, steer, integrate, startDash, startJump } from '../src/game/dogController.js';
import { createHeadlessGame } from './helpers/headless.mjs';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';

const ALL = [...LEVELS, ...DEV_LEVELS];

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('primitivas, portão, carrinho e navegação da fase 1 (tools/scripts/test-collision.mjs)', () => {
  const r = spawnSync(process.execPath, ['tools/scripts/test-collision.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, / 0 falha\(s\)/);
});

/** Os segmentos (p0→p1) e (a→b) se cruzam? */
function crosses(p0x, p0z, p1x, p1z, ax, az, bx, bz) {
  const d = (x1, z1, x2, z2, x3, z3) => (x2 - x1) * (z3 - z1) - (z2 - z1) * (x3 - x1);
  const d1 = d(ax, az, bx, bz, p0x, p0z);
  const d2 = d(ax, az, bx, bz, p1x, p1z);
  const d3 = d(p0x, p0z, p1x, p1z, ax, az);
  const d4 = d(p0x, p0z, p1x, p1z, bx, bz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Linha central de um colisor fino (segmento, ou eixo longo de uma caixa estreita). null se não for fino. */
function centerline(c) {
  if (c.shape === 'segment') return { ax: c.ax, az: c.az, bx: c.bx, bz: c.bz };
  if (c.shape === 'box' && Math.min(c.hx, c.hz) < 0.3) {
    return c.hx < c.hz ? { ax: c.x, az: c.z - c.hz, bx: c.x, bz: c.z + c.hz } : { ax: c.x - c.hx, az: c.z, bx: c.x + c.hx, bz: c.z };
  }
  return null;
}

// Regressão: a arrancada da Radhija (passo grande por quadro) não pode atravessar paredes finas, nem com
// queda de FPS (o jogo limita dt a 1/20 s). Também testa a Rhaenyra andando e PULANDO contra as mesmas
// paredes (o pulo só passa por cima de colisores marcados jumpable).
for (const [idx, def] of ALL.entries()) {
  test(`${def.id}: arrancada, pulo e passos longos nunca atravessam paredes finas`, async () => {
    const h = await createHeadlessGame({ level: idx + 1, levels: ALL }); // mundo da etapa inicial (portões fechados)
    const world = h.world;
    const L = h.layout;
    const walls = [...world.statics, ...world.dynamics].filter((c) => c.enabled !== false && !c.except && !c.companionOnly && centerline(c));
    assert.ok(walls.length > 0);
    let tries = 0;
    const bad = [];
    const runs = [['radhija', 'arrancada'], ['rhaenyra', 'andando'], ['rhaenyra', 'pulo']];
    for (const [name, mode] of runs) {
      const cfg = L.DOGS[name];
      const c = createController(name, cfg);
      if (mode === 'pulo' && !cfg.jumpHeight) continue;
      for (const wall of walls) {
        if (wall.blocks !== 'all' && wall.blocks !== c.size) continue;
        if (mode === 'pulo' && wall.jumpable) continue;
        const { ax, az, bx, bz } = centerline(wall);
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        for (const u of [0.25, 0.5, 0.75]) {
          for (const side of [1, -1]) {
            for (const dt of [1 / 60, 1 / 30, 1 / 20]) {
              const px = ax + (bx - ax) * u + nx * side * (c.r + 0.35);
              const pz = az + (bz - az) * u + nz * side * (c.r + 0.35);
              if (world.overlaps(px, pz, c.r, c.size)) continue;
              const dx = -nx * side;
              const dz = -nz * side;
              placeController(c, px, pz, Math.atan2(dx, dz));
              if (mode === 'arrancada') startDash(c, dx, dz);
              if (mode === 'pulo') startJump(c, dx, dz);
              tries++;
              for (let t = 0; t < 0.8; t += dt) {
                const x0 = c.x;
                const z0 = c.z;
                steer(c, dt, { dx, dz, speed: cfg.walkSpeed });
                integrate(c, dt, world);
                if (crosses(x0, z0, c.x, c.z, ax, az, bx, bz)) {
                  bad.push(`${name} (${mode}) atravessou ${wall.id} (u=${u}, lado ${side}, dt=${dt.toFixed(3)})`);
                  break;
                }
              }
            }
          }
        }
      }
    }
    assert.ok(tries > 20, `poucas tentativas (${tries})`);
    assert.deepEqual(bad, []);
  });
}
