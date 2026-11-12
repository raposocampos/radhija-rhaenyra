// Gestos de cena e fala das dogs (Modo História: lock.gesture / lock.talk → anim.gesture / anim.talk, dogAnimation.js).
// Sem os campos novos a pose é exatamente a de antes; cada gesto mexe as partes certas; a fala abre e fecha a boca; nada
// vira NaN e nada do corpo passa do chão (modelo novo, v2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import { withSeed } from './helpers/seeded.mjs';

installBrowserStubs();
const { createDog } = await import('../src/dogs/dog.js');
const { createDogV2 } = await import('../src/dogs/v2/dog.js');
const { GESTURE_TIME } = await import('../src/dogs/dogAnimation.js');

const KINDS = ['radhija', 'rhaenyra'];
const GESTURES = ['stretch', 'yawn', 'tilt', 'sniffGround', 'sad', 'alert', 'wag', 'shiver', 'chaseTail', 'stumble', 'bonk'];
const DT = 1 / 60;
const v = new THREE.Vector3();
const q = new THREE.Quaternion();

// a primeira montagem de cada modelo sorteia coisas que ficam guardadas (texturas, desenho): fora da comparação
for (const kind of KINDS) {
  createDog(kind);
  createDogV2(kind, { shells: 1 });
}
/** Dog nova (o mesmo sorteio em todas: as poses comparam quadro a quadro). */
const make = (kind, v2 = false) => withSeed(11, () => (v2 ? createDogV2(kind, { shells: 1 }) : createDog(kind)));
/** Dog nova rodada `secs` s com anim(t), com o mesmo sorteio do começo ao fim (olhadinhas e piscadas iguais). */
const fresh = (kind, secs, anim, v2 = false) => withSeed(11, () => run(v2 ? createDogV2(kind, { shells: 1 }) : createDog(kind), secs, anim));
const bone = (d, n) => d.bones.find((b) => b.name === n);
const world = (d, n) => {
  d.object.updateMatrixWorld(true);
  return bone(d, n).getWorldPosition(new THREE.Vector3());
};
/** Roda `secs` segundos com anim(t) e devolve a dog. */
function run(d, secs, anim) {
  const n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) d.update(DT, anim(i * DT));
  d.object.updateMatrixWorld(true);
  return d;
}
const still = () => ({ speed: 0, action: 'none' });
const gest = (kind, extra = {}) => (t) => ({ speed: 0, action: 'none', gesture: { kind, t }, ...extra });
/** Todos os números da pose (ossos, olhos, boca, raiz) para comparar duas dogs. */
function snapshot(d) {
  const out = [];
  d.object.traverse((o) => {
    out.push(o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w, o.scale.x, o.scale.y, o.scale.z, o.visible ? 1 : 0);
  });
  return out;
}

for (const v2 of [false, true]) {
  test(`gestos (${v2 ? 'modelo novo' : 'modelo atual'}): sem gesto e sem fala a pose é exatamente a de antes`, () => {
    const scripts = [
      ['parada', (t) => ({ speed: 0, action: 'none' })],
      ['andando', (t) => ({ speed: 1.1, turn: 0.4, action: 'none' })],
      ['sentada', (t) => ({ speed: 0, action: 'sit' })],
      ['latindo', (t) => ({ speed: 0, action: 'none' })],
    ];
    for (const kind of KINDS) {
      for (const [name, anim] of scripts) {
        const go = (extra) => withSeed(11, () => {
          const d = v2 ? createDogV2(kind, { shells: 1 }) : createDog(kind);
          for (let i = 0; i < 150; i++) {
            if (name === 'latindo' && i === 60) d.triggerBark();
            d.update(DT, { ...anim(i * DT), ...extra });
          }
          return snapshot(d);
        });
        assert.deepEqual(go({ gesture: null, talk: 0 }), go({}), `${kind} ${name}`);
      }
    }
  });
}

