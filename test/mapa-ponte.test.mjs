// Ponte levadiça do mapa das fases (src/levels/mapa: layout.js BRIDGE, world/clouds.js, puzzle.js). Retorno do usuário
// (2026-10-27, junto com o "pode integrar" do #71): "depois precisa melhorar a colisão da ponte, quando ela desce e
// passamos por cima dela, as patas ficam atravessando". Deitada, as tábuas ficam em BRIDGE.deck e um piso de pisar sem
// desenho (src/game/ground.js) põe as patas em cima delas; descendo, o rio segue fechado; as torres e o guarda-corpo
// colidem. A travessia é conferida com os modelos de verdade (o novo das duas e o atual da Radhija), que recebem quadro
// a quadro a posição, o rumo e a animação do jogo headless e o alto que o jogo daria com o chão do cenário de verdade
// (o mesmo cálculo de game.js), como em "a Radhija de verdade não vaza do balde" (fase10.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import mapa from '../src/levels/mapa/index.js';
import { BRIDGE, BRIDGE_TOWERS, RIVER } from '../src/levels/mapa/layout.js';
import { forgetLastVisit } from '../src/levels/mapa/puzzle.js';
import { LEVELS } from '../src/levels/index.js';
import { createGround, walkablesOf, bodyGround } from '../src/game/ground.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createHeadlessGame } from './helpers/headless.mjs';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { withSeedAsync } from './helpers/seeded.mjs';

const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { done: true, best: 80, treats: 1, total: 3, clears: 1 }]));
const ids = (n) => LEVELS.slice(0, n).map((d) => d.id);
const MID = (BRIDGE.x0 + BRIDGE.x1) / 2;
const HALF = (BRIDGE.x1 - BRIDGE.x0) / 2;
/** O alto da ponte deitada em x (as tábuas e as rampinhas das margens); null fora dela. */
const surface = (x) => {
  const R = BRIDGE.ramp;
  if (x >= BRIDGE.x0 && x <= BRIDGE.x1) return BRIDGE.deck;
  if (x > BRIDGE.x0 - R && x < BRIDGE.x0) return (BRIDGE.deck * (x - (BRIDGE.x0 - R))) / R;
  if (x > BRIDGE.x1 && x < BRIDGE.x1 + R) return (BRIDGE.deck * (BRIDGE.x1 + R - x)) / R;
  return null;
};
async function untilLoaded(h, timeout = 5000) {
  const t0 = Date.now();
  while (h.game.state === 'loading' && Date.now() - t0 < timeout) await new Promise((r) => setTimeout(r, 10));
  assert.notEqual(h.game.state, 'loading', 'a fase não terminou de carregar');
}

test('ponte: as quatro torres e o guarda-corpo colidem (em terra também); o meio da ponte fica livre', () => {
  const w = createCollisionWorld(mapa.layout);
  for (const t of BRIDGE_TOWERS) {
    assert.ok(w.contacts(t.x, t.z, 0.05, 'large').some((c) => c.id.startsWith('ponte-torre')), `torre em (${t.x}, ${t.z})`);
  }
  for (const s of [-1, 1]) {
    // nas dobradiças (em terra, fora do rio) e no meio
    for (const x of [BRIDGE.x0 + 0.1, MID, BRIDGE.x1 - 0.1]) {
      assert.ok(w.contacts(x, BRIDGE.z + s * BRIDGE.rail, 0.05, 'large').some((c) => c.id.startsWith('ponte-guarda')), `guarda-corpo em x ${x.toFixed(2)}, lado ${s}`);
    }
  }
  assert.deepEqual(w.contacts(MID, BRIDGE.z, 0.22, 'large').map((c) => c.id), []);
});

