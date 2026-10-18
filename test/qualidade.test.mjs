// Qualidade gráfica por aparelho (src/core/quality.js): o PC continua exatamente no perfil de sempre; celular e
// tablet começam mais leves e, no automático, descem sozinhos quando o FPS cai (governador). Sem navegador nem GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  QUALITY_PROFILES, QUALITY_MODES, MOBILE_LADDER, detectDevice, readDeviceEnv, initialLevel, isAdaptive, pixelRatioFor,
  createFpsGovernor, applyQualityProfile, createQualityControl, loadQualityMode, saveQualityMode,
} from '../src/core/quality.js';

test('perfil do PC (alta) = os valores de sempre do engine', () => {
  assert.deepEqual(QUALITY_PROFILES.alta, {
    name: 'alta', pixelRatio: 1.5, pixelBudget: 0, shadows: true, shadowSize: 2048, softShadows: true, msaa: 4, bloom: true,
  });
  // pixel ratio = min(devicePixelRatio, 1,5), sem orçamento de pixels, em qualquer tamanho de janela
  for (const [dpr, w, h] of [[1, 1280, 720], [1.25, 1920, 1080], [2, 2560, 1440], [3, 3840, 2160], [undefined, 800, 600]]) {
    assert.equal(pixelRatioFor(QUALITY_PROFILES.alta, { dpr, width: w, height: h }), Math.min(dpr || 1, 1.5));
  }
});

test('perfis do celular: cada degrau é mais leve que o anterior', () => {
  const [a, b, c, d] = ['alta', 'media', 'baixa', 'minima'].map((n) => QUALITY_PROFILES[n]);
  for (const [hi, lo] of [[a, b], [b, c], [c, d]]) {
    assert.ok(lo.pixelRatio <= hi.pixelRatio && lo.shadowSize <= hi.shadowSize && lo.msaa <= hi.msaa, `${lo.name} ≤ ${hi.name}`);
    assert.ok(!lo.bloom || hi.bloom);
  }
  assert.ok(b.shadowSize === 1024 && !b.softShadows, 'média: sombras 1024 sem PCFSoft');
  assert.ok(!c.bloom && !d.bloom && !d.shadows, 'baixa sem bloom; mínima sem sombras');
  assert.deepEqual(MOBILE_LADDER, ['media', 'baixa', 'minima']);
  assert.deepEqual(QUALITY_MODES, ['auto', 'alta', 'media', 'baixa'], 'o menu não oferece a mínima (só o automático chega lá)');
  // celular deitado (844×390, DPR 3): teto do perfil; tablet grande: o orçamento de pixels manda
  assert.equal(pixelRatioFor(b, { dpr: 3, width: 844, height: 390 }), 1.25);
  assert.equal(pixelRatioFor(c, { dpr: 3, width: 844, height: 390 }), 1);
  const tablet = pixelRatioFor(b, { dpr: 2, width: 1366, height: 1024 });
  assert.ok(tablet < 1 && Math.abs(1366 * 1024 * tablet * tablet - b.pixelBudget) < 1, `tablet ${tablet.toFixed(3)}`);
});

test('detecção do aparelho: só o dedo como ponteiro principal muda o perfil', () => {
  assert.equal(detectDevice({ coarse: false, hover: true, screenW: 1920, screenH: 1080 }), 'desktop');
  assert.equal(detectDevice({ coarse: true, hover: true, screenW: 1366, screenH: 768 }), 'desktop', 'notebook com tela de toque');
  assert.equal(detectDevice({ coarse: false, hover: false, screenW: 1280, screenH: 720 }), 'desktop', 'navegador sem ponteiro (headless)');
  assert.equal(detectDevice({ coarse: true, hover: false, screenW: 390, screenH: 844 }), 'phone');
  assert.equal(detectDevice({ coarse: true, hover: false, screenW: 915, screenH: 412 }), 'phone', 'celular deitado');
  assert.equal(detectDevice({ coarse: true, hover: false, screenW: 1024, screenH: 1366 }), 'tablet');
  assert.equal(detectDevice(), 'desktop');
  const env = readDeviceEnv({ matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }), screen: { width: 412, height: 915 } });
  assert.deepEqual(env, { coarse: true, hover: false, screenW: 412, screenH: 915 });
  assert.equal(readDeviceEnv({}).coarse, false, 'sem matchMedia: PC');
});

test('perfil inicial e modo automático', () => {
  assert.equal(initialLevel('auto', 'desktop'), 'alta');
  assert.equal(initialLevel('auto', 'phone'), 'media');
  assert.equal(initialLevel('auto', 'tablet'), 'media');
  assert.equal(initialLevel('baixa', 'desktop'), 'baixa', 'forçado no menu');
  assert.equal(initialLevel('alta', 'phone'), 'alta');
  assert.equal(initialLevel('xyz', 'desktop'), 'alta', 'valor estranho = automático');
  assert.equal(initialLevel('minima', 'phone'), 'media', 'a mínima não se escolhe');
  assert.ok(!isAdaptive('auto', 'desktop'), 'no PC nada muda sozinho');
  assert.ok(isAdaptive('auto', 'phone'));
  assert.ok(!isAdaptive('media', 'phone'), 'forçado: sem governador');
});

