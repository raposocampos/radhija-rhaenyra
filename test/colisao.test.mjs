// Colisão: os testes de primitivas da fase 1 (tools/scripts/test-collision.mjs) e a regressão
// "arrancada atravessando a cerca", agora para TODAS as paredes finas de todas as fases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createController, placeController, steer, integrate, startDash, startJump } from '../src/game/dogController.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { withStart } from '../src/dogs/config.js';
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

// ---------------------------------------------------------------------------------------------------------------
// Corpo comprido (etapa 4 dos modelos novos): o peito e a garupa passam do círculo do meio; dois círculos menores
// (DOG_CONFIG[nome].body, collision.js resolveBody) seguram o corpo fora de paredes e móveis sem mudar os vãos.
// ---------------------------------------------------------------------------------------------------------------
const box = (id, x, z, hx, hz, extra = {}) => ({ id, shape: 'box', x, z, hx, hz, ...extra });
const arena = (colliders) => createCollisionWorld({ STATIC_COLLIDERS: colliders, WORLD: { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } } });
const DT = 1 / 60;
/** Anda segurando a direção (dx, dz) por `secs` s; each(c) depois de cada quadro. */
function hold(c, world, dx, dz, secs, each = null, speed = c.cfg.walkSpeed) {
  for (let t = 0; t < secs; t += DT) {
    steer(c, DT, { dx, dz, speed });
    integrate(c, DT, world);
    each?.(c);
  }
}
/** Anda rumo ao ponto (tx, tz), como quem segura o analógico apontando para lá. */
function drive(c, world, tx, tz, secs, each = null) {
  for (let t = 0; t < secs; t += DT) {
    const dx = tx - c.x, dz = tz - c.z, L = Math.hypot(dx, dz) || 1;
    steer(c, DT, { dx: dx / L, dz: dz / L, speed: c.cfg.walkSpeed });
    integrate(c, DT, world);
    each?.(c);
  }
}
/** Centros do peito e da garupa. */
const parts = (c) => {
  const b = c.cfg.body;
  const sx = Math.sin(c.yaw), sz = Math.cos(c.yaw);
  return [[c.x + sx * (b.front - b.r), c.z + sz * (b.front - b.r)], [c.x - sx * (b.back - b.r), c.z - sz * (b.back - b.r)]];
};

test('corpo: o peito para na parede (o círculo do meio nem encosta) e a garupa não entra ao virar de costas para ela', () => {
  for (const name of ['radhija', 'rhaenyra']) {
    const cfg = withStart(name, { x: 0, z: 0, yaw: 0 });
    const b = cfg.body;
    assert.ok(b.front - b.r < cfg.radius && b.back - b.r < cfg.radius && b.r < cfg.radius, `${name}: peito e garupa dentro do círculo do meio`);
    const world = arena([box('parede', 0, 2.2, 3, 0.2)]); // face em z = 2
    const c = createController(name, cfg);
    placeController(c, 0, 0, 0);
    hold(c, world, 0, 1, 2.5);
    assert.ok(Math.abs(c.z + b.front - 2) < 0.002, `${name}: o peito encosta na parede (centro a ${(2 - c.z).toFixed(3)} m dela, peito a ${b.front})`);
    assert.ok(c.z + c.r < 2 - 0.01, `${name}: o círculo do meio fica longe da parede`);
    // agora vira de costas (a garupa passa rente à parede) e anda para longe: a garupa nunca entra
    let worst = 0;
    hold(c, world, 0, -1, 1.5, (k) => {
      for (const [, pz] of parts(k)) worst = Math.max(worst, pz + b.r - 2);
      worst = Math.max(worst, k.z + k.r - 2);
    });
    assert.ok(worst < 0.002, `${name}: virando de costas, nada entrou na parede (${(worst * 1000).toFixed(1)} mm)`);
    assert.ok(c.z < 0.5, `${name}: e foi embora (z = ${c.z.toFixed(2)})`);
  }
});

