// As cenas do capítulo 1: a abertura "A noite da garoa", os pombos na janela, a Reconstrução da piscina,
// a senha do interfone, o varal, o terraço da torre, o cheiro na guarita, o porteiro e o fechamento. Roteiro em
// docs/HISTORIA.md. Cada cena é uma lista de beats (src/story/scene/sequencer.js) tocada pelo diretor
// (src/story/scene/director.js). O que fica de PERMANENTE (pistas, etapa, portas, onde as dogs ficam) está no commit de
// cada cena: pular ou assistir deixa o jogo no mesmo estado.
// DIREÇÃO (2026-11-09): a câmera das cenas é de cinema, DENTRO dos lugares (a casa é inteira: nada de olhar através de
// parede), na altura das cachorrinhas, com quem age de perfil ou de frente e a cenoura sempre em quadro quando ela é o
// assunto. Quem leva a cenoura agarra com as patas (props.carrot.holdBy).
// DIREÇÃO (2026-11-10, depois da 2ª reprovação): as falas são escritas (balões de HQ nas cenas: dir.say), e os
// momentos fortes viram páginas de HQ estilo mangá/Scott Pilgrim (dir.comic, dir.panel, dir.onomato, dir.caption,
// dir.fx: src/story/scene/storyteller.js). As dogs têm gestos (dir.gesture) e mexem a boca quando falam.
// K: { ctx, dir, props, L, faro, cloud, recon, reconCode, playRecon, book, mood, emit, S, ... } (montado pelo puzzle).
import { createScene, span, smooth, lerp } from '../../scene/sequencer.js';
import { MORNING, NIGHT } from './lighting.js';

const CLUES_ABERTURA = ['pombos', 'abraco'];
const P3 = (x, y, z) => ({ x, y, z });

// ------------------------------------------------------------------------------------------------ utilidades
function hideSquad(K) {
  K.heldBy = null;
  K.props.carrot.holdBy?.(null);
  for (const p of Object.values(K.props.squad)) { p.carry?.(false); p.shiver?.(0); p.lookAt?.(null); p.setVisible(false); }
}
/** A cenoura nas patas de um pombo (ou solta, com null). */
function grab(K, pigeon) {
  const c = K.props.carrot;
  c.object.visible = true;
  for (const p of Object.values(K.props.squad)) p.carry?.(p === pigeon);
  K.heldBy = pigeon;
  c.holdBy?.(pigeon);
}
/**
 * O esquadrão voando em bando, baixo e torto: o Capitão na frente, o Farelo no meio com a cenoura nas patas e o Soneca
 * atrás. `p` é onde o Farelo está; `yaw`, para onde voam.
 */
function flyPack(K, p, yaw, t, { carrot = true, k = 0 } = {}) {
  const sq = K.props.squad;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const wob = Math.sin(t * 6.1) * 0.07;
  const at = (ahead, side, up) => ({ x: p.x + fx * ahead + rx * side, y: p.y + up, z: p.z + fz * ahead + rz * side });
  const pts = [[sq.cap, at(0.75, -0.28, 0.24 - wob * 0.5)], [sq.far, at(0, 0, wob)], [sq.son, at(-0.7, 0.32, 0.16 + wob * 0.7)]];
  for (const [b, q] of pts) {
    b.setVisible(true);
    b.shiver?.(0);
    b.setPose({ ...q, yaw, flying: true, asleep: false, flightProgress: k });
  }
  const c = K.props.carrot;
  if (carrot) {
    if (c.holdBy) { if (K.heldBy !== sq.far) grab(K, sq.far); } else {
      // sem o agarrar (cenário antigo): colada embaixo do Farelo
      c.object.visible = true;
      c.object.position.set(p.x, p.y + wob - 0.16, p.z);
      c.object.rotation.set(0.3 + wob, yaw + Math.PI / 2, Math.sin(t * 5) * 0.25);
    }
  }
}
/** O esquadrão pousado no varal, de perfil, com a cenoura presa no pregador (o estado depois da cena da janela). */
export function squadOnLine(K) {
  const L = K.L;
  const y = L.LINE.h + 0.01;
  const sq = K.props.squad;
  K.heldBy = null;
  K.props.carrot.holdBy?.(null);
  for (const p of Object.values(sq)) { p.setVisible(true); p.carry?.(false); p.shiver?.(0); p.lookAt?.(null); }
  sq.cap.setPose({ x: L.CARROT_PIN.x - 0.75, y, z: L.LINE.a.z, yaw: Math.PI / 2, flying: false, asleep: false });
  sq.son.setPose({ x: L.CARROT_PIN.x - 1.5, y, z: L.LINE.a.z, yaw: Math.PI / 2, flying: false, asleep: true });
  sq.far.setPose({ x: L.CARROT_PIN.x + 0.6, y, z: L.LINE.a.z, yaw: -Math.PI / 2, flying: false, asleep: false });
  const c = K.props.carrot.object;
  c.visible = true;
  c.position.set(L.CARROT_PIN.x, L.CARROT_PIN.y - 0.15, L.CARROT_PIN.z);
  c.rotation.set(Math.PI / 2, 0, 0);
}
/** O esquadrão no alto da caixa d'água da torre, o Farelo com a cenoura debaixo da pata (depois do varal). */
export function squadOnTank(K) {
  const T = K.L.TERRACE.pigeons;
  const sq = K.props.squad;
  for (const p of Object.values(sq)) { p.setVisible(true); p.shiver?.(0); p.lookAt?.(null); }
  sq.cap.setPose({ x: T.x - 0.55, y: T.y, z: T.z + 0.05, yaw: 0.5, flying: false, asleep: false });
  sq.far.setPose({ x: T.x, y: T.y, z: T.z + 0.12, yaw: 0.1, flying: false, asleep: false });
  sq.son.setPose({ x: T.x + 0.55, y: T.y, z: T.z, yaw: -0.4, flying: false, asleep: false });
  const c = K.props.carrot;
  c.object.visible = true;
  if (c.holdBy) grab(K, sq.far);
  else { c.object.position.set(T.x + 0.12, T.y + 0.04, T.z + 0.3); c.object.rotation.set(0, 0.9, Math.PI / 2); }
}
/** O quarto de manhã, depois da noite da garoa: a janela fechada, o pote virado, a pena no parapeito, a cenoura sumida. */
export function morningRoom(K) {
  const { L, props } = K;
  const SO = L.SILL.out;
  K.mood.set(MORNING);
  props.cinemaLight?.setNight?.(0);
  props.cinemaLight?.setMorning?.(1);
  props.cinemaLight?.flash?.(0);
  props.rain?.setOn?.(0);
  props.windowLeaf?.setOpen?.(0);
  props.bowl?.setTipped?.(1);
  props.carrot?.squeeze?.(0);
  hideSquad(K);
  props.carrot.object.visible = false;
  K.feather.visible = true;
  // a pena nova (src/story/scene/feather.js) deitada no parapeito, molhada da garoa
  if (props.feather?.placeOnSill) { props.feather.placeOnSill(); props.feather.setWet?.(0.65); }
  else { K.feather.position.set(SO.x + 0.25, SO.y + 0.03, SO.z); K.feather.rotation.set(0, 0.4, 1.45); }
}

// ------------------------------------------------------------------------------------------------ a abertura
/**
 * A abertura "A noite da garoa" (~55 s), revisada em 2026-11-10 para parecer cinema e HQ:
 *  - FORA: a casa de noite, na garoa; a câmera desce até a janela do quarto (caixa de narração);
 *  - NOITE: lá dentro, as duas dormindo abraçadas à cenoura (falando dormindo);
 *  - POMBOS: página de HQ — o esquadrão encharcado pousa no parapeito; o Capitão mede a cenoura e diz que ela é
 *    "exatamente o que precisamos" (o mistério); o trovão, o preto;
 *  - MANHÃ: a mão da tutora fecha o basculante; a Radhija acorda, e a cenoura sumiu (página de HQ, o grito);
 *  - ACORDA: a Rhaenyra acorda molhada (a pista da virada, sem explicar), as apresentações estilo Scott Pilgrim, a
 *    Radhija promete descobrir quem foi; a cartela do capítulo.
 * Termina com a jogadora no quarto e a primeira pergunta na árvore de pistas ("Quem entrou no quarto de noite?").
 */
