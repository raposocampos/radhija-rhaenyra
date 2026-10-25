// Qualidade gráfica por aparelho (src/core/quality.js): o PC continua exatamente no perfil de sempre; celular e
// tablet começam mais leves (GPU de entrada ainda mais) e, no automático, descem sozinhos quando o FPS cai
// (governador), com teto de 60 quadros por segundo. Sem navegador nem GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  QUALITY_PROFILES, QUALITY_MODES, MOBILE_LADDER, SKY_FIRST, SKY_LAST, detectDevice, readDeviceEnv, isMobileUA, initialLevel,
  isAdaptive, isLowEndGpu, pixelRatioFor, createFrameCap, createFpsGovernor, applyQualityProfile, createQualityControl,
  loadQualityMode, saveQualityMode, needsInstallTip, readInstallEnv,
} from '../src/core/quality.js';

test('perfil do PC (alta) = os valores de sempre do engine', () => {
  assert.deepEqual(QUALITY_PROFILES.alta, {
    name: 'alta', pixelRatio: 1.5, pixelBudget: 0, shadows: true, shadowSize: 2048, softShadows: true, shadowEvery: 1,
    msaa: 4, bloom: true, post: true, skyLast: false,
  });
  assert.equal(SKY_FIRST, -10, 'o céu continua sendo desenhado primeiro no PC (renderOrder de sempre)');
  // pixel ratio = min(devicePixelRatio, 1,5), sem orçamento de pixels, em qualquer tamanho de janela
  for (const [dpr, w, h] of [[1, 1280, 720], [1.25, 1920, 1080], [2, 2560, 1440], [3, 3840, 2160], [undefined, 800, 600]]) {
    assert.equal(pixelRatioFor(QUALITY_PROFILES.alta, { dpr, width: w, height: h }), Math.min(dpr || 1, 1.5));
  }
});

test('perfis do celular: cada degrau é mais leve que o anterior', () => {
  const [a, b, c, d] = ['alta', 'media', 'baixa', 'minima'].map((n) => QUALITY_PROFILES[n]);
  for (const [hi, lo] of [[a, b], [b, c], [c, d]]) {
    assert.ok(lo.pixelRatio < hi.pixelRatio && lo.shadowSize <= hi.shadowSize && lo.msaa <= hi.msaa, `${lo.name} < ${hi.name}`);
    assert.ok(!lo.bloom || hi.bloom);
    assert.ok(lo.shadowEvery >= hi.shadowEvery || !lo.shadows);
  }
  assert.ok(!b.bloom && b.msaa === 0 && b.shadows && b.shadowEvery === 1 && !b.softShadows && b.post, 'média: sombra PCF a cada quadro, sem bloom/MSAA');
  assert.ok(c.shadows && c.shadowEvery === 2 && c.post, 'baixa: sombra redesenhada a cada 2 quadros');
  assert.ok(!d.shadows && !d.post, 'mínima: sem sombra e sem compositor (desenho direto)');
  assert.ok(b.skyLast && c.skyLast && d.skyLast && SKY_LAST > 0, 'no celular o céu vem depois do cenário');
  assert.deepEqual(MOBILE_LADDER, ['media', 'baixa', 'minima']);
  assert.deepEqual(QUALITY_MODES, ['auto', 'alta', 'media', 'baixa'], 'o menu não oferece a mínima (só o automático chega lá)');
  // celular deitado (844×390, DPR 3): teto do perfil; tablet grande: o orçamento de pixels manda
  assert.equal(pixelRatioFor(b, { dpr: 3, width: 844, height: 390 }), 1);
  assert.equal(pixelRatioFor(c, { dpr: 3, width: 844, height: 390 }), 0.85);
  assert.equal(pixelRatioFor(d, { dpr: 2.625, width: 915, height: 412 }), 0.7);
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
  assert.deepEqual(env, { coarse: true, anyCoarse: false, hover: false, mobileUA: false, screenW: 412, screenH: 915 });
  assert.equal(readDeviceEnv({}).coarse, false, 'sem matchMedia: PC');
});

