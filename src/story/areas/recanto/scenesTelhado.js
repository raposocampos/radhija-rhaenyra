// As cenas do TERRAÇO DA TORRE jogável (rooftop.js; o cenário em world/telhado.js), no estilo de scenes.js: planos de
// cinema dentro do lugar, falas curtas em pt-BR (dir.say), páginas de HQ (dir.comic, panel, onomato, caption, fx).
//   telhadoChega  o corte no preto do saguão para o terraço: as duas saem da casinha da escada, o Esquadrão no varal
//                 provoca ("ninguém alcança o Esquadrão Migalha!") e a Rhaenyra dá a ideia (uma de guarda, a outra
//                 espanta). Commit: o bando no varal, as duas na frente da casinha, a caça começa;
//   telhadoFuga   lá no alto da caixa d'água: QUAAASE! O bando foge com a cenoura (e o Soneca com a TAMPA de borracha
//                 do alçapão) para a cidade, com o relógio parado ao longe; a Radhija acha o alçapão aberto. Commit: a
//                 pista 'tampa', as penas no chão, as duas embaixo, perto da caixa;
//   telhadoOlha   na mureta do norte, de frente para a cidade: a Radhija brava, a Rhaenyra "pela rua!", e o corte de
//                 volta para a porta da torre. Commit: a etapa 'portaria' (como o fim da cena 'terraco' de antes).
// O que fica de PERMANENTE está no commit de cada cena (pular ou assistir dá no mesmo).
// Registrar no puzzle (makeScenes): ...createRooftopScenes(K, roof)  →  { telhadoChega, telhadoFuga, telhadoOlha }.
import { createScene, span, smooth, lerp } from '../../scene/sequencer.js';
import { ROOF_SCENES } from './rooftop.js';

const P3 = (x, y, z) => ({ x, y, z });

/**
 * O Esquadrão voando em bando, baixo e torto (como o flyPack de scenes.js): o Capitão na frente, o Farelo no meio com a
 * cenoura nas patas e o Soneca atrás. `p` é onde o Farelo está; `yaw`, para onde voam.
 */
function flyPack(K, roof, p, yaw, t, k = 0) {
  const sq = K.props.squad;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const wob = Math.sin(t * 6.1) * 0.07;
  const at = (ahead, side, up) => ({ x: p.x + fx * ahead + rx * side, y: p.y + up, z: p.z + fz * ahead + rz * side });
  for (const [b, q] of [[sq.cap, at(0.75, -0.28, 0.24 - wob * 0.5)], [sq.far, at(0, 0, wob)], [sq.son, at(-0.7, 0.32, 0.16 + wob * 0.7)]]) {
    b.setVisible(true);
    b.shiver?.(0);
    b.setPose({ ...q, yaw, flying: true, asleep: false, flightProgress: k });
  }
  roof.grabCarrot();
}

/** As três cenas do terraço, pelo id (para o makeScenes do puzzle). */
export function createRooftopScenes(K, roof) {
  return {
    [ROOF_SCENES.chega]: createRoofArrival(K, roof),
    [ROOF_SCENES.fuga]: createRoofEscape(K, roof),
    [ROOF_SCENES.olha]: createRoofLook(K, roof),
  };
}