test('gestos: depois que o gesto e a fala acabam, a dog volta à pose de sempre', () => {
  for (const kind of KINDS) {
    const a = fresh(kind, 6.5, still);
    const b = fresh(kind, 6.5, (t) => (t < 1.5 ? { speed: 0, action: 'none', gesture: { kind: 'sad', t }, talk: 0.8 } : still()));
    for (const n of ['head', 'chest', 'jaw', 'tail0', 'earL0']) {
      bone(a, n).getWorldQuaternion(q);
      const qb = bone(b, n).getWorldQuaternion(new THREE.Quaternion());
      assert.ok(q.angleTo(qb) < 0.01, `${kind} ${n}: ${q.angleTo(qb).toFixed(4)} rad da pose de sempre`);
    }
  }
});

test('gestos: cada um mexe as partes esperadas', () => {
  for (const kind of KINDS) {
    const base = fresh(kind, 2, still);
    const at = (n) => world(base, n);
    const s = at('head').y; // escala: altura da cabeça em pé

    // alongar: na primeira metade o peito desce e as patas da frente vão à frente; na segunda, as traseiras para trás
    const st1 = fresh(kind, 0.8, gest('stretch'));
    assert.ok(world(st1, 'chest').y < at('chest').y - 0.06 * s, `${kind} alongando: o peito desce (${world(st1, 'chest').y.toFixed(3)} × ${at('chest').y.toFixed(3)})`);
    assert.ok(world(st1, 'FLp').z > at('FLp').z + 0.03, `${kind} alongando: as patas da frente esticadas à frente`);
    assert.ok(world(st1, 'hips').y > world(st1, 'chest').y, `${kind} alongando: a garupa fica mais alta que o peito`);
    const st2 = fresh(kind, 1.75, gest('stretch'));
    assert.ok(world(st2, 'HLp').z < at('HLp').z - 0.03, `${kind} alongando: as traseiras esticadas para trás`);
    const st3 = fresh(kind, GESTURE_TIME.stretch + 0.6, gest('stretch'));
    assert.ok(Math.abs(world(st3, 'chest').y - at('chest').y) < 0.01, `${kind} alongando: no fim volta à pose em pé`);

    // bocejar: a boca abre bem (a mandíbula desce) e a cabeça sobe
    const yw = fresh(kind, 0.85, gest('yawn'));
    assert.ok(bone(yw, 'jaw').quaternion.x > 0.08, `${kind} bocejando: a mandíbula desce (${bone(yw, 'jaw').quaternion.x.toFixed(3)})`);
    const nose = (d) => {
      d.object.updateMatrixWorld(true);
      const h = bone(d, 'head');
      return new THREE.Vector3(0, 0, 0.1).applyQuaternion(h.getWorldQuaternion(new THREE.Quaternion())).y;
    };
    assert.ok(nose(yw) > nose(base) + 0.02, `${kind} bocejando: o focinho aponta para cima`);
    const ywEnd = fresh(kind, GESTURE_TIME.yawn + 0.4, gest('yawn'));
    assert.ok(Math.abs(bone(ywEnd, 'jaw').quaternion.x) < 0.01, `${kind} bocejando: no fim a boca fecha`);

    // cabeça inclinada: a cabeça rola (o "para cima" dela tomba de lado)
    const upX = (d) => {
      d.object.updateMatrixWorld(true);
      return new THREE.Vector3(0, 1, 0).applyQuaternion(bone(d, 'head').getWorldQuaternion(new THREE.Quaternion())).x;
    };
    const ti = fresh(kind, 1.2, gest('tilt'));
    assert.ok(Math.abs(upX(ti) - upX(base)) > 0.25, `${kind} inclinada: a cabeça rola (${upX(ti).toFixed(3)} × ${upX(base).toFixed(3)})`);
    const tiR = fresh(kind, 1.2, (t) => ({ ...still(), gesture: { kind: 'tilt', t, side: 1 } }));
    const tiL = fresh(kind, 1.2, (t) => ({ ...still(), gesture: { kind: 'tilt', t, side: -1 } }));
    assert.ok(Math.sign(upX(tiR) - upX(base)) !== Math.sign(upX(tiL) - upX(base)), `${kind} inclinada: side escolhe o lado`);

    // farejando o chão: a cabeça desce perto do chão e varre de um lado para o outro
    const sn = make(kind);
    let lowHead = Infinity, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < 240; i++) {
      sn.update(DT, gest('sniffGround')(i * DT));
      if (i < 60) continue;
      const h = world(sn, 'head');
      lowHead = Math.min(lowHead, h.y);
      // a ponta do focinho (10 cm à frente do osso da cabeça)
      const tip = new THREE.Vector3(0, 0, 0.1).applyQuaternion(bone(sn, 'head').getWorldQuaternion(q)).add(h);
      minX = Math.min(minX, tip.x);
      maxX = Math.max(maxX, tip.x);
    }
    assert.ok(lowHead < s * 0.72, `${kind} farejando: a cabeça desce (${lowHead.toFixed(3)} de ${s.toFixed(3)})`);
    assert.ok(maxX - minX > 0.03, `${kind} farejando: a cabeça varre de lado (${(maxX - minX).toFixed(3)} m)`);

    // triste: cabeça e rabo baixos; alerta: cabeça e rabo altos
    const tailTip = (d) => world(d, 'tail3').y;
    const sad = fresh(kind, 2, gest('sad'));
    assert.ok(world(sad, 'head').y < s - 0.02, `${kind} triste: a cabeça baixa`);
    assert.ok(tailTip(sad) < tailTip(base) - 0.03, `${kind} triste: o rabo baixo (${tailTip(sad).toFixed(3)} × ${tailTip(base).toFixed(3)})`);
    const al = fresh(kind, 1.5, gest('alert'));
    assert.ok(world(al, 'head').y > s + 0.01, `${kind} alerta: a cabeça erguida`);
    assert.ok(tailTip(al) > tailTip(base) + 0.01, `${kind} alerta: o rabo alto`);

    // abanando e tremendo: o rabo vai de um lado para o outro mais que parada; a tremidinha mexe o corpo depressa
    const swing = (anim, b = 'tail3') => {
      const d = fresh(kind, 1, anim);
      let lo = Infinity, hi = -Infinity, flips = 0, prev = 0, last = null;
      for (let i = 0; i < 90; i++) {
        d.update(DT, anim(1 + i * DT));
        const x = world(d, b).x;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
        if (last !== null) {
          const dir = Math.sign(x - last);
          if (dir && prev && dir !== prev) flips++;
          if (dir) prev = dir;
        }
        last = x;
      }
      return { range: hi - lo, flips };
    };
    const wagBase = swing(still);
    const wag = swing(gest('wag'));
    assert.ok(wag.range > wagBase.range * 1.5 && wag.flips >= 10, `${kind} abanando: ${wag.range.toFixed(3)} m, ${wag.flips} viradas (parada ${wagBase.range.toFixed(3)})`);
    const shiv = swing(gest('shiver'), 'chest');
    const shivBase = swing(still, 'chest');
    assert.ok(shiv.flips >= 20 && shiv.flips > shivBase.flips * 3, `${kind} tremendo: ${shiv.flips} viradas do peito em 1,5 s (parada ${shivBase.flips})`);
  }
});

