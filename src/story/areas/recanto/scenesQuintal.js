// As cenas do QUINTAL MAIOR (quintalPuzzles.js; o cenário em world/quintal.js), no estilo de scenes.js: planos curtos,
// falas em pt-BR (dir.say) e páginas de HQ (dir.comic, panel, onomato, caption). As dogs ficam onde estavam (nenhuma
// anda nas cenas): pular ou assistir deixa tudo igual, e o que é permanente sai no commit.
//   quintalChega   a primeira vez do lado de fora: o quintal dos fundos, o jabuti cochilando na passagem da horta e os
//                  aspersores do jardim lá adiante. Commit: a cena já passou;
//   quintalJabuti  a Radhija joga a folha de alface no cantinho; o Seu Bento cheira, fala devagar e vai atrás dela.
//                  Commit: a folha no cantinho e o jabuti andando;
//   quintalPipa    a rabiola de perto: penas cinzentas e um anel de borracha laranja enroscados. Commit: a pista
//                  'rabiola';
//   quintalBolinha a bolinha de meia da Rhaenyra boiando na borda do baldão, com as bicadas. Commit: a 4ª meia.
// Registrar no puzzle (makeScenes): ...createQuintalScenes(K, yard).
import * as THREE from 'three';
import { createScene, span, smooth, lerp } from '../../scene/sequencer.js';
import { YARD_SCENES } from './quintalPuzzles.js';

const P3 = (x, y, z) => ({ x, y, z });
const NAMES = ['radhija', 'rhaenyra'];

/** As quatro cenas do quintal, pelo id (para o makeScenes do puzzle). */
export function createQuintalScenes(K, yard) {
  return {
    [YARD_SCENES.chega]: createYardArrival(K, yard),
    [YARD_SCENES.jabuti]: createJabutiScene(K, yard),
    [YARD_SCENES.pipa]: createKiteScene(K, yard),
    [YARD_SCENES.bolinha]: createToyScene(K, yard),
  };
}

/** Uma vez só dentro da cena (a chave é do beat: o mesmo nome em dois beats pularia o segundo). */
function onceIn(S) {
  return (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
}

// ------------------------------------------------------------------------------------------------ a chegada no quintal
export function createYardArrival(K, yard) {
  const { L, dir, emit, props } = K;
  const JB = L.JABUTI, SP = L.SPRINKLERS, SD = L.SERVICE_DOOR;
  const S = {};
  const once = onceIn(S);
  return createScene({
    id: YARD_SCENES.chega,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      const a = dir.actor('radhija');
      S.a = { x: a.x, z: a.z };
    },
    beats: [
      {
        // o quintal dos fundos, do alto da porta: o jardim, a horta e lá no fundo a porta da área de serviço
        id: 'fundos', dur: 2.6,
        enter() {
          dir.lens(40);
          // longe da folha da porta dos fundos (ela abre para fora, para o leste): a 2,6 m da parede da casa e no alto
          const EX = L.HOUSE_EXIT;
          dir.shot(P3(EX.x + 2.6, 2.1, (EX.z0 + EX.z1) / 2 + 2.4), P3(JB.x, 0.4, JB.z - 3.5), { inT: 0.8 });
          dir.caption('O quintal dos fundos', { sub: 'depois da garoa', pos: 'bl', dur: 2.4 });
          for (const n of NAMES) dir.actor(n).look = P3(JB.x, 0.3, JB.z);
        },
        tick(_, t) { once('fala', t > 0.9, () => dir.say('radhija', 'A porta da área de serviço fica lá no fundo…', { mode: 'cena', dur: 1.7 })); },
      },
      {
        // o jabuti cochilando bem no meio da passagem da horta
        id: 'jabuti', dur: 2.6,
        enter() {
          dir.comic(true);
          dir.panel('2h', 0, { enter: 'wipe', tilt: -1.5 });
          dir.lens(30);
          dir.shot(P3(JB.x + 0.9, 0.55, JB.z + 1.5), P3(JB.x, 0.15, JB.z), { inT: 0.5 });
          dir.onomato('ZZZ…', { at: P3(JB.x, 0.55, JB.z), size: 0.7, color: '#c9d6ff', rot: -6 });
        },
        tick(_, t) { once('fala', t > 0.6, () => dir.say('rhaenyra', 'Tem um jabuti dormindo no caminho!', { mode: 'cena', dur: 1.8 })); },
      },
      {
        // os aspersores do jardim ligando um depois do outro
        id: 'aspersores', dur: 2.8,
        enter() {
          dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(36);
          const m = SP.heads[1];
          dir.shot(P3(m.x + 0.6, 1.4, SP.lane.z1 + 1.6), P3(m.x, 0.3, m.z - 0.5), { inT: 0.5 });
          dir.onomato('TSSS!', { at: P3(m.x, 0.9, m.z), size: 0.8, color: '#8fd3ff', rot: 6 });
        },
        tick(_, t) { once('fala', t > 0.5, () => dir.say('radhija', 'E os aspersores ligados… eu NÃO vou me molhar!', { mode: 'cena', dur: 2.0 })); },
      },
    ],
    cleanup() { dir.cleanup({ snap: true }); },
    commit() { yard.introDone(); dir.snapFollow?.(); },
  });
}