// ------------------------------------------------------------------------------------------------ a chegada
export function createRoofArrival(K, roof) {
  const { L, dir, props, emit } = K;
  const H = L.ROOF_HUT, A = L.ROOF_ARRIVE, PV = L.ROOF_PERCHES.varal;
  const dz = (H.door.z0 + H.door.z1) / 2;
  /** Logo do lado de fora da porta da casinha (como quem acabou de subir a escada). */
  const out = { rad: { x: H.x1 + 0.4, z: H.door.z1 - 0.1, yaw: Math.PI / 2 }, rha: { x: H.x1 + 0.52, z: H.door.z0 + 0.1, yaw: Math.PI / 2 } };
  const S = {};
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
  return createScene({
    id: ROOF_SCENES.chega,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      dir.fade(1, 0.35);
    },
    beats: [
      {
        // o preto: lá em cima, as duas saem da casinha da escada; o Esquadrão no varal
        id: 'escada', dur: 0.7, noSkip: true,
        tick(_, t) {
          once('placed', t > 0.4, () => {
            dir.pose('radhija', { ...out.rad, y: 0, speed: 0, airK: -1 });
            dir.pose('rhaenyra', { ...out.rha, y: 0, speed: 0, airK: -1 });
            roof.squadAt('varal', { x: H.x1, z: dz });
            dir.lens(40);
            dir.shot(P3(H.x1 + 2.6, 0.85, dz - 1.4), P3(H.x1 + 0.3, 0.55, dz), { cut: true });
          });
        },
      },
      {
        // a porta da casinha: as duas saem para o terraço, com o vento lá de cima
        id: 'saem', dur: 2.2,
        enter() {
          dir.fade(0, 0.4);
          dir.sfx('vento', { x: H.x1, z: dz, volume: 0.6 });
          dir.walk('radhija', [{ x: A.rad.x, z: A.rad.z }], { speed: 1.3, face: A.rad.yaw });
          dir.walk('rhaenyra', [{ x: A.rha.x, z: A.rha.z }], { speed: 1.2, face: A.rha.yaw });
          dir.caption('O terraço da torre', { sub: 'lá no alto', pos: 'bl', dur: 2.2 });
        },
        tick() { for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(PV.x, PV.y, PV.z); },
      },
      {
        // o Esquadrão no varal: o Capitão provoca, o Farelo agarrado à cenoura
        id: 'pombos', dur: 3.6,
        enter() {
          dir.comic(true);
          dir.panel('2h', 0, { enter: 'wipe', tilt: -1.5 });
          dir.lens(34);
          dir.shot(P3(PV.x - 1.6, 0.95, PV.z + 2.6), P3(PV.x, PV.y + 0.1, PV.z), { inT: 0.5 });
          dir.sfx('arrulho', { x: PV.x, z: PV.z });
          dir.say('capitao', 'Ora, ora… duas cachorrinhas no telhado!', { mode: 'cena', dur: 1.8 });
          props.squad?.cap?.lookAt?.(P3(A.rad.x, 0.4, A.rad.z));
        },
        tick(_, t) {
          once('far', t > 1.8, () => dir.say('farelo', 'Capitão, elas querem a cenoura de volta!', { mode: 'cena', dur: 1.7 }));
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(PV.x, PV.y, PV.z);
        },
      },
      {
        // o desafio, de perto: continência e o grito de guerra
        id: 'desafio', dur: 2.8,
        enter() {
          dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(28);
          const cap = props.squad?.cap?.object?.position;
          const c = cap ? P3(cap.x, cap.y, cap.z) : P3(PV.x - PV.step, PV.y, PV.z);
          dir.shot(P3(c.x + 0.2, c.y + 0.1, c.z + 1.4), P3(c.x, c.y + 0.12, c.z), { inT: 0.4 });
          dir.say('capitao', 'Esquadrão, posições! Ninguém alcança o Esquadrão Migalha!', { mood: 'grito', mode: 'cena', dur: 2.3 });
          dir.onomato('PRU-PRU!', { at: P3(c.x + 0.4, c.y + 0.5, c.z), size: 0.9, color: '#9bd1ff', rot: -8 });
        },
        tick(_, t) { props.squad?.cap?.salute?.(smooth(span(t, 0.1, 0.5)) * (1 - smooth(span(t, 2.2, 2.7)))); },
        leave() { props.squad?.cap?.salute?.(0); },
      },
      {
        // as duas combinam o plano (a dica da mecânica: uma de guarda, a outra espanta)
        id: 'plano', dur: 3.4,
        enter() {
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(32);
          const mx = (A.rad.x + A.rha.x) / 2, mz = (A.rad.z + A.rha.z) / 2;
          dir.shot(P3(mx + 2.0, 0.55, mz - 0.5), P3(mx, 0.38, mz), { cut: true });
          dir.say('radhija', 'Eles fogem de poleiro em poleiro…', { mode: 'cena', dur: 1.6 });
        },
        tick(_, t) {
          const a = dir.actor('radhija'), h = dir.actor('rhaenyra');
          a.look = P3(h.x, 0.4, h.z);
          h.look = P3(a.x, 0.35, a.z);
          once('rha', t > 1.6, () => { dir.say('rhaenyra', 'Então eu fico de guarda e você espanta!', { mode: 'cena', dur: 1.8 }); dir.gesture?.('rhaenyra', 'wag'); });
        },
      },
    ],
    cleanup() {
      props.squad?.cap?.salute?.(0);
      props.squad?.cap?.lookAt?.(null);
      dir.gesture?.('rhaenyra', null);
      dir.cleanup({ snap: true });
      dir.fade(0, 0.3);
    },
    commit() {
      roof.begin();
      K.placeAt(A.rad, A.rha);
      dir.snapFollow();
    },
  });
}