export function createOpening(K) {
  const { L, dir, props, emit } = K;
  const B = L.BED, W = L.WINDOW;
  const cx = (W.x0 + W.x1) / 2;
  const SO = L.SILL.out;
  const lie = (t, k = 1, side = 1) => ({ kind: 'lie', t, k, side });
  // as duas um pouco para o fundo da caminha e a cenoura na frente delas, do lado da câmera (à vista o tempo todo)
  const sleepRad = { x: B.x + 0.27, z: B.z - 0.17, yaw: -Math.PI / 2 - 0.25 };
  const sleepRha = { x: B.x - 0.27, z: B.z - 0.07, yaw: Math.PI / 2 - 0.2 };
  const carrotBed = { x: B.x + 0.03, y: 0.18, z: B.z + 0.3 };
  const st = { rad: L.DOGS.radhija.start, rha: L.DOGS.rhaenyra.start };
  /** Onde a Rhaenyra cai ao pular da caminha (fora da borda, do lado de baixo, longe da irmã no chão). */
  const rhaOut = { x: B.x + 0.35, z: B.z + 1.15 };
  const perchY = SO.y + 0.04;
  const perch = [[-0.42, 0.5], [0.02, 1.25], [0.46, 1.95]]; // deslocamento no parapeito e quando cada um pousa
  const capAt = () => P3(cx + perch[0][0], perchY + 0.18, SO.z - 0.02);
  /**
   * O close do Capitão: de perfil, na altura da cabeça, da ponta oeste do parapeito (ele é o primeiro da fila: nada
   * entre ele e a câmera; o esquadrão fica atrás dele e o vidro à direita). O alvo é a cabeça (~0,11 m acima de capAt).
   */
  const capCam = () => { const c = capAt(); return P3(c.x - 1.0, c.y + 0.2, c.z - 0.2); };
  const capLook = (t) => { const c = capAt(); return P3(c.x + 0.08 + Math.sin(t * 0.7) * 0.01, c.y + 0.11, c.z + 0.03); };
  // lá fora: do alto e de longe (o telhado na garoa) descendo até a janela acesa, emoldurada pelas duas árvores do
  // gramado norte (a câmera para antes delas, no vão do meio)
  const outA = P3(cx + 2.5, 5.4, W.z - 14), outB = P3(cx + 0.38, 1.6, W.z - 7.3);
  const S = {};
  /** Uma vez só por cena (as falas e os efeitos em `t`). */
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };

  const scene = createScene({
    id: 'abertura',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      K.mood.set(NIGHT);
      props.cinemaLight?.setMorning?.(0);
      props.cinemaLight?.setNight?.(1);
      props.rain.setOn(1);
      props.windowLeaf.setOpen(1);
      props.bowl.setTipped(0);
      K.feather.visible = false;
      dir.ambience('rain');
      dir.music(null);
      dir.fade(0, 2.2);
      dir.comic(false);
      dir.hold('radhija', 'rhaenyra');
      dir.pose('radhija', { ...sleepRad, y: 0.12, speed: 0, action: 'none', lie: lie(14, 1, -1) });
      dir.pose('rhaenyra', { ...sleepRha, y: 0.12, speed: 0, action: 'none', lie: lie(14, 1, 1) });
      hideSquad(K);
      const c = props.carrot.object;
      c.visible = true;
      c.position.set(carrotBed.x, carrotBed.y, carrotBed.z);
      c.rotation.set(0, 0.4, Math.PI / 2);
      dir.snapFollow();
      dir.lens(32);
      dir.shot(outA, P3(cx, 3.0, W.z), { cut: true });
    },
    beats: [
      {
        // FORA: plano de grua, da chuva até a janela do quarto, com a caixa de narração
        id: 'fora', dur: 6.4,
        tick(_, t) {
          dir.dolly(outA, outB, P3(cx, 3.0, W.z), P3(cx, 0.98, W.z), span(t, 0.3, 6.2));
          once('cap', t > 0.8, () => dir.caption('Recanto das Patinhas', { sub: 'a noite da garoa', pos: 'bl', dur: 4.6 }));
          once('n1', t > 3.4, () => dir.say(null, 'Toda noite, as duas dormiam abraçadas ao seu tesouro…', { mode: 'cena', dur: 3.4 }));
        },
      },
      {
        // NOITE: dentro do quarto, a câmera chega devagar na caminha, até a cenoura abraçada pelas duas
        id: 'noite', dur: 8.4,
        enter() { dir.lens(34); dir.shot(P3(B.x + 2.3, 1.3, B.z + 3.5), P3(B.x, 0.8, B.z - 0.7), { cut: true }); },
        tick(_, t) {
          dir.dolly(P3(B.x + 2.3, 1.3, B.z + 3.5), P3(B.x + 0.9, 0.55, B.z + 1.45), P3(B.x, 0.8, B.z - 0.7), P3(carrotBed.x, 0.24, carrotBed.z), span(t, 0.3, 6.6));
          once('n2', t > 0.5, () => dir.say(null, '…uma cenoura de borracha.', { mode: 'cena', dur: 2.4 }));
          props.carrot.squeeze(t > 3.3 && t < 3.9 ? Math.sin(span(t, 3.3, 3.9) * Math.PI) : 0);
          once('sq', t > 3.4, () => {
            dir.sfx('fiu', { x: carrotBed.x, z: carrotBed.z });
            dir.onomato('SQUEAK!', { at: P3(carrotBed.x, carrotBed.y + 0.25, carrotBed.z), size: 0.8, color: '#ff9f43', rot: 10 });
          });
          once('s1', t > 4.3, () => dir.say('rhaenyra', 'Hmmm… cenourinha… minha…', { mood: 'sono', mode: 'cena', dur: 2.2 }));
          once('s2', t > 6.4, () => dir.say('radhija', '…é minha… zzz', { mood: 'sono', mode: 'cena', dur: 1.8 }));
        },
        leave() { props.carrot.squeeze(0); },
      },
      {
        // POMBOS: a página de HQ. Os três pousam encharcados no parapeito; o Capitão mede a cenoura; o trovão
        id: 'pombos', dur: 14.2,
        enter() {
          dir.comic(true);
          dir.panel('2h', 0, { enter: 'wipe', tilt: -1 });
          dir.shot(P3(cx + 1.5, 1.05, W.z + 2.3), P3(cx - 0.05, 0.98, SO.z), { cut: true });
          dir.sfx('arrulho', { x: cx, z: SO.z });
        },
        tick(_, t) {
          const sq = props.squad;
          if (!S.close) dir.dolly(P3(cx + 1.5, 1.05, W.z + 2.3), P3(cx + 0.85, 1.0, W.z + 1.72), P3(cx - 0.05, 0.98, SO.z), P3(cx - 0.1, 0.95, SO.z), span(t, 0.3, 5.6));
          [sq.cap, sq.son, sq.far].forEach((p, i) => {
            const [off, at] = perch[i];
            if (t < at - 0.75) return;
            const u = span(t, at - 0.75, at);
            const px = cx + off, pz = SO.z - 0.02;
            p.setVisible(true);
            if (u < 1) {
              // chegando de fora, da chuva
              p.setPose({ x: px + (1 - smooth(u)) * 1.4, y: perchY + (1 - smooth(u)) * 0.9, z: pz - (1 - smooth(u)) * 1.5, yaw: 0, flying: true, asleep: false, flightProgress: u });
            } else {
              // pousado, tremendo de frio (um tremidinho no lugar)
              p.setPose({ x: px + Math.sin(t * 46 + i) * 0.004, y: perchY, z: pz, yaw: 0, flying: false, asleep: false });
              p.shiver?.(1 - 0.5 * span(t, 9.0, 10.0));
              if (!S[`land${i}`]) { S[`land${i}`] = true; dir.sfx('asas', { x: px, z: pz, volume: 0.45 }); }
            }
          });
          once('flap', t > 0.7, () => dir.onomato('FLAP FLAP', { at: P3(cx + 0.6, perchY + 0.7, SO.z), size: 1, color: '#9bd1ff', rot: -10 }));
          once('l1', t > 2.5, () => dir.say('capitao', 'Esquadrão… abrigo à vista!', { mood: 'sussurro', mode: 'cena' }));
          once('l2', t > 4.3, () => {
            dir.say('soneca', 'Atchim!', { mood: 'grito', mode: 'cena', dur: 1.2 });
            dir.sfx('espirro', { x: cx + perch[1][0], z: SO.z });
            dir.onomato('ATCHIM!', { at: P3(cx + perch[1][0], perchY + 0.45, SO.z), size: 0.9, color: '#ffffff', rot: 6, style: 'shake' });
          });
          once('l3', t > 5.0, () => dir.say('capitao', 'Shhh!', { mood: 'sussurro', mode: 'cena', dur: 1.0 }));
          // segundo quadro: de perto, o Capitão olha a cenoura lá dentro e mede com a asa
          once('close', t > 5.8, () => {
            dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 });
            // de fora, na chuva: o Capitão de perfil, a cabeça no terço do quadro, olhando a cenoura pelo vidro
            dir.lens(30);
            dir.shot(capCam(), capLook(0), { cut: true });
          });
          if (S.close) dir.lookAt(capLook(t));
          once('l4', t > 6.0, () => dir.say('farelo', 'Capitão… olha aquilo lá dentro.', { mood: 'sussurro', mode: 'cena' }));
          sq.cap.lookAt?.(t > 6.6 && t < 11.2 ? P3(carrotBed.x, carrotBed.y, carrotBed.z) : null);
          sq.cap.measure(span(t, 7.4, 8.0) * (1 - span(t, 10.0, 10.4)));
          once('l5', t > 7.7, () => dir.say('capitao', 'Uma cenoura desse tamanho…', { mode: 'cena', dur: 2.0 }));
          once('l6', t > 9.6, () => { dir.say('capitao', '…é exatamente o que precisamos.', { mode: 'cena', dur: 2.4 }); dir.fx('focus', { at: capAt(), dur: 1.6 }); });
          sq.cap.salute(span(t, 11.2, 11.5) * (1 - span(t, 12.4, 12.7)));
          once('l7', t > 11.2, () => dir.say('farelo', 'E as cachorras?', { mode: 'cena', dur: 1.3 }));
          once('l8', t > 12.0, () => dir.say('capitao', 'Dormem feito pedra.', { mode: 'cena', dur: 1.4 }));
          if (t > 11.0 && !S.feather) {
            S.feather = true;
            K.feather.visible = true;
            K.featherFall = 0;
          }
          if (S.feather) {
            K.featherFall = Math.min(1, (K.featherFall ?? 0) + 1 / 55);
            const f = K.featherFall;
            // a pena cai rodopiando do Capitão até o parapeito e assenta, molhada
            if (f >= 1 && props.feather?.placeOnSill) { if (!S.featherDown) { S.featherDown = true; props.feather.placeOnSill(); props.feather.setWet?.(0.65); } }
            else {
              K.feather.position.set(SO.x + 0.25 + Math.sin(f * 9) * 0.06, SO.y + 0.004 + (1 - f) * 0.3, SO.z);
              K.feather.rotation.set(Math.sin(f * 7) * 0.5, 1.35 + Math.sin(f * 5) * 0.6, Math.sin(f * 11) * 0.35);
            }
          }
          // o trovão: quadro cheio, o clarão, e a tela escurece antes de qualquer coisa acontecer
          once('thunder', t > 13.1, () => {
            dir.panel('full', 0, { enter: 'pop' });
            dir.lens(40);
            dir.shot(P3(cx + 1.1, 1.0, W.z + 1.9), P3(cx, 0.95, SO.z), { cut: true });
            dir.fx('flash', { dur: 0.5 });
            dir.fx('shake', { dur: 0.6 });
            dir.onomato('BRRRUUUM!', { sx: 0.5, sy: 0.42, size: 1.6, color: '#ffe066', rot: -6, style: 'shake' });
            dir.sfx('trovao');
            S.flashT = 0;
          });
          // o relâmpago: a luz da janela estoura e cai em dois pulsos, e o quarto acende junto
          if (S.flashT !== undefined) {
            S.flashT += 1 / 60;
            const f = Math.max(0, 1 - S.flashT / 0.18) + 0.6 * Math.max(0, 1 - Math.abs(S.flashT - 0.32) / 0.1);
            props.cinemaLight?.flash?.(Math.min(1, f));
            K.mood.blend(NIGHT, MORNING, Math.min(0.7, f * 0.7));
          }
          once('dark', t > 13.6, () => dir.fade(1, 0.6));
        },
        leave() { props.squad.cap.measure(0); props.squad.cap.salute(0); },
      },
      {
        // no preto: a manhã chega (a luz, a garoa para, os pombos e a cenoura já foram, o pote virou)
        id: 'preto', dur: 1.2, noSkip: true,
        enter() { dir.clearSay(); dir.comic(false); },
        tick(_, t) {
          if (t > 0.05 && !S.morning) {
            S.morning = true;
            morningRoom(K);
            props.windowLeaf.setOpen(1);
            dir.ambience('day');
            // a Rhaenyra dormindo abraçada na irmã, no lugar da cenoura
            dir.pose('rhaenyra', { x: B.x - 0.08, z: B.z + 0.04, yaw: Math.PI / 2 - 0.35, y: 0.12, lie: lie(16, 1, 1) });
            dir.pose('radhija', { x: B.x + 0.24, z: B.z - 0.06, yaw: -Math.PI / 2 + 0.2, y: 0.12, lie: lie(16, 1, -1) });
            dir.shot(P3(cx - 1.6, 0.9, W.z + 2.5), P3(cx + 0.15, 0.92, W.z + 0.1), { cut: true });
          }
        },
      },
      {
        // MANHÃ: a mão da tutora fecha o basculante; a Radhija acorda e a cenoura não está mais lá
        id: 'manha', dur: 11.2,
        enter() {
          dir.fade(0, 1.1);
          dir.sfx('passarinhos', { volume: 0.6 });
          dir.caption('Na manhã seguinte…', { pos: 'tl', dur: 2.6 });
          const arm = props.humans.tutora;
          arm.object.visible = true;
          arm.object.position.set(cx + 0.62, 2.55, W.z + 0.42);
          arm.object.rotation.set(0.0, 0, 0.0);
          arm.hand.userData.grip(0);
        },
        tick(_, t) {
          const arm = props.humans.tutora;
          // o braço desce por cima, a mão pega a alavanca e fecha o basculante, e volta para cima (só a manga e a mão)
          const down = span(t, 0.6, 1.7) * (1 - span(t, 2.9, 3.6));
          arm.object.rotation.x = lerp(-0.9, 0.55, smooth(down));
          arm.object.position.y = lerp(2.75, 2.35, smooth(down));
          arm.elbow.rotation.x = lerp(0.0, 0.5, smooth(span(t, 1.1, 1.8)) * (1 - span(t, 2.8, 3.3)));
          arm.hand.userData.grip(span(t, 1.7, 2.0) * (1 - span(t, 2.7, 2.9)));
          if (t > 1.95 && t < 2.8) props.windowLeaf.setOpen(1 - span(t, 1.95, 2.7));
          once('click', t > 2.0, () => { dir.sfx('janela', { x: cx, z: W.z }); dir.onomato('CLEC', { at: P3(cx, W.top, W.z + 0.1), size: 0.6, color: '#ffffff', rot: 8 }); });
          arm.object.visible = t < 3.7;
          // corta para a caminha: a Radhija acorda, boceja, procura a cenoura e não acha
          once('cut', t > 3.7, () => {
            props.windowLeaf.setOpen(0);
            dir.shot(P3(B.x + 1.35, 0.52, B.z + 1.25), P3(B.x + 0.1, 0.33, B.z), { cut: true });
          });
          const a = dir.actor('radhija');
          const wake = span(t, 4.2, 5.0);
          if (wake > 0) a.lie = wake < 1 ? lie(16, 1 - wake, -1) : null;
          once('yawn', t > 5.0, () => dir.gesture?.('radhija', 'yawn'));
          once('w1', t > 5.9, () => dir.say('radhija', 'Hmm… bom dia, cenourinh…', { mood: 'sono', mode: 'cena', dur: 1.9 }));
          // olha o lugar vazio da cenoura
          a.look = t > 6.6 ? P3(carrotBed.x, 0.15, carrotBed.z) : null;
          // a página de HQ do susto: o rosto, o lugar vazio, o grito
          once('p1', t > 7.4, () => {
            dir.gesture?.('radhija', 'alert');
            dir.comic(true);
            dir.panel('3b', 0, { enter: 'pop', tilt: -2 });
            dir.lens(30);
            dir.shot(P3(a.x + Math.sin(a.yaw) * 1.2 + 0.25, 0.5, a.z + Math.cos(a.yaw) * 1.2), dir.head('radhija', -0.1), { cut: true });
            dir.say('radhija', '…cadê a cenoura?', { mode: 'cena', dur: 1.5 });
          });
          once('p2', t > 8.6, () => {
            dir.panel('3b', 1, { enter: 'slide', tilt: 2 });
            dir.shot(P3(carrotBed.x + 0.5, 0.62, carrotBed.z + 0.55), P3(carrotBed.x, 0.12, carrotBed.z), { cut: true });
            dir.onomato('?!', { at: P3(carrotBed.x, 0.4, carrotBed.z), size: 1.2, color: '#ff6b6b', rot: -8, style: 'stretch' });
          });
          once('p3', t > 9.6, () => {
            dir.panel('3b', 2, { enter: 'zoom', tilt: -1 });
            dir.lens(36);
            dir.shot(P3(B.x + 1.6, 0.7, B.z + 1.5), P3(B.x + 0.15, 0.35, B.z), { cut: true });
            dir.say('radhija', 'CADÊ A CENOURA?!', { mood: 'grito', mode: 'cena', dur: 1.6 });
            dir.fx('speed', { at: dir.head('radhija'), dur: 1.2 });
            dir.bark('radhija');
          });
        },
        leave() { props.humans.tutora.object.visible = false; props.windowLeaf.setOpen(0); },
      },
      {
        // ACORDA: a Rhaenyra acorda molhada; as apresentações; a promessa da detetive; as duas pulam da caminha
        id: 'acorda', dur: 10.4,
        enter() {
          dir.panel('2h', 0, { enter: 'slide', tilt: 1 });
          dir.shot(P3(B.x + 2.2, 0.85, B.z + 2.5), P3(B.x + 0.45, 0.36, B.z + 0.6), { cut: true });
          dir.actor('radhija').lie = null;
        },
        tick(_, t) {
          const a = dir.actor('radhija');
          const h = dir.actor('rhaenyra');
          if (!S.radOut) a.look = P3(h.x, 0.3, h.z);
          const wake = span(t, 0.3, 1.1);
          h.lie = wake < 1 ? lie(16, 1 - wake, 1) : null;
          once('ry', t > 1.0, () => dir.gesture?.('rhaenyra', 'yawn'));
          once('r1', t > 1.2, () => dir.say('rhaenyra', 'Hã…? Que cenoura?', { mood: 'sono', mode: 'cena', dur: 1.7 }));
          h.action = t > 3.0 && t < 3.8 ? 'shake' : 'none';
          once('drip', t > 3.0, () => {
            dir.sfx('sacudir', { x: h.x, z: h.z });
            dir.onomato('CHUÁ!', { at: dir.head('rhaenyra', 0.1), size: 0.8, color: '#7fd1ff', rot: 12 });
          });
          once('r2', t > 3.9, () => dir.say('radhija', 'Ué… por que você tá molhada?', { mode: 'cena', dur: 1.8 }));
          once('r3', t > 5.0, () => { dir.say('rhaenyra', 'Tô? Nem vi!', { mode: 'cena', dur: 1.2 }); dir.gesture?.('rhaenyra', 'tilt'); });
          // segundo quadro: a promessa, com as apresentações
          once('a2', t > 6.0, () => {
            dir.panel('2h', 1, { enter: 'slide', tilt: -1.5 });
            dir.shot(P3(B.x + 0.6, 0.5, B.z + 1.9), P3(B.x + 0.05, 0.42, B.z), { cut: true });
            dir.gesture?.('radhija', 'alert');
            dir.say('radhija', 'Alguém entrou no nosso quarto. E eu vou descobrir quem foi!', { mode: 'cena', dur: 2.6 });
            dir.caption('RADHIJA', { sub: 'detetive · mandona · morre de medo de trovão', pos: 'bl', dur: 2.6, at: dir.head('radhija') });
          });
          once('a3', t > 8.4, () => {
            dir.gesture?.('rhaenyra', 'wag');
            dir.say('rhaenyra', 'Eba! Uma investigação!', { mood: 'grito', mode: 'cena', dur: 1.6 });
            dir.caption('RHAENYRA', { sub: 'assistente · corajosa · meio bobinha', pos: 'br', dur: 2.0, at: dir.head('rhaenyra') });
            dir.fx('sparkle', { at: dir.head('rhaenyra'), dur: 1.2 });
          });
          // a Radhija pula da caminha para o chão
          if (t > 8.9 && !S.radOut) { S.radOut = true; S.rad0 = { x: a.x, z: a.z, yaw: a.yaw }; }
          if (S.radOut && !S.radDown) {
            const u = span(t, 8.9, 9.5), e = smooth(u);
            a.x = lerp(S.rad0.x, st.rad.x, e);
            a.z = lerp(S.rad0.z, st.rad.z, e);
            a.y = lerp(0.12, 0, e) + Math.sin(u * Math.PI) * 0.22;
            a.airK = u < 1 ? u : -1;
            a.yaw = Math.atan2(st.rad.x - S.rad0.x, st.rad.z - S.rad0.z);
            a.speed = 1.2;
            a.look = null;
            if (u >= 1) { S.radDown = true; Object.assign(a, { x: st.rad.x, z: st.rad.z, y: 0, airK: -1, speed: 0, yaw: st.rad.yaw }); }
          }
          // a Rhaenyra pula pelo lado de baixo (longe da irmã) e corre até ela
          if (t > 9.2 && !S.run) { S.run = true; S.hop0 = { x: h.x, z: h.z }; }
          if (S.run && !S.out) {
            const u = span(t, 9.2, 9.8), e = smooth(u);
            h.x = lerp(S.hop0.x, rhaOut.x, e);
            h.z = lerp(S.hop0.z, rhaOut.z, e);
            h.y = lerp(0.12, 0, e) + Math.sin(u * Math.PI) * 0.24;
            h.airK = u < 1 ? u : -1;
            h.yaw = Math.atan2(rhaOut.x - S.hop0.x, rhaOut.z - S.hop0.z);
            h.speed = 1.4;
            if (u >= 1) {
              S.out = true;
              Object.assign(h, { x: rhaOut.x, z: rhaOut.z, y: 0, airK: -1 });
              // por trás da irmã (em linha reta, passaria por dentro dela)
              dir.walk('rhaenyra', [{ x: st.rad.x - 0.16, z: st.rad.z + 0.7 }, { x: st.rha.x, z: st.rha.z }], { speed: 2.8, face: st.rha.yaw });
            }
          }
          if (S.out && !dir.walking('rhaenyra')) h.look = P3(a.x, 0.35, a.z);
        },
      },
      {
        // a cartela do capítulo, por cima do quarto
        id: 'titulo', dur: 3.6,
        enter() {
          dir.clearSay();
          dir.comic(false);
          dir.gesture?.('radhija', null);
          dir.gesture?.('rhaenyra', null);
          emit('story:title', { eyebrow: 'Capítulo 1', title: 'As Aventuras de Radhija & Rhaenyra', chapter: 'Cadê a Cenoura?' });
          dir.music('recanto');
          dir.shot(P3(B.x + 2.6, 1.5, B.z + 3.6), P3(B.x + 0.6, 0.5, B.z + 1.0), { inT: 1.2 });
        },
        tick(_, t) {
          // a Rhaenyra termina de chegar ao lugar dela
          const h = dir.actor('rhaenyra');
          if (S.out && !dir.walking('rhaenyra')) h.look = P3(dir.actor('radhija').x, 0.35, dir.actor('radhija').z);
          void t;
        },
      },
    ],
    cleanup() {
      props.humans.tutora.object.visible = false;
      dir.gesture?.('radhija', null);
      dir.gesture?.('rhaenyra', null);
      dir.cleanup({ snap: true });
      dir.fade(0, 0.35);
    },
    commit() {
      morningRoom(K);
      for (const id of CLUES_ABERTURA) K.book.add(id, K.clueAt(id));
      K.placeStart();
      dir.ambience('day');
      dir.music('recanto');
      K.setStage('quarto');
      K.deduction?.ask('quem');
      dir.snapFollow();
    },
  });
  return scene;
}