test('ponte: abrindo a chácara, o rio segue fechado enquanto ela desce; deitada, dá para atravessar', async () => {
  forgetLastVisit();
  const h = await createHeadlessGame({ level: 0, progress: { levels: done(...ids(7)) } });
  assert.equal(h.info().zones.chacara, false);
  // entra na 8 e conclui lá (a UI grava): ao voltar ao mapa, a chácara abre e a ponte desce animada
  h.events.emit('ui:menu', {});
  h.events.emit('ui:selectLevel', { index: 7 });
  await untilLoaded(h);
  Object.assign(h.save.levels, done('fase8'));
  h.clearLog();
  h.events.emit('ui:openMap', {});
  await untilLoaded(h);
  assert.equal(h.log('map:unlock').at(-1)?.zone, 'chacara');
  const block = h.world.getDynamic('ponte-levantada');
  assert.equal(block.enabled, true, 'acabou de abrir: a ponte ainda está levantada');
  // descendo, ela não deixa ninguém entrar (nem no pé das folhas, nas margens)
  const dog = h.game.activeDog;
  const west = mapa.layout.NAV_NODES.ponteOeste;
  h.teleport(dog, west.x, west.z, Math.PI / 2);
  h.walkTo(BRIDGE.x1 + 0.7, BRIDGE.z, { timeout: 1.5 });
  let c = h.ctrls[dog];
  assert.ok(c.x < BRIDGE.x0, `descendo, ela fica na margem (x ${c.x.toFixed(2)})`);
  assert.equal(block.enabled, true, 'ainda descendo');
  // deitada de vez (o atraso da olhadinha mais a descida), o rio abre
  h.run(1.8);
  assert.equal(block.enabled, false, 'deitada: dá para passar');
  h.walkTo(BRIDGE.x1 + 0.7, BRIDGE.z, { timeout: 12 });
  c = h.ctrls[dog];
  assert.ok(c.x > BRIDGE.x1, `atravessou (x ${c.x.toFixed(2)})`);
});