// ------------------------------------------------------------------------------------------------ a fuga, lá no alto
export function createRoofEscape(K, roof) {
  const { L, dir, props, emit } = K;
  const T = L.ROOF_TANK, PC = L.ROOF_PERCHES.caixa, hatch = T.hatch;
  const C = () => props.rooftop?.clockAt ?? { x: 70.5, y: 9.2, z: -55.5 };
  /** Embaixo, depois do corte: as duas perto da caixa d'água, longe do caixote e da escada. */
  const floor = { rad: { x: 73.2, z: -6.9, yaw: -2.4 }, rha: { x: 72.1, z: -6.3, yaw: -2.2 } };
  const S = {};
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
  /** A tampa de borracha presa nas patas do Soneca. */
  const lidFollow = () => {
    const lid = props.rooftop?.lid?.object, son = props.squad?.son;
    if (!lid || !son?.feetPoint) return;
    const f = son.feetPoint();
    lid.position.set(f.x, f.y - 0.05, f.z);
  };
  return createScene({
    id: ROOF_SCENES.fuga,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      roof.escapeStart();
      dir.hold('radhija', 'rhaenyra');
      const a = dir.actor('radhija');
      S.rad = { x: a.x, z: a.z };
      a.y = T.h;
      dir.comic(true);
      dir.panel('2v', 0, { enter: 'wipe', tilt: -1 });
      dir.lens(34);
      dir.shot(P3(a.x + 1.0, T.h + 0.85, a.z + 1.3), P3(PC.x, PC.y + 0.2, PC.z), { inT: 0.5 });
    },
    beats: [
      {
        // o bote: QUAAASE! O bando decola com a cenoura (e o Soneca com a tampa do alçapão)
        id: 'quase', dur: 2.6,
        tick(_, t) {
          const a = dir.actor('radhija');
          const u = span(t, 0.2, 0.75);
          a.airK = u > 0 && u < 1 ? u : -1;
          a.y = T.h + Math.sin(u * Math.PI) * 0.35;
          a.x = lerp(S.rad.x, S.rad.x + (PC.x - S.rad.x) * 0.45, smooth(u));
          a.z = lerp(S.rad.z, S.rad.z + (PC.z - S.rad.z) * 0.45, smooth(u));
          a.look = P3(PC.x, PC.y + 0.2, PC.z);
          once('go', t > 0.45, () => {
            dir.sfx('asas', { x: PC.x, z: PC.z });
            dir.say('capitao', 'Esquadrão, decolar!', { mood: 'grito', mode: 'cena', dur: 1.4 });
            dir.onomato('QUAAASE!', { at: P3(PC.x - 0.3, PC.y + 0.7, PC.z + 0.4), size: 1.2, color: '#ffd23f', rot: -10, style: 'stretch' });
            dir.fx('speed', { dur: 1.0 });
          });
          if (S.go) {
            const k = span(t, 0.45, 2.4);
            flyPack(K, roof, { x: PC.x - k * 0.8, y: PC.y + 0.3 + k * 1.6, z: PC.z - k * 2.2 }, Math.PI, t);
            lidFollow();
          }
        },
      },
      {
        // por cima da mureta: o bando vai para a cidade; ao longe, o relógio parado
        id: 'vento', dur: 4.0,
        enter() {
          dir.panel('2v', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(30);
          const a = dir.actor('radhija'), c = C();
          dir.shot(P3(a.x + 0.35, T.h + 1.25, a.z + 1.7), P3(c.x, c.y - 0.5, c.z), { inT: 1.0 });
          dir.sfx('vento', { x: PC.x, z: PC.z });
        },
        tick(_, t) {
          const c = C(), k = smooth(span(t, 0, 3.8));
          const p0 = { x: PC.x - 0.8, y: PC.y + 1.9, z: PC.z - 2.2 };
          flyPack(K, roof, { x: lerp(p0.x, c.x + 2, k), y: lerp(p0.y, c.y + 3, k), z: lerp(p0.z, c.z + 14, k) }, Math.PI + 0.08, t + 2);
          lidFollow();
          dir.actor('radhija').look = P3(c.x, c.y, c.z);
          once('clock', t > 1.6, () => dir.say(null, 'Lá longe, o relógio da Prefeitura parou a uma hora em ponto.', { mode: 'cena', dur: 2.6 }));
        },
      },
      {
        // o alçapão aberto: a tampa de borracha sumiu
        id: 'tampa', dur: 3.2,
        enter() {
          roof.hideSquad();
          props.rooftop?.lid?.setVisible?.(false);
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(30);
          dir.shot(P3(hatch.x + 1.0, T.h + 0.75, hatch.z + 0.9), P3(hatch.x, T.h + 0.1, hatch.z), { inT: 0.4 });
          dir.walk('radhija', [{ x: hatch.x - 0.12, z: hatch.z + 0.58 }], { speed: 0.9, face: Math.PI });
          dir.sfx('faro', { x: hatch.x, z: hatch.z, volume: 0.6 });
        },
        tick(_, t) {
          dir.actor('radhija').y = T.h;
          dir.actor('radhija').look = P3(hatch.x, T.h, hatch.z);
          once('sniff', t > 0.5, () => dir.gesture?.('radhija', 'sniffGround'));
          once('fala', t > 0.9, () => {
            dir.say('radhija', 'A tampa de borracha da caixa d’água sumiu… mais borracha!', { mode: 'cena', dur: 2.2 });
            dir.onomato('?!', { at: P3(hatch.x, T.h + 0.55, hatch.z), size: 0.8, color: '#ffffff', rot: 6 });
          });
        },
      },
      {
        id: 'desce', dur: 0.9, noSkip: true,
        enter() { dir.fade(1, 0.35); dir.comic(false); dir.gesture?.('radhija', null); },
        tick(_, t) {
          once('down', t > 0.4, () => {
            dir.pose('radhija', { ...floor.rad, y: 0, speed: 0, airK: -1 });
            dir.pose('rhaenyra', { ...floor.rha, y: 0, speed: 0, airK: -1 });
          });
        },
      },
    ],
    cleanup() { dir.gesture?.('radhija', null); dir.cleanup({ snap: true }); dir.fade(0, 0.4); },
    commit() {
      roof.afterEscape();
      const lid = props.rooftop?.lid?.object;
      if (lid) lid.position.set(hatch.x, T.h + 0.008, hatch.z);
      K.book?.add?.('tampa', { x: hatch.x, y: T.h + 0.1, z: hatch.z });
      K.placeAt(floor.rad, floor.rha);
      dir.snapFollow();
    },
  });
}