// ------------------------------------------------------------------------------------------------ os pombos na janela
/**
 * Com a pergunta "Quem entrou no quarto de noite?" deduzida na árvore de pistas: lá fora, os pombos passam baixo e
 * torto com a cenoura nas patas. Página de HQ: o voo, o grito, a reação das duas.
 */
export function createWindowScene(K) {
  const { L, dir, emit } = K;
  const B = L.BED, W = L.WINDOW;
  const cx = (W.x0 + W.x1) / 2;
  const marks = { rad: { x: B.x + 0.9, z: B.z + 1.55, yaw: Math.PI }, rha: { x: B.x + 1.8, z: B.z + 1.95, yaw: Math.PI } };
  const S = {};
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
  return createScene({
    id: 'janela',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      dir.walk('radhija', [{ x: marks.rad.x, z: marks.rad.z }], { speed: 2.6, face: Math.PI });
      dir.walk('rhaenyra', [{ x: marks.rha.x, z: marks.rha.z }], { speed: 2.8, face: Math.PI });
      dir.comic(true);
      dir.panel('full', 0, { enter: 'zoom' });
      // de perto, por cima da caminha: a janela enche a tela e os pombos passam logo ali fora
      dir.lens(34);
      dir.shot(P3(cx + 0.35, 0.98, W.z + 2.1), P3(cx - 0.2, 0.98, W.z - 1.2), { inT: 0.7 });
      dir.music('misterio');
    },
    beats: [
      {
        id: 'voo', dur: 5.0,
        enter() { dir.sfx('asas', { x: cx, z: W.z - 1.5 }); },
        tick(_, t) {
          const k = span(t, 0.6, 3.9);
          // chegam depressa, passam DEVAGAR na frente do vidro (o Farelo torto, com a cenoura pendurada nas patas) e
          // somem depressa: x em três trechos
          const x = t < 1.3 ? lerp(cx - 3.9, cx - 1.25, span(t, 0.6, 1.3))
            : t < 3.1 ? lerp(cx - 1.25, cx + 0.35, span(t, 1.3, 3.1))
              : lerp(cx + 0.35, cx + 4.8, span(t, 3.1, 3.9));
          if (t > 0.6 && t < 4.2) flyPack(K, { x, y: 0.95 + Math.sin(t * 2.6) * 0.07, z: W.z - 1.35 }, Math.PI / 2, t);
          if (t >= 4.2 && !S.gone) { S.gone = true; hideSquad(K); K.props.carrot.object.visible = false; }
          for (const n of ['radhija', 'rhaenyra']) if (!dir.walking(n)) dir.actor(n).look = P3(lerp(cx - 2, cx + 2, k), 1.2, W.z);
          // a câmera acompanha o Farelo um pouco
          dir.lookAt(P3(lerp(cx - 0.4, cx + 0.15, span(t, 1.0, 3.2)), 0.98, W.z - 1.2));
          once('flap', t > 1.1, () => dir.onomato('FLAP FLAP FLAP', { at: P3(cx - 0.8, 1.35, W.z - 0.8), size: 1.1, color: '#9bd1ff', rot: -8 }));
          once('l1', t > 1.4, () => dir.say('rhaenyra', 'Olha! Lá fora!', { mood: 'grito', mode: 'cena', dur: 1.3 }));
          once('l2', t > 2.4, () => dir.say('farelo', 'Foi mal! É por uma boa causa!', { mode: 'cena', dur: 1.7 }));
          once('l3', t > 3.4, () => {
            dir.say('radhija', 'A NOSSA CENOURA!', { mood: 'grito', mode: 'cena', dur: 1.5 });
            dir.fx('speed', { dur: 1.0 });
            dir.bark('radhija');
          });
        },
      },
      {
        // de frente para as duas: a Radhija manda; a Rhaenyra faz o rabo-hélice
        id: 'reacao', dur: 5.0,
        enter() {
          dir.panel('2v', 0, { enter: 'slide', tilt: -1.5 });
          dir.shot(P3(cx + 0.4, 0.62, W.z + 0.8), P3(B.x + 1.35, 0.38, B.z + 1.75), { cut: true });
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = null;
        },
        tick(_, t) {
          const a = dir.actor('radhija');
          const h = dir.actor('rhaenyra');
          a.press = t > 0.3 && t < 1.9 ? { x: a.x, y: 0.4, z: a.z - 0.34, k: Math.sin(span(t, 0.3, 1.9) * Math.PI) } : null;
          once('s1', t > 0.4, () => { dir.say('radhija', 'Foram os pombos! Eu sabia!', { mode: 'cena', dur: 1.8 }); dir.fx('anger', { at: dir.head('radhija'), dur: 1.2 }); });
          h.look = t < 1.6 ? P3(a.x, 0.35, a.z) : null;
          once('p2', t > 2.2, () => {
            dir.panel('2v', 1, { enter: 'slide', tilt: 1.5 });
            // o segundo quadro: a Rhaenyra de perto, abanando
            dir.lens(30);
            dir.shot(P3(h.x + 0.35, 0.62, h.z + 1.75), dir.head('rhaenyra', -0.18), { cut: true });
            dir.gesture?.('rhaenyra', 'wag');
            dir.say('rhaenyra', 'Bora atrás deles!', { mood: 'grito', mode: 'cena', dur: 1.4 });
            dir.bark('rhaenyra');
          });
          once('s3', t > 3.6, () => dir.say('radhija', 'Pela porta do quintal. Rápido!', { mode: 'cena', dur: 1.5 }));
        },
        leave() { dir.actor('radhija').press = null; dir.actor('rhaenyra').action = 'none'; dir.gesture?.('rhaenyra', null); },
      },
    ],
    cleanup() { dir.cleanup(); },
    commit() {
      hideSquad(K);
      squadOnLine(K);
      K.windowSeen();
      K.placeAt(marks.rad, marks.rha);
      dir.music('recanto');
      K.deduction?.resolve('quem', { silent: true });
      K.deduction?.ask('onde');
      K.setStage('casa');
    },
  });
}

