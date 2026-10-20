// Superbafo pelos dutos: a fumaça sai pela boca de saída, na altura dela. Retorno do usuário (2026-10-20): na fase 10,
// "quando o bafo sai do cano, o efeito de fumaça acaba saindo na parte de baixo, quando deveria sair na ponta do cano
// que está do lado do pombo"; na fase 4, a saída do duto "muito baixa em comparação com onde está o pombo".
// A nuvem guarda a altura da boca (src/game/mechanics/scent.js, outlet.y), o desenho fica nela (src/fx/scentView.js),
// a poeirinha da saída também (scent:exit com y, src/fx/feedback.js), e a boca de cada duto fica do lado do pombo,
// na altura dele (o cenário de verdade, test/helpers/worldBuild.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createScentField } from '../src/game/mechanics/scent.js';
import { createScentView } from '../src/fx/scentView.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { LEVELS } from '../src/levels/index.js';
import fase4 from '../src/levels/fase4/index.js';
import fase10 from '../src/levels/fase10/index.js';
import { createHeadlessGame } from './helpers/headless.mjs';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { withSeedAsync } from './helpers/seeded.mjs';

const DT = 1 / 60;
const openWorld = (colliders = []) => createCollisionWorld({ WORLD: { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } }, STATIC_COLLIDERS: colliders });
/** Roda o campo de cheiro `secs` segundos, ou até `until()` (devolve se chegou lá). */
function runField(f, secs, until = null) {
  for (let t = 0; t < secs; t += DT) {
    f.update(DT);
    if (until?.()) return true;
  }
  return !until;
}
/** Cada campo de `want` igual ao de `got` (até 1 mm). */
function close(got, want, msg) {
  for (const [k, v] of Object.entries(want)) {
    assert.ok(Math.abs(got[k] - v) < 1e-3, `${msg}: ${k} = ${got[k]} (esperado ${v})`);
  }
}
/** O desenho da nuvem `c` (o grupo de bolhas no lugar dela) dentro do grupo do cheiro. */
function drawnCloud(cheiro, c) {
  cheiro.updateMatrixWorld(true);
  return cheiro.children.find((g) => g.name !== 'mira-do-bafo' && Math.abs(g.position.x - c.x) < 1e-9 && Math.abs(g.position.z - c.z) < 1e-9);
}
/** Altura (no mundo) da bolha do meio da nuvem desenhada. */
const midY = (g) => g.children[0].getWorldPosition(new THREE.Vector3()).y;
const bounds = (o) => new THREE.Box3().setFromObject(o, true);

test('cheiro: saindo de um duto, a nuvem aparece na boca de saída, na altura dela, e fica lá em cima', () => {
  /** @type {[string, any][]} */
  const events = [];
  // um poste no chão bem na frente da saída: lá em cima, a nuvem passa por cima dele
  const f = createScentField({ world: openWorld([{ id: 'poste', shape: 'circle', x: 5.45, z: 5, r: 0.14 }]), emit: (n, p) => events.push([n, p]) });
  f.addWind({ x: -2, z: 0, dirX: 1, dirZ: 0, length: 3, halfWidth: 0.4, strength: 2.4 });
  f.addDuct({ id: 'cano', inlet: { x: 0.8, z: 0, r: 0.35 }, outlet: { x: 5, y: 2.5, z: 5, dirX: 3, dirZ: 0, speed: 1.3, exit: 0.1 }, travel: 1 });
  const c = f.spawn({ x: -1.5, z: 0, dirX: 1, dirZ: 0, speed: 1 });
  assert.equal(c.y, 0, 'soprada pela Radhija, a nuvem fica no chão');
  assert.ok(runField(f, 5, () => events.some(([n]) => n === 'scent:exit')), 'o vento levou a nuvem pelo duto');
  const exit = events.find(([n]) => n === 'scent:exit')[1];
  close(exit, { x: 5.1, y: 2.5, z: 5, dirX: 1, dirZ: 0 }, 'scent:exit na boca, na altura dela e soprando para fora');
  close(c, { x: 5.1, y: 2.5, z: 5 }, 'a nuvem aparece na boca');
  assert.equal(c.exitAge, c.age, 'marca a hora em que saiu (o desenho nasce dali)');
  runField(f, 1);
  assert.equal(c.y, 2.5, 'continua na altura da boca');
  assert.ok(c.x > 5.5, `lá em cima, passa por cima do poste do chão (x=${c.x.toFixed(2)})`);
  assert.equal(f.near(c.x, c.z, 0.5), null, 'quem está no chão não alcança a nuvem lá em cima');
  assert.equal(f.near(c.x, c.z, 0.5, 2.4), c, 'na altura dela, sim');
  const low = f.spawn({ x: -6, z: -6, speed: 0 });
  assert.equal(f.near(-6, -6, 0.5), low, 'a nuvem no chão continua ao alcance de quem está no chão');
  // a mira marca a saída na boca, na altura dela
  const p = f.preview({ x: -1.5, z: 0, dirX: 1, dirZ: 0, speed: 1 }, { secs: 3.5 });
  assert.equal(p.exits.length, 1, 'a prévia mostra a saída do duto');
  close(p.exits[0], { x: 5.1, y: 2.5, z: 5 }, 'a prévia marca a saída na boca');
  assert.equal(p.points[0].y, 0, 'antes do duto, os pontinhos ficam no chão');
  assert.equal(p.points.at(-1).y, 2.5, 'depois da saída, na altura da boca');
});

