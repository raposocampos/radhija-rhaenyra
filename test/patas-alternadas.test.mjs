// Patas alternadas (os dois modelos): saindo de parada para andar, trotar e correr (reto, virando e na arrancada da
// Radhija), e com o analógico pela metade, as duas patas de cada par se alternam. Retorno do usuário (2026-10-24):
// "quando você tá parado e sai correndo com as dogs, elas mexem as duas patas, principalmente a traseira (...), saem
// iguais no movimento, fica parecendo um trote de cavalo ou algo bugado". Para cada decolagem de uma pata, mede em que
// ponto da passada da outra do par ela sai: perto de 0 (ou de 1), as duas saem juntas; 0,5, bem alternadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import { withSeed } from './helpers/seeded.mjs';

installBrowserStubs();
const { createDog } = await import('../src/dogs/dog.js');
const { createDogV2 } = await import('../src/dogs/v2/dog.js');
const { gaitRhythm } = await import('../src/dogs/v2/gait.js');
const { DOG_CONFIG } = await import('../src/dogs/config.js');

const DT = 1 / 60;
const PAWS = ['FLp', 'FRp', 'HLp', 'HRp'];
const NAMES = ['FL', 'FR', 'HL', 'HR'];
/** Sementes: a fase da passada e o relógio do guia começam sorteados (parada, as patas estão em qualquer ponto). */
const SEEDS = Array.from({ length: 12 }, (_, i) => 2003 + i * 6151);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const fract = (x) => x - Math.floor(x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bone = (d, n) => d.bones?.find((b) => b.name === n) ?? d.object.getObjectByName(n);

const SCENES = [
  { name: 'andando', mag: 0.3 },
  { name: 'analógico pela metade', mag: 0.4 }, // ~0,8 m/s: no meio da troca do passo para o trote
  { name: 'trotando', mag: 0.67 },
  { name: 'correndo', mag: 1 },
  { name: 'correndo e virando 90°', mag: 1, turn: Math.PI / 2 },
  { name: 'correndo e virando 180°', mag: 1, turn: Math.PI },
  // o galope da arrancada é com as duas de cada par quase juntas (é o dele): mede depois, de volta ao trote
  { name: 'arrancada (R1)', mag: 1, dash: true, only: 'radhija', from: 0.45 },
];

/**
 * Parada um pouco e depois sai como o controle do jogo faz (dogController.js): a velocidade sobe com a aceleração,
 * virando para o rumo pedido (devagar enquanto desalinhada), a da animação suavizada; na arrancada, o perfil dela.
 * → as decolagens de cada pata [{ t }] (t a partir da saída).
 */
function liftOffs(model, kind, scene, seed) {
  return withSeed(seed, () => {
    const cfg = DOG_CONFIG[kind];
    const d = model === 'novo' ? createDogV2(kind) : createDog(kind);
    for (let i = 0; i < 60; i++) d.update(DT, { speed: 0, action: 'none' });
    d.object.updateMatrixWorld(true);
    const base = PAWS.map((n) => bone(d, n).getWorldPosition(new THREE.Vector3()).y);
    let v = 0, anim = 0, yawRate = 0;
    let yaw = d.object.rotation.y;
    const want = yaw + (scene.turn || 0);
    const ev = [[], [], [], []];
    const was = [false, false, false, false];
    for (let f = 0; f < 90; f++) {
      const t = f * DT;
      const prevYaw = yaw;
      const dash = scene.dash && t < cfg.dashTime;
      if (dash) {
        const ph = t / cfg.dashTime;
        const k = ph < 0.12 ? 0.75 + (0.25 * ph) / 0.12 : ph > 0.7 ? 1 - ((1 - cfg.walkSpeed / cfg.dashSpeed) * (ph - 0.7)) / 0.3 : 1;
        v = t + DT >= cfg.dashTime ? Math.min(cfg.dashSpeed * k, cfg.walkSpeed * 1.05) : cfg.dashSpeed * k;
      } else {
        const delta = wrap(want - yaw);
        const align = Math.cos(Math.min(Math.abs(delta), Math.PI / 2));
        const target = cfg.walkSpeed * scene.mag * (0.3 + 0.7 * align * align);
        const rate = clamp(delta * 12, -cfg.turnSpeed, cfg.turnSpeed);
        yaw = Math.abs(rate * DT) >= Math.abs(delta) ? want : wrap(yaw + rate * DT);
        v = target > v ? Math.min(target, v + cfg.accel * DT) : Math.max(target, v - cfg.decel * DT);
      }
      anim += (v - anim) * (1 - Math.exp(-DT * 18));
      yawRate += (wrap(yaw - prevYaw) / DT - yawRate) * (1 - Math.exp(-DT * 20));
      d.object.rotation.y = yaw;
      d.object.position.x += Math.sin(yaw) * v * DT;
      d.object.position.z += Math.cos(yaw) * v * DT;
      d.update(DT, { speed: anim, turn: yawRate, turnTo: wrap(want - yaw), action: dash ? 'dash' : 'none' });
      d.object.updateMatrixWorld(true);
      // no ar: no modelo novo, o balanço da locomoção dele; no atual, a pata acima de onde estava parada
      const up = model === 'novo' && d.gait > 0.9
        ? d.locomotion.legs.map((l) => l.swing)
        : PAWS.map((n, i) => bone(d, n).getWorldPosition(new THREE.Vector3()).y - base[i] > 0.012);
      for (let i = 0; i < 4; i++) {
        if (up[i] && !was[i]) ev[i].push(t);
        was[i] = up[i];
      }
    }
    return ev;
  });
}

/** Para cada decolagem de B dentro de uma passada de A (de uma decolagem de A à seguinte): o quanto longe das de A. */
function seps(A, B) {
  const out = [];
  for (let k = 0; k + 1 < A.length; k++) {
    for (const t of B) if (t >= A[k] && t < A[k + 1]) {
      const u = (t - A[k]) / (A[k + 1] - A[k]);
      out.push({ t, sep: Math.min(u, 1 - u) });
    }
  }
  return out;
}

test('patas alternadas: saindo de parada (andar, trotar, correr, virando e na arrancada), as duas de cada par não saem juntas (os dois modelos)', () => {
  const report = [];
  const bad = [];
  for (const model of ['atual', 'novo']) for (const kind of ['radhija', 'rhaenyra']) for (const scene of SCENES) {
    if (scene.only && scene.only !== kind) continue;
    const all = { hind: [], front: [] };
    const firsts = [];
    for (const seed of SEEDS) {
      const ev = liftOffs(model, kind, scene, seed);
      const from = scene.from ?? 0;
      const h = [...seps(ev[2], ev[3]), ...seps(ev[3], ev[2])].filter((x) => x.t >= from).sort((a, b) => a.t - b.t);
      const fr = [...seps(ev[0], ev[1]), ...seps(ev[1], ev[0])].filter((x) => x.t >= from);
      all.hind.push(...h);
      all.front.push(...fr);
      firsts.push(h.slice(0, 3).map((x) => x.sep.toFixed(2)).join('/'));
      const tag = `${model} ${kind} ${scene.name} (semente ${seed})`;
      if (ev.some((e) => e.length < 2)) bad.push(`${tag}: alguma pata quase não deu passo (${ev.map((e) => e.length).join(', ')})`);
      // traseiras: a queixa do usuário (antes: 0 a 0,2 em boa parte das decolagens, as duas como num pulo de coelho)
      const hb = h.filter((x) => x.sep < 0.2);
      if (hb.length) {
        const seq = ev.flatMap((e, i) => e.map((t) => ({ t, leg: NAMES[i] }))).sort((a, b) => a.t - b.t).filter((x) => x.t < 0.9);
        bad.push(`${tag}: as traseiras saíram juntas (fase ${hb.map((x) => `${x.sep.toFixed(2)} em ${x.t.toFixed(2)} s`).join(', ')}) [${seq.map((x) => `${x.leg}@${x.t.toFixed(2)}`).join(' ')}]`);
      }
      const fb = fr.filter((x) => x.sep < 0.1);
      if (fb.length) bad.push(`${tag}: as dianteiras saíram juntas (fase ${fb.map((x) => `${x.sep.toFixed(2)} em ${x.t.toFixed(2)} s`).join(', ')})`);
    }
    const min = (a) => (a.length ? Math.min(...a.map((x) => x.sep)).toFixed(2) : '-');
    const under = (a) => (a.length ? Math.round((100 * a.filter((x) => x.sep < 0.25).length) / a.length) : 0);
    report.push(`${model} ${kind.padEnd(8)} ${scene.name.padEnd(24)} traseiras: mín ${min(all.hind)}, ${under(all.hind)}% abaixo de 0,25 (3 primeiras: ${firsts.slice(0, 3).join(' · ')}) | dianteiras: mín ${min(all.front)}, ${under(all.front)}% abaixo de 0,25`);
  }
  console.log(`[patas alternadas] fase de cada decolagem na passada da outra do par (0,5 = alternadas; 0 = juntas)\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('patas alternadas: nas fases do ritmo, as duas de cada par nunca se encontram, e do passo ao trote nenhuma pata atrasa', () => {
  // gaitRhythm mistura o passo, o trote e o galope (o mesmo do guia, dogAnimation.js). Com o trote escrito [0; 0,5;
  // 0,5; 0], na metade da troca do passo para o trote as duas traseiras ficavam na mesma fase (andavam juntas)
  const pair = (R, a, b) => {
    const d = fract(R.off[a] - R.off[b]);
    return Math.min(d, 1 - d);
  };
  for (let dash = 0; dash <= 1.0001; dash += 0.05) {
    for (let v = 0; v <= 2.4001; v += 0.02) {
      const R = gaitRhythm({ speed: v, turnS: 0, w: { dash, pre: 0 } }, 1);
      for (const [a, b, n] of [[0, 1, 'dianteiras'], [2, 3, 'traseiras']]) {
        assert.ok(pair(R, a, b) >= 0.08 - 1e-9, `${n} a ${v.toFixed(2)} m/s, galope ${dash.toFixed(2)}: fase ${pair(R, a, b).toFixed(3)} uma da outra`);
      }
    }
  }
  // a locomoção do modelo novo só atrasa uma pata no balanço (no apoio, atrasar alonga o apoio além do alcance da
  // traseira): do passo ao trote, a fase de cada pata só cresce ou fica
  let prev = null;
  for (let v = 0; v <= 2.4001; v += 0.01) {
    const R = gaitRhythm({ speed: v, turnS: 0, w: { dash: 0, pre: 0 } }, 1);
    if (prev) R.off.forEach((o, i) => assert.ok(o >= prev[i] - 1e-9, `${NAMES[i]} atrasa de ${prev[i].toFixed(3)} para ${o.toFixed(3)} a ${v.toFixed(2)} m/s`));
    prev = R.off;
  }
});