// ------------------------------------------------------------------------------------------------ as testemunhas
/**
 * Uma conversa com testemunha (a Dona Gansa, o Bichano): página de HQ com as falas, um plano das duas dogs com quem
 * fala, e o depoimento vai para a árvore de pistas (K.book.add). `who`: o falante; `at()`: onde ele está.
 * @param {any} K @param {{ id: string, who: string, at: () => ({ x: number, y: number, z: number }), clue: string,
 *   lines: [string | null, string, object?][], onCommit?: () => void }} o
 */
export function createWitnessScene(K, { id, who, at, clue, lines, onCommit = () => {} }) {
  const { dir, emit } = K;
  const S = {};
  let T = 0;
  return createScene({
    id,
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      const p = at();
      const a = dir.actor('radhija');
      // o plano: de lado, as dogs de um lado e quem fala do outro
      const mx = (a.x + p.x) / 2, mz = (a.z + p.z) / 2;
      const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz) || 1;
      const px = -dz / d, pz = dx / d;
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(p.x, p.y + 0.2, p.z);
      dir.comic(true);
      dir.panel('full', 0, { enter: 'zoom' });
      dir.lens(34);
      dir.shot(P3(mx + px * 2.4, 0.95, mz + pz * 2.4), P3(mx, 0.35, mz), { inT: 0.6 });
      T = 0.5;
      S.at = 0;
    },
    beats: [
      {
        id: 'conversa', until: () => S.done, max: 30,
        tick(_, t) {
          // uma fala de cada vez, no ritmo de ler; a cada duas, um quadro novo
          if (S.at < lines.length && t >= T) {
            const [speaker, text, o = {}] = lines[S.at];
            if (S.at > 0 && S.at % 2 === 0) dir.panel('2h', (S.at / 2) % 2, { enter: 'slide', tilt: S.at % 4 ? 1.5 : -1.5 });
            dir.say(speaker, text, { mode: 'cena', ...o });
            T = t + Math.min(3.4, 1.0 + String(text).length / 16);
            S.at++;
          }
          if (S.at >= lines.length && t >= T) S.done = true;
        },
      },
      { id: 'pista', dur: 1.0, enter() { K.book.add(clue, K.clueAt?.(clue)); } },
    ],
    cleanup() { dir.cleanup(); },
    commit() {
      K.book.add(clue, K.clueAt?.(clue));
      onCommit();
    },
  });
}