test('ponte: deitada, as patas da Radhija e da Rhaenyra (modelos de verdade) pisam nas tábuas, sem atravessar', async () => {
  await withSeedAsync(7, async () => {
    // o cenário de verdade, com o chão montado como no jogo: logo depois de construir, com a ponte ainda levantada
    const scene = await buildLevelWorld(mapa);
    try {
      const { root, built } = scene;
      const ground = createGround(walkablesOf(root));
      const bridge = built.props.bridge;
      assert.equal(bridge.down, false);
      assert.equal(ground.heightAt(MID, BRIDGE.z), 0, 'levantada, a ponte não é chão');
      bridge.setDown(true, { instant: true });
      root.updateMatrixWorld(true);

      // o alto das tábuas (desenho) e o do chão de pisar coincidem, de margem a margem
      const leaves = [];
      root.traverse((o) => { if (o.name === 'mapa:ponte-folha') leaves.push(o); });
      assert.equal(leaves.length, 2);
      const ray = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      const planks = Math.round(HALF / 0.3);
      for (let i = 0; i < planks; i++) {
        for (const x of [BRIDGE.x0 + 0.15 + i * 0.3, BRIDGE.x1 - 0.15 - i * 0.3]) {
          for (const dz of [-0.8, 0, 0.8]) {
            ray.set(new THREE.Vector3(x, 2, BRIDGE.z + dz), down);
            const hit = ray.intersectObjects(leaves, false)[0];
            assert.ok(hit && Math.abs(hit.point.y - BRIDGE.deck) < 0.002, `tábua em (${x.toFixed(2)}, ${dz}): ${hit?.point.y.toFixed(3)}`);
            assert.ok(Math.abs(ground.heightAt(x, BRIDGE.z + dz) - BRIDGE.deck) < 0.002, `chão de pisar em (${x.toFixed(2)}, ${dz})`);
          }
        }
      }

      // as rampinhas das margens: o chão sobe da rua até as tábuas
      for (const x of [BRIDGE.x0 - BRIDGE.ramp / 2, BRIDGE.x1 + BRIDGE.ramp / 2]) {
        const g = ground.heightAt(x, BRIDGE.z);
        assert.ok(Math.abs(g - BRIDGE.deck / 2) < 0.003, `rampinha em x ${x.toFixed(2)}: ${g.toFixed(3)}`);
      }

      // os modelos de verdade, espelhando o jogo headless (com tudo concluído, a ponte já deitada)
      const { createDog } = await import('../src/dogs/dog.js');
      const { createDogV2 } = await import('../src/dogs/v2/dog.js');
      forgetLastVisit();
      const h = await createHeadlessGame({ level: 0, progress: { levels: done(...ids(LEVELS.length)) } });
      assert.equal(h.world.getDynamic('ponte-levantada').enabled, false);
      const world = createCollisionWorld(mapa.layout);
      const models = /** @type {const} */ ([['novo', 'radhija'], ['novo', 'rhaenyra'], ['atual', 'radhija']]).map(([kind, name]) => {
        const d = kind === 'novo' ? createDogV2(name) : createDog(name);
        d.setWorld?.(world); // como o jogo faz
        d.setGround?.(ground.heightAt);
        return { kind, name, d, y: 0, gx: NaN, gz: NaN, flat: -Infinity, core: -Infinity, coreN: 0, span: -Infinity, rail: 0 };
      });
      const DT = 1 / 60;
      const v = new THREE.Vector3();
      /** Um quadro do jogo nos modelos: posição, rumo, animação e o alto do corpo como em game.js (suavizado). */
      const mirror = () => {
        for (const m of models) {
          const stub = h.dogs[m.name], c = h.ctrls[m.name];
          if (!stub.anim) continue;
          const gy = c.cfg.body ? bodyGround(ground, c.x, c.z, c.yaw, c.cfg.body) : ground.heightAt(c.x, c.z);
          const placed = !(Math.hypot(c.x - m.gx, c.z - m.gz) < 0.5);
          m.y = placed ? gy : m.y + (gy - m.y) * (1 - Math.exp(-14 * DT));
          m.gx = c.x;
          m.gz = c.z;
          m.d.object.position.set(c.x, m.y, c.z);
          m.d.object.rotation.y = c.yaw;
          m.d.update(DT, stub.anim);
        }
      };
      /**
       * A pele de cada modelo (de 3 em 3 vértices): o quanto afunda no chão da rua ('flat') ou na ponte: em cima do rio,
       * com o corpo inteiro nas tábuas ('core'), e na ponte toda, com as rampinhas das margens ('span').
       */
      const measure = (where) => {
        for (const m of models) {
          m.d.object.updateMatrixWorld(true);
          const mesh = m.d.meshes.body;
          const n = mesh.geometry.attributes.position.count;
          for (let i = 0; i < n; i += 3) {
            mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
            const dz = Math.abs(v.z - BRIDGE.z);
            if (where === 'flat') m.flat = Math.max(m.flat, -v.y);
            else if (dz < BRIDGE.rail - 0.06 && surface(v.x) != null) {
              m.span = Math.max(m.span, /** @type {number} */ (surface(v.x)) - v.y);
              if (v.x > RIVER.minX + 0.5 && v.x < RIVER.maxX - 0.5) {
                m.core = Math.max(m.core, BRIDGE.deck - v.y);
                m.coreN++;
              }
            }
            // nada da pele dentro do guarda-corpo (tábua de cima e os postes, até 0,5 m)
            if (Math.abs(v.x - MID) < HALF && dz > BRIDGE.rail - 0.05 && dz < BRIDGE.rail + 0.05 && v.y < BRIDGE.deck + 0.5) m.rail++;
          }
        }
      };
      /** Anda com a dog ativa até (x, z), espelhando e medindo cada quadro (e um tanto a mais, para a irmã chegar). */
      const walk = (x0, x1, z, where) => {
        h.teleport(h.game.activeDog, x0, z, x1 > x0 ? Math.PI / 2 : -Math.PI / 2);
        h.run(0.4);
        h.walkTo(x1, z, { timeout: 12, until: () => { mirror(); measure(where); return false; } });
        for (let i = 0; i < 150; i++) { h.step(); mirror(); measure(where); }
      };
      // na rua (o chão de sempre): a medida de comparação
      walk(BRIDGE.x0 - 7, BRIDGE.x0 - 1.6, BRIDGE.z, 'flat');
      // pela ponte, no meio e perto de cada guarda-corpo, nos dois sentidos
      walk(BRIDGE.x0 - 0.9, BRIDGE.x1 + 0.9, BRIDGE.z, 'deck');
      walk(BRIDGE.x1 + 0.9, BRIDGE.x0 - 0.9, BRIDGE.z + 0.85, 'deck');
      walk(BRIDGE.x0 - 0.9, BRIDGE.x1 + 0.9, BRIDGE.z - 0.85, 'deck');
      const cm = (x) => `${(x * 100).toFixed(1)} cm`;
      const report = models.map((m) => `${m.kind}/${m.name}: rua ${cm(m.flat)}, sobre o rio ${cm(m.core)} (${m.coreN} medidas), ponte toda ${cm(m.span)}, guarda-corpo ${m.rail}`).join('; ');
      console.log(`  ponte: ${report}`);
      for (const m of models) {
        assert.ok(m.coreN > 100, `${m.kind}/${m.name} passou pela ponte (${report})`);
        // sobre o rio, as patas ficam como na rua (no máximo 1 cm a mais do que a pele encosta no chão)
        assert.ok(m.core <= m.flat + 0.01, `${m.kind}/${m.name}: as patas afundam nas tábuas (${report})`);
        // o modelo novo (o do jogo) pisa pata por pata: nem nas rampinhas das pontas elas entram na madeira
        if (m.kind === 'novo') assert.ok(m.span <= m.flat + 0.02, `${m.kind}/${m.name}: na subida da ponte as patas entram nas tábuas (${report})`);
        assert.equal(m.rail, 0, `${m.kind}/${m.name}: a pele atravessa o guarda-corpo (${report})`);
      }
    } finally {
      scene.dispose();
    }
  });
});