/** Alimenta o governador com quadros de `ms` por `sec` segundos; devolve as decisões. */
function feed(gov, ms, sec, active = true) {
  const out = [];
  for (let t = 0; t < sec * 1000; t += ms) {
    const r = gov.sample(ms, active);
    if (r) out.push(r);
  }
  return out;
}

test('governador: 60 fps não muda nada; 25 fps desce um degrau depois de duas janelas', () => {
  const gov = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(gov, 16.7, 30), []);
  assert.equal(gov.level, 'media');
  const r = feed(gov, 40, 5.4); // aquecimento já passou: 2 janelas de 3 s
  assert.equal(r.length, 0, 'uma janela ruim só não basta');
  const r2 = feed(gov, 40, 1.2);
  assert.equal(r2.length, 1);
  assert.equal(r2[0].action, 'down');
  assert.equal(r2[0].level, 'baixa');
  assert.equal(Math.round(r2[0].fps), 25);
  assert.equal(gov.level, 'baixa');
});

test('governador: se a descida melhorou, segue; no último degrau, para', () => {
  const gov = createFpsGovernor({ level: 'media' });
  let r = feed(gov, 50, 9); // 20 fps: aquecimento + 2 janelas → baixa
  assert.deepEqual(r.map((x) => x.level), ['baixa']);
  r = feed(gov, 33, 7.2); // ~30 fps (melhorou 1,5×) mas ainda abaixo de 45: mais 2 janelas → mínima
  assert.deepEqual(r.map((x) => x.level), ['minima']);
  r = feed(gov, 25, 30); // 40 fps: melhorou; ainda abaixo, mas é o fim da escada
  assert.deepEqual(r, []);
  assert.equal(gov.level, 'minima');
  assert.ok(gov.locked);
});

test('governador: descer sem ganho (aparelho preso a 30 Hz) volta ao degrau anterior e para', () => {
  const gov = createFpsGovernor({ level: 'media' });
  let r = feed(gov, 33.4, 10);
  assert.deepEqual(r.map((x) => x.action), ['down']);
  r = feed(gov, 33.4, 6);
  assert.equal(r.length, 1);
  assert.equal(r[0].action, 'revert');
  assert.equal(r[0].level, 'media');
  assert.ok(gov.locked);
  assert.deepEqual(feed(gov, 60, 30), [], 'travado: nada mais muda');
});

test('governador: menus, pausa e travadas longas não contam', () => {
  const gov = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(gov, 50, 60, false), [], 'fora da partida não mede');
  // entra em jogo: soluços isolados (compilação de shader) não derrubam a qualidade
  const r = [];
  for (let i = 0; i < 2000; i++) {
    const x = gov.sample(i % 30 === 0 ? 120 : 16.7, true);
    if (x) r.push(x);
  }
  assert.deepEqual(r, [], 'a mediana ignora os soluços');

  const g2 = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(g2, 50, 5.5), [], 'aquecimento + uma janela ruim');
  feed(g2, 50, 1, false); // pausa: recomeça do aquecimento e esquece a janela ruim
  assert.deepEqual(feed(g2, 50, 5.5), [], 'depois da pausa, de novo só uma janela ruim');
  assert.equal(g2.sample(5000, true), null, 'aba escondida: o intervalo enorme não é quadro');
  const d = feed(g2, 50, 4.6); // assentamento (1,5 s) + a segunda janela ruim seguida
  assert.deepEqual(d.map((x) => x.level), ['baixa']);
});

/** Engine falso, com o que applyQualityProfile toca. */
function fakeEngine(profile = QUALITY_PROFILES.alta) {
  const calls = [];
  const rt = () => ({ samples: profile.msaa, disposed: 0, dispose() { this.disposed++; } });
  const mat = new THREE.MeshStandardMaterial();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
  const v0 = mat.version;
  let pr = 1.5;
  const map = { disposed: 0, dispose() { this.disposed++; } };
  return {
    calls, mat, v0, map,
    renderer: {
      getPixelRatio: () => pr,
      setPixelRatio: (v) => { pr = v; calls.push(['renderer', v]); },
      shadowMap: { type: profile.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap },
    },
    composer: { setPixelRatio: (v) => calls.push(['composer', v]), renderTarget1: rt(), renderTarget2: rt() },
    sun: { castShadow: true, shadow: { mapSize: new THREE.Vector2(profile.shadowSize, profile.shadowSize), map } },
    bloom: { enabled: profile.bloom },
    scene,
  };
}