// ------------------------------------------------------------------------------------------------ a folha para o jabuti
export function createJabutiScene(K, yard) {
  const { L, dir, emit, props } = K;
  const JB = L.JABUTI;
  const S = {};
  const once = onceIn(S);
  /** A folha voando da boca da Radhija até o cantinho (um arco curto). */
  const leafArc = (k) => {
    const leaf = props.quintal?.lettuce?.leaf;
    if (!leaf || !S.from) return;
    const e = smooth(k);
    leaf.position.set(lerp(S.from.x, JB.leaf.x, e), 0.012 + Math.sin(Math.PI * k) * 0.45 + (1 - k) * (S.from.y - 0.012), lerp(S.from.z, JB.leaf.z, e));
    leaf.rotation.set(0, 0.4 + k * 3, 0);
  };
  return createScene({
    id: YARD_SCENES.jabuti,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      const leaf = props.quintal?.lettuce?.leaf;
      // a folha sai da boca: fica no mundo, de onde estava
      if (leaf) {
        const p = leaf.getWorldPosition(new THREE.Vector3());
        props.quintal.lettuce.putLeaf(p.x, p.z, 1);
        S.from = { x: p.x, y: Math.max(0.15, p.y), z: p.z };
        leafArc(0);
      }
      const a = dir.actor('radhija');
      for (const n of NAMES) dir.actor(n).look = P3(JB.leaf.x, 0.1, JB.leaf.z);
      dir.comic(true);
      dir.panel('2h', 0, { enter: 'zoom', tilt: -1 });
      dir.lens(34);
      dir.shot(P3(a.x - 1.2, 0.9, a.z + 1.6), P3((a.x + JB.leaf.x) / 2, 0.25, (a.z + JB.leaf.z) / 2), { inT: 0.5 });
    },
    beats: [
      {
        // "Pega, Seu Bento!": a folha voa até o cantinho do canteiro
        id: 'joga', dur: 1.6,
        tick(_, t) {
          once('fala', t > 0.05, () => { dir.say('radhija', 'Pega, Seu Bento! Alface fresquinha!', { mode: 'cena', dur: 1.5 }); dir.sfx('pulinho', { x: JB.leaf.x, z: JB.leaf.z, volume: 0.5 }); });
          leafArc(span(t, 0.3, 1.2));
        },
      },
      {
        // o jabuti acorda, estica o pescoço e fala devagarinho
        id: 'cheira', dur: 3.0,
        enter() {
          dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(28);
          const j = props.quintal?.jabuti;
          j?.setState?.('acordado');
          j?.lookAt?.(P3(JB.leaf.x, 0.05, JB.leaf.z));
          dir.shot(P3(JB.x + 0.75, 0.42, JB.z + 0.95), P3(JB.x, 0.15, JB.z + 0.1), { inT: 0.4 });
          dir.onomato('SNIF?', { at: P3(JB.x + 0.2, 0.45, JB.z + 0.2), size: 0.7, color: '#9be07a', rot: -6 });
        },
        tick(_, t) {
          once('fala', t > 0.5, () => { props.quintal?.jabuti?.say?.(true); dir.say('bento', 'Al… fa… ce…', { mode: 'cena', dur: 2.2 }); });
        },
        leave() { props.quintal?.jabuti?.say?.(false); },
      },
      {
        // as duas olhando o Seu Bento começar a andar (muito devagar)
        id: 'devagar', dur: 2.8,
        enter() {
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(34);
          const a = dir.actor('radhija'), h = dir.actor('rhaenyra');
          const mx = (a.x + h.x) / 2, mz = (a.z + h.z) / 2;
          dir.shot(P3(mx + 1.6, 0.7, mz + 1.2), P3(mx, 0.35, mz), { inT: 0.4 });
        },
        tick(_, t) {
          once('rha', t > 0.1, () => { dir.say('rhaenyra', 'Ele é tão fofinho!', { mode: 'cena', dur: 1.2 }); dir.gesture?.('rhaenyra', 'wag'); });
          once('rad', t > 1.3, () => dir.say('radhija', 'Anda, Seu Bento! A gente tem pombo pra pegar!', { mode: 'cena', dur: 1.5 }));
        },
      },
    ],
    cleanup() {
      dir.gesture?.('rhaenyra', null);
      props.quintal?.jabuti?.say?.(false);
      dir.cleanup({ snap: true });
    },
    commit() {
      yard.giveLeaf();
      dir.snapFollow?.();
    },
  });
}