// ------------------------------------------------------------------------------------------------ a Reconstrução da piscina
export function createReconScene(K) {
  const { L, dir, emit, recon } = K;
  const R = L.RECON;
  return createScene({
    id: 'reconstrucao',
    emit,
    setup() {
      dir.hold('radhija', 'rhaenyra');
      for (const n of ['radhija', 'rhaenyra']) { dir.actor(n).look = P3(R.x, 0.2, R.z); dir.actor(n).speed = 0; }
      dir.shot(P3(R.x - 1.9, 1.35, R.z + 2.7), P3(R.x + 0.6, 0.5, R.z - 0.5), { inT: 0.8 });
      dir.music('misterio');
      K.playRecon('piscina');
    },
    beats: [
      {
        id: 'silhuetas', until: () => !recon.active, max: recon.duration + 1.5,
        tick(_, t) {
          // acompanha o pombo fantasma saindo baixo e torto para o nordeste, com a boia murcha
          const g = K.props.ghosts.pigeon.object.position;
          if (t > 2.4) dir.lookAt(P3(lerp(R.x + 0.6, g.x, 0.6), lerp(0.5, g.y, 0.6), lerp(R.z - 0.5, g.z, 0.6)));
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(g.x, g.y + 0.1, g.z);
        },
      },
      {
        id: 'pista', dur: 2.6,
        enter() {
          K.book.add('boia', K.clueAt('boia'));
          dir.say('radhija', 'Um pombo levou a boia de patinho… também é de borracha!', { mode: 'cena', dur: 2.4 });
        },
      },
    ],
    cleanup() {
      recon.stop();
      dir.cleanup();
    },
    commit() {
      K.book.add('boia', K.clueAt('boia'));
      dir.music('recanto');
      K.deduction?.ask('borracha');
      K.setStage('varal');
    },
  });
}

// ------------------------------------------------------------------------------------------------ a senha do interfone
/** O Faro perto da porta da torre: a silhueta do Farelo sobe até cada botão do interfone, na ordem da senha. */
export function createCodeScene(K) {
  const { L, dir, emit, reconCode } = K;
  const IC = L.INTERCOM;
  const wallX = L.TOWER.x0;
  const midZ = IC.buttons[1].z;
  const S = {};
  return createScene({
    id: 'senha',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      for (const n of ['radhija', 'rhaenyra']) { dir.actor(n).look = P3(wallX, 1.0, midZ); dir.actor(n).speed = 0; }
      dir.shot(P3(wallX - 3.1, 1.2, midZ + 1.5), P3(wallX, 0.98, midZ - 0.25), { inT: 0.8 });
      dir.music('misterio');
      for (const b of IC.buttons) K.lightCode(b.id, false);
      K.playRecon('senha');
    },
    beats: [
      {
        id: 'silhuetas', until: () => !reconCode.active, max: reconCode.duration + 1.5,
        tick(_, t) {
          // dois botões acendem quando o Farelo aperta (e ficam acesos até o fim); no terceiro, o espirro do Soneca
          // atrapalha: o terceiro botão fica para a árvore de pistas (o depoimento da Dona Gansa)
          if (t >= K.CODE_TIMES[2] && !S.sneeze) {
            S.sneeze = true;
            dir.sfx('espirro', { x: wallX, z: midZ });
            dir.onomato('ATCHIM!', { at: P3(wallX - 0.6, 1.5, midZ), size: 1.2, color: '#ffffff', rot: -8, style: 'shake' });
            dir.fx('shake', { dur: 0.5 });
          }
          IC.code.slice(0, 2).forEach((id, i) => {
            if (t >= K.CODE_TIMES[i] && !S[id]) {
              S[id] = true;
              K.lightCode(id, true);
              dir.sfx('bip', { x: wallX, z: IC.buttons.find((b) => b.id === id).z });
              const bz = IC.buttons.find((b) => b.id === id).z;
              dir.onomato(['BIP!', 'BIP!', 'BIP!'][i], { at: P3(wallX - 0.25, 1.35, bz), size: 0.7, color: ['#7fd1ff', '#ff8fc7', '#8ee08e'][i], rot: (i - 1) * 8 });
            }
          });
        },
      },
      {
        id: 'pista', dur: 2.6,
        enter() {
          K.book.add('senha', K.clueAt('senha'));
          dir.say('rhaenyra', 'Sino, osso… e o terceiro? O espirro atrapalhou tudo!', { mode: 'cena', dur: 2.4 });
        },
      },
    ],
    cleanup() {
      reconCode.stop();
      for (const b of IC.buttons) K.lightCode(b.id, false);
      dir.cleanup();
    },
    commit() {
      K.book.add('senha', K.clueAt('senha'));
      K.codeSeen();
      K.deduction?.ask('senha', { silent: true });
      dir.music('recanto');
    },
  });
}

