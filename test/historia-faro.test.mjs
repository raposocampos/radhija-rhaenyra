// Modo História, o modo Faro com fôlego (pedido de 2026-11-11: "crie tipo uma estamina para o Faro, dê a opção de
// ligar e desligar ao apertar"). Só a parte sem GPU:
//  - o liga/desliga (toggle), o gasto (8 s do cheio ao vazio) e a recarga (5 s, começando 0,8 s depois de desligar);
//  - vazio: desliga sozinho, a dog funga cansada e só religa com 25%; numa cena (cinematic), desliga;
//  - um fôlego por dog (trocar dá fôlego novo; a que descansa recarrega);
//  - o aviso story:faroState para o HUD (a cada mudança e a cada ~0,1 s enquanto muda);
//  - o desenho do faro.js no modo: trilhas só com ele ligado, pistas ao alcance reveladas, faíscas e fiapos, tudo
//    apagado em ~0,4 s; a correção de cor volta ao valor de antes (e respeita o clima de cena que mudou no meio);
//  - a nuvem de cheiro andando do focinho para a pista; nada de NaN em lugar nenhum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import { createFaroMode, FARO_MODE, snoutOf } from '../src/story/faro/faroMode.js';
import { createFaro, FARO_GRADE } from '../src/story/faro/faro.js';
import { createScentCloud } from '../src/story/faro/scentCloud.js';
import { SOUND_NAMES } from '../src/fx/audio/sounds.js';

installBrowserStubs();

const DT = 1 / 60;
const dogAt = (name, x = 0, z = 0, yaw = 0) => ({ name, x, z, yaw, y: 0, size: name === 'rhaenyra' ? 'large' : 'small' });

/** O modo com um faro de mentira (só conta o que recebe) e o registro dos eventos. */
function setup({ spotsInReach = [] } = {}) {
  const log = [];
  const calls = { hold: [], wave: 0, sniff: 0, tired: 0, scan: 0 };
  const faro = {
    hold(k, from) { calls.hold.push([k, from]); },
    wave() { calls.wave++; },
    sniff() { calls.sniff++; },
    tired() { calls.tired++; },
    scan() { calls.scan++; return spotsInReach.slice(); },
  };
  const reveals = [];
  const tired = [];
  const mode = createFaroMode({
    faro,
    emit: (name, p) => log.push({ name, p }),
    onReveal: (ids, info) => reveals.push({ ids, fresh: info.fresh, who: info.who }),
    onTired: (who, why) => tired.push({ who, why }),
  });
  const run = (sec, o) => { let k = 0; for (let i = 0; i < Math.round(sec / DT); i++) k = mode.update(DT, o); return k; };
  const events = (name) => log.filter((e) => e.name === name).map((e) => e.p);
  const sfx = () => events('story:sfx').map((p) => p.name);
  return { mode, faro, calls, log, events, sfx, run, reveals, tired };
}

test('modo Faro: apertar liga, apertar de novo desliga (com som e aviso para o HUD)', () => {
  const { mode, run, events, sfx, calls } = setup();
  const r = dogAt('radhija');
  run(0.1, { active: r });
  assert.equal(mode.on, false);
  assert.equal(mode.toggle(r), true, 'o primeiro aperto liga');
  assert.equal(mode.on, true);
  assert.equal(calls.wave, 1, 'a onda sai ao ligar');
  assert.ok(sfx().includes('faro-liga'));
  assert.equal(events('story:faroState').at(-1).on, true);
  // acende em ~0,35 s
  const k = run(0.4, { active: r });
  assert.equal(k, 1);
  assert.equal(mode.toggle(r), false, 'o segundo aperto desliga (→ false: não ligou)');
  assert.equal(mode.on, false);
  assert.ok(sfx().includes('faro-desliga'));
  assert.equal(events('story:faroState').at(-1).on, false);
  // apaga em ~0,4 s
  assert.ok(run(0.2, { active: r }) > 0, 'ainda apagando');
  assert.equal(run(0.25, { active: r }), 0, 'apagado');
  // o faro.js recebe o k a cada quadro
  assert.ok(calls.hold.length > 50);
  assert.equal(calls.hold.at(-1)[0], 0);
  // repique: dois apertos no mesmo instante contam como um
  assert.equal(mode.toggle(r), true);
  assert.equal(mode.toggle(r), false);
  assert.equal(mode.on, true, 'o aperto repicado não desliga');
});