// ------------------------------------------------------------------------------------------------ a rabiola da pipa
export function createKiteScene(K, yard) {
  const { dir, emit } = K;
  const S = {};
  const once = onceIn(S);
  return createScene({
    id: YARD_SCENES.pipa,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      const at = yard.state?.kiteAt || K.L.KITE.land[0];
      S.at = { x: at.x, z: at.z };
      for (const n of NAMES) dir.actor(n).look = P3(at.x, 0.05, at.z);
      dir.comic(true);
      dir.panel('2h', 0, { enter: 'wipe', tilt: -1.5 });
      dir.lens(30);
      dir.shot(P3(at.x + 0.7, 0.75, at.z + 0.9), P3(at.x, 0.03, at.z + 0.45), { inT: 0.5 });
    },
    beats: [
      {
        id: 'penas', dur: 2.6,
        tick(_, t) { once('fala', t > 0.3, () => dir.say('radhija', 'Penas cinzentas enroscadas na rabiola…', { mode: 'cena', dur: 2.0 })); },
      },
      {
        // o anel de borracha laranja, de pertinho
        id: 'anel', dur: 3.0,
        enter() {
          dir.panel('2h', 1, { enter: 'zoom', tilt: 1.5 });
          dir.lens(24);
          dir.shot(P3(S.at.x + 0.35, 0.45, S.at.z + 0.95), P3(S.at.x, 0.02, S.at.z + 0.62), { inT: 0.4 });
          dir.onomato('!', { at: P3(S.at.x, 0.35, S.at.z + 0.62), size: 0.9, color: '#f07a1a', rot: 8 });
        },
        tick(_, t) { once('fala', t > 0.2, () => dir.say('radhija', '…e um anel de borracha! Os pombos passaram por aqui carregando borracha!', { mode: 'cena', dur: 2.6 })); },
      },
      {
        id: 'rhaenyra', dur: 2.6,
        enter() {
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(34);
          const a = dir.actor('radhija'), h = dir.actor('rhaenyra');
          dir.shot(P3((a.x + h.x) / 2 + 1.4, 0.7, (a.z + h.z) / 2 + 1.1), P3((a.x + h.x) / 2, 0.35, (a.z + h.z) / 2), { inT: 0.4 });
        },
        tick(_, t) {
          once('rha', t > 0.1, () => dir.say('rhaenyra', 'Eles queriam roubar a pipa também?!', { mode: 'cena', dur: 1.2 }));
          once('rad', t > 1.3, () => dir.say('radhija', 'Não, boba. Só a borracha. Anotado!', { mode: 'cena', dur: 1.2 }));
        },
      },
    ],
    cleanup() { dir.cleanup({ snap: true }); },
    commit() { yard.kiteSeen(); dir.snapFollow?.(); },
  });
}

// ------------------------------------------------------------------------------------------------ a bolinha de meia
export function createToyScene(K, yard) {
  const { L, dir, emit } = K;
  const BK = L.BUCKET;
  const S = {};
  const once = onceIn(S);
  return createScene({
    id: YARD_SCENES.bolinha,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      for (const n of NAMES) dir.actor(n).look = P3(BK.x, BK.h, BK.z);
      dir.comic(true);
      dir.panel('2h', 0, { enter: 'zoom', tilt: -1 });
      dir.lens(30);
      dir.shot(P3(BK.x - 0.9, 0.95, BK.z - 0.9), P3(BK.x, BK.h, BK.z), { inT: 0.5 });
      dir.onomato('PLOC!', { at: P3(BK.x, BK.h + 0.3, BK.z), size: 0.8, color: '#cfe04a', rot: 6 });
    },
    beats: [
      {
        id: 'boia', dur: 2.4,
        tick(_, t) { once('fala', t > 0.25, () => dir.say('rhaenyra', 'MINHA BOLINHA DE MEIA! Sumiu na garoa!', { mode: 'cena', dur: 1.9, mood: 'grito' })); },
      },
      {
        // as bicadas na borracha da bolinha: a detetive anota
        id: 'bicadas', dur: 2.8,
        enter() {
          dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(26);
          dir.shot(P3(BK.x - 0.5, BK.h + 0.35, BK.z - 0.45), P3(BK.x, BK.h, BK.z), { inT: 0.4 });
        },
        tick(_, t) { once('fala', t > 0.2, () => dir.say('radhija', 'Bicadas… até a sua bolinha de borracha eles tentaram levar!', { mode: 'cena', dur: 2.4 })); },
      },
    ],
    cleanup() { dir.cleanup({ snap: true }); },
    commit() { yard.takeToy(); dir.snapFollow?.(); },
  });
}