// ------------------------------------------------------------------------------------------------ o mirante e a volta
export function createRoofLook(K, roof) {
  const { L, dir, props, emit } = K;
  const LK = L.ROOF_LOOKOUT, ST = L.ROOF_STEP;
  const C = () => props.rooftop?.clockAt ?? { x: 70.5, y: 9.2, z: -55.5 };
  /** Em cima do degrau do mirante, lado a lado, de frente para a cidade (a cabeça passa da mureta). */
  const sz = (ST.z0 + ST.z1) / 2 + 0.05, sy = ST.h;
  const at = { rad: { x: LK.x - 0.45, z: sz, yaw: Math.PI }, rha: { x: LK.x + 0.5, z: sz, yaw: Math.PI } };
  const D = L.TOWER_DOOR;
  const dz = (D.hinge.z + D.latchPost.z) / 2;
  /** Onde as duas ficam ao descer: do lado de fora da porta da torre, lado a lado (como a cena 'terraco' de antes). */
  const out = { rad: { x: D.hinge.x - 1.2, z: dz + 0.2, yaw: -Math.PI / 2 }, rha: { x: D.hinge.x - 1.3, z: dz + 1.2, yaw: -Math.PI / 2 } };
  const S = {};
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
  return createScene({
    id: ROOF_SCENES.olha,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      dir.pose('radhija', { ...at.rad, y: sy, speed: 0, airK: -1 });
      dir.pose('rhaenyra', { ...at.rha, y: sy, speed: 0, airK: -1 });
      dir.comic(true);
      dir.panel('2h', 0, { enter: 'wipe', tilt: -1 });
      dir.lens(32);
      const c = C();
      dir.shot(P3(LK.x + 0.2, 1.3, LK.z + 2.1), P3(c.x, c.y - 1.5, c.z), { cut: true });
    },
    beats: [
      {
        // por cima da mureta: a cidade, o relógio parado e o bando, pontinhos sumindo entre os telhados
        id: 'cidade', dur: 3.0,
        enter() { dir.sfx('vento', { x: LK.x, z: LK.z, volume: 0.7 }); },
        tick(_, t) {
          const c = C(), k = span(t, 0, 3.0);
          flyPack(K, roof, { x: c.x + 3 - k * 2, y: c.y + 4 - k, z: c.z + 12 - k * 6 }, Math.PI, t);
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(c.x, c.y, c.z);
          once('cap', t > 0.6, () => dir.caption('O bando sumiu entre os telhados da cidade…', { pos: 'bl', dur: 2.2 }));
        },
      },
      {
        // de frente para as duas (do lado de fora da mureta): a Radhija brava, a Rhaenyra já sabe o caminho
        id: 'olham', dur: 3.8,
        enter() {
          roof.hideSquad();
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(30);
          dir.shot(P3(LK.x + 0.1, 1.02, ST.z0 - 1.5), P3(LK.x, sy + 0.45, sz), { cut: true });
          dir.say('radhija', 'Voltem aqui, seus ladrões de cenoura!', { mood: 'grito', mode: 'cena', dur: 1.8 });
          dir.fx('anger', { at: dir.head('radhija'), dur: 1.2 });
          dir.bark('radhija');
        },
        tick(_, t) {
          const a = dir.actor('radhija'), h = dir.actor('rhaenyra');
          if (t > 1.5) { a.look = P3(h.x, sy + 0.4, h.z); h.look = P3(a.x, sy + 0.35, a.z); }
          once('rha', t > 1.7, () => { dir.say('rhaenyra', 'Foram para a rua! A gente tem que sair pelo portão!', { mode: 'cena', dur: 2.0 }); dir.gesture?.('rhaenyra', 'tilt'); });
        },
      },
      {
        id: 'desce', dur: 0.9, noSkip: true,
        enter() { dir.fade(1, 0.35); dir.comic(false); dir.gesture?.('rhaenyra', null); },
        tick(_, t) {
          once('back', t > 0.4, () => {
            dir.pose('radhija', { ...out.rad, y: 0, speed: 0, airK: -1 });
            dir.pose('rhaenyra', { ...out.rha, y: 0, speed: 0, airK: -1 });
          });
        },
      },
    ],
    cleanup() { dir.gesture?.('rhaenyra', null); dir.cleanup({ snap: true }); dir.fade(0, 0.4); },
    commit() { roof.returnToTower(); },
  });
}