test('fôlego: 8 s ligado esvaziam; vazio desliga sozinho, funga cansada e só religa com 25%', () => {
  const { mode, run, events, sfx, tired, calls } = setup();
  const r = dogAt('radhija');
  run(0.1, { active: r });
  mode.toggle(r);
  run(4, { active: r });
  assert.ok(Math.abs(mode.stamina - 0.5) < 0.02, `metade em 4 s (${mode.stamina})`);
  assert.equal(mode.on, true);
  run(3.9, { active: r });
  assert.equal(mode.on, true, 'ainda ligado pouco antes de 8 s');
  run(0.2, { active: r });
  assert.equal(mode.on, false, 'vazio, desliga sozinho');
  assert.equal(mode.stamina, 0);
  assert.deepEqual(tired.at(-1), { who: 'radhija', why: 'vazio' });
  assert.ok(sfx().includes('faro-cansado'), 'o som de cansada');
  assert.equal(calls.tired, 1, 'o bufo no focinho');
  const tiredState = events('story:faroState').find((p) => p.tired);
  assert.ok(tiredState && tiredState.on === false && tiredState.locked === true, 'o HUD pisca e mostra a trava');
  assert.deepEqual(mode.info().locked, ['radhija']);
  // logo depois: não liga (cansada de novo, sem ligar)
  run(0.3, { active: r });
  assert.equal(mode.toggle(r), false);
  assert.equal(mode.on, false);
  assert.equal(tired.at(-1).why, 'travado');
  // a recarga começa 0,8 s depois de desligar e enche 20%/s: 25% em 0,8 + 1,25 s
  run(1.4, { active: r }); // 1,7 s desde que esvaziou: 0,9 s de recarga = 18%
  assert.ok(mode.stamina > 0.15 && mode.stamina < 0.25, `abaixo dos 25% (${mode.stamina})`);
  assert.equal(mode.canStart('radhija'), false);
  assert.equal(mode.toggle(r), false, 'abaixo dos 25% não religa');
  run(0.5, { active: r });
  assert.ok(mode.stamina >= FARO_MODE.minOn, `passou dos 25% (${mode.stamina})`);
  assert.equal(mode.canStart('radhija'), true);
  assert.equal(mode.toggle(r), true, 'com 25%, religa');
  assert.ok(mode.info().locked.length === 0);
});

test('fôlego: recarrega em 5 s do vazio ao cheio, só depois de 0,8 s desligado; desligar antes de esvaziar não trava', () => {
  const { mode, run } = setup();
  const r = dogAt('radhija');
  run(0.1, { active: r });
  mode.toggle(r);
  run(6, { active: r });
  const left = mode.stamina;
  assert.ok(Math.abs(left - 0.25) < 0.02, `um quarto depois de 6 s (${left})`);
  mode.toggle(r); // desliga com 25%
  run(0.7, { active: r });
  assert.equal(mode.stamina, left, 'nos primeiros 0,8 s não recarrega');
  run(0.6, { active: r }); // 1,3 s: 0,5 s de recarga = +10%
  assert.ok(Math.abs(mode.stamina - (left + 0.1)) < 0.02, `recarregando (${mode.stamina})`);
  // ligar e desligar com pouco fôlego (sem esvaziar) não trava
  mode.toggle(r);
  run(0.5, { active: r });
  mode.toggle(r);
  assert.equal(mode.canStart('radhija'), true);
  // do vazio ao cheio em 0,8 + 5 s
  run(0.2, { active: r });
  assert.equal(mode.toggle(r), true);
  let guard = 0;
  while (mode.on && guard++ < 600) run(DT, { active: r });
  assert.equal(mode.stamina, 0, 'esvaziou');
  run(0.8 + 4.9, { active: r });
  assert.ok(mode.stamina > 0.97 && mode.stamina < 1, `quase cheio em 5,7 s (${mode.stamina})`);
  run(0.2, { active: r });
  assert.equal(mode.stamina, 1);
});

