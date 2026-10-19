// Modelo novo das cachorrinhas (src/dogs/v2/): monta no Node com o esqueleto novo, segue a pose do esqueleto atual
// em todas as ações e nada do corpo passa do chão. Também confere o orçamento (ossos e triângulos) contra o atual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';

installBrowserStubs();
const { createDog } = await import('../src/dogs/dog.js');
const { createDogV2 } = await import('../src/dogs/v2/dog.js');
const { BONE_NAMES_V2, BONES_V2 } = await import('../src/dogs/v2/skeleton.js');
const { buildDesignV2, paramsV2 } = await import('../src/dogs/v2/design.js');
const { DOG_PARAMS, buildDesign } = await import('../src/dogs/dogModel.js');
const { EXTRA_TIME } = await import('../src/game/extras.js');

const KINDS = ['radhija', 'rhaenyra'];
const v1 = Object.fromEntries(KINDS.map((k) => [k, createDog(k)]));
const v2 = Object.fromEntries(KINDS.map((k) => [k, createDogV2(k)]));
const v = new THREE.Vector3();
const w = new THREE.Vector3();

test('modelo novo: esqueleto de 38 ossos, pais antes dos filhos e os nomes antigos preservados', () => {
  assert.equal(BONE_NAMES_V2.length, 38);
  assert.equal(new Set(BONE_NAMES_V2).size, BONE_NAMES_V2.length, 'nomes únicos');
  BONES_V2.forEach(([name, parent], i) => {
    if (parent) assert.ok(BONE_NAMES_V2.indexOf(parent) < i, `${name}: pai ${parent} vem antes`);
  });
  for (const n of ['body', 'hips', 'chest', 'neck', 'head', 'jaw', 'FLu', 'FLl', 'FLp', 'FRp', 'HLu', 'HLl', 'HLm', 'HLp', 'HRp', 'tail0', 'earL0', 'earR0']) {
    assert.ok(BONE_NAMES_V2.includes(n), `osso ${n}`);
  }
  for (const kind of KINDS) {
    const d = v2[kind];
    assert.equal(d.bones.length, 38);
    assert.equal(d.model, 'v2');
    // todas as primitivas presas a um osso que existe
    const design = buildDesignV2(paramsV2(kind));
    for (const g of [...design.bodyGroups, ...design.earGroups]) for (const p of g.prims) assert.ok(BONE_NAMES_V2.includes(p.bone), `${kind}: primitiva no osso ${p.bone}`);
  }
});

test('modelo novo: as juntas que já existiam ficam no mesmo lugar do modelo atual', () => {
  for (const kind of KINDS) {
    const a = buildDesign(DOG_PARAMS[kind]).bones;
    const b = buildDesignV2(paramsV2(kind)).bones;
    for (const n of ['body', 'hips', 'chest', 'neck', 'head', 'jaw', 'FLu', 'FLl', 'HLu', 'HLl', 'HLm', 'HLp', 'earL0', 'tail0']) {
      const d = Math.hypot(a[n][0] - b[n][0], a[n][1] - b[n][1], a[n][2] - b[n][2]);
      assert.ok(d < 1e-6, `${kind}: ${n} mudou ${d}`);
    }
    // o pulso novo fica onde era a "pata" (pulso) do atual
    const d = Math.hypot(...a.FLp.map((x, i) => x - b.FLc[i]));
    assert.ok(d < 1e-6, `${kind}: pulso`);
  }
});

test('modelo novo: pesos válidos (4 ossos por vértice, somam 1) nas três malhas', () => {
  for (const kind of KINDS) {
    const d = v2[kind];
    for (const [name, m] of Object.entries(d.meshes)) {
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      for (let i = 0; i < si.count; i += 7) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const wt = sw.getComponent(i, k);
          assert.ok(wt >= 0, `${kind}/${name}: peso negativo`);
          assert.ok(si.getComponent(i, k) < d.bones.length, `${kind}/${name}: índice de osso`);
          sum += wt;
        }
        assert.ok(Math.abs(sum - 1) < 1e-3, `${kind}/${name}: soma ${sum}`);
      }
    }
  }
});

