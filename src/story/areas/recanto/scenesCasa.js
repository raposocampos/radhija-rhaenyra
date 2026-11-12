// As cenas da CASA (casaPuzzles.js; o cenário em world/casaSul.js), no estilo de scenes.js: planos de cinema DENTRO dos
// cômodos, falas curtas em pt-BR (dir.say) e páginas de HQ (dir.comic, panel, onomato, caption, fx).
//   aspirador    a porta da cozinha abre e o barulho acorda o ASPIRADOR ROBÔ na base, no fim do corredor: os olhos de luz
//                acendem, BIP-BIP, ele sai em zigue-zague pelo corredor (VRRRUUUM) e a Radhija avisa que não passa perto
//                daquilo (a Rhaenyra acha que é só um aspirador). Commit: ele andando pela trilha, a partir de VACUUM.start
//                (a Radhija não entra no corredor). As duas ficam onde estavam;
//   portaFundos  a porta dos fundos abre para o quintal: a luz da manhã, as duas olham para fora e a Radhija aponta o
//                caminho dos pombos. Commit: a porta aberta de vez, as duas na frente dela, por dentro, e a etapa 'quintal'.
// O que fica de PERMANENTE está no commit de cada cena (pular ou assistir dá no mesmo).
// Registrar no puzzle (makeScenes): ...createCasaScenes(K, casa)  →  { aspirador, portaFundos }.
import { createScene, span, smooth, lerp, lerpAngle } from '../../scene/sequencer.js';
import { CASA_SCENES } from './casaPuzzles.js';

const P3 = (x, y, z) => ({ x, y, z });

/** As duas cenas da casa, pelo id (para o makeScenes do puzzle). */
export function createCasaScenes(K, casa) {
  return {
    [CASA_SCENES.aspirador]: createVacuumScene(K, casa),
    [CASA_SCENES.saida]: createBackDoorScene(K, casa),
  };
}

// ------------------------------------------------------------------------------------------------ o aspirador acorda
export function createVacuumScene(K, casa) {
  const { L, dir, emit } = K;
  const V = L.VACUUM, LN = V.lane, KD = L.KITCHEN_DOOR;
  const R = (n) => K.ctx.ctrls[n];
  const S = {};
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
  /** A saída da base até a ponta sul da trilha (a primeira parte do caminho dele). */
  const exitBase = (k) => {
    const e = smooth(k);
    const x = lerp(V.dock.x, casa.laneX(LN.z1), e), z = lerp(V.dock.z, LN.z1, e);
    casa.vacuumPose(x, z, lerpAngle(V.dock.yaw, Math.PI, Math.min(1, k * 1.6)));
  };
  return createScene({
    id: CASA_SCENES.aspirador,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      casa.wakeVacuum();
      const a = R('radhija'), h = R('rhaenyra');
      S.radNear = Math.hypot(a.x - h.x, a.z - h.z) < 4.5;
      dir.comic(true);
      dir.panel('2v', 0, { enter: 'wipe', tilt: -1.2 });
      dir.lens(32);
      // de perto, no fim do corredor: a base e o aspirador acordando
      dir.shot(P3(LN.x + 0.15, 0.42, LN.z1 - 0.55), P3(V.dock.x, 0.06, V.dock.z), { cut: true });
      dir.sfx('aspirador-bip', { x: V.dock.x, z: V.dock.z });
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3((KD.hinge.x + KD.latchPost.x) / 2, 0.3, KD.hinge.z + 1.5);
    },
    beats: [
      {
        // os olhos de luz acendem: BIP-BIP, e ele sai da base
        id: 'acorda', dur: 2.0,
        tick(_, t) {
          once('bip', t > 0.25, () => dir.onomato('BIP-BIP!', { at: P3(V.dock.x - 0.1, 0.42, V.dock.z), size: 0.8, color: '#7fd4ff', rot: -6 }));
          exitBase(span(t, 0.7, 2.0));
        },
      },
      {
        // da porta da cozinha, olhando o corredor: ele vem em zigue-zague (VRRRUUUM)
        id: 'vem', dur: 2.8,
        enter() {
          dir.panel('2v', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(30);
          dir.shot(P3(LN.x - 0.55, 0.55, KD.hinge.z + 0.55), P3(LN.x, 0.12, (LN.z1 + V.start.z) / 2), { inT: 0.4 });
          dir.sfx('aspirador', { x: LN.x, z: LN.z1 });
        },
        tick(_, t) {
          casa.lanePose(lerp(LN.z1, V.start.z, smooth(span(t, 0, 2.6))), -1);
          once('vruum', t > 0.5, () => dir.onomato('VRRRUUUM', { at: P3(LN.x + 0.3, 0.55, LN.z1 - 1.2), size: 1.0, color: '#9bd1ff', rot: -8, style: 'stretch' }));
          once('rha', t > 0.9, () => dir.say('rhaenyra', 'Hã? O aspirador acordou!', { mode: 'cena', dur: 1.6 }));
        },
      },
      {
        // as duas, na porta: a Radhija não passa perto daquilo
        id: 'medo', dur: 3.0,
        enter() {
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(34);
          const h = R('rhaenyra');
          dir.shot(P3((KD.hinge.x + KD.latchPost.x) / 2 - 0.1, 0.78, KD.hinge.z + 0.6), P3(h.x, 0.38, h.z), { cut: true });
          casa.lanePose(V.start.z, -1);
          if (S.radNear) {
            dir.say('radhija', 'Esse monstro barulhento de novo?! Eu não passo!', { mood: 'grito', mode: 'cena', dur: 2.2 });
            dir.gesture?.('radhija', 'shiver');
            dir.balloon?.('medo', { who: 'radhija', life: 2.2 });
          } else dir.say('rhaenyra', 'A Radhija morre de medo dessa coisa…', { mode: 'cena', dur: 2.2 });
        },
        tick(_, t) {
          once('rha2', t > 1.9 && S.radNear, () => dir.say('rhaenyra', 'Medrosa! É só um aspirador… acho.', { mode: 'cena', dur: 1.2 }));
        },
      },
    ],
    cleanup() {
      dir.gesture?.('radhija', null);
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = null;
      dir.cleanup();
    },
    commit() { casa.startPatrol(); },
  });
}