test('cena: o modo desliga sozinho (sem som) e não liga durante ela', () => {
  const { mode, run, sfx } = setup();
  const r = dogAt('radhija');
  run(0.1, { active: r });
  mode.toggle(r);
  run(0.5, { active: r });
  mode.update(DT, { active: r, cinematic: true });
  assert.equal(mode.on, false, 'a cena desliga');
  assert.ok(!sfx().includes('faro-desliga'), 'sem o som de desligar no começo da cena');
  run(0.3, { active: r, cinematic: true });
  assert.equal(mode.toggle(r), false, 'na cena não liga');
  assert.equal(mode.on, false);
  assert.equal(run(0.5, { active: r, cinematic: true }), 0, 'apagou');
  // sem ninguém com a jogadora, também desliga
  run(0.3, { active: r });
  mode.toggle(r);
  mode.update(DT, { active: null });
  assert.equal(mode.on, false);
});

test('uma barra por dog: trocar dá fôlego novo, e a que descansa recarrega', () => {
  const { mode, run, events } = setup();
  const r = dogAt('radhija');
  const h = dogAt('rhaenyra', 1, 0);
  run(0.1, { active: r });
  mode.toggle(r);
  run(6, { active: r });
  assert.ok(mode.staminaOf('radhija') < 0.3);
  // troca com o Faro ligado: a Rhaenyra continua farejando com o fôlego dela
  run(0.1, { active: h });
  assert.equal(mode.on, true);
  assert.equal(mode.who, 'rhaenyra');
  assert.equal(events('story:faroState').at(-1).who, 'rhaenyra', 'o HUD mostra o fôlego de quem está com a jogadora');
  const rad = mode.staminaOf('radhija');
  run(2, { active: h });
  assert.ok(mode.staminaOf('rhaenyra') < 0.8 && mode.staminaOf('rhaenyra') > 0.7, `a Rhaenyra gasta (${mode.staminaOf('rhaenyra')})`);
  assert.ok(mode.staminaOf('radhija') > rad + 0.2, 'a Radhija descansa e recarrega');
  // a Rhaenyra esvazia; a Radhija (com fôlego) pode ligar logo em seguida
  run(6.5, { active: h });
  assert.equal(mode.on, false);
  assert.equal(mode.canStart('rhaenyra'), false);
  assert.equal(mode.canStart('radhija'), true);
  run(0.2, { active: r });
  assert.equal(mode.toggle(r), true);
  // trocar para a dog travada com o Faro ligado: desliga
  run(0.3, { active: r });
  run(DT, { active: h });
  assert.equal(mode.on, false, 'a irmã sem fôlego não continua');
});

