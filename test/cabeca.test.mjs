// Cabeça que desvia (src/dogs/v2/head.js, etapa 4 da troca dos modelos): o peito e a garupa ficam fora das paredes pela
// colisão do jogo (collision.js resolveBody); a cabeça, que vai uns 18 cm além do peito, não entra: o desenho freia
// antes (aos poucos, chegando parado) e a cabeça vira farejando; raspando de lado, a cabeça gira para fora; indo embora,
// tudo volta. O jogo não muda: o centro da dog para onde parava.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserStubs } from './helpers/headless.mjs';
import { withSeed } from './helpers/seeded.mjs';
import { createCollisionWorld, penCircleBox } from '../src/game/collision.js';
import { createController, placeController, steer, integrate } from '../src/game/dogController.js';
import { withStart } from '../src/dogs/config.js';

installBrowserStubs();
const { createDogV2 } = await import('../src/dogs/v2/dog.js');

const DT = 1 / 60;
const KINDS = ['radhija', 'rhaenyra'];
const SEEDS = [101, 202, 303, 404];
const worldOf = (cols) => createCollisionWorld({ STATIC_COLLIDERS: cols, WORLD: { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } } });
const PAWS = ['FLp', 'FRp', 'HLp', 'HRp'];

/** A dog nova andando com o controle e a colisão do jogo (como game.js): segura (dx, dz) a `speed`. */
function drive(d, c, world, dx, dz, speed, secs, each = null, extra = {}) {
  for (let f = 0; f < Math.round(secs * 60); f++) {
    steer(c, DT, { dx, dz, speed });
    integrate(c, DT, world);
    d.object.position.set(c.x, 0, c.z);
    d.object.rotation.y = c.yaw;
    d.update(DT, { speed: c.animSpeed, turn: c.yawRate, action: 'none', ...extra });
    d.object.updateMatrixWorld(true);
    each?.(f);
  }
}
/** Quanto os pontos de contato da cabeça (nariz, focinho, cabeça) invadem as caixas `boxes`, pelo esqueleto de agora. */
function headPen(d, boxes) {
  const hb = d.bones.find((b) => b.name === 'head');
  let worst = 0;
  for (const o of d.head.offsets) {
    const p = hb.localToWorld(o.off.clone());
    for (const b of boxes) worst = Math.max(worst, penCircleBox(p.x, p.z, o.r, b.x, b.z, b.hx, b.hz)?.depth ?? 0);
  }
  return worst;
}
const pawsWorld = (d) => PAWS.map((n) => d.bones.find((b) => b.name === n).getWorldPosition(d.object.position.clone()));

