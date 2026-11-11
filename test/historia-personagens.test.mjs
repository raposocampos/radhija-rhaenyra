// Modo História: os personagens novos do cap. 1 montados no Node (sem GPU):
//  - o SR. LUIZ (src/story/scene/srLuiz.js): todas as poses sem NaN, ~1,72 m de pé, dentro do orçamento de triângulos;
//    na guarita (o lugar de atores.js), sentado e de pé, cabe entre as paredes, acima do piso e sem atravessar o tampo
//    do balcão de dentro (as medidas de leste.js); a cadeira também;
//  - a PENA (src/story/scene/feather.js): deitada no apoio (y = 0), seca e molhada, sem NaN;
//  - o BICHANO (src/story/scene/bichano.js, o gato da fase 9): as poses encostam no apoio, sem NaN; no capô da
//    caminhonete, acima das dogs e dentro do colisor dela;
//  - atores.js entrega os três em props e o reset devolve cada um ao lugar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import L from '../src/story/areas/recanto/layout.js';
import { createSrLuiz, createGuardChair, CHAIR_OFFSET, SR_LUIZ_POSES } from '../src/story/scene/srLuiz.js';
import { createFeather } from '../src/story/scene/feather.js';
import { createBichano, BICHANO_POSES } from '../src/story/scene/bichano.js';
import { buildAtores, srLuizSpot, bichanoSpot, featherSill } from '../src/story/areas/recanto/world/atores.js';

installBrowserStubs();
const DT = 1 / 60;

/** Triângulos de tudo que é malha embaixo de `o`. */
function triangles(o) {
  let n = 0;
  o.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
}
/** Cada vértice no mundo: fn(v, malha). */
function eachWorldVertex(root, fn) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  root.traverse((m) => {
    if (!m.isMesh) return;
    for (let p = m; p; p = p.parent) if (p.visible === false) return;
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) fn(v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld), m);
  });
}
/** Caixa exata (vértice a vértice) no mundo. */
function worldBox(root) {
  const b = new THREE.Box3();
  eachWorldVertex(root, (v) => b.expandByPoint(v));
  return b;
}
function assertFinite(root, what) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    for (const x of o.matrixWorld.elements) assert.ok(Number.isFinite(x), `${what}: matriz com NaN em ${o.name || o.type}`);
  });
  const b = worldBox(root);
  for (const x of [...b.min.toArray(), ...b.max.toArray()]) assert.ok(Number.isFinite(x), `${what}: caixa com NaN`);
}
/** Roda `secs` segundos de update. */
function run(a, secs, t0 = 0) {
  const n = Math.round(secs / DT);
  for (let i = 1; i <= n; i++) a.update(DT, t0 + i * DT);
  return t0 + n * DT;
}

// ------------------------------------------------------------------------------------------------ as medidas da guarita
// (as mesmas contas de buildBooth em src/story/areas/recanto/world/leste.js)
const B = L.BOOTH;
const WALL_IN = 0.02 + 0.12; // o recuo da parede e a espessura dela
const INSIDE = { x0: B.x0 + WALL_IN, x1: B.x1 - WALL_IN, z0: B.z0 + WALL_IN, z1: B.z1 - WALL_IN, y0: 0.05, y1: B.roof - 0.17 - 0.06 };
const COUNTER = { x0: INSIDE.x0, x1: INSIDE.x1, z0: INSIDE.z1 - 0.46, z1: INSIDE.z1, y0: 0.765, y1: 0.8 };

/** Quantos vértices de `root` caem fora do miolo da guarita (com folga) ou dentro do tampo do balcão. */
function boothClash(root, margin = 0.01) {
  const out = [], inCounter = [];
  eachWorldVertex(root, (v, m) => {
    if (v.x < INSIDE.x0 + margin || v.x > INSIDE.x1 - margin || v.z < INSIDE.z0 + margin || v.z > INSIDE.z1 - margin || v.y < INSIDE.y0 - 0.002 || v.y > INSIDE.y1 - margin) {
      out.push(`${m.name}@${v.toArray().map((x) => x.toFixed(3))}`);
    }
    if (v.x > COUNTER.x0 && v.x < COUNTER.x1 && v.z > COUNTER.z0 - 0.003 && v.z < COUNTER.z1 && v.y > COUNTER.y0 - 0.003 && v.y < COUNTER.y1 + 0.003) {
      inCounter.push(`${m.name}@${v.toArray().map((x) => x.toFixed(3))}`);
    }
  });
  return { out, inCounter };
}

