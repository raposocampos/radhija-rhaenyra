// Locomoção do modelo novo (src/dogs/v2/gait.js, etapa 2 da troca dos modelos): a pata apoiada fica plantada no
// chão (não patina andando, trotando, na curva nem na voltinha da comemoração), as patas assentam no lugar com
// passinhos ao parar, a pata rola no fim do apoio e o pulso dobra no balanço; nas outras poses, as patas são as do guia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';

installBrowserStubs();
const { createDogV2 } = await import('../src/dogs/v2/dog.js');

const KINDS = ['radhija', 'rhaenyra'];
const PAWS = ['FLp', 'FRp', 'HLp', 'HRp'];
const DT = 1 / 60;
const bone = (d, n) => d.bones.find((b) => b.name === n);
const pawsWorld = (d) => PAWS.map((n) => bone(d, n).getWorldPosition(new THREE.Vector3()));

/** Uma dog nova, parada um pouco (pose de pé). */
function fresh(kind) {
  const d = createDogV2(kind);
  d.update(DT, { speed: 0, action: 'sniff' });
  for (let i = 0; i < 40; i++) d.update(DT, { speed: 0, action: 'none' });
  return d;
}

/**
 * Anda de verdade no mundo: a cada quadro o objeto vai `speed` para a frente e gira `turn` (como o jogo faz) e a dog
 * anima. each(f, d) roda depois de cada quadro, com as matrizes atualizadas.
 */
function walk(d, { speed, turn = 0, secs, action = 'none', move = true, each = null }) {
  for (let f = 0; f < Math.round(secs * 60); f++) {
    if (move) {
      const yaw = d.object.rotation.y;
      d.object.position.x += Math.sin(yaw) * speed * DT;
      d.object.position.z += Math.cos(yaw) * speed * DT;
      d.object.rotation.y += turn * DT;
    }
    d.update(DT, { speed, turn, action });
    if (each) {
      d.object.updateMatrixWorld(true);
      each(f, d);
    }
  }
}

/** Mede quanto cada pata apoiada escorrega no chão (m por quadro, no plano) enquanto `run` anima. */
function slideMeter(d) {
  let prev = null;
  let prevSwing = null;
  const out = { max: 0, sum: 0, n: 0, lifts: 0, worst: '' };
  const each = () => {
    const now = pawsWorld(d);
    const swing = d.locomotion.legs.map((l) => l.swing);
    if (prev && d.gait > 0.99) {
      for (let i = 0; i < 4; i++) {
        if (swing[i] && !prevSwing[i]) out.lifts++;
        if (swing[i] || prevSwing[i]) continue;
        const sl = Math.hypot(now[i].x - prev[i].x, now[i].z - prev[i].z);
        out.sum += sl;
        out.n++;
        if (sl > out.max) {
          out.max = sl;
          out.worst = PAWS[i];
        }
      }
    }
    prev = now;
    prevSwing = swing;
  };
  return { out, each };
}

test('locomoção nova: andando no mundo, a pata apoiada fica plantada no chão (passo, trote e curva)', () => {
  const report = [];
  for (const kind of KINDS) {
    for (const [name, speed, turn] of [['passo', 0.7, 0], ['trote', 1.6, 0], ['curva', 0.9, 1.3]]) {
      const d = fresh(kind);
      walk(d, { speed, turn, secs: 1.0 });
      const m = slideMeter(d);
      walk(d, { speed, turn, secs: 2.0, each: m.each });
      const o = m.out;
      report.push(`${kind} ${name}: escorrega até ${(o.max * 1000).toFixed(2)} mm/quadro (${o.worst}), média ${(o.sum / Math.max(o.n, 1) * 1000).toFixed(3)}, ${o.lifts} passos, tronco desceu ${(d.locomotion.drop * 1000).toFixed(1)} mm`);
      assert.ok(o.n > 120, `${kind} ${name}: patas apoiadas medidas (${o.n})`);
      assert.ok(o.lifts >= 8, `${kind} ${name}: as patas dão passos (${o.lifts})`);
      assert.ok(o.max < 0.003, `${kind} ${name}: a pata apoiada escorregou ${(o.max * 1000).toFixed(2)} mm num quadro (${o.worst})`);
    }
  }
  console.log(`[locomoção] ${report.join('\n  ')}`);
});