test('aviso para o HUD: story:faroState a cada mudança e a cada ~0,1 s enquanto o fôlego muda; parado, nada', () => {
  const { mode, run, events } = setup();
  const r = dogAt('radhija');
  run(0.5, { active: r });
  const n0 = events('story:faroState').length;
  run(2, { active: r });
  assert.equal(events('story:faroState').length, n0, 'cheio e desligado: nenhum aviso');
  mode.toggle(r);
  const n1 = events('story:faroState').length;
  run(2, { active: r });
  const during = events('story:faroState').length - n1;
  assert.ok(during >= 17 && during <= 22, `uns 20 avisos em 2 s ligados (${during})`);
  for (const p of events('story:faroState')) {
    assert.ok(Number.isFinite(p.stamina) && p.stamina >= 0 && p.stamina <= 1, JSON.stringify(p));
    assert.equal(typeof p.on, 'boolean');
    assert.ok(p.who === 'radhija' || p.who === 'rhaenyra');
  }
  // recarrega até encher e para de avisar; o último diz cheio
  mode.toggle(r);
  run(0.8 + 1.4, { active: r });
  assert.equal(events('story:faroState').at(-1).stamina, 1);
  const n2 = events('story:faroState').length;
  run(1, { active: r });
  assert.equal(events('story:faroState').length, n2);
  // reset: cheio e desligado, com aviso
  mode.toggle(r);
  run(1, { active: r });
  mode.reset();
  assert.equal(mode.on, false);
  assert.equal(mode.k, 0);
  assert.deepEqual({ on: events('story:faroState').at(-1).on, stamina: events('story:faroState').at(-1).stamina }, { on: false, stamina: 1 });
});

test('pistas: ligado, as do alcance se revelam (na hora e enquanto dura), uma procura a cada 0,25 s', () => {
  const { mode, run, reveals, calls, sfx } = setup({ spotsInReach: ['trilha', 'pote'] });
  const r = dogAt('radhija');
  run(0.1, { active: r });
  mode.toggle(r);
  assert.equal(reveals.length, 1, 'na hora em que liga');
  assert.deepEqual(reveals[0], { ids: ['trilha', 'pote'], fresh: ['trilha', 'pote'], who: 'radhija' });
  run(1, { active: r });
  assert.ok(calls.scan >= 4 && calls.scan <= 6, `procuras em 1 s: ${calls.scan}`);
  assert.deepEqual(reveals.at(-1).fresh, [], 'as mesmas pistas não são novas');
  // as fungadas: uma logo depois de ligar e a cada 1,25 s, com o som baixinho
  assert.equal(calls.sniff, 1);
  run(1.3, { active: r });
  assert.equal(calls.sniff, 2);
  assert.ok(sfx().includes('fungada'));
  // desligado, não procura
  mode.toggle(r);
  const n = calls.scan;
  run(1, { active: r });
  assert.equal(calls.scan, n);
});

test('os sons do modo Faro existem na biblioteca', () => {
  for (const n of ['faro-liga', 'faro-desliga', 'faro-cansado', 'fungada']) assert.ok(SOUND_NAMES.includes(n), n);
});

test('nada de NaN: dt estranho, dog sem yaw, focinho de cada dog', () => {
  const { mode, events } = setup();
  const r = { name: 'radhija', x: 1, z: 2 };
  for (const dt of [NaN, -1, Infinity, 0, 5]) mode.update(dt, { active: r });
  mode.toggle(r);
  for (const dt of [NaN, -1, Infinity, 0, 5]) mode.update(dt, { active: r });
  const st = mode.info();
  for (const v of Object.values(st.stamina)) assert.ok(Number.isFinite(v));
  assert.ok(Number.isFinite(mode.k));
  for (const p of events('story:faroState')) assert.ok(Number.isFinite(p.stamina));
  const a = snoutOf(dogAt('radhija', 0, 0, 0));
  const b = snoutOf(dogAt('rhaenyra', 0, 0, Math.PI / 2));
  assert.ok(a.z > 0.25 && Math.abs(a.x) < 1e-9, 'o focinho fica na frente');
  assert.ok(b.x > a.z && b.y > a.y, 'a Rhaenyra é maior');
  const c = snoutOf({ x: NaN, z: 0 });
  assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z));
});