test('celular Android que diz ter hover ou ponteiro fino continua celular (layout e qualidade do celular)', () => {
  // o "HUD de navegador" num Android compacto: o navegador dizia hover (ou ponteiro principal fino) e o jogo caía no PC
  assert.equal(detectDevice({ coarse: true, anyCoarse: true, hover: true, screenW: 360, screenH: 640 }), 'phone', 'toque + hover, tela pequena');
  assert.equal(detectDevice({ coarse: false, anyCoarse: true, hover: true, mobileUA: true, screenW: 640, screenH: 360 }), 'phone', 'ponteiro fino fantasma, navegador de celular');
  assert.equal(detectDevice({ coarse: false, anyCoarse: true, hover: false, mobileUA: true, screenW: 320, screenH: 568 }), 'phone');
  // sem toque nenhum, ou toque só como secundário num navegador de PC: PC
  assert.equal(detectDevice({ coarse: false, anyCoarse: false, hover: true, mobileUA: true, screenW: 360, screenH: 640 }), 'desktop', 'sem ponteiro de toque');
  assert.equal(detectDevice({ coarse: false, anyCoarse: true, hover: true, mobileUA: false, screenW: 1366, screenH: 768 }), 'desktop', 'notebook com tela de toque');
  assert.equal(detectDevice({ coarse: false, anyCoarse: true, hover: true, mobileUA: false, screenW: 1280, screenH: 600 }), 'desktop');
  // tablet: tela grande e toque como principal; com o user agent de celular (tela grande), tablet
  assert.equal(detectDevice({ coarse: true, anyCoarse: true, hover: false, screenW: 1180, screenH: 820 }), 'tablet');
  assert.equal(detectDevice({ coarse: true, anyCoarse: true, hover: true, mobileUA: true, screenW: 1180, screenH: 820 }), 'tablet');

  const uaPixel = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const uaTab = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const uaIphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const uaPc = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  assert.ok(isMobileUA({ userAgent: uaPixel }));
  assert.ok(isMobileUA({ userAgent: uaIphone }));
  assert.ok(!isMobileUA({ userAgent: uaTab }), 'tablet Android não tem "Mobile"');
  assert.ok(!isMobileUA({ userAgent: uaPc }));
  assert.ok(isMobileUA({ userAgent: uaPc, userAgentData: { mobile: true } }), 'o próprio navegador diz que é celular');
  assert.ok(!isMobileUA({}));
  const fake = readDeviceEnv({
    matchMedia: (q) => ({ matches: q === '(any-pointer: coarse)' || q === '(hover: hover)' }),
    navigator: { userAgent: uaPixel }, screen: { width: 360, height: 640 },
  });
  assert.equal(detectDevice(fake), 'phone', 'ambiente completo de um Android com hover');
});