test('locomoção nova: na voltinha da comemoração (o corpo anda o círculo com o objeto parado), a pata quase não patina', () => {
  const report = [];
  for (const kind of KINDS) {
    const d = fresh(kind);
    const m = slideMeter(d);
    walk(d, {
      speed: 0, secs: 2.0, action: 'celebrate', move: false,
      // da metade da voltinha em diante (antes, a locomoção ainda está assumindo depois dos pulinhos)
      each: (f) => { if (f / 60 >= 1.15 && f / 60 < 2.05) m.each(); },
    });
    const o = m.out;
    report.push(`${kind}: escorrega até ${(o.max * 1000).toFixed(2)} mm/quadro (${o.worst}), média ${(o.sum / Math.max(o.n, 1) * 1000).toFixed(3)}, ${o.lifts} passos`);
    assert.ok(o.n > 60, `${kind}: patas apoiadas na voltinha (${o.n})`);
    assert.ok(o.lifts >= 6, `${kind}: as patas dão passos na voltinha (${o.lifts})`);
    // a voltinha é bem fechada (raio de 20 cm, menor que a dog): numa curva assim a pata pode girar um pouco no chão
    assert.ok(o.sum / Math.max(o.n, 1) < 0.001, `${kind}: na voltinha a pata apoiada escorrega em média ${(o.sum / o.n * 1000).toFixed(2)} mm por quadro`);
    assert.ok(o.max < 0.008, `${kind}: na voltinha a pata escorregou ${(o.max * 1000).toFixed(2)} mm num quadro (${o.worst})`);
  }
  console.log(`[locomoção] voltinha\n  ${report.join('\n  ')}`);
});

test('locomoção nova: ao parar, as patas assentam no lugar com passinhos, sem patinar', () => {
  for (const kind of KINDS) {
    const d = fresh(kind);
    walk(d, { speed: 1.4, secs: 1.5 });
    const m = slideMeter(d);
    let steps = 0;
    let was = d.locomotion.legs.map((l) => l.swing);
    walk(d, {
      speed: 0, secs: 1.6, each: () => {
        m.each();
        const now = d.locomotion.legs.map((l) => l.swing);
        for (let i = 0; i < 4; i++) if (now[i] && !was[i]) steps++;
        was = now;
      },
    });
    const L = d.locomotion.legs;
    const off = L.map((l) => Math.hypot(l.foot.x - l.neutral.x, l.foot.z - l.neutral.z));
    assert.ok(m.out.max < 0.003, `${kind}: parando, a pata apoiada escorregou ${(m.out.max * 1000).toFixed(2)} mm num quadro (${m.out.worst})`);
    assert.ok(L.every((l) => !l.swing), `${kind}: parada, todas as patas no chão`);
    assert.ok(off.every((x) => x < 0.016 * 1.2), `${kind}: patas no lugar (${off.map((x) => (x * 100).toFixed(1)).join(', ')} cm)`);
    assert.ok(steps <= 10, `${kind}: poucos passos para assentar (${steps})`);
  }
});

test('locomoção nova: na esteira (objeto parado, só a velocidade), a pata apoiada vai para trás na velocidade', () => {
  for (const kind of KINDS) {
    const d = fresh(kind);
    walk(d, { speed: 1.0, secs: 1.0, move: false });
    let prev = null, prevSwing = null;
    const vel = [];
    walk(d, {
      speed: 1.0, secs: 1.5, move: false, each: () => {
        const now = pawsWorld(d);
        const swing = d.locomotion.legs.map((l) => l.swing);
        if (prev) for (let i = 0; i < 4; i++) if (!swing[i] && !prevSwing[i]) vel.push((now[i].z - prev[i].z) / DT);
        prev = now;
        prevSwing = swing;
      },
    });
    vel.sort((a, b) => a - b);
    const med = vel[vel.length >> 1];
    assert.ok(Math.abs(med + 1.0) < 0.15, `${kind}: a pata apoiada anda para trás a ${(-med).toFixed(2)} m/s (esperado ~1,0)`);
  }
});