test('modelo novo: mesma API do atual e orçamento de malha (ossos ≤ 40, triângulos ≤ 115% do atual)', () => {
  for (const kind of KINDS) {
    const a = v1[kind], b = v2[kind];
    for (const k of ['kind', 'object', 'mouthSocket', 'markerAnchor', 'update', 'triggerBark', 'setCarryPose', 'carryKind', 'setWet', 'setMud', 'setShine', 'mud', 'bones', 'skeleton', 'meshes', 'stats']) {
      assert.ok(k in b, `${kind}: ${k}`);
      assert.equal(typeof b[k], typeof a[k], `${kind}: tipo de ${k}`);
    }
    assert.ok(b.bones.length <= 40);
    for (const part of ['body', 'ears', 'fur']) {
      const ratio = b.stats.tris[part] / a.stats.tris[part];
      assert.ok(ratio <= 1.15, `${kind}: triângulos de ${part} ${b.stats.tris[part]} × ${a.stats.tris[part]} (${(ratio * 100).toFixed(0)}%)`);
    }
    console.log(`[v2] ${kind}: ${b.bones.length} ossos, tris ${JSON.stringify(b.stats.tris)} (atual ${JSON.stringify(a.stats.tris)}), montagem ${b.stats.ms.toFixed(0)} ms (atual ${a.stats.ms.toFixed(0)} ms)`);
  }
  assert.ok(v2.rhaenyra.markerAnchor.position.y > v2.radhija.markerAnchor.position.y, 'Rhaenyra é mais alta');
});

// ------------------------------------------------------------------ poses
const wall = { wallGap: 0.45, wallTop: 1.1, wallOut: 0.05, wallPaws: 1.03, wallSide: 0.165, wallLat: 0.14 };
/** [nome, duração (s), anim(t, k)] — todas as ações e extras do jogo. */
const CASES = [
  ['parada', 1.2, () => ({})],
  ['passo', 1.2, () => ({ speed: 0.7 })],
  ['trote', 1.2, () => ({ speed: 1.9, turn: 0.6 })],
  ['galope', 1.2, () => ({ speed: 5.5, action: 'dash' })],
  ...['sit', 'push', 'strain', 'tug', 'celebrate', 'sniff', 'turn', 'shake', 'startled', 'bafoAim', 'bafo', 'proud', 'yuck', 'slide']
    .map((a) => [a, 1.6, () => ({ action: a, speed: a === 'push' ? 0.6 : 0 })]),
  ['pulo', 0.42, (t, k) => ({ airK: k, jump: 4 * 0.5 * k * (1 - k) })],
  ['parede', 1.05, (t, k) => ({ action: 'wallJump', wallK: k, ...wall })],
  ['lambendo', 1.32, (t) => ({ action: 'lick', lickPhase: (t % 0.44) / 0.44, lickSide: 1 })],
  ['lambida', 1.32, (t) => ({ action: 'licked', lickPhase: (t % 0.44) / 0.44, lickSide: -1 })],
  ['carregando', 1.0, () => ({ carrying: true, speed: 0.9 })],
  ['agachada', 3.2, (t, k) => ({ poopK: k })],
  ['voltinha', 1.5, (t, k) => ({ poopPre: k, speed: 0.7, turn: 1.6 })],
  ['festa', 1.5, () => ({ party: { glee: 1, bow: 0.6, hop: 0.05, air: -1, jump: 0, brace: 0.3, zoom: 0 } })],
  ['irmã vendo', 1.5, (t) => ({ cheer: t })],
  ...['drink', 'eat', 'dig', 'sneeze', 'nudge', 'roll'].map((x) => [x, EXTRA_TIME[x], (t, k) => ({ extra: { kind: x, k, t, h: 0 } })]),
];

/** Região de cada vértice pelo osso de maior peso: rabo, orelha ou corpo. */
function regions(d) {
  const tail = new Set(d.bones.filter((b) => b.name.startsWith('tail')).map((b) => d.bones.indexOf(b)));
  const ear = new Set(d.bones.filter((b) => b.name.startsWith('ear')).map((b) => d.bones.indexOf(b)));
  return [d.meshes.body, d.meshes.ears].map((m) => {
    const si = m.geometry.attributes.skinIndex;
    const reg = new Uint8Array(si.count);
    for (let i = 0; i < si.count; i++) {
      const b = si.getComponent(i, 0);
      reg[i] = tail.has(b) ? 1 : ear.has(b) ? 2 : 0;
    }
    return { m, reg };
  });
}
/** y mais baixo (de 4 em 4 vértices) do corpo, do rabo e das orelhas, com a pose do quadro. */
function lowestByRegion(d, parts) {
  d.object.updateMatrixWorld(true);
  const low = [Infinity, Infinity, Infinity];
  for (const { m, reg } of parts) {
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 4) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      if (v.y < low[reg[i]]) low[reg[i]] = v.y;
    }
  }
  return low;
}