test('fala: a boca abre e fecha em sílabas irregulares; talk 0 deixa a boca normal', () => {
  for (const kind of KINDS) {
    const d = make(kind);
    run(d, 0.5, still);
    const jaw = bone(d, 'jaw');
    const open = [];
    for (let i = 0; i < 180; i++) {
      d.update(DT, { speed: 0, action: 'none', talk: 1 });
      open.push(jaw.quaternion.x);
    }
    const hi = Math.max(...open), lo = Math.min(...open.slice(20));
    assert.ok(hi > 0.025, `${kind}: a boca abre (${hi.toFixed(3)})`);
    assert.ok(lo < hi * 0.35, `${kind}: e fecha entre as sílabas (${lo.toFixed(3)})`);
    // sílabas: picos de abertura em 3 s, com alturas diferentes
    const peaks = [];
    for (let i = 1; i < open.length - 1; i++) if (open[i] > open[i - 1] && open[i] >= open[i + 1] && open[i] > hi * 0.3) peaks.push(open[i]);
    assert.ok(peaks.length >= 8, `${kind}: ${peaks.length} sílabas em 3 s`);
    assert.ok(Math.max(...peaks) - Math.min(...peaks) > hi * 0.2, `${kind}: as sílabas têm alturas diferentes`);
    // calou: a boca volta a fechar
    run(d, 2, still);
    assert.ok(Math.abs(jaw.quaternion.x) < 1e-6, `${kind}: calada, a mandíbula volta ao lugar`);
  }
});