test('cheiro: o desenho fica na altura da nuvem e, saindo de um duto, nasce do tamanho da boca e cresce', () => {
  const root = new THREE.Group();
  const view = createScentView(root);
  const f = createScentField({ view, world: openWorld() });
  f.addDuct({ id: 'cano', inlet: { x: 0, z: 0, r: 0.5 }, outlet: { x: 3, y: 2.5, z: 0, dirX: 1, dirZ: 0, speed: 0.4 }, travel: 0.5 });
  const ground = f.spawn({ x: -4, z: 4, speed: 0 });
  const high = f.spawn({ x: 0, z: 0, speed: 0 }); // na boca de entrada: engolida no primeiro quadro
  assert.ok(runField(f, 2, () => high.state === 'free' && high.exitAge >= 0), 'saiu do duto');
  const g0 = drawnCloud(view.group, high);
  assert.ok(g0?.visible, 'desenhada ao sair');
  assert.ok(Math.abs(midY(g0) - 2.5) < 1e-9, `a bolha do meio fica na altura da boca (${midY(g0)})`);
  const s0 = bounds(g0).getSize(new THREE.Vector3());
  assert.ok(Math.max(s0.x, s0.z) < 0.3, `nasce do tamanho da boca (${s0.x.toFixed(2)} × ${s0.z.toFixed(2)} m)`);
  assert.equal(g0.children[0].material.opacity, 0, 'e aparece aos poucos');
  runField(f, 0.6);
  const g1 = drawnCloud(view.group, high);
  const b1 = bounds(g1);
  assert.ok(Math.abs(midY(g1) - 2.5) < 1e-9, 'continua na altura da boca');
  assert.ok(b1.min.y > 2, `inteira lá em cima (de ${b1.min.y.toFixed(2)} a ${b1.max.y.toFixed(2)} m)`);
  assert.ok(b1.getSize(new THREE.Vector3()).x > s0.x * 2, 'cresceu ao sair');
  assert.ok(g1.children[0].material.opacity > 0.3, 'e apareceu');
  // a soprada pela Radhija continua no chão, como sempre
  const gg = drawnCloud(view.group, ground);
  assert.equal(gg.position.y, 0);
  const bg = bounds(gg);
  assert.ok(bg.getCenter(new THREE.Vector3()).y > 0.05 && bg.max.y < 0.8, 'no chão, as bolhas ficam por cima dele');
});