// ------------------------------------------------------------------------------------------------ o varal
export function createVaralScene(K) {
  const { L, dir, props, emit } = K;
  const P = L.CARROT_PIN;
  const tank = L.TERRACE.pigeons;
  const lineY = L.LINE.h + 0.01;
  const S = {};
  return createScene({
    id: 'varal',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(P.x, P.y, P.z);
      // do sul, baixo: o varal de perfil, a cenoura no pregador e o cesto embaixo (página de HQ)
      dir.comic(true);
      dir.panel('2v', 0, { enter: 'wipe', tilt: -1 });
      dir.lens(34);
      dir.shot(P3(P.x + 1.9, 0.95, P.z + 3.7), P3(P.x - 0.3, 1.1, P.z), { inT: 0.6 });
    },
    beats: [
      {
        id: 'sacode', dur: 1.2,
        enter() {
          dir.sfx('varal', { x: L.LINE.b.x, z: L.LINE.b.z });
          dir.onomato('TOIM-OIM-OIM!', { at: P3(L.LINE.b.x - 0.4, L.LINE.h + 0.3, L.LINE.b.z), size: 1, color: '#ffb35c', rot: 8, style: 'shake' });
          dir.fx('shake', { dur: 0.5 });
        },
        tick(_, t) {
          props.line.shake(Math.exp(-t * 2.2));
          // os pombos se assustam: um pulinho no ar e voltam para o fio
          const sq = props.squad;
          const hop = Math.sin(span(t, 0.05, 0.75) * Math.PI);
          sq.cap.setPose({ y: lineY + hop * 0.22, flying: hop > 0.05, flightProgress: 0.9 });
          sq.far.setPose({ y: lineY + hop * 0.16, flying: hop > 0.05, flightProgress: 0.9 });
          sq.son.setPose({ asleep: t < 0.2 });
        },
      },
      {
        id: 'cai', dur: 1.9,
        enter() {
          props.line.setPin(1);
          dir.sfx('pregador', { x: P.x, z: P.z });
          dir.panel('2v', 1, { enter: 'slide', tilt: 1.5 });
          dir.lens(26);
          dir.onomato('PLOC!', { at: P3(P.x, P.y + 0.1, P.z), size: 0.8, color: '#ffffff', rot: -6 });
        },
        tick(_, t) {
          props.line.shake(Math.exp(-(t + 1.0) * 2.2));
          const c = props.carrot;
          const far = props.squad.far;
          const fall = P.y - 0.15 - 4.9 * t * t;
          const catchT = 0.42;
          if (t < catchT) {
            // a cenoura cai do pregador, direto para o cesto; o Farelo mergulha atrás
            c.object.position.set(P.x, fall, P.z);
            c.object.rotation.x = Math.PI / 2 + t * 5;
            const u = span(t, 0.04, catchT);
            far.setPose({ x: lerp(P.x + 0.6, P.x + 0.05, u), y: lerp(lineY, fall + 0.2, u), z: P.z + 0.02, yaw: -Math.PI / 2, flying: true, flightProgress: 0.4 });
          } else {
            // ele agarra no ar, um palmo acima do cesto, e sobe pesado
            if (!S.caught) {
              S.caught = true;
              grab(K, far);
              dir.sfx('asas', { x: P.x, z: P.z });
              dir.onomato('PEGOU!', { at: P3(P.x, P.y - 0.2, P.z), size: 1, color: '#ffd23f', rot: -10 });
              dir.say('radhija', 'NÃÃÃO!', { mood: 'grito', mode: 'cena', dur: 1.0 });
            }
            const u = smooth(span(t, catchT, 1.5));
            const y0 = P.y - 0.15 - 4.9 * catchT * catchT + 0.2;
            const fx = lerp(P.x + 0.05, P.x - 0.9, u), fy = lerp(y0, lineY + 0.9, u), fz = lerp(P.z, P.z + 0.5, u);
            far.setPose({ x: fx, y: fy, z: fz, yaw: lerp(-Math.PI / 2, -Math.PI * 0.8, u), flying: true, flightProgress: 0 });
            if (!c.holdBy) { c.object.position.set(fx, fy - 0.14, fz); c.object.rotation.set(0.4, 0.3, Math.sin(t * 9) * 0.3); }
            dir.lookAt(P3(lerp(P.x - 0.3, fx, 0.6), lerp(1.1, fy, 0.7), P.z));
          }
        },
      },
      {
        // o bando sobe até a caixa d'água da torre: a câmera acompanha
        id: 'voa', dur: 3.6,
        enter() {
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(38);
          dir.sfx('asas', { x: P.x, z: P.z });
          dir.say('capitao', 'Esquadrão, para a torre!', { mode: 'cena', dur: 1.6 });
          dir.onomato('FLAP FLAP', { at: P3(P.x - 0.6, P.y + 0.6, P.z), size: 1, color: '#9bd1ff', rot: -6 });
        },
        tick(_, t) {
          const u = smooth(span(t, 0, 3.4));
          const p = { x: lerp(P.x - 0.9, tank.x, u), y: lerp(lineY + 0.9, tank.y + 0.4, u) + Math.sin(u * Math.PI) * 0.8, z: lerp(P.z + 0.5, tank.z, u) };
          flyPack(K, p, Math.atan2(tank.x - P.x, tank.z - P.z), t, { k: u > 0.85 ? (u - 0.85) / 0.15 : 0 });
          // a câmera recua para a torre caber inteira e fica presa no bando (antes, olhava para um ponto fixo e o
          // bando saía do quadro)
          dir.dolly(P3(P.x + 1.9, 0.95, P.z + 3.7), P3(P.x - 2.2, 1.3, P.z + 5.4), P3(P.x - 0.3, 1.1, P.z), P3(P.x - 0.3, 1.1, P.z), span(t, 0.1, 3.0));
          const e = smooth(span(t, 0, 0.6));
          dir.lookAt(P3(lerp(P.x - 0.3, p.x, e), lerp(1.1, p.y - 0.1, e), lerp(P.z, p.z, e)));
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(p.x, p.y, p.z);
        },
      },
      {
        // as duas olhando para o alto da torre, com a caixa d'água ao fundo
        id: 'pousam', dur: 1.6,
        enter() {
          squadOnTank(K);
          dir.sfx('arrulho', { x: tank.x, z: tank.z });
          dir.shot(P3(P.x - 1.7, 0.62, P.z + 1.3), P3(L.TOWER.x0 + 2.2, 3.0, tank.z + 1.4), { inT: 0.5 });
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(tank.x, tank.y, tank.z);
          dir.say('rhaenyra', 'Eles foram para a torre!', { mode: 'cena', dur: 1.5 });
        },
      },
    ],
    cleanup() {
      props.line.shake(0);
      dir.cleanup();
    },
    commit() {
      K.deduction?.resolve('onde', { silent: true });
      props.line.setPin(1);
      squadOnTank(K);
      K.setStage('torre');
    },
  });
}

// ------------------------------------------------------------------------------------------------ o terraço da torre
export function createTerraceScene(K) {
  const { L, dir, props, emit } = K;
  const T = L.TERRACE;
  const tank = T.pigeons;
  const tx0 = L.TOWER.tank.x0;
  const D = L.TOWER_DOOR;
  const dz = (D.hinge.z + D.latchPost.z) / 2;
  /** Onde as duas ficam ao descer: do lado de fora da porta, lado a lado. */
  const out = { rad: { x: D.hinge.x - 1.2, z: dz + 0.2, yaw: -Math.PI / 2 }, rha: { x: D.hinge.x - 1.3, z: dz + 1.2, yaw: -Math.PI / 2 } };
  const S = {};
  return createScene({
    id: 'terraco',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      dir.fade(1, 0.35);
    },
    beats: [
      {
        id: 'escada', dur: 0.7, noSkip: true,
        tick(_, t) {
          if (t > 0.4 && !S.placed) {
            S.placed = true;
            // lá em cima: as duas saem da casinha da escada no terraço
            dir.pose('rhaenyra', { x: T.hut.x + 0.9, z: T.hut.z - 0.5, y: T.y, yaw: Math.PI * 0.8, speed: 0 });
            dir.pose('radhija', { x: T.hut.x + 0.9, z: T.hut.z + 0.3, y: T.y, yaw: Math.PI * 0.8, speed: 0 });
            squadOnTank(K);
            dir.shot(P3(T.rad.x + 0.8, T.y + 1.45, T.hut.z + 2.5), P3(tx0 + 1.1, T.y + 1.6, tank.z + 0.5), { cut: true });
          }
        },
      },
      {
        // as duas correm até a caixa d'água: os pombos lá em cima, a cenoura debaixo da pata do Farelo
        id: 'corrida', dur: 3.0,
        enter() {
          dir.fade(0, 0.4);
          dir.comic(true);
          dir.panel('full', 0, { enter: 'wipe' });
          dir.lens(40);
          dir.walk('rhaenyra', [{ x: T.rha.x, z: T.rha.z }], { speed: 2.6 });
          dir.walk('radhija', [{ x: T.rad.x, z: T.rad.z }], { speed: 2.0 });
          dir.say('rhaenyra', 'Lá está a cenoura!', { mood: 'grito', mode: 'cena', dur: 1.4 });
        },
        tick() {
          for (const n of ['radhija', 'rhaenyra']) { dir.actor(n).y = T.y; dir.actor(n).look = P3(tank.x, tank.y, tank.z); }
          props.squad.cap.lookAt?.(P3(T.rad.x, T.y, T.rad.z));
        },
      },
      {
        // a Rhaenyra pula na parede da caixa d'água: quase; os pombos levantam voo com a cenoura
        id: 'quase', dur: 2.6,
        enter() {
          dir.bark('rhaenyra');
          dir.panel('2h', 0, { enter: 'slide', tilt: -2 });
          dir.shot(P3(T.rad.x + 0.3, T.y + 0.8, T.rad.z + 2.3), P3(tx0 + 1.2, T.y + 1.9, tank.z + 0.3), { inT: 0.5 });
          dir.say('capitao', 'Esquadrão, decolar!', { mood: 'grito', mode: 'cena', dur: 1.4 });
          dir.fx('speed', { dur: 1.2 });
          dir.onomato('QUAAASE!', { at: P3(tx0 + 0.6, T.y + 1.2, tank.z + 0.6), size: 1.2, color: '#ffd23f', rot: -10, style: 'stretch' });
        },
        tick(_, t) {
          const h = dir.actor('rhaenyra');
          const u = span(t, 0.1, 0.75);
          h.airK = u > 0 && u < 1 ? u : -1;
          h.y = T.y + Math.sin(u * Math.PI) * 0.5;
          dir.actor('radhija').y = T.y;
          if (t > 0.35 && !S.go) { S.go = true; dir.sfx('asas', { x: tank.x, z: tank.z }); dir.sfx('vento', { x: tank.x, z: tank.z }); props.squad.cap.lookAt?.(null); }
          if (S.go) {
            const k = span(t, 0.35, 2.0);
            flyPack(K, { x: tank.x - k * 1.2, y: tank.y + 0.35 + k * 1.3, z: tank.z - k * 2.4 }, Math.PI + 0.3, t);
          }
        },
      },
      {
        // por cima da mureta: o vento sul leva os pombos por cima do muro, rumo à cidade; ao longe, o relógio parado
        id: 'vento', dur: 4.2,
        enter() { dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 }); dir.lens(32); dir.shot(P3(T.rad.x - 0.4, T.y + 1.0, T.rad.z - 1.2), P3(T.view.x - 2.5, 7.2, T.view.z), { inT: 1.2 }); },
        tick(_, t) {
          const k = span(t, 0, 3.8);
          flyPack(K, { x: tank.x - 1.2 - k * 5.5, y: tank.y + 1.65 + k * 2.6, z: tank.z - 2.4 - k * 15 }, Math.PI + 0.3, t + 2);
          if (t > 1.9 && !S.clock) {
            S.clock = true;
            // ao longe, o relógio da Prefeitura parado (o ícone colado na torre)
            const ca = props.city.clockAt;
            dir.say(null, 'Lá longe, o relógio da Prefeitura parou a uma hora em ponto.', { mode: 'cena', dur: 2.8 });
          }
          for (const n of ['radhija', 'rhaenyra']) { dir.actor(n).y = T.y; dir.actor(n).look = P3(tank.x - 3, 5, tank.z - 9); }
        },
      },
      {
        // de frente para as duas: a Radhija brava, a Rhaenyra sem entender
        id: 'olham', dur: 3.6,
        enter() {
          dir.panel('full', 0, { enter: 'pop' });
          dir.lens(30);
          hideSquad(K);
          props.carrot.object.visible = false;
          dir.shot(P3(T.rad.x + 0.5, T.y + 0.55, T.rad.z - 2.3), P3((T.rad.x + T.rha.x) / 2, T.y + 0.36, (T.rad.z + T.rha.z) / 2), { cut: true });
          dir.say('radhija', 'Voltem aqui, seus ladrões de cenoura!', { mood: 'grito', mode: 'cena', dur: 1.8 });
          dir.fx('anger', { at: dir.head('radhija'), dur: 1.2 });
        },
        tick(_, t) {
          const a = dir.actor('radhija'), h = dir.actor('rhaenyra');
          a.y = h.y = T.y;
          a.look = P3(h.x, T.y + 0.4, h.z);
          h.look = P3(a.x, T.y + 0.35, a.z);
          if (t > 1.6 && !S.shrug) { S.shrug = true; dir.say('rhaenyra', 'Foram para a rua… pelo portão!', { mode: 'cena', dur: 1.8 }); dir.gesture?.('rhaenyra', 'tilt'); }
        },
      },
      {
        id: 'desce', dur: 0.9, noSkip: true,
        enter() { dir.fade(1, 0.35); dir.comic(false); dir.gesture?.('rhaenyra', null); },
        tick(_, t) { if (t > 0.4 && !S.back) { S.back = true; downstairs(); } },
      },
    ],
    cleanup() { dir.cleanup({ snap: true }); dir.fade(0, 0.4); },
    commit() {
      K.deduction?.ask('rua');
      // só o lugar (K.placeAt): uma pose do diretor aqui seguraria as dogs de novo, depois do cleanup
      hideSquad(K);
      props.carrot.object.visible = false;
      K.closeTowerDoor();
      K.placeAt(out.rad, out.rha);
      K.setStage('portaria');
      dir.snapFollow();
    },
  });

  function downstairs() {
    dir.pose('radhija', { ...out.rad, y: 0, speed: 0, airK: -1 });
    dir.pose('rhaenyra', { ...out.rha, y: 0, speed: 0, airK: -1 });
  }
}

