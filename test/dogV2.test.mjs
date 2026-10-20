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
    // (a orelha nasce na cabeça, que na Rhaenyra nova é menor: a base dela muda de lugar)
    for (const n of ['body', 'hips', 'chest', 'neck', 'head', 'jaw', 'FLu', 'FLl', 'HLu', 'HLl', 'HLm', 'HLp', 'tail0']) {
      const d = Math.hypot(a[n][0] - b[n][0], a[n][1] - b[n][1], a[n][2] - b[n][2]);
      assert.ok(d < 1e-6, `${kind}: ${n} mudou ${d}`);
    }
    // o pulso novo fica onde era a "pata" (pulso) do atual
    const d = Math.hypot(...a.FLp.map((x, i) => x - b.FLc[i]));
    assert.ok(d < 1e-6, `${kind}: pulso`);
  }
});

test('modelo novo: a cabeça da Rhaenyra (com o cabelo) fica quase do tamanho da da Radhija', () => {
  /** Altura e largura da cabeça (vértices do corpo presos sobretudo à cabeça), em repouso. */
  const head = (d) => {
    const m = d.meshes.body;
    const hi = d.bones.findIndex((b) => b.name === 'head');
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex;
    const box = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) if (si.getComponent(i, 0) === hi) box.expandByPoint(v.fromBufferAttribute(pos, i));
    return box.getSize(new THREE.Vector3());
  };
  const a = head(v2.radhija), b = head(v2.rhaenyra);
  const rh = Math.max(b.x / a.x, b.y / a.y);
  console.log(`[v2] cabeça: Radhija ${a.x.toFixed(3)} × ${a.y.toFixed(3)} m, Rhaenyra ${b.x.toFixed(3)} × ${b.y.toFixed(3)} m (${(rh * 100).toFixed(0)}%)`);
  assert.ok(rh < 1.1, `cabeça da Rhaenyra ${(rh * 100).toFixed(0)}% da da Radhija`);
});

