// As cenas do capítulo 1 (sem palavras): a abertura "A noite da garoa", a Reconstrução da piscina, o varal, o terraço
// da torre, o porteiro e o fechamento. Roteiro em docs/HISTORIA.md. Cada cena é uma lista de beats (src/story/scene/
// sequencer.js) tocada pelo diretor (src/story/scene/director.js). O que fica de PERMANENTE (pistas, etapa, portas,
// onde as dogs ficam) está no commit de cada cena: pular ou assistir deixa o jogo no mesmo estado.
// K: { ctx, dir, props, L, faro, recon, book, mood, emit, S, actors } (montado pelo puzzle).
import { createScene, span, smooth, lerp } from '../../scene/sequencer.js';
import { MORNING, NIGHT } from './lighting.js';

const CLUES_ABERTURA = ['pombos', 'abraco', 'pote', 'trilha', 'pena'];

// ------------------------------------------------------------------------------------------------ utilidades
/** Os três pombos lado a lado (Capitão, Soneca, Farelo) em volta de um ponto, todos olhando para `yaw`. */
function perch(K, at, yaw, { gap = 0.3, asleepSoneca = true } = {}) {
  const sq = K.props.squad;
  const list = [[sq.cap, -gap], [sq.son, 0], [sq.far, gap]];
  for (const [p, off] of list) {
    p.setVisible(true);
    const ox = Math.cos(yaw) * off, oz = -Math.sin(yaw) * off;
    p.setPose({ x: at.x + ox, y: at.y, z: at.z + oz, yaw, flying: false, asleep: asleepSoneca && p === sq.son });
  }
}
/** O esquadrão voando em bando (baixo e torto), com a cenoura pendurada embaixo do Capitão e do Farelo. */
function flyPack(K, p, yaw, t, { carrot = true, k = 0 } = {}) {
  const sq = K.props.squad;
  const wob = Math.sin(t * 7.3) * 0.06;
  const pts = [[sq.cap, -0.22, 0.05], [sq.far, 0.22, -0.03], [sq.son, 0, 0.16]];
  for (const [b, side, up] of pts) {
    b.setVisible(true);
    b.setPose({ x: p.x + Math.cos(yaw) * side, y: p.y + up + wob * (side > 0 ? 1 : -1), z: p.z - Math.sin(yaw) * side, yaw, flying: true, asleep: false, flightProgress: k });
  }
  if (carrot) {
    const c = K.props.carrot.object;
    c.visible = true;
    c.position.set(p.x, p.y - 0.16 + wob * 0.5, p.z);
    c.rotation.set(0.3 + wob, yaw + Math.PI / 2, Math.sin(t * 5) * 0.25);
  }
}
function hideSquad(K) {
  for (const p of Object.values(K.props.squad)) p.setVisible(false);
}
/** O esquadrão pousado no varal, com a cenoura presa no pregador (o estado depois da abertura). */
export function squadOnLine(K) {
  const L = K.L;
  const y = L.LINE.h + 0.01;
  const sq = K.props.squad;
  sq.cap.setVisible(true); sq.son.setVisible(true); sq.far.setVisible(true);
  sq.cap.setPose({ x: L.CARROT_PIN.x - 0.55, y, z: L.LINE.a.z, yaw: Math.PI * 0.85, flying: false, asleep: false });
  sq.son.setPose({ x: L.CARROT_PIN.x - 1.1, y, z: L.LINE.a.z, yaw: Math.PI, flying: false, asleep: true });
  sq.far.setPose({ x: L.CARROT_PIN.x + 0.45, y, z: L.LINE.a.z, yaw: -Math.PI * 0.9, flying: false, asleep: false });
  const c = K.props.carrot.object;
  c.visible = true;
  c.position.set(L.CARROT_PIN.x, L.CARROT_PIN.y - 0.15, L.CARROT_PIN.z);
  c.rotation.set(Math.PI / 2, 0, 0);
}
/** O esquadrão no alto da caixa d'água da torre, com a cenoura (depois do varal). */
export function squadOnTank(K) {
  const T = K.L.TERRACE.pigeons;
  perch(K, { x: T.x, y: T.y, z: T.z }, 0.2, { gap: 0.32, asleepSoneca: false });
  const c = K.props.carrot.object;
  c.visible = true;
  c.position.set(T.x + 0.12, T.y + 0.04, T.z + 0.18);
  c.rotation.set(0, 0.9, Math.PI / 2);
}