test('corpo: os vãos continuam os mesmos (passa onde o círculo do meio passa; o vão da Radhija segura a Rhaenyra)', () => {
  for (const name of ['radhija', 'rhaenyra']) {
    const cfg = withStart(name, { x: 0, z: -1.5, yaw: 0 });
    // corredor com 2 cm de folga para o círculo do meio, de frente e entrando torto (30°)
    const half = cfg.radius + 0.01;
    const world = arena([box('esq', -half - 0.5, 0, 0.5, 0.6), box('dir', half + 0.5, 0, 0.5, 0.6)]);
    // de frente e chegando de lado (escorrega pela quina até a entrada)
    for (const x0 of [0, -0.5]) {
      const c = createController(name, cfg);
      placeController(c, x0, -1.5, 0);
      let bad = false;
      drive(c, world, 0, 1.6, 3, (k) => { if (world.overlaps(k.x, k.z, k.r - 1e-3, k.size)) bad = true; });
      assert.ok(!bad, `${name}: o círculo do meio nunca entra (saindo de x = ${x0})`);
      assert.ok(c.z > 1, `${name}: passou pelo corredor justo (saindo de x = ${x0}, z = ${c.z.toFixed(2)})`);
    }
  }
  // vão de 0,4 m que só a Radhija passa (colisor 'large' no meio)
  const world = arena([box('esq', -0.7, 0, 0.5, 0.3), box('dir', 0.7, 0, 0.5, 0.3), box('vao', 0, 0, 0.2, 0.3, { blocks: 'large' })]);
  for (const [name, passes] of [['radhija', true], ['rhaenyra', false]]) {
    const c = createController(name, withStart(name, { x: 0, z: -1.2, yaw: 0 }));
    placeController(c, 0, -1.2, 0);
    hold(c, world, 0, 1, 2.5);
    assert.equal(c.z > 0.6, passes, `${name}: ${passes ? 'passa' : 'não passa'} pelo vão (z = ${c.z.toFixed(2)})`);
  }
});

test('corpo: num corredor justo ela vira para trás sem travar (o peito e a garupa cedem; o do meio, nunca)', () => {
  for (const name of ['radhija', 'rhaenyra']) {
    const cfg = withStart(name, { x: 0, z: 0, yaw: 0 });
    const half = cfg.radius + 0.01;
    const world = arena([box('esq', -half - 0.5, 0, 0.5, 3), box('dir', half + 0.5, 0, 0.5, 3)]);
    const c = createController(name, cfg);
    placeController(c, 0, 0, 0);
    hold(c, world, 0, 1, 0.4);
    let bad = '';
    hold(c, world, 0, -1, 2.0, (k) => {
      if (!Number.isFinite(k.x + k.z + k.yaw)) bad = 'NaN';
      else if (world.overlaps(k.x, k.z, k.r - 1e-3, k.size)) bad = `o círculo do meio entrou (x = ${k.x.toFixed(3)})`;
    });
    assert.equal(bad, '', name);
    assert.ok(Math.cos(c.yaw) < -0.95, `${name}: virou para trás (rumo ${(c.yaw * 57.3).toFixed(0)}°)`);
    assert.ok(c.z < -1, `${name}: e andou de volta pelo corredor (z = ${c.z.toFixed(2)})`);
  }
});

test('corpo: a batida de frente conta no peito (som e tranco da batida continuam)', () => {
  const world = arena([box('parede', 0, 2.2, 3, 0.2)]);
  const c = createController('radhija', withStart('radhija', { x: 0, z: 0, yaw: 0 }));
  placeController(c, 0, 0.6, 0);
  startDash(c, 0, 1);
  let bump = null;
  for (let t = 0; t < 0.5 && !bump; t += DT) {
    steer(c, DT, { dx: 0, dz: 1, speed: c.cfg.walkSpeed });
    bump = integrate(c, DT, world).bump;
  }
  assert.ok(bump && bump.id === 'parede', `batida na parede (${JSON.stringify(bump)})`);
  assert.ok(c.hits.some((h) => h.id === 'parede'), 'contato registrado');
});