// ---------------------------------------------------------------------------------------------- fase 10: o cano de brinquedo
test('fase 10: a boca de trompete do cano fica do lado do pombo, virada para ele, e o cheiro sai pela beira larga', async (t) => {
  const { root, built, dispose } = await buildLevelWorld(fase10);
  t.after(dispose);
  const { TUBE, PIGEON, DECK, DECK_RAIL } = fase10.layout;
  const O = TUBE.outlet;
  const bell = /** @type {THREE.Mesh} */ (root.getObjectByName('boca-do-cano'));
  assert.ok(bell?.isMesh, 'a boca do cano existe');
  // os dois aros da boca, no mundo: o do topo do cilindro e o de baixo (centro pela caixa: o aro é simétrico e o
  // vértice da costura se repete)
  const pos = bell.geometry.attributes.position;
  const ring = (top) => {
    const pts = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0 === top) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(bell.matrixWorld));
    const c = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
    return { c, r: pts.reduce((a, p) => a + p.distanceTo(c), 0) / pts.length };
  };
  const wide = ring(true), narrow = ring(false);
  assert.ok(wide.r > narrow.r * 2, `a beira larga (${wide.r.toFixed(3)}) e a ponta fina (${narrow.r.toFixed(3)})`);
  assert.ok(wide.c.distanceTo(new THREE.Vector3(O.x, O.y, O.z)) < 0.005, `a beira larga fica em TUBE.outlet (${wide.c.toArray().map((v) => v.toFixed(3))})`);
  assert.ok(narrow.c.distanceTo(new THREE.Vector3(TUBE.mouth.x, TUBE.mouth.y, TUBE.mouth.z)) < 0.03, 'a ponta fina encaixa no fim do cano');
  const axis = wide.c.clone().sub(narrow.c).normalize();
  assert.ok(axis.dot(new THREE.Vector3(O.dirX, 0, O.dirZ)) > 0.999, 'a boca abre na direção em que o cheiro sai');
  // o pombo logo na frente da boca e na altura dela
  const toPigeon = new THREE.Vector3(PIGEON.x - O.x, 0, PIGEON.z - O.z);
  assert.ok(toPigeon.length() < PIGEON.smellR * 0.5, `o pombo fica logo na frente da boca (${toPigeon.length().toFixed(2)} m)`);
  assert.ok(toPigeon.normalize().dot(axis) > 0.95, 'a boca aponta para o pombo');
  const pigeon = built.props.pigeon.object;
  const pb = bounds(pigeon);
  assert.ok(O.y > pb.min.y && O.y < pb.max.y, `a boca na altura do pombo (${O.y.toFixed(2)} m; pombo de ${pb.min.y.toFixed(2)} a ${pb.max.y.toFixed(2)})`);
  // nada do pombo dentro da boca, e ela passa por cima do corrimão e do laço
  const len = wide.c.distanceTo(narrow.c);
  const inside = [];
  pigeon.traverse((/** @type {any} */ o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const d = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).sub(wide.c);
      const along = d.dot(axis);
      if (along > 0 || along < -len) continue;
      const rAt = wide.r + (narrow.r - wide.r) * (-along / len);
      if (d.addScaledVector(axis, -along).length() < rAt + 0.005) inside.push(o.name);
    }
  });
  assert.deepEqual(inside, [], 'nada do pombo dentro da boca do cano');
  const bb = bounds(bell);
  assert.ok(bb.min.y > DECK.h + DECK_RAIL.h + 0.005, `a boca passa por cima do corrimão (de ${bb.min.y.toFixed(3)} m)`);
  const bow = root.getObjectByName('ribbon');
  assert.ok(bow && !bb.intersectsBox(bounds(bow)), 'e não encosta no laço');
});

test('fase 10: o superbafo no funil sai pela boca do cano, lá em cima do lado do pombo, e se espalha ali', () => withSeedAsync(1, async () => {
  const h = await createHeadlessGame({ level: LEVELS.indexOf(fase10) + 1 });
  const { TUBE, PIGEON } = h.layout;
  const O = TUBE.outlet;
  h.run(0.3);
  h.game.debug.puzzle.debugSet('gate');
  h.teleport('radhija', TUBE.inlet.x, TUBE.inlet.z + 0.85, Math.PI);
  h.run(0.15);
  h.clearLog();
  h.keyDown('KeyR');
  h.run(0.3);
  h.keyUp('KeyR');
  assert.ok(h.run(5, { until: () => h.log('scent:exit').length > 0 }), 'o cheiro subiu pelo cano');
  const ex = h.log('scent:exit')[0];
  close(ex, { x: O.x, y: O.y, z: O.z, dirX: O.dirX, dirZ: O.dirZ }, 'scent:exit na boca do cano, na altura dela');
  assert.equal(h.info().quintal.pigeon, 'flying', 'o pombo sentiu na hora');
  const cloud = h.game.debug.scent.clouds.find((c) => c.id === ex.id);
  assert.ok(cloud && cloud.state === 'free', 'a nuvem sai do cano (não some)');
  const cheiro = h.engine.scene.getObjectByName('cheiro');
  const g0 = drawnCloud(cheiro, cloud);
  assert.ok(g0?.visible && Math.abs(midY(g0) - O.y) < 1e-9, `desenhada na boca, lá em cima (${g0 && midY(g0).toFixed(2)} m)`);
  const d0 = Math.hypot(cloud.x - PIGEON.x, cloud.z - PIGEON.z);
  h.run(0.5);
  assert.ok(h.game.debug.scent.clouds.includes(cloud), 'continua ali, se espalhando');
  const g1 = drawnCloud(cheiro, cloud);
  const b1 = bounds(g1);
  assert.ok(Math.abs(midY(g1) - O.y) < 1e-9 && b1.min.y > PIGEON.y - 0.3, `continua lá em cima, perto do pombo (de ${b1.min.y.toFixed(2)} a ${b1.max.y.toFixed(2)} m)`);
  assert.ok(Math.hypot(cloud.x - PIGEON.x, cloud.z - PIGEON.z) < d0, 'soprada na direção do pombo');
  assert.ok(h.game.debug.scent.clouds.every((c) => c.y > 2), 'nenhuma nuvem embaixo, no chão');
}));