// ------------------------------------------------------------------------------------------------ a abertura
/** A abertura "A noite da garoa" (6 beats, ~40 s). O 4º espera o primeiro pulso do Faro (sai sozinho em 5 s). */
export function createOpening(K) {
  const { L, dir, props, faro, emit } = K;
  const B = L.BED, W = L.WINDOW;
  const cx = (W.x0 + W.x1) / 2;
  const SO = L.SILL.out;
  const lie = (t, k = 1, side = 1) => ({ kind: 'lie', t, k, side });
  const sleepRad = { x: B.x + 0.2, z: B.z - 0.04, yaw: -Math.PI / 2 - 0.25 };
  const sleepRha = { x: B.x - 0.24, z: B.z + 0.08, yaw: Math.PI / 2 - 0.2 };
  const carrotBed = { x: B.x - 0.02, y: 0.17, z: B.z - 0.02 };
  const floorRad = { x: -11.5, z: 3.0 };
  /** Onde a Rhaenyra cai ao pular da caminha (fora da borda, do lado de baixo, longe da irmã no chão). */
  const rhaOut = { x: B.x - 0.1, z: B.z + 1.05 };
  const S = { faro: false, pulsed: false, armT: 0, flyT: 0 };

  const scene = createScene({
    id: 'abertura',
    emit,
    setup() {
      S.faro = false;
      S.pulsed = false;
      K.mood.set(NIGHT);
      props.rain.setOn(1);
      props.windowLeaf.setOpen(1);
      props.bowl.setTipped(0);
      K.feather.visible = false;
      faro.setSpot('baba', false);
      dir.ambience('rain');
      dir.music(null);
      dir.fade(0, 1.4);
      dir.hold('radhija', 'rhaenyra');
      dir.pose('radhija', { ...sleepRad, y: 0.12, speed: 0, action: 'none', lie: lie(14, 1, -1) });
      dir.pose('rhaenyra', { ...sleepRha, y: 0.12, speed: 0, action: 'none', lie: lie(14, 1, 1) });
      const c = props.carrot.object;
      c.visible = true;
      c.position.set(carrotBed.x, carrotBed.y, carrotBed.z);
      c.rotation.set(0, 0.4, Math.PI / 2);
      hideSquad(K);
      dir.snapFollow();
      dir.shot({ x: cx + 2.6, y: 2.7, z: -2.4 }, { x: cx, y: 1.0, z: 1.2 }, { cut: true });
    },
    beats: [
      {
        id: 'noite', dur: 6.5,
        tick(_, t) {
          // a câmera chega perto do basculante e olha para dentro (a caminha pelo vão de baixo)
          dir.dolly({ x: cx + 2.6, y: 2.7, z: -2.4 }, { x: cx + 0.35, y: 1.22, z: -0.55 }, { x: cx, y: 1.0, z: 1.2 }, { x: cx, y: 0.24, z: B.z }, span(t, 0.4, 5.8));
          if (t > 3.4 && t < 3.6 && !S.fiu) {
            S.fiu = true;
            dir.sfx('fiu', { x: carrotBed.x, z: carrotBed.z });
            dir.balloon('nota', { at: { x: carrotBed.x + 0.12, y: 0.55, z: carrotBed.z }, kind: 'solto', life: 1.6, size: 0.22 });
          }
          props.carrot.squeeze(t > 3.3 && t < 3.9 ? Math.sin(span(t, 3.3, 3.9) * Math.PI) : 0);
        },
        leave() { S.fiu = false; },
      },
      {
        id: 'pombos', dur: 8,
        enter() {
          perch(K, { x: cx - 0.05, y: SO.y + 0.04, z: SO.z - 0.02 }, 0, { gap: 0.36, asleepSoneca: false });
          props.squad.son.setPose({ asleep: false });
          dir.shot({ x: cx - 1.05, y: 0.98, z: SO.z - 1.25 }, { x: cx + 0.1, y: 0.72, z: SO.z + 0.25 }, { cut: true });
          dir.sfx('arrulho', { x: cx, z: SO.z });
        },
        tick(_, t) {
          const sq = props.squad;
          // tremendo de frio (um tremidinho no lugar)
          const sh = Math.sin(t * 46) * 0.004;
          for (const [p, off] of [[sq.cap, -0.36], [sq.son, 0], [sq.far, 0.36]]) p.setPose({ x: cx - 0.05 + off + sh, flying: false });
          sq.cap.measure(span(t, 1.6, 2.2) * (1 - span(t, 4.2, 4.6)));
          sq.cap.salute(span(t, 4.6, 5.0) * (1 - span(t, 6.0, 6.4)));
          if (t > 2.2 && !S.cone) {
            S.cone = true;
            // o cone aparece primeiro colado na cenoura, depois no balão de pensamento do Capitão
            dir.balloon('cone', { at: { x: carrotBed.x, y: carrotBed.y + 0.06, z: carrotBed.z }, kind: 'solto', life: 1.6, size: 0.26 });
          }
          if (t > 3.2 && !S.think) {
            S.think = true;
            dir.balloon('cone', { at: { x: cx - 0.41, y: SO.y + 0.62, z: SO.z - 0.02 }, kind: 'pensamento', life: 1.9, size: 0.34 });
          }
          if (t > 5.6 && !S.feather) {
            S.feather = true;
            K.feather.visible = true;
            K.featherFall = 0;
            dir.sfx('asas', { x: cx, z: SO.z, volume: 0.5 });
          }
          if (S.feather) {
            K.featherFall = Math.min(1, (K.featherFall ?? 0) + 1 / 50);
            const f = K.featherFall;
            K.feather.position.set(SO.x + 0.25 + Math.sin(f * 9) * 0.06, SO.y + 0.03 + (1 - f) * 0.28, SO.z);
            K.feather.rotation.set(0, 0, Math.sin(f * 7) * 0.6 + 1.3);
          }
          if (t > 6.6 && !S.dark) {
            S.dark = true;
            dir.fade(1, 0.9); // a tela escurece antes de qualquer coisa acontecer
          }
          dir.lookAt({ x: cx + 0.1, y: 0.72 + Math.sin(t * 0.6) * 0.01, z: SO.z + 0.25 });
        },
        leave() { S.cone = S.think = S.feather = S.dark = false; props.squad.cap.measure(0); props.squad.cap.salute(0); },
      },
      {
        // no preto: a manhã chega (a luz, a garoa para, os pombos e a cenoura já foram, o pote virou)
        id: 'preto', dur: 0.9, noSkip: true,
        tick(_, t) {
          if (t > 0.05 && !S.morning) {
            S.morning = true;
            K.mood.set(MORNING);
            props.rain.setOn(0);
            hideSquad(K);
            props.carrot.object.visible = false;
            props.bowl.setTipped(1);
            K.feather.visible = true;
            K.feather.position.set(SO.x + 0.25, SO.y + 0.03, SO.z);
            K.feather.rotation.set(0, 0.4, 1.45);
            dir.ambience('day');
            // a Rhaenyra dormindo abraçada na irmã, no lugar da cenoura
            dir.pose('rhaenyra', { x: B.x - 0.08, z: B.z + 0.04, yaw: Math.PI / 2 - 0.35, y: 0.12, lie: lie(16, 1, 1) });
            dir.pose('radhija', { x: B.x + 0.24, z: B.z - 0.06, yaw: -Math.PI / 2 + 0.2, y: 0.12, lie: lie(16, 1, -1) });
            dir.shot({ x: cx + 1.7, y: 0.5, z: 3.7 }, { x: cx - 0.15, y: 0.95, z: 1.35 }, { cut: true });
          }
        },
        leave() { S.morning = false; },
      },
      {
        id: 'manha', dur: 7.2,
        enter() {
          dir.fade(0, 0.8);
          dir.sfx('passarinhos', { volume: 0.6 });
          const arm = props.humans.tutora;
          arm.object.visible = true;
          arm.object.position.set(cx + 0.62, 2.55, 1.62);
          arm.object.rotation.set(0.0, 0, 0.0);
          arm.hand.userData.grip(0);
        },
        tick(_, t) {
          const arm = props.humans.tutora;
          // o braço desce por cima, a mão pega a alavanca e fecha o basculante, e volta para cima (só a manga e a mão)
          const down = span(t, 0.6, 1.8) * (1 - span(t, 3.3, 4.3));
          arm.object.rotation.x = lerp(-0.9, 0.55, smooth(down));
          arm.object.position.y = lerp(2.75, 2.35, smooth(down));
          arm.elbow.rotation.x = lerp(0.0, 0.5, smooth(span(t, 1.2, 1.9)) * (1 - span(t, 3.2, 3.8)));
          arm.hand.userData.grip(span(t, 1.8, 2.1) * (1 - span(t, 3.0, 3.2)));
          if (t > 2.1 && t < 3.0) props.windowLeaf.setOpen(1 - span(t, 2.1, 2.9));
          if (t > 2.15 && !S.click) { S.click = true; dir.sfx('janela', { x: cx, z: W.z }); }
          arm.object.visible = t < 4.4;
          // a Radhija acorda e percebe: a cenoura sumiu, a irmã abraçando ela, o pote virado
          const wake = span(t, 4.3, 5.1);
          if (wake > 0) dir.actor('radhija').lie = wake < 1 ? lie(16, 1 - wake, -1) : null;
          if (t > 5.1 && !S.q1) { S.q1 = true; dir.balloon('cenoura', { who: 'radhija', kind: 'pensamento', life: 1.2, size: 0.36 }); }
          if (t > 6.2 && !S.q2) { S.q2 = true; dir.balloon('q', { who: 'radhija', life: 1.0, size: 0.36 }); }
          dir.actor('radhija').look = t > 5.6 ? { x: L.BOWL.x, y: 0.1, z: L.BOWL.z } : t > 5.1 ? { x: B.x - 0.3, y: 0.3, z: B.z + 0.1 } : null;
        },
        leave() { S.click = S.q1 = S.q2 = false; props.humans.tutora.object.visible = false; props.windowLeaf.setOpen(0); },
      },
      {
        // a Radhija pula da caminha e a cena espera o primeiro pulso do Faro (o ícone do focinho e o botão)
        id: 'pulso', until: () => S.pulsed && S.flyT > 3.4, max: 12,
        enter() {
          S.armT = 0;
          S.flyT = 0;
          const a = dir.actor('radhija');
          a.lie = null;
          a.look = null;
          dir.shot({ x: cx + 1.5, y: 1.95, z: 4.0 }, { x: cx - 0.05, y: 0.32, z: 1.95 }, { inT: 1.0 });
        },
        tick(_, t, __, dt) {
          const a = dir.actor('radhija');
          // pulinho para fora da caminha, até o chão perto do pote
          if (t < 0.8) {
            const u = smooth(span(t, 0, 0.8));
            a.x = lerp(B.x + 0.24, floorRad.x, u);
            a.z = lerp(B.z - 0.06, floorRad.z, u);
            a.y = lerp(0.12, 0, u) + Math.sin(span(t, 0, 0.8) * Math.PI) * 0.22;
            a.airK = t < 0.8 ? span(t, 0, 0.8) : -1;
            a.yaw = lerp(-Math.PI / 2 + 0.2, -2.6, u);
            a.speed = 1.2;
          } else if (!S.landed) {
            S.landed = true;
            Object.assign(a, { x: floorRad.x, z: floorRad.z, y: 0, airK: -1, speed: 0, yaw: -2.6 });
            emit('story:prompt', { kind: 'faro', on: true });
          }
          if (S.landed && !S.pulsed) {
            S.armT += dt;
            if (S.faro || S.armT > 5) pulse();
          }
          if (S.pulsed) {
            S.flyT += dt;
            const f = S.flyT;
            // a câmera sobe para o basculante: lá fora, os pombos passam baixo e torto com a cenoura
            if (f > 1.4) dir.dolly({ x: cx + 1.5, y: 1.95, z: 4.0 }, { x: cx + 0.6, y: 1.05, z: 3.0 }, { x: cx - 0.05, y: 0.32, z: 1.95 }, { x: cx, y: 1.05, z: 0.4 }, span(f, 1.4, 2.4));
            if (f > 1.5) flyPack(K, { x: lerp(cx - 3.4, cx + 3.8, span(f, 1.5, 3.6)), y: 1.15 + Math.sin(f * 2.6) * 0.1, z: -0.25 }, Math.PI / 2, f, { k: 0 });
            if (f > 2.2 && !S.ex) { S.ex = true; dir.balloon('ex', { who: 'radhija', life: 0.9, size: 0.38 }); }
            if (f > 3.0 && !S.mad) { S.mad = true; dir.balloon('raiva', { who: 'radhija', life: 1.2, size: 0.38 }); }
            a.look = f > 1.4 ? { x: cx, y: 1.0, z: W.z } : null;
          }
        },
        leave() {
          emit('story:prompt', { kind: 'faro', on: false });
          hideSquad(K);
          props.carrot.object.visible = false;
          S.landed = S.ex = S.mad = false;
        },
      },
      {
        // a Radhija late ordens; a Rhaenyra acorda de patas molhadas, olha o pote, sacode, rabo-hélice e dispara
        id: 'acorda', dur: 6.2,
        enter() {
          dir.shot({ x: cx + 1.9, y: 1.25, z: 4.2 }, { x: B.x + 0.4, y: 0.4, z: B.z + 0.4 }, { inT: 0.9 });
        },
        tick(_, t) {
          const a = dir.actor('radhija');
          const h = dir.actor('rhaenyra');
          a.yaw = lerp(a.yaw, -2.2, 0.08);
          a.look = { x: h.x, y: 0.3, z: h.z };
          // pata erguida e dois latidos finos, olhando para a irmã e de novo para a porta
          a.press = t > 0.1 && t < 1.6 ? { x: a.x + Math.sin(a.yaw) * 0.32, y: 0.36, z: a.z + Math.cos(a.yaw) * 0.32, k: Math.sin(span(t, 0.1, 1.6) * Math.PI) } : null;
          if (t > 0.25 && !S.b1) { S.b1 = true; dir.bark('radhija'); }
          if (t > 0.6 && !S.b2) { S.b2 = true; dir.bark('radhija'); dir.balloon('seta', { who: 'radhija', life: 1.2, size: 0.36, flip: true }); }
          const wake = span(t, 1.1, 1.9);
          h.lie = wake < 1 ? lie(16, 1 - wake, 1) : null;
          if (t > 1.9 && t < 2.4) h.look = { x: L.BOWL.x, y: 0.05, z: L.BOWL.z };
          if (t > 2.0 && !S.hq) { S.hq = true; dir.balloon('q', { who: 'rhaenyra', life: 0.9, size: 0.36 }); }
          h.action = t > 2.4 && t < 3.3 ? 'shake' : t > 3.4 && t < 4.1 ? 'proud' : 'none';
          if (t > 2.4 && !S.drip) { S.drip = true; dir.sfx('sacudir', { x: h.x, z: h.z }); }
          // dispara: um pulinho para fora da caminha, pelo lado de baixo (longe da irmã), e corre para a porta
          if (t > 4.1 && !S.run) {
            S.run = true;
            S.hop0 = { x: h.x, z: h.z };
          }
          if (S.run && !S.out) {
            const u = span(t, 4.1, 4.75);
            const e = smooth(u);
            h.x = lerp(S.hop0.x, rhaOut.x, e);
            h.z = lerp(S.hop0.z, rhaOut.z, e);
            h.y = lerp(0.12, 0, e) + Math.sin(u * Math.PI) * 0.24;
            h.airK = u < 1 ? u : -1;
            h.yaw = Math.atan2(rhaOut.x - S.hop0.x, rhaOut.z - S.hop0.z);
            h.speed = 1.4;
            if (u >= 1) {
              S.out = true;
              Object.assign(h, { x: rhaOut.x, z: rhaOut.z, y: 0, airK: -1 });
              const st = L.DOGS.rhaenyra.start;
              dir.walk('rhaenyra', [{ x: -11.5, z: 3.55 }, { x: st.x, z: st.z }], { speed: 3.0, face: st.yaw });
            }
          }
          if (S.out && !dir.walking('rhaenyra')) h.look = { x: a.x, y: 0.35, z: a.z };
        },
        leave() { S.b1 = S.b2 = S.hq = S.drip = S.run = S.out = false; },
      },
      {
        id: 'titulo', dur: 3.8,
        enter() {
          emit('story:title', { eyebrow: 'Capítulo 1', title: 'As Aventuras de Radhija & Rhaenyra', chapter: 'Cadê a Cenoura?' });
          dir.music('recanto');
        },
      },
    ],
    cleanup() {
      emit('story:prompt', { kind: 'faro', on: false });
      props.humans.tutora.object.visible = false;
      faro.setSpot('baba', true);
      dir.cleanup({ snap: true });
      dir.fade(0, 0.35);
    },
    commit(_, how) {
      K.mood.set(MORNING);
      props.rain.setOn(0);
      props.windowLeaf.setOpen(0);
      props.bowl.setTipped(1);
      props.carrot.squeeze(0);
      K.feather.visible = true;
      K.feather.position.set(SO.x + 0.25, SO.y + 0.03, SO.z);
      K.feather.rotation.set(0, 0.4, 1.45);
      squadOnLine(K);
      void how;
      for (const id of CLUES_ABERTURA) K.book.add(id, K.clueAt(id));
      K.placeStart();
      dir.ambience('day');
      dir.music('recanto');
      K.setStage('cozinha');
      dir.snapFollow();
    },
  });

  /** A jogadora apertou o Faro durante a abertura (o puzzle chama). */
  scene.pressFaro = () => { S.faro = true; };
  /** A cena está esperando o primeiro pulso agora? */
  Object.defineProperty(scene, 'waitingFaro', { get: () => scene.active && scene.beat === 'pulso' && S.landed && !S.pulsed });
  return scene;

  function pulse() {
    S.pulsed = true;
    emit('story:prompt', { kind: 'faro', on: false });
    const r = dir.actor('radhija');
    faro.pulse({ x: r.x, z: r.z });
    emit('story:faro', { x: r.x, z: r.z, scene: true });
    dir.sfx('faro', { x: r.x, z: r.z });
    // as três pistas do primeiro pulso viram cartões (o commit garante, mesmo pulando)
    for (const id of ['trilha', 'pote', 'pena']) K.book.add(id, K.clueAt(id));
  }
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
      const r = dir.actor('radhija');
      r.look = { x: R.x, y: 0.2, z: R.z };
      r.speed = 0;
      dir.shot({ x: R.x + 2.4, y: 2.1, z: R.z + 2.6 }, { x: R.x + 0.6, y: 0.45, z: R.z - 0.4 }, { inT: 0.8 });
      dir.music('misterio');
      recon.play();
    },
    beats: [
      {
        id: 'silhuetas', until: () => !recon.active, max: recon.duration + 1.5,
        tick(_, t) {
          // acompanha o pombo fantasma saindo baixo e torto para o nordeste
          const g = K.props.ghosts.pigeon.object.position;
          if (t > 2.4) dir.lookAt({ x: lerp(R.x + 0.6, g.x, 0.5), y: 0.6, z: lerp(R.z - 0.4, g.z, 0.5) });
        },
      },
      { id: 'pista', dur: 0.8, enter() { K.book.add('boia', K.clueAt('boia')); } },
    ],
    cleanup() {
      recon.stop();
      dir.cleanup();
    },
    commit() {
      K.book.add('boia', K.clueAt('boia'));
      dir.music('recanto');
      K.setStage('varal');
    },
  });
}