// ------------------------------------------------------------------------------------------------ o cheiro na guarita
/** O Superbafo entrou pela grelha: lá dentro, um espirro; a janela abre para o cheiro sair, e o ronco volta. */
export function createSmellScene(K) {
  const { L, dir, props, emit } = K;
  const bx = (L.BOOTH.x0 + L.BOOTH.x1) / 2;
  const S = {};
  const win = () => props.booth.windowAnchor;
  return createScene({
    id: 'cheiro',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(win().x, win().y, win().z);
      K.snoring = false;
      dir.shot(P3(bx + 1.9, 1.15, L.BOOTH.z1 + 2.7), P3(win().x, win().y - 0.05, win().z), { inT: 0.7 });
    },
    beats: [
      {
        id: 'cheiro', dur: 1.3,
        enter() { dir.onomato('FUUU…', { at: P3(win().x - 0.2, win().y + 0.2, win().z + 0.1), size: 0.8, color: '#c8f7a1', rot: 6 }); },
        tick(_, t) { props.booth.setVentPuff?.(Math.max(0, 1 - t)); },
      },
      {
        id: 'espirro', dur: 1.0,
        enter() {
          dir.sfx('espirro', { x: bx, z: L.BOOTH.z1 });
          dir.onomato('ATCHIM!', { at: P3(win().x, win().y + 0.35, win().z + 0.1), size: 1.1, color: '#ffffff', rot: -8, style: 'shake' });
          props.booth.radio.setOn(false);
        },
      },
      {
        id: 'abre', dur: 1.7,
        enter() { dir.sfx('janela', { x: win().x, z: win().z }); },
        tick(_, t) { props.booth.setWindow?.(smooth(span(t, 0.1, 1.2))); },
      },
      {
        // o ronco volta, agora de janela aberta: dá para ouvir (e para acordar)
        id: 'ronco', dur: 1.6,
        enter() {
          props.booth.radio.setOn(true);
          dir.sfx('ronco', { x: bx, z: L.BOOTH.z1 });
          dir.say('porteiro', 'Uá… uá… zzz…', { mood: 'sono', mode: 'cena', dur: 1.5 });
        },
        tick(_, t) { if (t > 0.6 && !S.idea) { S.idea = true; dir.say('radhija', 'Janela aberta! Agora, o latido mais forte da casa…', { mood: 'pensa', mode: 'cena', dur: 1.8 }); } },
      },
    ],
    cleanup() {
      props.booth.setVentPuff?.(0);
      dir.cleanup();
    },
    commit() {
      K.book.add('grelha', K.clueAt?.('grelha'));
      props.booth.radio.setOn(true);
      K.windowOpened();
      K.snoring = true;
    },
  });
}