// ------------------------------------------------------------------------------------------------ o Sr. Luiz
test('Sr. Luiz: monta, ~1,72 m de pé, todas as poses sem NaN, orçamento de triângulos', () => {
  const s = createSrLuiz();
  const tris = triangles(s.object);
  let meshes = 0;
  s.object.traverse((o) => { if (o.isMesh) meshes++; });
  console.log(`  Sr. Luiz: ${tris} triângulos, ${meshes} malhas`);
  assert.ok(tris <= 6200, `até ~6 mil triângulos (tem ${tris})`);
  assert.ok(meshes <= 36, `poucas malhas (tem ${meshes})`);
  s.setPose('em-pe', undefined, { instant: true });
  run(s, 1);
  const b = worldBox(s.object);
  assert.ok(b.max.y > 1.66 && b.max.y < 1.78, `de pé, o alto do quepe a ~1,72 m (está a ${b.max.y.toFixed(3)})`);
  assert.ok(b.min.y > -0.005 && b.min.y < 0.01, `as botinas no chão (o mais baixo em ${b.min.y.toFixed(3)})`);
  let t = 1;
  for (const pose of SR_LUIZ_POSES) {
    for (const k of [undefined, 0, 0.3, 0.65, 1]) {
      s.setPose(pose, k);
      t = run(s, 0.5, t);
      assertFinite(s.object, `pose ${pose} k=${k}`);
    }
  }
  // as extras: olhar, falar, alcançar um ponto do mundo
  s.setPose('em-pe');
  s.lookAt({ x: 1, y: 0.4, z: 2 });
  s.say(true);
  s.reach('R', { x: -0.1, y: 1.0, z: 0.4 });
  t = run(s, 1, t);
  assertFinite(s.object, 'olhar, falar e alcançar');
  const hp = s.handPoint('R');
  assert.ok(Math.hypot(hp.x + 0.1, hp.y - 1.0, hp.z - 0.4) < 0.06, `a palma chega ao ponto pedido (${JSON.stringify(hp)})`);
  s.dispose();
});

test('Sr. Luiz: as malhas fechadas têm a face para fora (volume com sinal positivo)', () => {
  const s = createSrLuiz();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const name of ['sr-luiz:calca', 'sr-luiz:camisa', 'sr-luiz:rosto', 'sr-luiz:bigode', 'manga', 'coxa', 'canela', 'botina']) {
    let m = null;
    s.object.traverse((o) => { if (!m && o.isMesh && o.name === name) m = o; });
    assert.ok(m, `a malha ${name}`);
    const P = m.geometry.attributes.position, I = m.geometry.index;
    let vol = 0;
    for (let k = 0; k < I.count; k += 3) {
      a.fromBufferAttribute(P, I.getX(k)); b.fromBufferAttribute(P, I.getX(k + 1)); c.fromBufferAttribute(P, I.getX(k + 2));
      vol += a.dot(b.clone().cross(c)) / 6;
    }
    assert.ok(vol > 0, `${name}: as faces viradas para fora (volume ${vol.toExponential(2)})`);
  }
  s.dispose();
});

test('Sr. Luiz: andando, o passo acompanha o quanto o object anda (sem patinar)', () => {
  const s = createSrLuiz();
  s.setPose('anda', undefined, { instant: true });
  let t = 0;
  const feetZ = [];
  for (let i = 0; i < 90; i++) {
    s.object.position.z += 0.9 * DT;
    t += DT;
    s.update(DT, t);
    s.object.updateMatrixWorld(true);
    const ankle = s.parts.legs.L.ankle.getWorldPosition(new THREE.Vector3());
    feetZ.push({ z: ankle.z, y: ankle.y });
  }
  // a botina no chão (o tornozelo baixo) fica parada no mundo: anda quase nada entre dois quadros
  const planted = feetZ.slice(1).map((f, i) => ({ dz: Math.abs(f.z - feetZ[i].z), y: Math.min(f.y, feetZ[i].y) })).filter((f) => f.y < 0.125);
  assert.ok(planted.length > 10, 'a botina pisa no chão em parte do passo');
  const slide = planted.reduce((a, f) => a + f.dz, 0) / planted.length;
  assert.ok(slide < 0.006, `pisando, a botina quase não desliza (média ${(slide * 1000).toFixed(1)} mm por quadro; o corpo anda 15 mm)`);
  s.dispose();
});