test('gestos e fala no modelo novo: sem NaN e nada do corpo passa do chão', () => {
  const bad = [];
  for (const kind of KINDS) {
    const d = make(kind, true);
    const body = d.meshes.body;
    const n = body.geometry.attributes.position.count;
    const lowest = () => {
      d.object.updateMatrixWorld(true);
      let low = Infinity;
      for (let i = 0; i < n; i += 4) low = Math.min(low, body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld).y);
      return low;
    };
    const cases = [
      ...GESTURES.map((g) => [g, 3, gest(g)]),
      ...['sad', 'alert', 'wag', 'sniffGround'].map((g) => [`${g} andando`, 2, gest(g, { speed: 0.7 })]),
      ['falando', 2, (t) => ({ ...still(), talk: 0.5 + 0.5 * Math.sin(t * 3) })],
      ['falando e inclinada', 2, gest('tilt', { talk: 1 })],
      ['bocejando sentada', 2.5, gest('yawn', { action: 'sit' })],
      ['triste deitada', 3, gest('sad', { idle: { kind: 'lie', k: 1, t: 2, side: 1 } })],
      ['olhando de lado e alerta', 2, gest('alert', { lookAt: { x: 1, y: 0.4, z: 0.5 } })],
      // a Rhaenyra distraída: a voltinha a trote atrás do rabo (as duas mãos) e o tropeço correndo
      ['atrás do rabo, na voltinha', 2.5, (t) => ({ speed: 1.35, turn: 3.9, action: 'none', gesture: { kind: 'chaseTail', t, side: 1 } })],
      ['atrás do rabo, para a direita', 2.5, (t) => ({ speed: 1.35, turn: -3.9, action: 'none', gesture: { kind: 'chaseTail', t, side: -1 } })],
      ['tropeçando correndo', 1.2, (t) => ({ speed: Math.max(0, 1.6 - t * 3), action: 'none', gesture: { kind: 'stumble', t } })],
      ['bateu o focinho recuando', 1.4, (t) => ({ speed: t < 0.25 ? 0.5 : 0, back: t < 0.25, action: t < 0.35 ? 'startled' : 'none', gesture: { kind: 'bonk', t } })],
    ];
    for (const [name, secs, anim] of cases) {
      for (let i = 0; i < 40; i++) d.update(DT, still());
      let worst = Infinity;
      const N = Math.round(secs / DT);
      for (let i = 0; i < N; i++) {
        d.update(DT, anim(i * DT));
        if (i % 6) continue;
        for (const b of d.bones) if (!Number.isFinite(b.quaternion.x + b.quaternion.y + b.quaternion.z + b.quaternion.w + b.position.x + b.position.y + b.position.z)) bad.push(`${kind} ${name}: osso ${b.name} inválido`);
        worst = Math.min(worst, lowest());
      }
      if (!(worst > -0.012)) bad.push(`${kind} ${name}: o corpo passou do chão (${worst.toFixed(3)} m)`);
    }
  }
  assert.deepEqual(bad, []);
});