const FOLLOW = [['body', 'body'], ['chest', 'chest'], ['hips', 'hips'], ['head', 'head'], ['FLu', 'FLu'], ['FLc', 'FLp'], ['FRc', 'FRp'], ['HLp', 'HLp'], ['HRp', 'HRp'], ['tail0', 'tail0'], ['earL0', 'earL0']];

for (const kind of KINDS) {
  test(`${kind} nova: segue o esqueleto atual em todas as ações, sem NaN, e nada do corpo passa do chão`, () => {
    const d = v2[kind];
    const parts = regions(d);
    const byName = (list, n) => list.find((b) => b.name === n);
    const report = [];
    const bad = [];
    for (const [name, dur, anim] of CASES) {
      // volta para a pose parada entre um caso e outro
      for (let i = 0; i < 30; i++) d.update(1 / 60, { speed: 0, action: 'none' });
      const N = Math.max(12, Math.round(dur * 60));
      let worst = [Infinity, Infinity, Infinity];
      let follow = 0;
      for (let f = 0; f <= N; f++) {
        const k = f / N;
        d.update(1 / 60, { speed: 0, turn: 0, action: 'none', ...anim(f / 60, k) });
        if (f % 6) continue;
        for (const b of d.bones) if (!Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.x + b.position.y)) bad.push(`${name}: osso ${b.name} inválido`);
        const low = lowestByRegion(d, parts);
        worst = worst.map((x, i) => Math.min(x, low[i]));
        // o osso novo e o atual no mesmo lugar (fora a subida do corpo quando a pose afundaria no chão)
        d.driver.inner.updateMatrixWorld(true);
        const lift = d.object.children[0].position.y - d.driver.inner.position.y;
        for (const [n2, n1] of FOLLOW) {
          byName(d.bones, n2).getWorldPosition(v);
          byName(d.driver.rig.bones, n1).getWorldPosition(w);
          follow = Math.max(follow, Math.hypot(v.x - w.x, v.y - w.y - lift, v.z - w.z));
        }
      }
      report.push(`${name}: corpo ${worst[0].toFixed(3)} rabo ${worst[1].toFixed(3)} orelha ${worst[2].toFixed(3)} guia ${(follow * 1000).toFixed(2)} mm`);
      if (follow > 1e-4) bad.push(`${name}: osso fora da guia (${(follow * 1000).toFixed(2)} mm)`);
      if (worst[0] < -0.012) bad.push(`${name}: o corpo passou do chão (${worst[0].toFixed(3)} m)`);
    }
    console.log(`[v2] ${kind} — ponto mais baixo por pose (m):\n  ${report.join('\n  ')}`);
    assert.deepEqual(bad, []);
  });
}

test('modelo novo: em pé, as quatro patas no chão; pisadas ao trotar', () => {
  for (const kind of KINDS) {
    const d = v2[kind];
    for (let i = 0; i < 60; i++) d.update(1 / 60, { speed: 0, action: 'none' });
    d.object.updateMatrixWorld(true);
    for (const p of ['FLp', 'FRp', 'HLp', 'HRp']) {
      const y = d.bones.find((b) => b.name === p).getWorldPosition(v).y;
      assert.ok(y > -0.01 && y < 0.06, `${kind}: ${p} no chão (${y.toFixed(3)})`);
    }
    let steps = 0;
    d.onFootstep = () => steps++;
    for (let i = 0; i < 120; i++) d.update(1 / 60, { speed: 2.0, action: 'none' });
    d.onFootstep = null;
    assert.ok(steps >= 6, `${kind}: trotando 2 s, ${steps} pisadas`);
  }
});

test('modelo novo: o item vai na boca (bolinha), à frente da cabeça e perto de onde fica no atual', () => {
  for (const kind of KINDS) {
    const pos = {};
    for (const [label, d] of [['atual', v1[kind]], ['nova', v2[kind]]]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6));
      ball.name = 'ball';
      d.mouthSocket.clear();
      d.mouthSocket.add(ball);
      for (let i = 0; i < 40; i++) d.update(1 / 60, { speed: 0, action: 'none', carrying: true });
      assert.equal(d.carryKind, 'ball');
      d.object.updateMatrixWorld(true);
      pos[label] = d.mouthSocket.getWorldPosition(new THREE.Vector3());
      d.mouthSocket.clear();
      d.update(1 / 60, { speed: 0, action: 'none' });
    }
    const gap = pos.nova.distanceTo(pos.atual);
    assert.ok(gap < 0.04, `${kind}: boca a ${(gap * 100).toFixed(1)} cm da do atual`);
    assert.ok(pos.nova.z > 0.2, `${kind}: boca na frente (z ${pos.nova.z.toFixed(3)})`);
  }
});