test('Sr. Luiz: na guarita, sentado dormindo, acordando e de pé, cabe entre as paredes e não atravessa o balcão', () => {
  const s = createSrLuiz();
  const chair = createGuardChair();
  const spot = srLuizSpot(L);
  s.object.position.set(spot.x, spot.y, spot.z);
  s.object.rotation.y = spot.yaw;
  chair.object.position.set(spot.x + CHAIR_OFFSET.x, spot.y, spot.z + CHAIR_OFFSET.z);
  const scene = new THREE.Group();
  scene.add(s.object, chair.object);
  const check = (what) => {
    const { out, inCounter } = boothClash(s.object);
    assert.equal(out.length, 0, `${what}: o Sr. Luiz sai da guarita em ${out.length} vértices (${out.slice(0, 4).join(' ')})`);
    assert.equal(inCounter.length, 0, `${what}: o Sr. Luiz atravessa o balcão em ${inCounter.length} vértices (${inCounter.slice(0, 4).join(' ')})`);
  };
  s.setPose('dorme', undefined, { instant: true });
  let t = 0;
  for (let i = 0; i < 8; i++) { t = run(s, 0.45, t); check(`dormindo (t=${t.toFixed(1)})`); }
  for (const k of [0.12, 0.2, 0.3, 0.45, 0.7, 1]) { s.setPose('acorda', k); t = run(s, 0.3, t); check(`acordando k=${k}`); }
  s.setPose('em-pe');
  for (let i = 0; i < 8; i++) { t = run(s, 0.12, t); check(`levantando (${i})`); }
  t = run(s, 1.2, t);
  check('de pé');
  s.setPose('em-pe');
  s.setPose('dorme');
  for (let i = 0; i < 6; i++) { t = run(s, 0.15, t); check(`sentando de novo (${i})`); }
  const c = boothClash(chair.object);
  assert.equal(c.out.length + c.inCounter.length, 0, `a cadeira cabe na guarita sem atravessar o balcão (${[...c.out, ...c.inCounter].slice(0, 3).join(' ')})`);
  // dormindo, a cabeça aparece no vão do guichê (0,82 a 1,5 m do chão, na metade do leste)
  s.setPose('dorme', undefined, { instant: true });
  run(s, 0.5, t);
  const head = s.parts.head.getWorldPosition(new THREE.Vector3());
  const cx = (B.x0 + B.x1) / 2;
  assert.ok(head.y > 0.95 && head.y < 1.45, `a cabeça na altura do guichê (y=${head.y.toFixed(2)})`);
  assert.ok(head.x > cx - 0.75 && head.x < cx + 0.75, `a cabeça na largura do guichê (x=${head.x.toFixed(2)})`);
  s.dispose();
  chair.dispose();
});

// ------------------------------------------------------------------------------------------------ a pena
test('pena: deitada no apoio, seca e molhada, sem NaN, leve', () => {
  const f = createFeather();
  const tris = triangles(f.object);
  console.log(`  pena: ${tris} triângulos`);
  assert.ok(tris <= 1500, `a pena é leve (${tris} triângulos)`);
  const mesh = f.object.getObjectByName('pena-vexilo');
  assert.ok(mesh?.morphTargetInfluences?.length === 1, 'o alvo de morph da pena molhada');
  for (const w of [0, 0.45, 1]) {
    f.setWet(w);
    // a posição com o morph aplicado (o Node não desenha: a conta é a do shader)
    const P = mesh.geometry.attributes.position, M = mesh.geometry.morphAttributes.position[0];
    let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i) + (M.getY(i) - P.getY(i)) * w, z = P.getZ(i) + (M.getZ(i) - P.getZ(i)) * w;
      assert.ok(Number.isFinite(y) && Number.isFinite(z), 'pena sem NaN');
      minY = Math.min(minY, y); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    assert.ok(minY > -0.0015 && minY < 0.002, `molhada ${w}: encosta no apoio (o mais baixo em ${minY.toFixed(4)})`);
    assert.ok(maxY < 0.025, `molhada ${w}: deitada (o mais alto em ${maxY.toFixed(4)})`);
    assert.ok(maxZ - minZ > 0.12 && maxZ - minZ < 0.16, `molhada ${w}: ~13 cm (${(maxZ - minZ).toFixed(3)})`);
  }
  f.dispose();
});