test('locomoção nova: a pata rola no fim do apoio e o pulso dobra no balanço (a botinha vira para trás)', () => {
  for (const kind of KINDS) {
    const d = fresh(kind);
    walk(d, { speed: 1.6, secs: 1.0 });
    // ângulo da quartela (pulso → pata) no plano de lado: + = pata à frente do pulso, − = atrás
    const ang = () => {
      const w = bone(d, 'FLc').getWorldPosition(new THREE.Vector3());
      const p = bone(d, 'FLp').getWorldPosition(new THREE.Vector3());
      const yaw = d.object.rotation.y;
      const fwd = (p.x - w.x) * Math.sin(yaw) + (p.z - w.z) * Math.cos(yaw);
      return Math.atan2(fwd, w.y - p.y);
    };
    let midSt = [], lateSt = [], swingMin = Infinity;
    walk(d, {
      speed: 1.6, secs: 1.5, each: () => {
        const L = d.locomotion.legs[0];
        const a = ang();
        if (L.swing) swingMin = Math.min(swingMin, a);
        else {
          const r = L.stanceK;
          if (r >= 0 && r < 0.5) midSt.push(a);
          if (r > 0.9) lateSt.push(a);
        }
      },
    });
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    assert.ok(midSt.length && lateSt.length, `${kind}: apoio medido (${midSt.length}/${lateSt.length})`);
    assert.ok(avg(midSt) - avg(lateSt) > 0.35, `${kind}: no fim do apoio o pulso passa por cima da pata (${(avg(midSt) * 57.3).toFixed(0)}° → ${(avg(lateSt) * 57.3).toFixed(0)}°)`);
    assert.ok(swingMin < -1.0, `${kind}: no balanço o pulso dobra (pata para trás: ${(swingMin * 57.3).toFixed(0)}°)`);
  }
});

test('locomoção nova: sentada, no pulo, empurrando e nos extras as patas são as do guia (peso zero)', () => {
  for (const kind of KINDS) {
    const d = fresh(kind);
    for (const [name, anim] of [
      ['sentada', { speed: 0, action: 'sit' }],
      ['empurrando', { speed: 0.6, action: 'push' }],
      ['bebendo', { speed: 0, extra: { kind: 'drink', k: 0.5, t: 1 } }],
      ['agachada', { speed: 0, poopK: 0.5 }],
    ]) {
      d.update(DT, { speed: 0, action: 'sniff' }); // zera o tempo parado (depois de 5 s ela senta sozinha)
      for (let i = 0; i < 90; i++) d.update(DT, anim);
      assert.equal(d.gait, 0, `${kind} ${name}: locomoção desligada`);
      for (let i = 0; i < 60; i++) d.update(DT, { speed: 0, action: 'none' });
    }
    d.update(DT, { speed: 0, action: 'sniff' });
    for (let i = 0; i < 25; i++) d.update(DT, { speed: 0, airK: i / 25, jump: 0.3 });
    assert.ok(d.gait < 0.05, `${kind} no pulo: locomoção desligada (${d.gait.toFixed(2)})`);
    d.update(DT, { speed: 0, action: 'sniff' });
    for (let i = 0; i < 60; i++) d.update(DT, { speed: 0, action: 'none' });
    assert.ok(d.gait > 0.95, `${kind}: em pé de novo, locomoção ligada (${d.gait.toFixed(2)})`);
  }
});

test('locomoção nova: galopando, nada inválido e as patas não afundam no chão', () => {
  for (const kind of KINDS) {
    const d = fresh(kind);
    let low = Infinity;
    walk(d, {
      speed: 5.5, secs: 1.5, action: 'dash', each: () => {
        for (const b of d.bones) assert.ok(Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.y), `${kind}: osso ${b.name} inválido`);
        for (const p of pawsWorld(d)) low = Math.min(low, p.y);
      },
    });
    assert.ok(low > -0.005, `${kind}: pata abaixo do chão no galope (${low.toFixed(3)} m)`);
  }
});

test('locomoção nova: a pisada (som e pegada) sai no pouso da pata, também na voltinha', () => {
  for (const kind of KINDS) {
    for (const [name, opts] of [['trote', { speed: 1.6, secs: 1.5 }], ['voltinha', { speed: 0, secs: 2.0, action: 'celebrate', move: false }]]) {
      const d = fresh(kind);
      const bad = [];
      let n = 0;
      d.onFootstep = (i, v) => {
        n++;
        const L = d.locomotion.legs[i];
        d.object.updateMatrixWorld(true);
        const y = bone(d, PAWS[i]).getWorldPosition(new THREE.Vector3()).y;
        if (L.swing || y > 0.035) bad.push(`${PAWS[i]} no ar (${(y * 100).toFixed(1)} cm)`);
        if (!(v > 0.2)) bad.push(`${PAWS[i]} sem passada (${v})`);
      };
      walk(d, opts);
      d.onFootstep = null;
      assert.ok(n >= 6, `${kind} ${name}: pisadas (${n})`);
      assert.deepEqual(bad.slice(0, 4), [], `${kind} ${name}`);
    }
  }
});