// ---------------------------------------------------------------------------------------------- fase 4: o duto do terraço
test('fase 4: a saída do duto fica na altura do pombo do poleiro A, virada para ele, e a caixa dela acima das dogs', async (t) => {
  const { root, built, dispose } = await buildLevelWorld(fase4);
  t.after(dispose);
  const { DUCT, PERCH_A, DOGS } = fase4.layout;
  const O = DUCT.outlet;
  const hole = /** @type {THREE.Mesh} */ (root.getObjectByName('saida-do-duto'));
  assert.ok(hole?.isMesh, 'a boca de saída existe');
  const c = bounds(hole).getCenter(new THREE.Vector3());
  assert.ok(Math.abs(c.y - O.y) < 0.005, `o centro da boca de saída fica em DUCT.outlet.y (${c.y.toFixed(3)})`);
  const n = new THREE.Vector3().fromBufferAttribute(hole.geometry.attributes.normal, 0).transformDirection(hole.matrixWorld);
  assert.ok(n.dot(new THREE.Vector3(O.dirX, 0, O.dirZ)) > 0.99, 'a boca olha para onde o cheiro sai (o leste)');
  assert.ok(PERCH_A.x > c.x && PERCH_A.x - c.x < PERCH_A.smellR + 0.1 && Math.abs(PERCH_A.z - c.z) < 0.05, 'o poleiro A fica logo na frente da boca');
  const pb = bounds(built.props.pigeon.object);
  assert.ok(O.y > pb.min.y + 0.05 && O.y < pb.max.y - 0.05, `a boca na altura do pombo (${O.y.toFixed(2)} m; pombo de ${pb.min.y.toFixed(2)} a ${pb.max.y.toFixed(2)})`);
  // a caixa da saída (no pé) fica acima da cabeça das duas: embaixo dela, só o pé tem colisor
  const box = bounds(root.getObjectByName('caixa-da-saida-do-duto'));
  const head = Math.max(DOGS.radhija.visual.headTop, DOGS.rhaenyra.visual.headTop);
  assert.ok(box.min.y > head, `a caixa da saída começa a ${box.min.y.toFixed(2)} m (cabeça a ${head.toFixed(2)} m)`);
});

test('fase 4: o cheiro sai do duto na altura do pombo e chega nele', async () => {
  const h = await createHeadlessGame({ level: LEVELS.indexOf(fase4) + 1 });
  const { DUCT, PERCH_A, FAN, CORRIDOR } = h.layout;
  const O = DUCT.outlet;
  h.game.debug.setStage('passOpen');
  h.game.debug.puzzle.mech.fan.setPos(FAN.start.x, FAN.alignZ);
  h.run(0.3);
  assert.ok(h.info().fan.aligned, 'ventilador encaixado');
  h.teleport('radhija', 1.1, CORRIDOR.z, Math.PI / 2);
  h.run(0.2);
  h.clearLog();
  h.keyDown('KeyR');
  h.run(0.4);
  h.keyUp('KeyR');
  assert.ok(h.run(4, { until: () => h.log('scent:exit').length > 0 }), 'o vento levou o cheiro pelo duto');
  const ex = h.log('scent:exit')[0];
  close(ex, { x: O.x + O.exit, y: O.y, z: O.z, dirX: 1, dirZ: 0 }, 'scent:exit na boca da saída, na altura do pombo');
  const cloud = h.game.debug.scent.clouds.find((c) => c.id === ex.id);
  assert.equal(cloud?.y, O.y, 'a nuvem sai na altura da boca');
  assert.equal(h.info().pigeon, 'flying', 'o pombo sentiu');
  // o pombo decola depois de um instante (a câmera chega antes): a fumaça chega nele, na altura dele
  h.run(0.3);
  assert.ok(Math.abs(cloud.x - PERCH_A.x) < 0.25 && Math.abs(cloud.z - PERCH_A.z) < 0.05, `a nuvem chegou no poleiro (x=${cloud.x.toFixed(2)})`);
  const g = drawnCloud(h.engine.scene.getObjectByName('cheiro'), cloud);
  const b = bounds(g);
  assert.ok(Math.abs(midY(g) - O.y) < 1e-9, 'desenhada na altura da boca');
  assert.ok(b.min.y < PERCH_A.y + 0.1 && b.max.y > PERCH_A.y + 0.25, `cobre o pombo (de ${b.min.y.toFixed(2)} a ${b.max.y.toFixed(2)} m)`);
});