test('GPU de entrada de celular começa no perfil baixa', () => {
  for (const g of ['Mali-G57 MC2', 'Mali-G52 MC2', 'Mali-G68 MC4', 'Mali-T830 MP2', 'Adreno (TM) 610', 'Adreno (TM) 619', 'Adreno (TM) 506', 'PowerVR Rogue GE8320']) {
    assert.ok(isLowEndGpu(g), g);
  }
  for (const g of ['Apple GPU', 'Adreno (TM) 642L', 'Adreno (TM) 730', 'Mali-G710 MC10', 'Mali-G78 MP20', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', '']) {
    assert.ok(!isLowEndGpu(g), g || '(vazio)');
  }
  assert.equal(initialLevel('auto', 'phone', { lowGpu: true }), 'baixa');
  assert.equal(initialLevel('auto', 'phone', { lowGpu: false }), 'media');
  assert.equal(initialLevel('alta', 'phone', { lowGpu: true }), 'alta', 'a escolha do menu manda');
  assert.equal(createQualityControl({ device: 'phone', gpu: 'Mali-G57 MC2' }).level, 'baixa', 'Infinix Note 30 5G');
  assert.equal(createQualityControl({ device: 'phone', gpu: 'Apple GPU' }).level, 'media', 'iPhone');
  const pc = createQualityControl({ device: 'desktop', gpu: 'Mali-G57 MC2' });
  assert.ok(pc.level === 'alta' && !pc.lowGpu && !pc.capFps, 'no PC a GPU nem conta e não há teto de quadros');
});

test('dica de "Adicionar à Tela de Início": só no iPhone fora do app e sem tela cheia', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const android = 'Mozilla/5.0 (Linux; Android 14; Infinix X6833B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const base = { ua: iphone, device: 'phone', standalone: false, fullscreenApi: false };
  assert.ok(needsInstallTip(base), 'Safari do iPhone');
  assert.ok(!needsInstallTip({ ...base, standalone: true }), 'aberto pelo ícone da tela inicial: já é tela cheia');
  assert.ok(!needsInstallTip({ ...base, fullscreenApi: true }), 'com a API de tela cheia (iPad), usa o botão');
  assert.ok(!needsInstallTip({ ...base, ua: android, fullscreenApi: true }), 'Android: tela cheia pelo toque');
  assert.ok(!needsInstallTip({ ...base, ua: android }), 'Android sem a API também não (a dica é do iPhone)');
  assert.ok(!needsInstallTip({ ...base, device: 'desktop' }), 'PC: nunca');
  assert.ok(needsInstallTip({ ...base, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', platform: 'MacIntel', touchPoints: 5, device: 'tablet' }),
    'iPad que se diz Mac (toque), sem a API');
  assert.ok(!needsInstallTip({ ...base, ua: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', touchPoints: 0, device: 'tablet' }), 'Mac de verdade');
  assert.ok(!needsInstallTip(), 'sem ambiente: nada');
  const win = (o = {}) => ({
    navigator: { userAgent: iphone, platform: 'iPhone', maxTouchPoints: 5, ...o.nav },
    document: { fullscreenEnabled: false, documentElement: {}, ...o.doc },
    matchMedia: (q) => ({ matches: !!o.modes?.includes(q) }),
  });
  assert.deepEqual(readInstallEnv(win()), { ua: iphone, platform: 'iPhone', touchPoints: 5, standalone: false, fullscreenApi: false });
  assert.equal(readInstallEnv(win({ nav: { standalone: true } })).standalone, true, 'navigator.standalone (iOS)');
  assert.equal(readInstallEnv(win({ modes: ['(display-mode: standalone)'] })).standalone, true, 'display-mode do manifest');
  assert.equal(readInstallEnv(win({ doc: { fullscreenEnabled: true, documentElement: { requestFullscreen() {} } } })).fullscreenApi, true);
  assert.equal(readInstallEnv({}).fullscreenApi, false);
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

test('teto de 60 quadros no celular: 60 Hz roda todos, 120 Hz metade, 90 Hz dois de três', () => {
  /** Quadros que rodam por segundo numa tela de `hz`. */
  const rate = (hz, sec = 10) => {
    const cap = createFrameCap(60);
    let ran = 0;
    const n = Math.round(sec * hz);
    for (let i = 0; i < n; i++) if (cap((i * 1000) / hz)) ran++;
    return ran / sec;
  };
  assert.ok(Math.abs(rate(60) - 60) < 0.5, `60 Hz: ${rate(60)}`);
  assert.ok(Math.abs(rate(120) - 60) < 0.5, `120 Hz: ${rate(120)}`);
  assert.ok(Math.abs(rate(90) - 60) < 1, `90 Hz: ${rate(90)}`);
  assert.ok(Math.abs(rate(30) - 30) < 0.5, `30 Hz (economia de bateria): ${rate(30)}`);
  // depois de uma travada (600 ms) não sai rajada: o segundo seguinte a 120 Hz tem 60 quadros
  const cap = createFrameCap(60);
  for (let i = 0; i < 120; i++) cap(1000 + (i * 1000) / 120);
  assert.ok(cap(2600), 'o quadro depois da travada roda');
  let ran = 0;
  for (let i = 1; i <= 120; i++) if (cap(2600 + (i * 1000) / 120)) ran++;
  assert.ok(Math.abs(ran - 60) <= 1, `sem rajada: ${ran}`);
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

test('governador: 60 fps não muda nada', () => {
  const gov = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(gov, 16.7, 60), []);
  assert.equal(gov.level, 'media');
  assert.ok(!gov.locked);
});

test('governador: 40 fps desce depois de duas janelas; abaixo de 30, com uma só', () => {
  const gov = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(gov, 25, 3.5), [], 'aquecimento (2 s) + uma janela (1,5 s) a 40 fps: ainda não');
  const r = feed(gov, 25, 1.5);
  assert.deepEqual(r.map((x) => [x.action, x.level, Math.round(x.fps)]), [['down', 'baixa', 40]]);
  const g2 = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(g2, 50, 3.5).map((x) => x.level), ['baixa'], '20 fps: a primeira janela já basta');
});

test('governador: se a descida ajudou, segue descendo; no último degrau, para', () => {
  const gov = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(gov, 50, 3.5).map((x) => x.level), ['baixa']); // 20 fps
  // 25 fps (ajudou 1,25×) mas ainda abaixo de 30: desce de novo na primeira janela
  assert.deepEqual(feed(gov, 40, 2.5).map((x) => x.level), ['minima']);
  // ~33 fps (ajudou), abaixo de 45 por duas janelas, mas já é o último degrau
  assert.deepEqual(feed(gov, 30, 4.05), []);
  assert.equal(gov.level, 'minima');
  assert.ok(gov.locked);
});

test('governador: descer sem ganho (o gargalo é outro) para de descer onde está', () => {
  const gov = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(gov, 50, 3.5).map((x) => x.level), ['baixa']);
  assert.deepEqual(feed(gov, 50, 2.6), [], 'a mesma taxa depois de descer');
  assert.equal(gov.level, 'baixa', 'fica na baixa, sem voltar nem descer mais');
  assert.ok(gov.locked);
  assert.deepEqual(feed(gov, 60, 30), [], 'travado: nada mais muda');
});

test('governador: preso a 30 Hz (economia de bateria) e estável não desce; caindo de 30, desce', () => {
  const gov = createFpsGovernor({ level: 'media' });
  assert.deepEqual(feed(gov, 33.4, 20), [], '30 fps redondos: limite do aparelho, não da qualidade');
  const r = feed(gov, 40, 3);
  assert.equal(r[0]?.level, 'baixa', '25 fps: desce');
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
  assert.deepEqual(feed(g2, 25, 3.5), [], 'aquecimento + uma janela ruim');
  feed(g2, 25, 1, false); // pausa: recomeça do aquecimento e esquece a janela ruim
  assert.deepEqual(feed(g2, 25, 3.5), [], 'depois da pausa, de novo só uma janela ruim');
  assert.equal(g2.sample(5000, true), null, 'aba escondida: o intervalo enorme não é quadro');
  const d = feed(g2, 25, 2.5); // assentamento (1 s) + a segunda janela ruim seguida
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
      shadowMap: { type: profile.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap, autoUpdate: true, needsUpdate: false },
    },
    composer: { setPixelRatio: (v) => calls.push(['composer', v]), renderTarget1: rt(), renderTarget2: rt() },
    sun: { castShadow: true, shadow: { mapSize: new THREE.Vector2(profile.shadowSize, profile.shadowSize), map } },
    bloom: { enabled: profile.bloom },
    sky: { renderOrder: SKY_FIRST },
    scene,
  };
}

test('trocar de perfil num engine já criado: só o que mudou', () => {
  const e = fakeEngine();
  const target = { ...e, castShadow: true, dpr: 3, width: 844, height: 390 };
  const pr = applyQualityProfile(target, QUALITY_PROFILES.media, QUALITY_PROFILES.alta);
  assert.equal(pr, 1);
  assert.deepEqual(e.calls, [['renderer', 1], ['composer', 1]]);
  assert.equal(e.renderer.shadowMap.type, THREE.PCFShadowMap);
  assert.ok(e.mat.version > e.v0, 'tipo de sombra mudou: materiais recompilam');
  assert.equal(e.sun.shadow.mapSize.x, 1024);
  assert.equal(e.map.disposed, 1);
  assert.equal(e.sun.shadow.map, null, 'mapa de sombra recriado no próximo quadro');
  assert.equal(e.composer.renderTarget1.samples, 0);
  assert.equal(e.composer.renderTarget2.disposed, 1);
  assert.ok(!e.bloom.enabled && e.sun.castShadow && e.renderer.shadowMap.autoUpdate);
  assert.equal(e.sky.renderOrder, SKY_LAST, 'céu depois do cenário');
  // media → baixa: mesmo tipo e tamanho de sombra (sem recompilar); sombra redesenhada só quando o engine pedir
  const v1 = e.mat.version;
  assert.equal(applyQualityProfile(target, QUALITY_PROFILES.baixa, QUALITY_PROFILES.media), 0.85);
  assert.equal(e.mat.version, v1);
  assert.ok(!e.renderer.shadowMap.autoUpdate && e.renderer.shadowMap.needsUpdate, 'a cada 2 quadros (engine.render)');
  // mínima: sem sombra do sol; uma fase sem sombra continua sem sombra em qualquer perfil
  applyQualityProfile(target, QUALITY_PROFILES.minima, QUALITY_PROFILES.baixa);
  assert.equal(e.sun.castShadow, false);
  applyQualityProfile({ ...target, castShadow: false }, QUALITY_PROFILES.alta, QUALITY_PROFILES.minima);
  assert.equal(e.sun.castShadow, false);
  assert.equal(e.sun.shadow.mapSize.x, 2048);
  assert.equal(e.renderer.shadowMap.type, THREE.PCFSoftShadowMap);
  assert.ok(e.bloom.enabled && e.renderer.shadowMap.autoUpdate);
  assert.equal(e.composer.renderTarget2.samples, 4);
  assert.equal(e.sky.renderOrder, SKY_FIRST);
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
  assert.ok(phone.adaptive && phone.capFps);
  for (let t = 1; t < 12000; t += 50) phone.frame(t, true);
  assert.deepEqual(applied, [['baixa', 'down']], 'desce uma vez; a mesma taxa depois: para na baixa');
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
  assert.ok(phone.forceLevel('minima') && phone.level === 'minima' && !phone.adaptive, 'diagnóstico: força a mínima');
  assert.equal(phone.mode, 'auto', 'sem mudar o modo salvo');
  assert.ok(!phone.forceLevel('ultra'));
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