test('cabeça: andando de frente para a parede, o desenho freia aos poucos e para com o focinho encostado; indo embora, volta', () => {
  const report = [];
  const bad = [];
  const WALL = { id: 'parede', shape: 'box', x: 0, z: 2.2, hx: 2, hz: 0.2 }; // face em z = 2
  for (const kind of KINDS) {
    for (const seed of SEEDS) {
      withSeed(seed, () => {
        const world = worldOf([WALL]);
        const d = createDogV2(kind);
        d.setWorld(world);
        const c = createController(kind, withStart(kind, { x: 0, z: 0, yaw: 0 }));
        placeController(c, 0, 0, 0);
        const m = { pen: 0, decel: 0, slide: 0, back: 0, yaw: 0, away: 0, awayPen: 0, why: '' };
        let fr = 0;
        let prevZ = null, prevV = null, prevPaws = null, prevSwing = null;
        const body = d.bones.find((b) => b.name === 'body');
        drive(d, c, world, 0, 1, c.cfg.walkSpeed, 2.2, () => {
          m.pen = Math.max(m.pen, headPen(d, [WALL]));
          // o desenho (o osso do meio do corpo): quanto ele desacelera de um quadro para o outro
          const z = body.getWorldPosition(d.object.position.clone()).z;
          if (prevZ !== null) {
            const v = (z - prevZ) / DT;
            if (prevV !== null) m.decel = Math.max(m.decel, (prevV - v) / DT);
            prevV = v;
          }
          prevZ = z;
          // a pata apoiada não escorrega enquanto o desenho freia e recua
          const paws = pawsWorld(d);
          const swing = d.locomotion.legs.map((l) => l.swing);
          fr++;
          if (prevPaws && d.gait > 0.99) {
            for (let i = 0; i < 4; i++) {
              if (swing[i] || prevSwing[i]) continue;
              const sl = Math.hypot(paws[i].x - prevPaws[i].x, paws[i].z - prevPaws[i].z);
              if (sl > m.slide) {
                m.slide = sl;
                const L = d.locomotion.legs[i], G = d.locomotion;
                // diagnóstico: o que a pata e o desenho faziam no quadro em que ela mais escorregou
                m.why = `${(fr / 60).toFixed(2)} s ${PAWS[i]}: arrastada ${L.dragged}, longe ${L.over}, esticada ${L.stretch.toFixed(3)}, recuo ${(d.head.info.back * 100).toFixed(1)} cm, corpo ${G.motion.v.toFixed(2)} m/s, no ar ${G.legs.filter((l) => l.swing).length}, centro ${c.v.toFixed(2)} m/s`;
              }
            }
          }
          prevPaws = paws;
          prevSwing = swing;
        });
        m.back = d.head.info.back;
        m.yaw = Math.abs(d.head.info.yaw);
        const stopZ = c.z;
        // vai embora (vira e anda para longe): a cabeça não entra virando e o desenho volta para o centro do jogo
        drive(d, c, world, 0, -1, c.cfg.walkSpeed, 1.6, () => { m.awayPen = Math.max(m.awayPen, headPen(d, [WALL])); });
        m.away = d.head.info.back;
        const tag = `${kind} (semente ${seed})`;
        report.push(`${tag}: parou com o centro a ${(2 - stopZ).toFixed(3)} m da parede; cabeça invadiu até ${(m.pen * 1000).toFixed(1)} mm (indo embora ${(m.awayPen * 1000).toFixed(1)} mm); o desenho recuou ${(m.back * 100).toFixed(1)} cm, cabeça virada ${(m.yaw * 57.3).toFixed(0)}°; freou até ${m.decel.toFixed(1)} m/s²; pata apoiada escorregou até ${(m.slide * 1000).toFixed(1)} mm/quadro (${m.why}); longe, recuo ${(m.away * 100).toFixed(1)} cm`);
        if (Math.abs(2 - stopZ - c.cfg.body.front) > 0.003) bad.push(`${tag}: o jogo mudou (centro a ${(2 - stopZ).toFixed(3)} m; o peito vai até ${c.cfg.body.front})`);
        if (m.pen > 0.012) bad.push(`${tag}: a cabeça entrou ${(m.pen * 1000).toFixed(1)} mm na parede`);
        if (m.awayPen > 0.012) bad.push(`${tag}: indo embora, a cabeça entrou ${(m.awayPen * 1000).toFixed(1)} mm`);
        if (m.back < 0.05) bad.push(`${tag}: o desenho não recuou (${(m.back * 100).toFixed(1)} cm)`);
        if (m.yaw < 0.1) bad.push(`${tag}: a cabeça não virou farejando (${(m.yaw * 57.3).toFixed(0)}°)`);
        if (m.decel > 30) bad.push(`${tag}: o desenho freou de repente (${m.decel.toFixed(1)} m/s²)`);
        if (m.slide > 0.004) bad.push(`${tag}: a pata apoiada escorregou ${(m.slide * 1000).toFixed(1)} mm num quadro`);
        if (m.away > 0.005) bad.push(`${tag}: longe da parede, o desenho continua recuado ${(m.away * 100).toFixed(1)} cm`);
      });
    }
  }
  console.log(`[cabeça] parede de frente\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('cabeça: andando rente à parede, de frente para uma quina e num corredor, a cabeça não entra', () => {
  const report = [];
  const bad = [];
  for (const kind of KINDS) {
    const cfg = withStart(kind, { x: 0, z: 0, yaw: 0 });
    const half = cfg.radius + 0.06;
    const cases = [
      // parede à direita (x > 0), andando quase junto dela e um pouco para ela (11°)
      { name: 'rente', boxes: [{ id: 'dir', shape: 'box', x: half + 0.3, z: 0, hx: 0.3, hz: 4 }], from: [0, -2.5, 0], dir: [Math.sin(0.2), Math.cos(0.2)], secs: 2 },
      // de frente para uma quina (a parede acaba 1 cm depois do meio da dog)
      { name: 'quina', boxes: [{ id: 'quina', shape: 'box', x: 1.01, z: 2.2, hx: 1.0, hz: 0.2 }], from: [0, 0, 0], dir: [0, 1], secs: 2 },
      // corredor com 6 cm de folga de cada lado, até o fim dele
      {
        name: 'corredor',
        boxes: [
          { id: 'esq', shape: 'box', x: -half - 0.3, z: 0, hx: 0.3, hz: 3 },
          { id: 'dir', shape: 'box', x: half + 0.3, z: 0, hx: 0.3, hz: 3 },
          { id: 'fim', shape: 'box', x: 0, z: 3.2, hx: 1, hz: 0.2 },
        ],
        from: [0, -2.5, 0], dir: [0, 1], secs: 3.4,
      },
    ];
    for (const K of cases) {
      withSeed(77, () => {
        const world = worldOf(K.boxes);
        const d = createDogV2(kind);
        d.setWorld(world);
        const c = createController(kind, cfg);
        placeController(c, K.from[0], K.from[1], K.from[2]);
        let pen = 0, yaw = 0;
        drive(d, c, world, K.dir[0], K.dir[1], cfg.walkSpeed, K.secs, () => {
          pen = Math.max(pen, headPen(d, K.boxes));
          yaw = Math.max(yaw, Math.abs(d.head.info.yaw));
        });
        report.push(`${kind} ${K.name}: cabeça invadiu até ${(pen * 1000).toFixed(1)} mm, virou até ${(yaw * 57.3).toFixed(0)}°, recuo no fim ${(d.head.info.back * 100).toFixed(1)} cm`);
        if (pen > 0.015) bad.push(`${kind} ${K.name}: a cabeça entrou ${(pen * 1000).toFixed(1)} mm`);
      });
    }
  }
  console.log(`[cabeça] rente, quina e corredor\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('cabeça: empurrando de pé (vai de propósito até a coisa) e fora de uma fase, ela não desvia', () => {
  for (const kind of KINDS) {
    const WALL = { id: 'parede', shape: 'box', x: 0, z: 2.2, hx: 2, hz: 0.2 };
    const world = worldOf([WALL]);
    const d = createDogV2(kind);
    d.setWorld(world);
    const c = createController(kind, withStart(kind, { x: 0, z: 0, yaw: 0 }));
    placeController(c, 0, 0, 0);
    drive(d, c, world, 0, 1, c.cfg.walkSpeed, 1.6);
    assert.ok(d.head.info.back > 0.05, `${kind}: encostada, o desenho recua (${(d.head.info.back * 100).toFixed(1)} cm)`);
    drive(d, c, world, 0, 1, 0.3, 1.2, null, { action: 'push', pushGap: c.cfg.body.front, pushTop: 0.9 });
    assert.ok(d.layers.head < 0.02, `${kind}: empurrando de pé, a cabeça não desvia (peso ${d.layers.head.toFixed(2)})`);
    d.setWorld(null);
    drive(d, c, world, 0, 1, c.cfg.walkSpeed, 1.2);
    assert.equal(d.layers.head, 0, `${kind}: sem mundo, nada`);
  }
});