// ------------------------------------------------------------------------------------------------ o Bichano
test('Bichano: o gato da fase 9 nas poses de testemunha, encostado no apoio, sem NaN', () => {
  const b = createBichano();
  const tris = triangles(b.object);
  console.log(`  Bichano: ${tris} triângulos`);
  assert.ok(tris <= 6000, `o gato da fase 9, com menos gomos (${tris} triângulos)`);
  let t = 0;
  for (const pose of BICHANO_POSES) {
    b.setPose(pose, undefined, { instant: true });
    t = run(b, 1.5, t);
    assertFinite(b.object, `bichano ${pose}`);
    const box = worldBox(b.object);
    assert.ok(box.min.y > -0.012 && box.min.y < 0.02, `${pose}: encosta no apoio (o mais baixo em ${box.min.y.toFixed(3)})`);
    assert.ok(box.max.y < 0.5, `${pose}: do tamanho de um gato (${box.max.y.toFixed(2)} m de altura)`);
  }
  b.lookAt({ x: 1, y: -0.5, z: 1 });
  b.say(true);
  b.setPose('brinca', 0.6);
  run(b, 1, t);
  assertFinite(b.object, 'bichano olhando e falando');
  b.dispose();
});

// ------------------------------------------------------------------------------------------------ atores.js
test('atores: o Sr. Luiz na guarita, a pena escondida e o Bichano no capô, e o reset devolve cada um', () => {
  const root = new THREE.Group();
  const A = buildAtores(root, L);
  const { srLuiz, feather, bichano, humans } = A.props;
  assert.ok(srLuiz && feather && bichano, 'props.srLuiz, props.feather e props.bichano');
  assert.ok(humans?.porteiro?.legs && humans.porteiro.hand?.userData?.grip, 'o porteiro antigo (a botina e a mão) continua lá para as cenas de hoje');
  assert.equal(srLuiz.pose, 'dorme');
  assert.equal(srLuiz.object.visible, true);
  assert.equal(feather.object.visible, false);
  assert.equal(bichano.pose, 'dorme');
  for (let i = 0; i < 30; i++) A.update(DT, i * DT);
  // o Bichano no capô: dentro da caminhonete em planta, acima da cabeça das dogs
  const cb = worldBox(bichano.object);
  const C = L.CAR;
  assert.ok(cb.min.x > C.x0 && cb.max.x < C.x1 && cb.min.z > C.z0 && cb.max.z < C.z1, `o Bichano em cima da caminhonete (${cb.min.toArray().map((x) => x.toFixed(2))} … ${cb.max.toArray().map((x) => x.toFixed(2))})`);
  assert.ok(cb.min.y > 1.0, `o Bichano acima das dogs (${cb.min.y.toFixed(2)} m)`);
  const BS = bichanoSpot(L);
  assert.ok(Math.abs(cb.min.y - BS.y) < 0.03, `deitado no capô (${cb.min.y.toFixed(3)} × ${BS.y.toFixed(3)})`);
  // a pena no parapeito
  feather.placeOnSill();
  const fs = featherSill(L);
  assert.ok(feather.object.visible && feather.object.position.distanceTo(new THREE.Vector3(fs.x, fs.y, fs.z)) < 1e-6, 'a pena no parapeito');
  // as cenas mexem, o reset devolve
  srLuiz.setPose('anda');
  srLuiz.object.position.set(L.GATE.x0, 0, L.GATE.z + 0.6);
  bichano.setPose('fala');
  for (let i = 0; i < 30; i++) A.update(DT, 1 + i * DT);
  A.reset();
  const LZ = srLuizSpot(L);
  assert.equal(srLuiz.pose, 'dorme');
  assert.ok(srLuiz.object.position.distanceTo(new THREE.Vector3(LZ.x, LZ.y, LZ.z)) < 1e-6, 'o Sr. Luiz de volta na guarita');
  assert.equal(bichano.pose, 'dorme');
  assert.equal(feather.object.visible, false);
  A.dispose();
});