// ---------------------------------------------------------------------------------------------- o desenho (faro.js)
/** O motor falso: só a correção de cor (os uniformes de verdade do engine.js). */
function fakeEngine() {
  return {
    grade: {
      uniforms: {
        uSat: { value: 1.07 },
        uWarm: { value: new THREE.Vector3(1.035, 1.0, 0.93) },
        uLift: { value: new THREE.Vector3(0.006, 0.003, 0.0) },
        uVignette: { value: 0.24 },
      },
    },
    quality: { profile: { post: true } },
  };
}
const gradeOf = (e) => {
  const G = e.grade.uniforms;
  return { sat: G.uSat.value, vig: G.uVignette.value, warm: G.uWarm.value.toArray(), lift: G.uLift.value.toArray() };
};
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function scene() {
  const root = new THREE.Group();
  const engine = fakeEngine();
  const faro = createFaro({ root, engine, world: null });
  faro.addTrail('cenoura', [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }]);
  faro.addSpot('perto', { x: 1, z: 1, r: 3 });
  faro.addSpot('longe', { x: 20, z: 0, r: 3 });
  const reveals = [];
  const mode = createFaroMode({ faro, emit: () => {}, onReveal: (ids) => reveals.push(...ids) });
  let time = 0;
  const run = (sec, o) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      time += DT;
      mode.update(DT, o);
      faro.update(DT, time);
    }
  };
  return { root, engine, faro, mode, run, reveals };
}
const named = (root, name) => root.getObjectByName(name);
const finiteMatrices = (mesh) => {
  const a = mesh.instanceMatrix.array;
  for (let i = 0; i < mesh.count * 16; i++) if (!Number.isFinite(a[i])) return false;
  const c = mesh.instanceColor?.array;
  if (c) for (let i = 0; i < mesh.count * 3; i++) if (!Number.isFinite(c[i])) return false;
  return true;
};

test('desenho: ligado, trilhas, pistas, faíscas e fiapos aparecem; desligado, tudo some em ~0,4 s', () => {
  const { root, faro, mode, run, reveals } = scene();
  const r = dogAt('radhija', 0.5, 0.2);
  run(0.2, { active: r });
  const trail = named(root, 'faro:trilha:cenoura');
  const fx = named(root, 'faro:fiapos');
  const perto = named(root, 'faro:pista:perto');
  assert.equal(trail.visible, false, 'trilha escondida com o Faro desligado');
  assert.equal(fx.visible, false);
  mode.toggle(r);
  run(0.6, { active: r });
  assert.equal(trail.visible, true, 'a trilha aparece com o modo ligado');
  assert.equal(named(root, 'faro:veu').visible, true);
  assert.equal(perto.visible, true);
  assert.ok(reveals.includes('perto') && !reveals.includes('longe'), 'só a pista ao alcance se revela');
  assert.deepEqual(faro.info().near, ['perto']);
  // a do alcance brilha mais que a de longe
  const lit = (id) => faro.spot(id).kk;
  assert.ok(lit('perto') > 0.9 && lit('longe') < 0.5 && lit('longe') > 0.2, `perto ${lit('perto')} × longe ${lit('longe')}`);
  assert.ok(fx.visible && fx.count >= 8, `faíscas e fiapos (${fx.count})`);
  assert.ok(finiteMatrices(fx) && finiteMatrices(trail));
  // a onda sai ao ligar e some
  assert.equal(named(root, 'faro:onda').visible, true);
  run(1.0, { active: r });
  assert.equal(named(root, 'faro:onda').visible, false, 'a onda acaba em ~1,3 s');
  // a fungada: longe das trilhas e das pistas, os fiapinhos de ar entram no focinho
  const far = dogAt('radhija', 10, 10);
  const nose = new THREE.Vector3(snoutOf(far).x, snoutOf(far).y, snoutOf(far).z);
  const nearNose = () => {
    const out = [];
    for (let i = 0; i < fx.count; i++) {
      const p = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(fx.instanceMatrix.array, i * 16));
      if (p.distanceTo(nose) < 0.6) out.push(p.distanceTo(nose));
    }
    return out;
  };
  let guard = 0;
  do { run(DT, { active: far }); } while (nearNose().length && ++guard < 120);
  assert.equal(nearNose().length, 0, 'entre uma fungada e outra, nada no focinho');
  faro.sniff();
  run(0.12, { active: far });
  const d1 = nearNose();
  assert.ok(d1.length >= 3, `os fiapinhos entrando no focinho (${d1.length})`);
  run(0.12, { active: far });
  const d2 = nearNose();
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(d2.length && avg(d2) < avg(d1), 'chegando perto do focinho');
  assert.ok(finiteMatrices(fx));
  // desliga: some tudo em ~0,4 s
  mode.toggle(r);
  run(0.45, { active: r });
  assert.equal(faro.k, 0);
  assert.equal(trail.visible, false, 'trilha some');
  assert.equal(named(root, 'faro:veu').visible, false);
  assert.equal(perto.visible, false);
  assert.equal(faro.info().active, false);
  // presa (revelada, sem examinar): continua brilhando fraco, com faíscas
  faro.pin('perto', true);
  run(0.2, { active: r });
  assert.equal(perto.visible, true);
  assert.equal(named(root, 'faro:pista:longe').visible, false);
  assert.ok(fx.visible && fx.count > 0);
  faro.pin('perto', false);
  run(0.2, { active: r });
  assert.equal(perto.visible, false);
});