test('gestos da Rhaenyra distraída: atrás do rabo (o "C"), o tropeço e o focinho na porta', () => {
  const fwd = (d, n) => {
    d.object.updateMatrixWorld(true);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(bone(d, n).getWorldQuaternion(new THREE.Quaternion()));
  };
  for (const kind of KINDS) {
    const base = fresh(kind, 2, still);
    const s = world(base, 'head').y; // escala: altura da cabeça em pé

    // atrás do rabo, andando a voltinha: a cabeça vira para o lado da curva e o rabo curva para o mesmo lado (o "C");
    // comparado com a mesma curva sem o gesto (+x é a esquerda da dog)
    for (const side of [1, -1]) {
      const turn = (g) => (t) => ({ speed: 1.3, turn: side * 3.8, action: 'none', ...(g ? { gesture: { kind: 'chaseTail', t, side } } : {}) });
      const plain = fresh(kind, 1.2, turn(false));
      const ct = fresh(kind, 1.2, turn(true));
      const dHead = (fwd(ct, 'head').x - fwd(plain, 'head').x) * side;
      assert.ok(dHead > 0.3, `${kind} atrás do rabo (${side}): a cabeça vira para dentro da curva (${dHead.toFixed(3)})`);
      const dTail = (world(ct, 'tail3').x - world(plain, 'tail3').x) * side;
      assert.ok(dTail > 0.02, `${kind} atrás do rabo (${side}): o rabo curva para o lado da cabeça (${dTail.toFixed(3)} m)`);
      const dChest = (world(ct, 'neck').x - world(plain, 'neck').x) * side;
      assert.ok(dChest > 0.005, `${kind} atrás do rabo (${side}): o peito curvado para dentro (${dChest.toFixed(3)} m)`);
    }

    // tropeço: o peito mergulha e a cabeça cai; no fim, volta à pose em pé
    const tr = fresh(kind, 0.17, gest('stumble'));
    assert.ok(world(tr, 'chest').y < world(base, 'chest').y - 0.03 * s, `${kind} tropeçando: o peito mergulha (${world(tr, 'chest').y.toFixed(3)} × ${world(base, 'chest').y.toFixed(3)})`);
    assert.ok(world(tr, 'head').y < s - 0.05 * s, `${kind} tropeçando: a cabeça cai`);
    const trEnd = fresh(kind, GESTURE_TIME.stumble + 0.6, gest('stumble'));
    assert.ok(Math.abs(world(trEnd, 'chest').y - world(base, 'chest').y) < 0.01, `${kind} tropeçando: no fim, de pé de novo`);

    // focinho na porta: o tranco joga a cabeça para trás (o focinho sobe) e depois ela fica zonza (a cabeça roda)
    const bk = fresh(kind, 0.1, gest('bonk'));
    assert.ok(fwd(bk, 'head').y > fwd(base, 'head').y + 0.08, `${kind} bateu o focinho: a cabeça vai para trás (${fwd(bk, 'head').y.toFixed(3)} × ${fwd(base, 'head').y.toFixed(3)})`);
    const upX = (d) => {
      d.object.updateMatrixWorld(true);
      return new THREE.Vector3(0, 1, 0).applyQuaternion(bone(d, 'head').getWorldQuaternion(new THREE.Quaternion())).x;
    };
    const rolls = [0.35, 0.5, 0.65, 0.8].map((t) => upX(fresh(kind, t, gest('bonk'))));
    assert.ok(Math.max(...rolls) - Math.min(...rolls) > 0.08, `${kind} zonza: a cabeça roda de um lado para o outro (${rolls.map((x) => x.toFixed(2)).join(' ')})`);
    const bkEnd = fresh(kind, GESTURE_TIME.bonk + 0.8, gest('bonk'));
    bone(base, 'head').getWorldQuaternion(q);
    assert.ok(q.angleTo(bone(bkEnd, 'head').getWorldQuaternion(new THREE.Quaternion())) < 0.02, `${kind} zonza: no fim, a cabeça volta ao lugar`);
  }
});