// ------------------------------------------------------------------------------------------------ o porteiro
export function createPorteiroScene(K) {
  const { L, dir, props, emit } = K;
  const G = L.GATE;
  const gx = (G.x0 + G.x1) / 2;
  const S = {};
  const once = (key, cond, fn) => { if (cond && !S[key]) { S[key] = true; fn(); } };
  const win = () => props.booth.windowAnchor;
  const luiz = () => props.srLuiz;
  /** Onde o Sr. Luiz fica no portãozinho: do lado do trinco, fora do arco da folha (ela abre para dentro). */
  const atGate = { x: G.x1 + 0.45, z: G.z + 0.55 };
  /** A cabeça do Sr. Luiz no mundo (o osso da cabeça; sentado ela fica a ~1,15 m, embaixo da barra do toldo). */
  const head = () => {
    const L1 = luiz(), hb = L1?.parts?.head, o = L1?.object;
    if (hb && o) {
      hb.updateWorldMatrix(true, false);
      const v = hb.localToWorld(o.position.clone().set(0, 0.06, 0));
      return P3(v.x, v.y, v.z);
    }
    return o ? P3(o.position.x, o.position.y + 1.15, o.position.z) : P3(win().x, win().y, win().z);
  };
  return createScene({
    id: 'porteiro',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(win().x, 1.2, win().z);
      K.snoring = false;
      props.booth.radio.setOn(false);
      props.humans.porteiro.object.visible = false;
      // página de HQ: em cima, o Sr. Luiz pulando na cadeira, visto pela janela do guichê
      dir.comic(true);
      dir.panel('2h', 0, { enter: 'pop', tilt: -1.5 });
      dir.lens(30);
      const h = head();
      // de fora, por baixo do babado do toldo (a barra fica a 1,56 m), pelo vão aberto do guichê
      dir.shot(P3(win().x + 0.2, Math.min(1.32, h.y + 0.04), win().z + 0.85), P3(h.x, h.y - 0.05, h.z), { cut: true });
      dir.onomato('AU! AU!', { at: P3(win().x - 0.4, win().y, win().z + 0.4), size: 1.3, color: '#ffd23f', rot: -10, style: 'shake' });
      luiz()?.setPose('acorda');
      dir.sfx('ronco-fim', { x: win().x, z: win().z });
      dir.fx('impact', { at: h, dur: 0.6 });
    },
    beats: [
      {
        id: 'acorda', dur: 6.2,
        tick(_, t) {
          once('l1', t > 0.4, () => dir.say('porteiro', 'HEIN?! Quem latiu?', { mood: 'grito', mode: 'cena', dur: 1.4 }));
          // embaixo, as duas latindo para a janela (ele só ouve latido)
          once('p2', t > 1.6, () => {
            dir.panel('2h', 1, { enter: 'slide', tilt: 1.5 });
            dir.lens(34);
            // do pátio, a ~2,9 m do guichê e a 0,95 m do chão: a linha até a cabeça dele passa por cima da lixeira
            // (1 m) quando ela está estacionada embaixo do toldo. A Rhaenyra (quem latiu) está ali na frente
            dir.shot(P3(win().x + 0.45, 0.95, win().z + 2.85), P3(win().x, 1.0, win().z), { cut: true });
            dir.say('rhaenyra', 'Seu Luiz! Os pombos levaram a nossa cenoura!', { mode: 'cena', dur: 2.0 });
            dir.bark('rhaenyra');
          });
          once('l3', t > 3.6, () => {
            luiz()?.setPose('fala');
            luiz()?.say(true);
            dir.say('porteiro', 'Pombo aqui? Impossível. Ninguém entra na guarita: está tudo trancado!', { mode: 'cena', dur: 2.6 });
          });
        },
        leave() { luiz()?.say(false); },
      },
      {
        // corte: ele no portãozinho, de pé, abrindo a tranca
        id: 'abre', dur: 3.4,
        enter() {
          dir.panel('full', 0, { enter: 'wipe' });
          dir.lens(32);
          const L1 = luiz();
          if (L1) {
            L1.chair && (L1.chair.object.visible = true);
            L1.object.position.set(atGate.x, 0, atGate.z);
            L1.object.rotation.set(0, -Math.PI * 0.75, 0);
            L1.setPose('em-pe', undefined, { instant: true });
          }
          dir.shot(P3(gx - 1.0, 1.0, G.z + 2.5), P3(gx + 0.3, 0.98, G.z + 0.3), { cut: true });
          dir.say('porteiro', 'Calma, calma! Querem passear, é?', { mode: 'cena', dur: 1.8 });
        },
        tick(_, t) {
          const L1 = luiz();
          if (L1) {
            L1.setPose('abre-portao', Math.min(1, t / 1.4));
            L1.reach?.('R', t < 1.6 ? P3(G.x1 - 0.05, 1.0, G.z + 0.03) : null);
          }
          once('click', t > 1.1, () => { dir.sfx('trinco', { x: gx, z: G.z }); dir.onomato('CLAC!', { at: P3(G.x1, 1.1, G.z), size: 0.8, color: '#ffffff', rot: 6 }); });
          once('open', t > 1.3, () => dir.sfx('portao', { x: gx, z: G.z }));
          if (t > 1.3) props.gateLeaf.setOpen(smooth(span(t, 1.3, 2.7)));
        },
      },
      {
        id: 'acena', dur: 2.2,
        enter() {
          const o = luiz()?.object;
          if (o) { S.yaw0 = o.rotation.y; S.yaw1 = Math.atan2(gx - 1.0 - o.position.x, G.z + 2.5 - o.position.z); }
          luiz()?.setPose('acena');
          dir.say('porteiro', 'Vão lá… mas voltem pro almoço!', { mode: 'cena', dur: 1.8 });
        },
        tick(_, t) {
          // vira devagar para a câmera (o lado curto do giro)
          const o = luiz()?.object;
          if (o && S.yaw1 !== undefined) {
            const d = Math.atan2(Math.sin(S.yaw1 - S.yaw0), Math.cos(S.yaw1 - S.yaw0));
            o.rotation.y = S.yaw0 + d * smooth(span(t, 0, 0.45));
          }
        },
        leave() { dir.say('radhija', 'O portão abriu! Atrás dos pombos!', { mode: 'cena', dur: 1.4 }); },
      },
    ],
    cleanup() {
      props.humans.porteiro.object.visible = false;
      luiz()?.reach?.('R', null);
      dir.cleanup();
    },
    commit() {
      K.book.add('dep-luiz', K.clueAt?.('dep-luiz'));
      props.gateLeaf.setOpen(1);
      K.gateOpened();
      props.booth.radio.setOn(true);
      // acordado, de volta à cadeira da guarita, de olho no portão
      const L1 = luiz();
      if (L1) { L1.reset?.(); L1.setPose('sentado', undefined, { instant: true }); }
      K.setStage('fechamento');
    },
  });
}


// ------------------------------------------------------------------------------------------------ o fechamento
export function createClosingScene(K) {
  const { L, dir, props, emit } = K;
  const G = L.GATE, St = L.STREET;
  const gx = (G.x0 + G.x1) / 2;
  const walkOut = { rad: { x: gx - 0.3, z: St.sidewalk + 0.5 }, rha: { x: gx + 0.45, z: St.sidewalk + 0.8 } };
  const back = { rad: { x: gx - 0.3, z: G.z + 1.6, yaw: Math.PI }, rha: { x: gx + 0.4, z: G.z + 2.2, yaw: Math.PI } };
  const S = {};
  /** Para onde os pombos vão: o portal da cidade, por cima da rua. */
  const portal = () => {
    const p = props.city?.portal?.position;
    return p ? { x: p.x, z: p.z } : { x: gx - 6, z: St.z1 - 8 };
  };
  return createScene({
    id: 'fechamento',
    emit,
    setup() {
      for (const k of Object.keys(S)) delete S[k];
      dir.hold('radhija', 'rhaenyra');
      // o vão do portãozinho: as duas saem em fila, pelo meio (lado a lado, uma encostaria no muro)
      dir.pose('radhija', { x: gx, z: G.z + 0.7, yaw: Math.PI, speed: 0 });
      dir.pose('rhaenyra', { x: gx + 0.05, z: G.z + 1.45, yaw: Math.PI, speed: 0 });
      dir.walk('radhija', [{ x: gx, z: G.z - 0.5 }, walkOut.rad], { speed: 1.9 });
      dir.walk('rhaenyra', [{ x: gx + 0.05, z: G.z - 0.45 }, walkOut.rha], { speed: 1.9 });
      // de dentro do condomínio, atrás delas: o portãozinho aberto e a rua
      dir.shot(P3(gx - 0.5, 0.9, G.z + 3.2), P3(gx + 0.1, 0.7, G.z - 1.5), { cut: true });
      K.butterfly.visible = false;
    },
    beats: [
      { id: 'saem', dur: 2.0 },
      {
        // na calçada, de costas para o muro: lá no alto, os pombos passam por cima do portal com a cenoura
        id: 'pombos', dur: 3.0,
        enter() {
          const p = portal();
          // de dentro, pelo vão do portãozinho: as duas na calçada, de costas, e os pombos lá no alto, sobre a avenida
          dir.shot(P3(gx - 0.4, 0.75, G.z + 2.6), P3(lerp(gx, p.x, 0.35), 3.4, St.z1 - 6), { inT: 1.0 });
        },
        tick(_, t) {
          const p = portal();
          const k = span(t, 0, 3.0);
          const yaw = Math.atan2(p.x - gx, p.z - St.sidewalk);
          flyPack(K, { x: lerp(gx - 1.5, p.x, 0.35 + k * 0.5), y: 5.4 + Math.sin(t * 2) * 0.2, z: lerp(St.sidewalk - 1, p.z, 0.35 + k * 0.5) }, yaw, t);
          if (t > 0.8 && !S.point) { S.point = true; dir.say('radhija', 'Lá vão eles, com a nossa cenoura!', { mode: 'cena', dur: 1.9 }); }
          const a = dir.actor('radhija');
          a.press = t > 0.8 && t < 2.4 ? { x: a.x, y: 0.42, z: a.z - 0.35, k: Math.sin(span(t, 0.8, 2.4) * Math.PI) } : null;
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = P3(p.x, 6, p.z);
        },
        leave() { dir.actor('radhija').press = null; },
      },
      {
        // a Rhaenyra sai para o lado errado atrás de uma borboleta
        id: 'borboleta', dur: 2.4,
        enter() {
          hideSquad(K);
          props.carrot.object.visible = false;
          K.butterfly.visible = true;
          dir.walk('rhaenyra', [{ x: gx + 2.8, z: St.sidewalk + 0.4 }], { speed: 1.5 });
          dir.shot(P3(gx + 0.3, 0.75, St.sidewalk - 1.9), P3(gx + 1.6, 0.5, St.sidewalk + 0.5), { inT: 0.8 });
        },
        tick(_, t) {
          const h = dir.actor('rhaenyra');
          K.butterfly.position.set(h.x + 0.5 + Math.sin(t * 3) * 0.15, 0.62 + Math.sin(t * 7) * 0.08, h.z - 0.1 + Math.cos(t * 3) * 0.15);
          K.butterflyFlap = t;
          h.look = P3(K.butterfly.position.x, K.butterfly.position.y, K.butterfly.position.z);
          dir.actor('radhija').look = P3(h.x, 0.4, h.z);
        },
      },
      {
        id: 'raiva', dur: 1.4,
        enter() { dir.say('radhija', 'RHAENYRA! Foco!', { mood: 'grito', mode: 'cena', dur: 1.2 }); dir.fx('anger', { at: dir.head('radhija'), dur: 1.0 }); dir.bark('radhija'); },
        tick(_, t) { if (t > 0.45 && !S.b2) { S.b2 = true; dir.bark('radhija'); } },
      },
      {
        // a Rhaenyra dá meia-volta e ultrapassa a irmã, rua afora
        id: 'volta', dur: 2.3,
        enter() {
          K.butterfly.visible = false;
          dir.walk('rhaenyra', [{ x: gx + 0.7, z: St.sidewalk - 0.3 }, { x: gx + 0.2, z: St.z1 + 0.8 }], { speed: 3.2 });
          dir.walk('radhija', [{ x: gx - 0.2, z: St.z1 + 1.4 }], { speed: 2.3 });
          // de novo pelo vão do portãozinho: as duas somem rua afora
          dir.shot(P3(gx - 0.35, 1.05, G.z + 1.6), P3(gx + 0.1, 0.5, St.z1 + 0.5), { inT: 0.8 });
        },
        tick(_, t) { if (t > 1.5 && !S.dark) { S.dark = true; dir.fade(1, 0.6); } },
      },
    ],
    cleanup() {
      K.butterfly.visible = false;
      hideSquad(K);
      dir.cleanup({ snap: true });
    },
    commit() {
      K.placeAt(back.rad, back.rha);
      K.setStage('mural');
    },
  });
}