test('desenho: sem fôlego, o bufo cinza sai do focinho mesmo com o Faro apagando', () => {
  const { root, mode, run } = scene();
  const r = dogAt('radhija');
  run(0.1, { active: r });
  mode.toggle(r);
  run(8.05, { active: r });
  assert.equal(mode.on, false);
  run(0.6, { active: r });
  const fx = named(root, 'faro:fiapos');
  assert.ok(fx.visible && fx.count > 0, 'o bufo depois de apagado');
  assert.ok(finiteMatrices(fx));
  run(1.0, { active: r });
  assert.equal(fx.visible, false, 'e some');
});

test('cor: a visão de cheiro tira cor, esfria e fecha a vinheta; ao desligar, volta ao valor de antes', () => {
  const { engine, mode, run } = scene();
  const r = dogAt('radhija');
  const g0 = gradeOf(engine);
  run(0.1, { active: r });
  mode.toggle(r);
  run(0.5, { active: r });
  const g1 = gradeOf(engine);
  assert.ok(close(g1.sat, g0.sat * FARO_GRADE.sat, 1e-4), `saturação ${g1.sat}`);
  assert.ok(close(g1.vig, g0.vig + FARO_GRADE.vignette, 1e-4), `vinheta ${g1.vig}`);
  assert.ok(g1.warm[2] > g0.warm[2] && g1.warm[0] < g0.warm[0], 'mais frio');
  assert.ok(g1.lift[2] > g0.lift[2], 'névoa violeta');
  mode.toggle(r);
  run(0.2, { active: r });
  assert.ok(gradeOf(engine).sat > g1.sat && gradeOf(engine).sat < g0.sat, 'voltando suave');
  run(0.3, { active: r });
  assert.deepEqual(gradeOf(engine), g0, 'de volta, exatamente');
  for (const v of [...g1.warm, ...g1.lift, g1.sat, g1.vig]) assert.ok(Number.isFinite(v));
});

test('cor: o clima de cena (mood.js) muda a cor no meio do Faro; o valor dele vira a base e fica ao desligar', () => {
  const { engine, mode, run } = scene();
  const r = dogAt('radhija');
  const G = engine.grade.uniforms;
  run(0.1, { active: r });
  mode.toggle(r);
  run(0.5, { active: r });
  // o mood.set(NIGHT) escreve valores absolutos
  G.uSat.value = 0.8;
  G.uVignette.value = 0.4;
  G.uWarm.value.set(0.9, 0.95, 1.1);
  G.uLift.value.set(0.01, 0.01, 0.02);
  run(0.1, { active: r });
  assert.ok(close(G.uSat.value, 0.8 * FARO_GRADE.sat, 1e-4), 'a base nova, com a visão de cheiro por cima');
  mode.toggle(r);
  run(0.6, { active: r });
  assert.ok(close(G.uSat.value, 0.8) && close(G.uVignette.value, 0.4), `a noite fica (${G.uSat.value}, ${G.uVignette.value})`);
  assert.deepEqual(G.uWarm.value.toArray().map((v) => +v.toFixed(6)), [0.9, 0.95, 1.1]);
  // e se o clima mudar no último quadro do apagar, o valor dele fica (o Faro não escreve por cima)
  mode.toggle(r);
  run(0.5, { active: r });
  mode.toggle(r);
  run(0.38, { active: r });
  G.uSat.value = 1.07;
  run(0.2, { active: r });
  assert.equal(G.uSat.value, 1.07);
});