test('trocar de perfil num engine já criado: só o que mudou', () => {
  const e = fakeEngine();
  const target = { ...e, castShadow: true, dpr: 3, width: 844, height: 390 };
  const pr = applyQualityProfile(target, QUALITY_PROFILES.media, QUALITY_PROFILES.alta);
  assert.equal(pr, 1.25);
  assert.deepEqual(e.calls, [['renderer', 1.25], ['composer', 1.25]]);
  assert.equal(e.renderer.shadowMap.type, THREE.PCFShadowMap);
  assert.ok(e.mat.version > e.v0, 'tipo de sombra mudou: materiais recompilam');
  assert.equal(e.sun.shadow.mapSize.x, 1024);
  assert.equal(e.map.disposed, 1);
  assert.equal(e.sun.shadow.map, null, 'mapa de sombra recriado no próximo quadro');
  assert.equal(e.composer.renderTarget1.samples, 2);
  assert.equal(e.composer.renderTarget2.disposed, 1);
  assert.ok(e.bloom.enabled && e.sun.castShadow);
  // media → baixa: mesmo tipo e tamanho de sombra (sem recompilar), sem MSAA e sem bloom
  const v1 = e.mat.version;
  applyQualityProfile(target, QUALITY_PROFILES.baixa, QUALITY_PROFILES.media);
  assert.equal(e.mat.version, v1);
  assert.equal(e.composer.renderTarget1.samples, 0);
  assert.equal(e.bloom.enabled, false);
  // mínima: sem sombra do sol; uma fase sem sombra continua sem sombra em qualquer perfil
  applyQualityProfile(target, QUALITY_PROFILES.minima, QUALITY_PROFILES.baixa);
  assert.equal(e.sun.castShadow, false);
  applyQualityProfile({ ...target, castShadow: false }, QUALITY_PROFILES.alta, QUALITY_PROFILES.minima);
  assert.equal(e.sun.castShadow, false);
  assert.equal(e.sun.shadow.mapSize.x, 2048);
  assert.equal(e.renderer.shadowMap.type, THREE.PCFSoftShadowMap);
  assert.ok(e.bloom.enabled);
  assert.equal(e.composer.renderTarget2.samples, 4);
});

test('controle da qualidade: PC fixo; celular com governador; escolha do menu salva e recomeça', () => {
  const applied = [];
  const changes = [];
  const saved = [];
  const pc = createQualityControl({ device: 'desktop', apply: (p, why) => applied.push([p.name, why]), onChange: (s) => changes.push(s), save: (m) => saved.push(m) });
  assert.equal(pc.level, 'alta');
  assert.ok(!pc.adaptive);
  for (let t = 1; t < 60000; t += 50) pc.frame(t, true); // 20 fps por um minuto
  assert.deepEqual(applied, [], 'no PC a qualidade nunca muda sozinha');

  const phone = createQualityControl({ device: 'phone', apply: (p, why) => applied.push([p.name, why]), onChange: (s) => changes.push(s), save: (m) => saved.push(m) });
  assert.equal(phone.level, 'media');
  assert.ok(phone.adaptive);
  for (let t = 1; t < 12000; t += 50) phone.frame(t, true);
  assert.deepEqual(applied, [['baixa', 'down']]);
  assert.equal(changes.at(-1).level, 'baixa');
  assert.equal(changes.at(-1).reason, 'down');
  assert.equal(changes.at(-1).fps, 20);

  assert.ok(phone.setMode('alta'));
  assert.deepEqual(applied.at(-1), ['alta', 'menu']);
  assert.deepEqual(saved, ['alta']);
  assert.ok(!phone.adaptive, 'forçado: governador desligado');
  assert.ok(!phone.setMode('minima'), 'a mínima não é opção do menu');
  assert.ok(!phone.setMode('ultra'));
  phone.setMode('auto');
  assert.equal(phone.level, 'media', 'automático recomeça no degrau do aparelho');
  assert.ok(phone.adaptive);
  const n = changes.length;
  phone.setMode('auto');
  assert.equal(changes.length, n + 1, 'a UI é avisada mesmo sem troca de nível');
  assert.equal(phone.state().mode, 'auto');
});

test('modo salvo no navegador (por prévia, como o volume)', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.equal(loadQualityMode(storage), 'auto');
  saveQualityMode('baixa', storage);
  assert.equal(loadQualityMode(storage), 'baixa');
  assert.deepEqual([...store.keys()], ['rr-quality']);
  saveQualityMode('auto', storage);
  assert.equal(store.size, 0, 'automático não ocupa o armazenamento');
  store.set('rr-quality', 'turbo');
  assert.equal(loadQualityMode(storage), 'auto', 'valor inválido');
  assert.equal(loadQualityMode({ getItem() { throw new Error('bloqueado'); } }), 'auto');
  assert.equal(loadQualityMode(null), 'auto');
});