// ------------------------------------------------------------------------------------------------ o varal
export function createVaralScene(K) {
  const { L, dir, props, emit } = K;
  const P = L.CARROT_PIN;
  const tank = L.TERRACE.pigeons;
  const S = {};
  return createScene({
    id: 'varal',
    emit,
    setup() {
      dir.hold('radhija', 'rhaenyra');
      dir.actor('radhija').look = { x: P.x, y: P.y, z: P.z };
      dir.actor('rhaenyra').look = { x: P.x, y: P.y, z: P.z };
      dir.shot({ x: P.x - 1.2, y: 2.0, z: P.z + 3.4 }, { x: P.x - 0.3, y: 1.15, z: P.z - 0.2 }, { inT: 0.6 });
      S.fall = 0;
    },
    beats: [
      {
        id: 'sacode', dur: 0.9,
        enter() { dir.sfx('varal', { x: L.LINE.b.x, z: L.LINE.b.z }); for (const p of Object.values(props.squad)) p.peck(); },
        tick(_, t) { props.line.shake(Math.exp(-t * 2.2) * 1); },
      },
      {
        id: 'cai', dur: 1.3,
        enter() { props.line.setPin(1); dir.sfx('pregador', { x: P.x, z: P.z }); },
        tick(_, t) {
          props.line.shake(Math.exp(-(t + 0.9) * 2.2));
          const c = props.carrot.object;
          const far = props.squad.far;
          if (t < 0.45) {
            // a cenoura cai do pregador
            c.position.set(P.x + t * 0.3, P.y - 0.15 - 4.9 * t * t, P.z + t * 0.2);
            c.rotation.x = Math.PI / 2 + t * 6;
            far.setPose({ x: lerp(P.x + 0.45, P.x + 0.2, span(t, 0, 0.45)), y: lerp(L.LINE.h, P.y - 0.55, span(t, 0.05, 0.45)), z: P.z + 0.1, flying: true, flightProgress: 0.5 });
          } else {
            // o Farelo pega no ar e sobe
            const u = span(t, 0.45, 1.3);
            const fx = P.x + 0.2 + u * 0.8, fy = P.y - 0.5 + u * 0.9, fz = P.z + 0.1 - u * 0.4;
            far.setPose({ x: fx, y: fy, z: fz, flying: true, flightProgress: 0, yaw: Math.PI * 0.75 });
            c.position.set(fx, fy - 0.12, fz);
            c.rotation.set(0.4, 0.3, Math.sin(t * 9) * 0.3);
            if (!S.caught) { S.caught = true; dir.sfx('asas', { x: fx, z: fz }); dir.balloon('migalha', { at: { x: fx, y: fy + 0.35, z: fz }, kind: 'solto', life: 0.8, size: 0.2 }); }
          }
        },
      },
      {
        id: 'voa', dur: 3.2,
        enter() { dir.balloon('ex', { who: 'radhija', life: 1.0, size: 0.38 }); dir.sfx('asas', { x: P.x, z: P.z }); },
        tick(_, t) {
          const u = smooth(span(t, 0, 3.0));
          const p = { x: lerp(P.x + 1.0, tank.x, u), y: lerp(P.y + 0.4, tank.y + 0.35, u) + Math.sin(u * Math.PI) * 0.9, z: lerp(P.z - 0.3, tank.z, u) };
          flyPack(K, p, Math.atan2(tank.x - P.x, tank.z - P.z), t, { k: u });
          dir.lookAt({ x: lerp(P.x - 0.3, tank.x - 1.2, u), y: lerp(1.15, 2.6, u), z: lerp(P.z - 0.2, tank.z + 0.8, u) });
        },
      },
      { id: 'pousam', dur: 1.0, enter() { squadOnTank(K); dir.sfx('arrulho', { x: tank.x, z: tank.z }); } },
    ],
    cleanup() {
      props.line.shake(0);
      dir.cleanup();
    },
    commit() {
      props.line.setPin(1);
      squadOnTank(K);
      K.setStage('torre');
    },
  });
}