// ------------------------------------------------------------------------------------------------ a porta dos fundos
export function createBackDoorScene(K, casa) {
  const { L, dir, emit } = K;
  const EX = L.HOUSE_EXIT;
  const mz = (EX.z0 + EX.z1) / 2;
  /** Onde as duas ficam depois (por dentro, na frente da porta aberta, olhando para o quintal). */
  const marks = { rad: { x: EX.x - 1.19, z: mz - 0.05, yaw: Math.PI / 2 }, rha: { x: EX.x - 0.59, z: mz + 0.45, yaw: Math.PI / 2 } };
  const out = P3(EX.x + 3.0, 0.7, mz - 0.6);
  const S = {};
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
  return createScene({
    id: CASA_SCENES.saida,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      casa.openExit();
      dir.comic(true);
      dir.panel('2h', 0, { enter: 'wipe', tilt: -1 });
      dir.lens(34);
      // de dentro da sala, por trás delas: a porta aberta e a luz da manhã lá fora
      dir.shot(P3(EX.x - 2.35, 0.95, mz - 0.75), P3(EX.x + 1.2, 0.7, mz + 0.1), { inT: 0.5 });
      dir.sfx('portao', { x: EX.x, z: mz });
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = out;
    },
    beats: [
      {
        id: 'abre', dur: 1.8,
        tick(_, t) {
          once('nhec', t > 0.15, () => dir.onomato('NHÉÉÉC', { at: P3(EX.x - 0.1, 1.5, EX.z1 - 0.1), size: 0.9, color: '#ffe27a', rot: 6, style: 'stretch' }));
          once('passaros', t > 0.6, () => dir.sfx('passarinhos', { x: EX.x + 2, z: mz, volume: 0.8 }));
        },
      },
      {
        // mais perto, baixinho: a Radhija aponta o caminho dos pombos; a Rhaenyra já quer ir
        id: 'olham', dur: 3.0,
        enter() {
          dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(30);
          dir.shot(P3(EX.x - 1.75, 0.45, mz + 0.85), P3(EX.x + 0.6, 0.55, mz - 0.3), { cut: true });
          dir.say('radhija', 'O quintal! Os pombos foram para aquele lado!', { mode: 'cena', dur: 1.8 });
        },
        tick(_, t) {
          const a = dir.actor('radhija');
          a.press = t > 0.2 && t < 1.6 ? { x: out.x, y: 0.6, z: out.z - 1.2, k: Math.sin(span(t, 0.2, 1.6) * Math.PI) } : null;
          once('rha', t > 1.7, () => { dir.say('rhaenyra', 'Bora!', { mood: 'grito', mode: 'cena', dur: 1.0 }); dir.gesture?.('rhaenyra', 'wag'); });
        },
        leave() { dir.actor('radhija').press = null; },
      },
      {
        id: 'corte', dur: 0.8, noSkip: true,
        enter() { dir.fade(1, 0.3); dir.comic(false); dir.gesture?.('rhaenyra', null); },
        tick(_, t) {
          once('marks', t > 0.35, () => {
            dir.pose('radhija', { ...marks.rad, y: 0, speed: 0, airK: -1, look: null });
            dir.pose('rhaenyra', { ...marks.rha, y: 0, speed: 0, airK: -1, look: null });
          });
        },
      },
    ],
    cleanup() {
      dir.gesture?.('rhaenyra', null);
      dir.cleanup({ snap: true });
      dir.fade(0, 0.35);
    },
    commit() {
      casa.afterExit();
      K.placeAt(marks.rad, marks.rha);
      K.setStage('quintal');
      dir.snapFollow();
    },
  });
}