test('o pulso antigo continua: acende, revela as do alcance e apaga em ~8,6 s', () => {
  const { root, faro } = scene();
  let time = 0;
  const step = (sec) => { for (let i = 0; i < Math.round(sec / DT); i++) { time += DT; faro.update(DT, time); } };
  assert.deepEqual(faro.pulse({ x: 0.5, z: 0.5 }), ['perto']);
  step(1);
  assert.equal(faro.k, 1);
  assert.equal(named(root, 'faro:trilha:cenoura').visible, true);
  step(7.7);
  assert.equal(faro.active, false);
  assert.equal(faro.k, 0);
  faro.stop();
  faro.dispose();
  assert.equal(root.children.length, 0);
});

// ---------------------------------------------------------------------------------------------- a nuvem de cheiro
test('nuvem de cheiro: anda do focinho para a pista, a ponta mais forte, o tufo na pista; k 0 apaga', () => {
  const root = new THREE.Group();
  const cloud = createScentCloud({ root, layout: /** @type {any} */ ({ NAV_NODES: {}, NAV_EDGES: [] }), world: null });
  cloud.setLead({ x: 6, z: 0, color: '#FF8A2A' });
  const from = { x: 0, z: 0, yaw: Math.PI / 2 };
  const mesh = cloud.mesh;
  const posOf = (i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16));
  cloud.update(DT, 10, 1, from);
  const info = cloud.info();
  assert.ok(info.on && info.puffs >= 15, JSON.stringify(info));
  assert.ok(finiteMatrices(mesh));
  // as do caminho (sem o tufo) andam para a pista
  const n = mesh.count - 5;
  const xs = Array.from({ length: n }, (_, i) => posOf(i).x);
  cloud.update(DT, 10.2, 1, from);
  const xs2 = Array.from({ length: n }, (_, i) => posOf(i).x);
  const moved = xs.slice(0, 5).map((x, i) => xs2[i] - x);
  assert.ok(moved.every((d) => d > 0.05 && d < 0.2), `andam ~0,11 m em 0,2 s: ${moved.map((d) => d.toFixed(3))}`);
  // a ponta (perto da pista) mais forte que o meio
  const bright = (i) => Math.max(...mesh.instanceColor.array.slice(i * 3, i * 3 + 3));
  const tip = Math.max(...Array.from({ length: 4 }, (_, j) => bright(n - 2 - j)));
  const mid = Math.max(...Array.from({ length: 4 }, (_, j) => bright(Math.floor(n / 2) - 4 + j)));
  assert.ok(tip > mid * 0.95, `ponta ${tip.toFixed(2)} × meio ${mid.toFixed(2)}`);
  // o tufo em volta da pista
  for (let j = mesh.count - 5; j < mesh.count; j++) assert.ok(posOf(j).distanceTo(new THREE.Vector3(6, posOf(j).y, 0)) < 0.5);
  // o focinho anda: o começo do rastro acompanha no mesmo quadro
  cloud.update(DT, 10.3, 1, { x: 1, z: 0 });
  assert.ok(posOf(0).x > 1, 'a primeira nuvenzinha na frente de quem fareja');
  // NaN não estraga nada
  cloud.update(NaN, NaN, 1, from);
  assert.ok(finiteMatrices(mesh));
  cloud.update(DT, 11, 0, from);
  assert.equal(cloud.info().on, false);
  cloud.dispose();
});