// ------------------------------------------------------------------------------------------------ o terraço da torre
export function createTerraceScene(K) {
  const { L, dir, props, emit } = K;
  const T = L.TERRACE, tank = T.pigeons;
  const S = {};
  const out = { rad: { x: 2.85, z: -6.5, yaw: -Math.PI / 2 }, rha: { x: 2.75, z: -5.55, yaw: -Math.PI / 2 - 0.4 } };
  return createScene({
    id: 'terraco',
    emit,
    setup() {
      dir.hold('radhija', 'rhaenyra');
      dir.fade(1, 0.35);
      S.placed = false;
      S.back = false;
    },
    beats: [
      {
        id: 'escada', dur: 0.6, noSkip: true,
        tick(_, t) {
          if (t > 0.38 && !S.placed) {
            S.placed = true;
            // lá em cima: as duas saem da casinha da escada no terraço
            dir.pose('rhaenyra', { x: T.hut.x + 0.1, z: T.hut.z - 0.45, y: T.y, yaw: Math.PI, speed: 0 });
            dir.pose('radhija', { x: T.hut.x - 0.25, z: T.hut.z - 0.2, y: T.y, yaw: Math.PI, speed: 0 });
            dir.shot({ x: T.hut.x - 1.6, y: T.y + 3.1, z: T.hut.z + 3.4 }, { x: tank.x - 1.4, y: T.y + 0.9, z: tank.z + 0.6 }, { cut: true });
          }
        },
      },
      {
        id: 'corrida', dur: 2.4,
        enter() {
          dir.fade(0, 0.4);
          dir.walk('rhaenyra', [{ x: T.rha.x, z: T.rha.z }], { speed: 2.4 });
          dir.walk('radhija', [{ x: T.rad.x, z: T.rad.z }], { speed: 1.8 });
          dir.balloon('medo', { who: 'radhija', life: 1.2, size: 0.34 });
        },
        tick() {
          for (const n of ['radhija', 'rhaenyra']) { dir.actor(n).y = T.y; dir.actor(n).look = { x: tank.x, y: tank.y, z: tank.z }; }
        },
      },
      {
        id: 'quase', dur: 1.6,
        enter() { dir.bark('rhaenyra'); },
        tick(_, t) {
          const h = dir.actor('rhaenyra');
          // o pulo da Rhaenyra: quase alcança a cenoura, e o vento sul tira os pombos dali
          const u = span(t, 0.1, 0.7);
          h.airK = u > 0 && u < 1 ? u : -1;
          h.y = T.y + Math.sin(u * Math.PI) * 0.5;
          if (t > 0.3 && !S.go) { S.go = true; dir.sfx('asas', { x: tank.x, z: tank.z }); dir.sfx('vento', { x: tank.x, z: tank.z }); }
          if (S.go) {
            const k = span(t, 0.3, 1.6);
            flyPack(K, { x: tank.x + k * 0.6, y: tank.y + 0.3 + k * 1.2, z: tank.z - k * 2.2 }, Math.PI, t, { k: 0 });
          }
        },
      },
      {
        id: 'vento', dur: 3.4,
        enter() { dir.shot({ x: tank.x - 1.4, y: T.y + 1.6, z: tank.z + 3.2 }, { x: T.view.x, y: 6.5, z: T.view.z }, { inT: 1.4 }); },
        tick(_, t) {
          const k = span(t, 0, 3.4);
          flyPack(K, { x: tank.x + 0.6 - k * 4.0, y: tank.y + 1.5 + k * 2.2, z: tank.z - 2.2 - k * 9 }, Math.PI + 0.3, t + 2, { k: 0 });
          if (t > 1.9 && !S.clock) {
            S.clock = true;
            // ao longe, o relógio da Prefeitura parado (o ícone colado na torre)
            const ca = props.city.clockAt;
            dir.balloon('relogio', { at: { x: ca.x + 1.6, y: ca.y + 0.6, z: ca.z }, kind: 'solto', life: 1.4, size: 1.1 });
          }
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = { x: tank.x - 1.2, y: 4.5, z: tank.z - 6 };
        },
      },
      {
        id: 'olham', dur: 1.6,
        enter() {
          hideSquad(K);
          props.carrot.object.visible = false;
          dir.shot({ x: T.rad.x + 1.2, y: T.y + 1.3, z: T.rad.z + 1.9 }, { x: T.rad.x - 0.2, y: T.y + 0.4, z: T.rad.z - 0.2 }, { inT: 0.6 });
          dir.balloon('raiva', { who: 'radhija', life: 1.2, size: 0.36 });
        },
        tick() {
          const a = dir.actor('radhija'), h = dir.actor('rhaenyra');
          a.look = { x: h.x, y: T.y + 0.4, z: h.z };
          h.look = { x: a.x, y: T.y + 0.35, z: a.z };
        },
      },
      {
        id: 'desce', dur: 0.9, noSkip: true,
        enter() { dir.fade(1, 0.35); },
        tick(_, t) { if (t > 0.4 && !S.back) { S.back = true; downstairs(); } },
      },
    ],
    cleanup() { dir.cleanup({ snap: true }); dir.fade(0, 0.4); },
    commit() {
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

// ------------------------------------------------------------------------------------------------ o porteiro
export function createPorteiroScene(K) {
  const { L, dir, props, emit } = K;
  const G = L.GATE;
  const gx = (G.x0 + G.x1) / 2;
  const S = {};
  return createScene({
    id: 'porteiro',
    emit,
    setup() {
      dir.hold('radhija', 'rhaenyra');
      for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = { x: props.booth.windowAnchor.x, y: 1.2, z: props.booth.windowAnchor.z };
      K.snoring = false;
      props.booth.radio.setOn(false);
      dir.balloon('ex', { at: { ...props.booth.windowAnchor }, kind: 'solto', life: 1.0, size: 0.4 });
      dir.sfx('ronco-fim', { x: props.booth.windowAnchor.x, z: props.booth.windowAnchor.z });
    },
    beats: [
      { id: 'acorda', dur: 1.1 },
      {
        id: 'botina', dur: 1.6,
        enter() {
          dir.shot({ x: gx - 1.1, y: 0.34, z: G.z + 2.1 }, { x: gx + 0.1, y: 0.55, z: G.z + 0.1 }, { cut: true });
          const p = props.humans.porteiro;
          p.object.visible = true;
          p.object.position.set(L.BOOTH.x1 + 0.25, 0, L.BOOTH.z0 + 0.5);
          p.object.rotation.y = Math.PI * 0.85;
          p.hand.userData.grip(0);
          p.arm.rotation.x = 0;
        },
        tick(_, t) {
          const p = props.humans.porteiro;
          const u = span(t, 0, 1.5);
          // do lado da guarita até o lado do trinco, fora do arco da folha (ela abre para dentro)
          p.object.position.x = lerp(L.BOOTH.x1 + 0.25, G.x1 + 0.35, u);
          p.object.position.z = lerp(L.BOOTH.z0 + 0.5, G.z + 0.45, u);
          p.object.rotation.y = lerp(Math.PI * 0.6, -2.38, smooth(span(t, 0.9, 1.5)));
          const step = Math.sin(u * Math.PI * 4);
          p.legs.left.position.z = step * 0.12;
          p.legs.right.position.z = -step * 0.12;
          if (Math.abs(step) > 0.95 && !S.st) { S.st = true; dir.sfx('botina', { x: p.object.position.x, z: p.object.position.z }); }
          if (Math.abs(step) < 0.5) S.st = false;
        },
      },
      {
        id: 'trinco', dur: 1.2,
        tick(_, t) {
          const p = props.humans.porteiro;
          p.arm.rotation.x = -0.9 * smooth(span(t, 0, 0.7));
          p.hand.userData.grip(span(t, 0.6, 0.9));
          if (t > 0.8 && !S.click) { S.click = true; dir.sfx('trinco', { x: gx, z: G.z }); }
        },
      },
      {
        id: 'abre', dur: 1.5,
        enter() { dir.sfx('portao', { x: gx, z: G.z }); },
        tick(_, t) { props.gateLeaf.setOpen(smooth(span(t, 0, 1.4))); },
      },
      {
        id: 'sai', dur: 1.3,
        tick(_, t) {
          const p = props.humans.porteiro;
          p.arm.rotation.x = -0.9 * (1 - smooth(span(t, 0, 0.5)));
          p.hand.userData.grip(1 - span(t, 0, 0.3));
          const u = span(t, 0.3, 1.3);
          p.object.position.x = lerp(G.x1 + 0.35, G.x1 + 0.9, u);
          p.object.position.z = lerp(G.z + 0.45, G.z + 1.6, u);
          p.object.rotation.y = 0.4;
          if (u >= 1) p.object.visible = false;
        },
        leave() { dir.balloon('seta', { who: 'radhija', life: 1.2, size: 0.36 }); },
      },
    ],
    cleanup() {
      props.humans.porteiro.object.visible = false;
      dir.cleanup();
    },
    commit() {
      props.gateLeaf.setOpen(1);
      K.gateOpened();
      props.booth.radio.setOn(true);
      K.setStage('fechamento');
    },
  });
}

// ------------------------------------------------------------------------------------------------ o fechamento
export function createClosingScene(K) {
  const { L, dir, props, emit } = K;
  const G = L.GATE, St = L.STREET;
  const gx = (G.x0 + G.x1) / 2;
  const walkOut = { rad: { x: gx - 0.25, z: St.sidewalk + 0.1 }, rha: { x: gx + 0.35, z: St.sidewalk + 0.3 } };
  const S = {};
  return createScene({
    id: 'fechamento',
    emit,
    setup() {
      dir.hold('radhija', 'rhaenyra');
      // o vão do portãozinho tem 1 m: as duas saem em fila, pelo meio (lado a lado, uma encostaria no muro)
      dir.pose('radhija', { x: gx, z: G.z + 0.7, yaw: Math.PI, speed: 0 });
      dir.pose('rhaenyra', { x: gx + 0.05, z: G.z + 1.45, yaw: Math.PI, speed: 0 });
      dir.walk('radhija', [{ x: gx, z: G.z - 0.5 }, walkOut.rad], { speed: 1.9 });
      dir.walk('rhaenyra', [{ x: gx + 0.05, z: G.z - 0.45 }, walkOut.rha], { speed: 1.9 });
      dir.shot({ x: gx - 0.9, y: 1.5, z: G.z + 2.2 }, { x: gx + 1.0, y: 1.6, z: St.z1 - 6 }, { cut: true });
      K.butterfly.visible = false;
    },
    beats: [
      { id: 'saem', dur: 1.8 },
      {
        id: 'pombos', dur: 2.6,
        enter() { dir.shot({ x: gx - 0.7, y: 1.2, z: St.sidewalk + 2.6 }, { x: 14.5, y: 4.5, z: -24 }, { inT: 1.0 }); },
        tick(_, t) {
          const k = span(t, 0, 2.6);
          flyPack(K, { x: lerp(12.5, 15.5, k), y: 6.2 + Math.sin(t * 2) * 0.2, z: lerp(-21, -25, k) }, 0.6, t, { k: 0 });
          if (t > 0.8 && !S.point) {
            S.point = true;
            dir.balloon('seta', { who: 'radhija', life: 1.6, size: 0.36 });
            dir.balloon('cenoura', { who: 'radhija', life: 1.6, size: 0.3, up: 0.72 });
          }
          dir.actor('radhija').press = t > 0.8 && t < 2.2 ? { x: walkOut.rad.x, y: 0.42, z: walkOut.rad.z - 0.35, k: Math.sin(span(t, 0.8, 2.2) * Math.PI) } : null;
          for (const n of ['radhija', 'rhaenyra']) dir.actor(n).look = { x: 14.5, y: 5, z: -24 };
        },
      },
      {
        id: 'borboleta', dur: 2.2,
        enter() {
          hideSquad(K);
          props.carrot.object.visible = false;
          K.butterfly.visible = true;
          dir.walk('rhaenyra', [{ x: gx + 2.6, z: St.sidewalk - 0.2 }], { speed: 1.4 });
          dir.shot({ x: gx + 0.4, y: 1.3, z: St.sidewalk + 2.4 }, { x: gx + 1.4, y: 0.6, z: St.sidewalk - 0.2 }, { inT: 0.8 });
        },
        tick(_, t) {
          const h = dir.actor('rhaenyra');
          K.butterfly.position.set(h.x + 0.5 + Math.sin(t * 3) * 0.15, 0.62 + Math.sin(t * 7) * 0.08, h.z - 0.1 + Math.cos(t * 3) * 0.15);
          K.butterflyFlap = t;
          h.look = { x: K.butterfly.position.x, y: K.butterfly.position.y, z: K.butterfly.position.z };
        },
      },
      {
        id: 'raiva', dur: 1.3,
        enter() { dir.balloon('raiva', { who: 'radhija', life: 1.1, size: 0.4 }); dir.bark('radhija'); },
        tick(_, t) { if (t > 0.45 && !S.b2) { S.b2 = true; dir.bark('radhija'); } },
      },
      {
        id: 'volta', dur: 2.2,
        enter() {
          K.butterfly.visible = false;
          dir.walk('rhaenyra', [{ x: gx + 0.6, z: St.sidewalk - 0.6 }, { x: gx + 0.2, z: St.z1 + 0.6 }], { speed: 3.0 });
          dir.walk('radhija', [{ x: gx - 0.1, z: St.z1 + 0.9 }], { speed: 2.2 });
          dir.shot({ x: gx - 0.6, y: 1.9, z: St.sidewalk + 2.6 }, { x: gx + 0.2, y: 0.6, z: St.z1 }, { inT: 0.8 });
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
      K.placeAt({ x: 12.6, z: -6.7, yaw: Math.PI }, { x: 13.2, z: -6.3, yaw: Math.PI });
      K.setStage('mural');
    },
  });
}