test('modelo novo: malha das orelhas fechada (sem buracos: cada aresta é de dois triângulos)', () => {
  for (const kind of KINDS) {
    const g = v2[kind].meshes.ears.geometry;
    const idx = g.index.array;
    const edges = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = idx[t + k], b = idx[t + ((k + 1) % 3)];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    let open = 0;
    for (const n of edges.values()) if (n !== 2) open++;
    console.log(`[v2] ${kind}: orelhas com ${edges.size} arestas, ${open} abertas`);
    assert.ok(open <= edges.size * 0.002, `${kind}: ${open} arestas abertas nas orelhas`);
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

test('modelo novo: mesma API do atual e orçamento de malha (ossos ≤ 40; triângulos ≤ 112% do atual no total, ≤ 125% por parte)', () => {
  for (const kind of KINDS) {
    const a = v1[kind], b = v2[kind];
    for (const k of ['kind', 'object', 'mouthSocket', 'markerAnchor', 'update', 'triggerBark', 'setCarryPose', 'carryKind', 'setWet', 'setMud', 'setShine', 'mud', 'bones', 'skeleton', 'meshes', 'stats']) {
      assert.ok(k in b, `${kind}: ${k}`);
      assert.equal(typeof b[k], typeof a[k], `${kind}: tipo de ${k}`);
    }
    assert.ok(b.bones.length <= 40);
    // as orelhas são pequenas: inteiras (sem a beirada cortada pela grade) têm algumas centenas de triângulos a mais
    for (const part of ['body', 'ears', 'fur']) {
      const ratio = b.stats.tris[part] / a.stats.tris[part];
      assert.ok(ratio <= 1.25, `${kind}: triângulos de ${part} ${b.stats.tris[part]} × ${a.stats.tris[part]} (${(ratio * 100).toFixed(0)}%)`);
    }
    const sum = (t) => t.body + t.ears + t.fur;
    const total = sum(b.stats.tris) / sum(a.stats.tris);
    assert.ok(total <= 1.12, `${kind}: triângulos no total ${sum(b.stats.tris)} × ${sum(a.stats.tris)} (${(total * 100).toFixed(0)}%)`);
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

const LEG_BONES = new Set(['FLu', 'FLc', 'FRc', 'HLp', 'HRp']);
const FOLLOW = [['body', 'body'], ['chest', 'chest'], ['hips', 'hips'], ['head', 'head'], ['FLu', 'FLu'], ['FLc', 'FLp'], ['FRc', 'FRp'], ['HLp', 'HLp'], ['HRp', 'HRp'], ['tail0', 'tail0']];

for (const kind of KINDS) {
  test(`${kind} nova: segue o esqueleto atual em todas as ações, sem NaN, e nada do corpo passa do chão`, () => {
    const d = v2[kind];
    const parts = regions(d);
    const byName = (list, n) => list.find((b) => b.name === n);
    const report = [];
    const bad = [];
    const a = v1[kind];
    const partsA = regions(a);
    for (const [name, dur, anim] of CASES) {
      // volta para a pose parada entre um caso e outro (um quadro farejando zera o tempo parado: sem sentar sozinha)
      for (const dog of [d, a]) {
        dog.update(1 / 60, { speed: 0, action: 'sniff' });
        for (let i = 0; i < 30; i++) dog.update(1 / 60, { speed: 0, action: 'none' });
      }
      const N = Math.max(12, Math.round(dur * 60));
      let worst = [Infinity, Infinity, Infinity];
      let base = Infinity;
      let follow = 0;
      let lift = 0;
      let tilt = 0;
      let liftBone = '';
      for (let f = 0; f <= N; f++) {
        const k = f / N;
        const pose = { speed: 0, turn: 0, action: 'none', ...anim(f / 60, k) };
        d.update(1 / 60, pose);
        a.update(1 / 60, pose);
        if (d.lift > lift) lift = d.lift;
        if (Math.abs(d.tilt) > Math.abs(tilt)) tilt = d.tilt;
        if ((d.lift || d.tilt) && !liftBone) liftBone = d.lowestBone;
        if (f % 6) continue;
        // o modelo atual na mesma pose (referência: ele não tem a correção do chão)
        base = Math.min(base, lowestByRegion(a, partsA)[0]);
        for (const b of d.bones) if (!Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.x + b.position.y)) bad.push(`${name}: osso ${b.name} inválido`);
        const low = lowestByRegion(d, parts);
        worst = worst.map((x, i) => Math.min(x, low[i]));
        // o osso novo e o atual no mesmo lugar (fora a subida do corpo quando a pose afundaria no chão; com o giro
        // sobre as patas apoiadas, o corpo inteiro gira e a comparação não vale neste quadro). Andando, as patas são
        // da locomoção própria do modelo novo (gait.js, testada em test/locomocao.test.mjs): aí só o tronco segue o guia.
        if (d.tilt || d.overlay) continue;
        d.driver.inner.updateMatrixWorld(true);
        // andando com a passada comprida, o tronco desce um pouco para as patas plantadas alcançarem o chão (gait.js)
        const rise = d.object.children[0].position.y - d.driver.inner.position.y - (d.gait > 0 ? d.locomotion.drop : 0);
        for (const [n2, n1] of FOLLOW) {
          if (d.gait > 0 && LEG_BONES.has(n2)) continue;
          byName(d.bones, n2).getWorldPosition(v);
          byName(d.driver.rig.bones, n1).getWorldPosition(w);
          follow = Math.max(follow, Math.hypot(v.x - w.x, v.y - w.y - rise, v.z - w.z));
        }
      }
      report.push(`${name}: corpo ${worst[0].toFixed(3)} (atual ${base.toFixed(3)}) rabo ${worst[1].toFixed(3)} orelha ${worst[2].toFixed(3)} giro ${(tilt * 180 / Math.PI).toFixed(1)}° subida ${(lift * 1000).toFixed(1)} mm${liftBone ? ` (${liftBone})` : ''} guia ${(follow * 1000).toFixed(2)} mm`);
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

test('modelo novo sentada: as patas da frente ficam no chão (se a garupa afundaria, o corpo gira sobre elas)', () => {
  for (const kind of KINDS) {
    const d = v2[kind];
    d.update(1 / 60, { speed: 0, action: 'sniff' });
    for (let i = 0; i < 180; i++) d.update(1 / 60, { speed: 0, action: 'sit' });
    d.object.updateMatrixWorld(true);
    const s = kind === 'rhaenyra' ? 1.133 : 1;
    for (const p of ['FLp', 'FRp']) {
      const y = d.bones.find((b) => b.name === p).getWorldPosition(v).y;
      assert.ok(y < 0.035 * s, `${kind}: ${p} no chão sentada (${y.toFixed(3)} m; giro ${(d.tilt * 180 / Math.PI).toFixed(1)}°, subida ${(d.lift * 1000).toFixed(0)} mm)`);
    }
    console.log(`[v2] ${kind} sentada: giro ${(d.tilt * 180 / Math.PI).toFixed(1)}°, subida ${(d.lift * 1000).toFixed(1)} mm, mais baixo ${d.lowestBone}`);
  }
});

test('modelo novo rolando: apoiada no chão, de costas em "C" e com as patas dobradas', () => {
  for (const kind of KINDS) {
    const d = v2[kind];
    const parts = regions(d);
    const bone = (n) => d.bones.find((b) => b.name === n);
    d.update(1 / 60, { speed: 0, action: 'sniff' });
    for (let i = 0; i < 60; i++) d.update(1 / 60, { speed: 0, action: 'none' });
    d.object.updateMatrixWorld(true);
    const restReach = bone('FLp').getWorldPosition(new THREE.Vector3()).distanceTo(bone('FLu').getWorldPosition(new THREE.Vector3()));
    const dur = EXTRA_TIME.roll;
    const N = Math.round(dur * 60);
    let touchBack = Infinity;
    let worst = Infinity;
    let curve = 0;
    let reach = Infinity;
    for (let f = 0; f <= N; f++) {
      const k = f / N;
      d.update(1 / 60, { speed: 0, action: 'none', extra: { kind: 'roll', k, t: k * dur, h: 0 } });
      if (f % 4) continue;
      const low = lowestByRegion(d, parts)[0];
      worst = Math.min(worst, low);
      if (k > 0.44 && k < 0.6) {
        touchBack = Math.min(touchBack, low);
        d.object.updateMatrixWorld(true);
        // "C": o peito e a garupa apontam para lados diferentes (ângulo entre os eixos do comprimento)
        const fwd = (n) => new THREE.Vector3(0, 0, 1).applyQuaternion(bone(n).getWorldQuaternion(new THREE.Quaternion()));
        curve = Math.max(curve, fwd('chest').angleTo(fwd('hips')));
        reach = Math.min(reach, bone('FLp').getWorldPosition(v).distanceTo(bone('FLu').getWorldPosition(w)));
      }
    }
    console.log(`[v2] ${kind} rolando: mais baixo ${worst.toFixed(3)} m, de costas ${touchBack.toFixed(3)} m, curva ${(curve * 180 / Math.PI).toFixed(0)}°, pata da frente a ${(reach * 100).toFixed(1)} cm do ombro (em pé ${(restReach * 100).toFixed(1)})`);
    assert.ok(worst > -0.012, `${kind}: nada atravessa o chão (${worst.toFixed(3)})`);
    assert.ok(touchBack < 0.02, `${kind}: de costas, encostada no chão (${touchBack.toFixed(3)} m)`);
    assert.ok(curve > 0.25, `${kind}: de costas, o corpo curva (${(curve * 180 / Math.PI).toFixed(0)}°)`);
    assert.ok(reach < restReach * 0.75, `${kind}: as patas da frente dobram (${(reach * 100).toFixed(1)} × ${(restReach * 100).toFixed(1)} cm)`);
  }
});

test('modelo novo: as orelhas reagem ao pulo (física) e voltam ao lugar; nunca passam do chão', () => {
  for (const kind of KINDS) {
    const d = v2[kind];
    const bone = (n) => d.bones.find((b) => b.name === n);
    const tipInHead = () => {
      d.object.updateMatrixWorld(true);
      return bone('head').worldToLocal(bone('earL2').getWorldPosition(new THREE.Vector3()));
    };
    d.update(1 / 60, { speed: 0, action: 'sniff' });
    for (let i = 0; i < 150; i++) d.update(1 / 60, { speed: 0, action: 'none', lookAt: { x: 0, y: 0.3, z: 4 } });
    const rest = tipInHead();
    let swing = 0;
    for (let f = 0; f <= 36; f++) {
      const k = f / 25;
      d.update(1 / 60, k <= 1 ? { speed: 0, airK: k, jump: 4 * 0.5 * k * (1 - k), lookAt: { x: 0, y: 0.3, z: 4 } } : { speed: 0, lookAt: { x: 0, y: 0.3, z: 4 } });
      swing = Math.max(swing, tipInHead().distanceTo(rest));
    }
    for (let i = 0; i < 150; i++) d.update(1 / 60, { speed: 0, action: 'none', lookAt: { x: 0, y: 0.3, z: 4 } });
    const back = tipInHead().distanceTo(rest);
    console.log(`[v2] ${kind}: orelha balançou ${(swing * 1000).toFixed(1)} mm no pulo e voltou a ${(back * 1000).toFixed(1)} mm`);
    assert.ok(swing > 0.008 && swing < 0.09, `${kind}: a orelha reage ao pulo sem virar do avesso (${(swing * 1000).toFixed(1)} mm)`);
    assert.ok(back < 0.006, `${kind}: a orelha volta ao lugar (${(back * 1000).toFixed(1)} mm)`);
    // rolando, as orelhas ficam sobre o chão
    let low = Infinity;
    const dur = EXTRA_TIME.roll;
    for (let f = 0; f <= 60; f++) {
      d.update(1 / 60, { speed: 0, action: 'none', extra: { kind: 'roll', k: 0.4 + f / 300, t: f / 60, h: 0 } });
      d.object.updateMatrixWorld(true);
      for (const n of ['earL1', 'earL2', 'earR1', 'earR2']) low = Math.min(low, bone(n).getWorldPosition(v).y);
    }
    void dur;
    assert.ok(low > -0.005, `${kind}: rolando, as juntas da orelha ficam acima do chão (${low.toFixed(3)})`);
  }
});

test('modelo novo: o rabo tem física firme — parado fica na pose, atrasa um pouco no pulo e no giro e volta; nunca passa do chão', () => {
  for (const kind of KINDS) {
    const d = createDogV2(kind);
    const bone = (n) => d.bones.find((b) => b.name === n);
    // a ponta do rabo (junta do último gomo) no referencial da garupa
    const tipInHips = () => {
      d.object.updateMatrixWorld(true);
      return bone('hips').worldToLocal(bone('tail4').getWorldPosition(new THREE.Vector3()));
    };
    const still = { speed: 0, action: 'none', lookAt: { x: 0, y: 0.3, z: 4 } };
    d.update(1 / 60, { speed: 0, action: 'sniff' });
    // a pose do guia: sem a física (zerada a cada quadro, a correntinha vai direto para a pose)
    for (let i = 0; i < 90; i++) { d.physics.reset(); d.update(1 / 60, still); }
    const guide = tipInHips();
    for (let i = 0; i < 150; i++) d.update(1 / 60, still);
    const rest = tipInHips();
    assert.ok(rest.distanceTo(guide) < 0.015, `${kind}: parado, o rabo fica na pose (${(rest.distanceTo(guide) * 1000).toFixed(1)} mm)`);
    // pulo e meia-volta rápida: atrasa um tiquinho (firme: nada de rabo mole) e volta
    let swing = 0;
    for (let f = 0; f <= 40; f++) {
      const k = f / 25;
      d.object.rotation.y += f < 20 ? 0.06 : 0; // meia-volta em 1/3 s
      d.update(1 / 60, k <= 1 ? { speed: 0, airK: k, jump: 4 * 0.4 * k * (1 - k) } : still);
      swing = Math.max(swing, tipInHips().distanceTo(rest));
    }
    for (let i = 0; i < 150; i++) d.update(1 / 60, still);
    const back = tipInHips().distanceTo(rest);
    assert.ok(swing > 0.002 && swing < 0.045, `${kind}: no pulo e no giro o rabo atrasa só um pouco (${(swing * 1000).toFixed(1)} mm)`);
    assert.ok(back < 0.004, `${kind}: o rabo volta à pose (${(back * 1000).toFixed(1)} mm)`);
    // rolando: as juntas do rabo ficam acima do chão
    let low = Infinity;
    for (let f = 0; f < 150; f++) {
      d.update(1 / 60, { speed: 0, action: 'none', extra: { kind: 'roll', k: 0.3 + f / 300, t: f / 60, h: 0 } });
      d.object.updateMatrixWorld(true);
      for (const n of ['tail1', 'tail2', 'tail3', 'tail4']) low = Math.min(low, bone(n).getWorldPosition(v).y);
    }
    assert.ok(low > -0.005, `${kind}: rolando, as juntas do rabo ficam acima do chão (${low.toFixed(3)})`);
  }
});

test('modelo novo: bebendo e comendo, a boca desce até perto do chão, no mesmo lugar do atual', () => {
  for (const kind of KINDS) {
    const d = v2[kind];
    const a = v1[kind];
    for (const x of ['drink', 'eat']) {
      let worst = 0, lowest = Infinity;
      for (const dog of [d, a]) {
        dog.update(1 / 60, { speed: 0, action: 'sniff' });
        for (let i = 0; i < 30; i++) dog.update(1 / 60, { speed: 0, action: 'none' });
      }
      for (let f = 0; f <= 120; f++) {
        const k = f / 120;
        const pose = { speed: 0, action: 'none', extra: { kind: x, k, t: k * EXTRA_TIME[x], h: 0 } };
        d.update(1 / 60, pose);
        a.update(1 / 60, pose);
        if (k < 0.3 || k > 0.7) continue;
        d.object.updateMatrixWorld(true);
        a.object.updateMatrixWorld(true);
        const jaw2 = d.bones.find((b) => b.name === 'jaw').getWorldPosition(v);
        const jaw1 = a.bones.find((b) => b.name === 'jaw').getWorldPosition(w);
        worst = Math.max(worst, jaw2.distanceTo(jaw1) - Math.abs(d.object.children[0].position.y - d.driver.inner.position.y));
        lowest = Math.min(lowest, jaw2.y);
      }
      // em pé a mandíbula fica a uns 30 cm do chão
      assert.ok(lowest < 0.12, `${kind} ${x}: a boca desce até perto do chão (${(lowest * 100).toFixed(1)} cm)`);
      assert.ok(worst < 0.006, `${kind} ${x}: a boca no mesmo lugar do atual (${(worst * 1000).toFixed(1)} mm)`);
    }
  }
});

test('modelo novo: as camadas — locomoção andando, rolagem rolando; sentada, nenhuma (a pose é a do atual)', () => {
  for (const kind of KINDS) {
    const d = createDogV2(kind);
    for (let i = 0; i < 60; i++) d.update(1 / 60, { speed: 1.2, action: 'none' });
    assert.ok(d.layers.gait > 0.99 && d.layers.roll === 0, `${kind} andando: ${JSON.stringify(d.layers)}`);
    d.update(1 / 60, { speed: 0, action: 'sniff' });
    for (let i = 0; i < 120; i++) d.update(1 / 60, { speed: 0, action: 'sit' });
    assert.ok(d.layers.gait === 0 && d.layers.roll === 0, `${kind} sentada: ${JSON.stringify(d.layers)}`);
    for (let f = 0; f < 60; f++) d.update(1 / 60, { speed: 0, action: 'none', extra: { kind: 'roll', k: 0.3 + f / 300, t: f / 60, h: 0 } });
    assert.ok(d.layers.roll > 0.99 && d.layers.gait === 0, `${kind} rolando: ${JSON.stringify(d.layers)}`);
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
      // as duas no mesmo estado (os testes de antes deixaram cada uma numa pose) e olhando para o mesmo ponto à frente
      // (parada, cada uma olharia em volta ao acaso)
      const ahead = { x: 0, y: 0.3, z: 4 };
      d.update(1 / 60, { speed: 0, action: 'sniff' });
      for (let i = 0; i < 150; i++) d.update(1 / 60, { speed: 0, action: 'none', carrying: true, lookAt: ahead });
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
