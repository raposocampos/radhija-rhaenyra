// MODO HISTÓRIA · Capítulo 1 — os puzzles do QUINTAL MAIOR (4ª rodada, pedido do usuário em 2026-11-11: "coloque mais
// puzzles espalhados pelo quintal, lado de fora; aumente o quintal após sair de casa"; ele escolheu os quatro). O cenário
// é de world/quintal.js; as coordenadas, de layout.js; as cenas, de scenesQuintal.js. Da porta dos fundos para o norte:
//   1. O JABUTI (obrigatório): o Seu Bento cochila na passagem estreita da horta do meio. Só sai com uma folha de
//      alface, que as duas pegam JUNTAS no canteiro do fundo: a Rhaenyra segura o pé (Fica perto dele) e a Radhija morde
//      a folha de fora e puxa (createMouthTug, o mesmo do ferrolho). Sozinha, a alface inteira estica e escapa. Com a
//      folha na boca, a Radhija entrega (E, cena 'quintalJabuti'); ele anda devagar até o cantinho e come lá;
//   2. A IRRIGAÇÃO AUTOMÁTICA (obrigatória): três aspersores no gramadinho entre os canteiros de flores, que ligam um
//      depois do outro, do norte para o sul (a onda vem de frente para quem chega do sul). A Radhija não passa por
//      aspersor ligado (o jato só barra a pequena; ligando com ela dentro, ela leva o banho e pula para trás). A
//      Rhaenyra senta (Fica) em cima de um e tampa: só tampando o do MEIO dá para atravessar, no tempo certo de cada
//      um. Do outro lado, a Radhija fecha o registro (E) e a irrigação desliga para as duas;
//   3. A PIPA (opcional): a Rhaenyra empurra a goiabeira em pé (Shift / R1, de qualquer lado) e, no terceiro empurrão, a
//      pipa cai bailando; na rabiola, penas e um anel de borracha (cena 'quintalPipa': a pista 'rabiola', extra da
//      pergunta "Por que os pombos pegam coisas de borracha?");
//   4. A MANGUEIRA E O BALDE (opcional): a Radhija morde o laço da mangueira enroscado na alavanca da torneira
//      temporizada e puxa: a torneira abre por uns segundos e o baldão enche; a bolinha de meia da Rhaenyra boia até a
//      borda e dá para pegar (cena 'quintalBolinha': a 4ª meia do capítulo).
// Depois disso, o final de antes (puzzle.js): o galho, a passagem baixa e a argola do ferrolho.
// Integração no puzzle.js (como o rooftop.js): createQuintal(K, { world, root, emit, effects, ctx, props, dir, hints, tug,
// dogs }) → { update, interact, objective, lead, prompt, lookTarget, modifyIntent, shoveSpots, onShove, onBark,
// navFlags, info, snapshot, reset, skipAll, anchorOf, … e o que as cenas usam }.
// Tudo o que fica de permanente sai dos commits das cenas (pular ou assistir dá no mesmo).
import { createShoveTarget } from '../../../game/mechanics/shoveTarget.js';
import { SCENT } from '../../faro/faro.js';

/** Os ids das cenas do quintal (registradas no puzzle: createQuintalScenes, scenesQuintal.js). */
export const YARD_SCENES = Object.freeze({ chega: 'quintalChega', jabuti: 'quintalJabuti', pipa: 'quintalPipa', bolinha: 'quintalBolinha' });
/** Quanto tempo a torneira temporizada fica aberta (s). */
export const TAP_OPEN = 3.8;
/** Os objetivos curtos do quintal (o HUD). */
export const YARD_TEXTS = {
  jabuti: 'Um jabuti dorme na passagem da horta',
  alface: 'O Seu Bento quer alface: peguem uma folha na horta',
  entregar: 'Levem a folha de alface para o Seu Bento',
  andando: 'O Seu Bento está saindo… devagarinho',
  irrigacao: 'Os aspersores ligam um depois do outro: a Radhija não passa molhada',
  registro: 'Fechem o registro da irrigação',
};
const HINTS = {
  jabuti: 'O jabuti não sai por nada… só com comida. Ele gosta de alface!',
  alface: 'A alface escapa! A Rhaenyra segura o pé (Fica: F, perto dele) e a Radhija morde e puxa a folha (E).',
  entregar: 'Com a folha na boca, a Radhija entrega para o Seu Bento (E).',
  morder: 'A Rhaenyra é desajeitada com a boca: a Radhija morde e puxa.',
  irrigacao: 'A Radhija não passa por aspersor ligado. A Rhaenyra pode sentar em cima de um (Fica: F) e tampar!',
  meio: 'Tampe o aspersor do MEIO com a Rhaenyra: a Radhija espera ao lado dela e passa pelos outros quando desligam.',
  registro: 'O registro fica na caixinha do chão: só o focinho da Radhija cabe lá (E).',
  pipa: 'Tem uma pipa presa na goiabeira: a Rhaenyra empurra o tronco em pé (segure Shift / R1).',
  mangueira: 'A mangueira está enroscada na alavanca da torneira: a Radhija puxa com a boca (E).',
  empurraJabuti: 'Empurrar o Seu Bento não adianta: ele é pesado… e não gosta.',
};
const NAMES = ['radhija', 'rhaenyra'];
const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * @param {any} K o contexto das cenas do puzzle (dir, props, L, S, book, deduction, faro, placeAt, setStage, …)
 * @param {{ world: any, root?: any, emit: any, effects: any, ctx: any, props: any, dir: any, hints: any, tug: any,
 *   dogs?: Record<string, any> }} o
 */
export function createQuintal(K, { world, emit, effects, ctx, props, dir, hints, tug, dogs = {} }) {
  const L = K.L;
  const P = () => props.quintal || null;
  const R = (n) => ctx.ctrls?.[n] ?? K.ctx?.ctrls?.[n];
  const SP = L.SPRINKLERS, JB = L.JABUTI, LT = L.LETTUCE, HS = L.HOSE, BK = L.BUCKET, GV = L.GUAVA, VV = L.VALVE, HR = L.HORTA_ROW;
  const PERIOD = SP.step * SP.heads.length;

  // ---------------------------------------------------------------- colisores dinâmicos: o jabuti e os jatos
  const jabCol = world.addDynamic({ id: 'jabuti', kind: 'static', shape: 'circle', x: JB.x, z: JB.z, r: JB.r });
  const jetCols = SP.heads.map((hd) => world.addDynamic({ id: `aspersor-${hd.id}`, kind: 'static', shape: 'circle', x: hd.x, z: hd.z, r: SP.r, blocks: 'small', enabled: false }));
  const JET_IDS = new Set(jetCols.map((c) => c.id));

  // ---------------------------------------------------------------- a goiabeira (empurrão em pé, de qualquer lado)
  const guavaSway = { dx: 1, dz: 0 };
  const shoveTree = createShoveTarget({
    id: 'goiabeira', cfg: { x: GV.x - GV.r - 0.03, z: GV.z, nx: -1, nz: 0, y: 0.55, w: 0, over: 0, kind: 'tree', pushes: GV.pushes }, emit, world,
    prop: /** @type {any} */ ({ setSway: (a) => P()?.guava?.setSway?.(Math.max(-0.22, Math.min(0.22, a)), guavaSway.dx, guavaSway.dz) }),
  });
  /** As quatro faces do tronco: a Rhaenyra empurra de onde estiver (cada uma é um spot do empurrão em pé). */
  const treeSpots = [[-1, 0, 'o'], [1, 0, 'l'], [0, -1, 'n'], [0, 1, 's']].map(([nx, nz, k]) => ({
    id: `goiabeira-${k}`, x: GV.x + nx * (GV.r + 0.03), z: GV.z + nz * (GV.r + 0.03), nx, nz, y: 0.55, w: 0, over: 0, kind: 'tree',
    look: { x: GV.kite.x, y: GV.kite.y, z: GV.kite.z },
  }));

  // ---------------------------------------------------------------- o estado
  /** @type {any} */
  let Y = null;
  const fresh = () => ({
    time: 0, introSeen: false, introWait: 0, metJabuti: false, leaf: 'pe', tugWhat: null, slip: -1,
    jabuti: 'cochila', jabT: 0, jabWait: 0, jabutiMoved: false, wakeT: 0, eatT: 0,
    irrT: 0, irrigationOff: false, offT: -1, plugged: null, snapFor: null, wet: 0, wetCd: 0, lastDry: null, rhaWetCd: 4,
    shoves: 0, kite: 'arvore', kiteSeen: false, tapT: -1, level: 0, full: false, toyTaken: false,
    sayCd: 0, zone: null, rattleCd: 0, eatSfx: 0, sfxCd: {}, lastActive: null, talkI: 0, bentoTalk: 0, leverK: 0, kiteAt: null,
  });

  // ---------------------------------------------------------------- utilidades
  function say(who, text, force = false, cd = 2.4) {
    if (!force && Y.sayCd > 0) return;
    Y.sayCd = cd;
    dir?.say?.(who, text, { mode: 'jogo' });
  }
  /** Pede uma cena ao puzzle (a fila S.pending: começa no próximo quadro sem exame). */
  function play(id) {
    if (K.startScene) K.startScene(id);
    else if (K.S) K.S.pending = K.S.pending || id;
  }
  /** Avisa o HUD que o objetivo mudou (o puzzle refaz o texto pelo objective() dele: K.refreshObjective). */
  const refresh = () => K.refreshObjective?.();
  /** A dog está na parte do quintal destes puzzles (do registro, logo ao norte do jardim, para o sul; dentro ou fora da casa)? */
  const inYardSouth = (c) => !!c && c.z > SP.lane.z0 - 1.5;
  const jab = () => P()?.jabuti || null;

  // ---------------------------------------------------------------- a irrigação: o programa, o tampão e o banho
  /** O tempo do programa de um aspersor: on (jorrando), pre (subindo, gorgolejando). */
  function headState(i, t) {
    const id = SP.heads[i].id;
    const k = SP.order.indexOf(id);
    const u = (((t - k * SP.step) % PERIOD) + PERIOD) % PERIOD;
    const on = u < SP.on;
    const pre = !on && u > PERIOD - SP.pre;
    return { on, pre, u };
  }
  /** Quais estão jorrando agora (ligados, sem tampão), para quem fica perto. */
  const spraying = (i) => !Y.irrigationOff && headState(i, Y.irrT).on && Y.plugged !== SP.heads[i].id;
  /** Dentro do jato do aspersor i (o círculo da dog encosta no do jato)? */
  const inJet = (c, i) => Math.hypot(c.x - SP.heads[i].x, c.z - SP.heads[i].z) < SP.r + c.r;
  /** Um ponto seco e livre para onde ela pula depois do banho: ao longo do gramadinho, de preferência para trás. */
  function dryExit(c, prefer) {
    const dirs = prefer ? [prefer, -prefer] : [1, -1];
    for (const s of dirs) {
      for (let d = 0.1; d <= 4.5; d += 0.05) {
        const x = c.x, z = c.z + s * d;
        if (SP.heads.some((_, i) => (spraying(i) || headState(i, Y.irrT + 0.6).on && Y.plugged !== SP.heads[i].id) && Math.hypot(x - SP.heads[i].x, z - SP.heads[i].z) < SP.r + c.r + 0.06)) continue;
        if (world.overlaps(x, z, c.r, c.size, { ignore: JET_IDS })) continue;
        return { x, z };
      }
    }
    return Y.lastDry || { x: c.x, z: c.z };
  }
  function soak(c) {
    const prefer = Y.lastDry ? Math.sign(Y.lastDry.z - c.z) || 1 : 1;
    const p = dryExit(c, prefer);
    const dist = Math.hypot(p.x - c.x, p.z - c.z);
    const dur = Math.max(0.3, Math.min(0.8, dist / 4));
    effects.pushTo(c, p.x, p.z, { dur, action: 'startled', face: { x: c.x, z: c.z - prefer }, then: { action: 'shake', dur: 0.85 } });
    effects.setWet(c.name, 1, 1.8);
    Y.wet++;
    Y.wetCd = dur + 1.0;
    emit('story:sfx', { name: 'yuck', x: c.x, z: c.z });
    emit('story:wet', { name: c.name, x: c.x, z: c.z, count: Y.wet });
    dir?.onomato?.('SPLASH!', { at: { x: c.x, y: 0.7, z: c.z }, size: 0.7, color: '#8fd3ff', rot: -6 });
    const lines = ['Eca! Molhou tudo!', 'Água NÃO! Eu acabei de secar!', 'Brrr! De novo, não!'];
    say('radhija', lines[(Y.wet - 1) % lines.length], true);
    if (Y.wet >= 2 && !Y.plugged) hints.now(HINTS.irrigacao, 5, 10);
    if (Y.wet >= 3) hints.now(HINTS.meio, 6, 14);
  }
  function stepIrrigation(dt, playing) {
    const q = P()?.sprinklers;
    if (Y.irrigationOff) {
      // desligando: as cabeças descem devagar
      if (Y.offT >= 0) {
        Y.offT += dt;
        const k = clamp01(1 - Y.offT / 0.8);
        SP.heads.forEach((hd) => q?.set?.(hd.id, { up: k, spray: 0, plugged: false }));
        if (Y.offT > 0.8) Y.offT = -1;
      }
      return;
    }
    Y.irrT += dt;
    // o tampão: a Rhaenyra no Fica em cima de uma cabeça (de perto, ela se ajeita em cima dela)
    const rha = R('rhaenyra');
    let plug = null;
    if (rha && ctx.isStaying?.('rhaenyra') && (rha.y || 0) < 0.1) {
      for (const hd of SP.heads) {
        const d = Math.hypot(rha.x - hd.x, rha.z - hd.z);
        if (d <= SP.plugR) { plug = hd.id; break; }
        if (d <= 0.7 && Y.snapFor !== hd.id && !effects.busy?.('rhaenyra')) {
          Y.snapFor = hd.id;
          effects.pushTo(rha, hd.x, hd.z, { dur: 0.3, action: 'none', face: { x: hd.x, z: hd.z - 1 } });
        }
      }
    } else Y.snapFor = null;
    if (plug !== Y.plugged) {
      const was = Y.plugged;
      Y.plugged = plug;
      if (plug) {
        emit('story:sfx', { name: 'waterOff', x: rha.x, z: rha.z, volume: 0.7 });
        dir?.onomato?.('TAMPEI!', { at: { x: rha.x, y: 0.75, z: rha.z }, size: 0.75, color: '#ffd23f', rot: 6 });
        say('rhaenyra', plug === 'meio' ? 'Sentei no do meio! Hihi, faz cócegas!' : 'Sentei nele! Tá tampado!', true);
        emit('story:plug', { id: plug });
      } else if (was) emit('story:plug', { id: null });
      refresh();
    }
    // o desenho e os colisores de cada um
    SP.heads.forEach((hd, i) => {
      const st = headState(i, Y.irrT);
      const plugged = Y.plugged === hd.id;
      const up = st.on ? 1 : st.pre ? clamp01((st.u - (PERIOD - SP.pre)) / SP.pre) : clamp01(1 - (st.u - SP.on) / 0.35);
      q?.set?.(hd.id, { up, spray: st.on ? Math.min(1, (st.u + 0.001) / 0.15) * (st.u > SP.on - 0.2 ? clamp01((SP.on - st.u) / 0.2) : 1) : 0, plugged });
      q?.setLit?.(hd.id, st.on);
      const col = jetCols[i];
      const want = st.on && !plugged;
      // com a Radhija dentro, o colisor espera ela sair (o banho a tira de lá)
      const rad = R('radhija');
      col.enabled = want && !(rad && inJet(rad, i));
      // o som de ligar, perto de quem joga
      if (st.on && st.u < 0.05 && playing) {
        const a = R(ctx.activeDog);
        const d = a ? Math.hypot(a.x - hd.x, a.z - hd.z) : 99;
        if (d < 9 && !(Y.sfxCd[hd.id] > 0)) { Y.sfxCd[hd.id] = 0.5; emit('story:sfx', { name: 'waterStart', x: hd.x, z: hd.z, volume: Math.max(0.15, 0.7 * (1 - d / 9)) }); }
      }
      if (Y.sfxCd[hd.id] > 0) Y.sfxCd[hd.id] -= dt;
    });
    if (!playing) return;
    // o banho da Radhija (ativa ou não): dentro de um jato que jorra
    const rad = R('radhija');
    if (rad && (rad.y || 0) < 0.3) {
      const wetNow = SP.heads.some((_, i) => spraying(i) && inJet(rad, i));
      if (!wetNow && !effects.busy?.('radhija')) Y.lastDry = { x: rad.x, z: rad.z };
      Y.wetCd = Math.max(0, Y.wetCd - dt);
      if (wetNow && Y.wetCd <= 0 && !effects.busy?.('radhija')) soak(rad);
    }
    // a Rhaenyra adora: molha e comemora (de vez em quando)
    Y.rhaWetCd = Math.max(0, Y.rhaWetCd - dt);
    if (rha && SP.heads.some((_, i) => spraying(i) && inJet(rha, i))) {
      effects.setWet('rhaenyra', 1, 2.2);
      if (Y.rhaWetCd <= 0) {
        Y.rhaWetCd = 9;
        say('rhaenyra', Y.plugged ? 'Chuveirinho!' : 'Iupi! Chuveirinho! Vem, Radhija!', false, 2.0);
      }
    }
    // a dica: a Radhija parada na frente do jardim com tudo ligado
    if (rad && ctx.activeDog === 'radhija' && rad.z > SP.lane.z1 - 0.2 && rad.z < HR.z0 && Math.abs(rad.x - SP.heads[0].x) < 1.2 && !Y.plugged) hints.cond?.(HINTS.irrigacao, 5, 18);
  }
  function closeValve(c) {
    if (Y.irrigationOff) return;
    Y.irrigationOff = true;
    Y.offT = 0;
    for (const col of jetCols) col.enabled = false;
    SP.heads.forEach((hd) => P()?.sprinklers?.setLit?.(hd.id, false));
    P()?.valve?.setClosed?.(1);
    effects.act(c.name, 'none', 0.7, { x: VV.x, z: VV.z });
    emit('story:sfx', { name: 'valve', x: VV.x, z: VV.z });
    emit('story:sfx', { name: 'waterStop', x: SP.heads[1].x, z: SP.heads[1].z, volume: 0.7 });
    dir?.onomato?.('CLEC!', { at: { x: VV.x, y: 0.6, z: VV.z }, size: 0.8, color: '#ffd23f', rot: -8 });
    say('radhija', 'Pronto: irrigação desligada. Pode levantar, Rhaenyra!', true);
    // quem estava tampando levanta sozinha e vem atrás
    if (ctx.isStaying?.('rhaenyra')) ctx.setStay?.('rhaenyra', false);
    Y.plugged = null;
    emit('story:irrigation', { off: true });
    refresh();
  }

  // ---------------------------------------------------------------- a alface (as duas juntas)
  /** A Rhaenyra segurando o pé (no Fica, perto dele)? */
  const holdingLettuce = () => { const h = R('rhaenyra'); return !!h && ctx.isStaying?.('rhaenyra') && near(h, LT, LT.holdR); };
  function stepLettuce(dt) {
    if (Y.slip >= 0) {
      // a alface volta para o lugar, balançando
      Y.slip += dt;
      const k = Math.max(0, 1 - Y.slip / 0.35) * Math.cos(Y.slip * 18);
      P()?.lettuce?.setPull?.(Math.abs(k) * 0.8, 0, -1);
      if (Y.slip > 0.6) { Y.slip = -1; P()?.lettuce?.setPull?.(0); }
    }
    if (Y.tugWhat !== 'alface') return;
    if (!tug.busy?.()) { Y.tugWhat = null; P()?.lettuce?.setPull?.(0); return; }
    if (!tug.holding?.()) return;
    const pulled = tug.pulled?.() ?? 0;
    const c = R('radhija');
    const dx = c ? c.x - LT.x : 0, dz = c ? c.z - LT.z : -1, dl = Math.hypot(dx, dz) || 1;
    P()?.lettuce?.setPull?.(Math.min(1, pulled / LT.pull), dx / dl, dz / dl);
    if (pulled < LT.pull) return;
    tug.release?.();
    Y.tugWhat = null;
    if (holdingLettuce()) {
      // a folha solta: vai na boca da Radhija
      Y.leaf = 'boca';
      P()?.lettuce?.setTorn?.(true);
      P()?.lettuce?.setPull?.(0);
      const leaf = P()?.lettuce?.leaf;
      const sock = dogs.radhija?.mouthSocket;
      if (leaf && sock) {
        sock.add(leaf);
        leaf.position.set(0, 0, 0);
        leaf.rotation.set(0, 0, 0);
        leaf.scale.setScalar(1);
        leaf.visible = true;
      }
      emit('story:sfx', { name: 'pluck', x: LT.x, z: LT.z });
      dir?.onomato?.('CREC!', { at: { x: LT.x, y: 0.6, z: LT.z }, size: 0.8, color: '#9be07a', rot: -6 });
      say('rhaenyra', 'Consegui segurar! Agora leva pro Seu Bento!', true);
      emit('story:leaf', { state: 'boca' });
      hints.now(HINTS.entregar, 4, 8);
      refresh();
    } else {
      // sem a irmã segurando, a alface inteira vem junto e volta: TOIM!
      Y.slip = 0;
      emit('story:sfx', { name: 'leafRustle', x: LT.x, z: LT.z });
      dir?.onomato?.('TOIM!', { at: { x: LT.x, y: 0.55, z: LT.z }, size: 0.8, color: '#9be07a', rot: 8, style: 'shake' });
      say('radhija', 'A alface inteira vem junto! Rhaenyra, segura o pé!', true);
      hints.now(HINTS.alface, 5.5, 8);
    }
  }

  // ---------------------------------------------------------------- o jabuti
  const _bz = { x: 0, z: 0 };
  /** O caminho dele (uma curva só: sai da passagem para o sul e vira para o leste), t 0..1. */
  function jabutiAt(t, out = _bz) {
    const a = { x: JB.x, z: JB.z }, b = { x: JB.path[0].x, z: JB.path[0].z + 0.14 }, c = JB.path[1];
    const u = 1 - t;
    out.x = u * u * a.x + 2 * u * t * b.x + t * t * c.x;
    out.z = u * u * a.z + 2 * u * t * b.z + t * t * c.z;
    return out;
  }
  /** O comprimento da curva (para andar a velocidade constante). */
  const PATH_LEN = (() => { let len = 0; const p = { x: JB.x, z: JB.z }, q = { x: 0, z: 0 }; for (let i = 1; i <= 40; i++) { jabutiAt(i / 40, q); len += Math.hypot(q.x - p.x, q.z - p.z); p.x = q.x; p.z = q.z; } return len; })();
  function placeJabuti(t) {
    const j = jab();
    const p = jabutiAt(t, { x: 0, z: 0 });
    const q = jabutiAt(Math.min(1, t + 0.02), { x: 0, z: 0 });
    jabCol.x = p.x;
    jabCol.z = p.z;
    if (j) {
      j.object.position.set(p.x, 0, p.z);
      if (Math.hypot(q.x - p.x, q.z - p.z) > 1e-4) j.object.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      if (t >= 1) j.object.rotation.y = JB.eat.yaw;
    }
  }
  function stepJabuti(dt) {
    const j = jab();
    if (Y.jabuti === 'anda') {
      // devagar pela curva; para quando alguém está na frente (ele nunca passa por cima de ninguém)
      const step = (JB.speed * dt) / PATH_LEN;
      const t1 = Math.min(1, Y.jabT + step);
      const p = jabutiAt(t1, { x: 0, z: 0 });
      const blockedBy = NAMES.find((n) => { const c = R(n); return c && Math.hypot(c.x - p.x, c.z - p.z) < c.r + JB.r + 0.04; });
      if (blockedBy) {
        Y.jabWait += dt;
        if (Y.jabWait > 1.2 && Y.sayCd <= 0) say('bento', 'Com… li…cen…ça…', true, 4);
        j?.setState?.('acordado');
      } else {
        Y.jabWait = 0;
        Y.jabT = t1;
        j?.setState?.('anda');
        placeJabuti(Y.jabT);
      }
      if (!Y.jabutiMoved && jabutiAt(Y.jabT, { x: 0, z: 0 }).x >= JB.freeX) {
        Y.jabutiMoved = true;
        emit('story:jabuti', { moved: true });
        refresh();
      }
      if (Y.jabT >= 1) {
        Y.jabuti = 'come';
        Y.eatT = 0;
        j?.setState?.('come');
        placeJabuti(1);
      }
    } else if (Y.jabuti === 'come') {
      // come a folha aos pouquinhos (ela encolhe a cada mordida)
      Y.eatT += dt;
      const size = Math.max(0, 1 - Y.eatT / 14);
      P()?.lettuce?.putLeaf?.(JB.leaf.x, JB.leaf.z, size);
      Y.eatSfx -= dt;
      if (Y.eatSfx <= 0) {
        Y.eatSfx = 1.6;
        const a = R(ctx.activeDog);
        if (a && near(a, JB.eat, 6)) emit('story:sfx', { name: 'extraCrunch', x: JB.eat.x, z: JB.eat.z, volume: 0.45 });
      }
      if (size <= 0) { Y.jabuti = 'fim'; j?.setState?.('cochila'); }
    } else if (Y.jabuti === 'cochila' || Y.jabuti === 'acordado' || Y.jabuti === 'fim') {
      // acorda quando alguém chega perto e olha para quem está mais perto; sem ninguém, volta a cochilar
      let best = null, bd = Infinity;
      for (const n of NAMES) { const c = R(n); if (!c) continue; const d = Math.hypot(c.x - jabCol.x, c.z - jabCol.z); if (d < bd) { bd = d; best = c; } }
      if (j && j.state !== 'esconde') {
        if (bd < 1.6) { Y.wakeT = 6; if (j.state === 'cochila') j.setState('acordado'); }
        else if ((Y.wakeT -= dt) <= 0 && j.state === 'acordado') j.setState('cochila');
        j.lookAt(best && bd < 3 ? { x: best.x, y: 0.35, z: best.z } : null);
      }
      if (Y.jabuti !== 'fim' && !Y.metJabuti && bd < 1.4) { Y.metJabuti = true; refresh(); }
    }
    j?.say?.(K.S?.scene?.active ? false : Y.bentoTalk > 0);
    if (Y.bentoTalk > 0) Y.bentoTalk -= dt;
  }
  function talkJabuti(c) {
    if (Y.rattleCd > 0) return;
    Y.rattleCd = 4.4;
    Y.metJabuti = true;
    Y.bentoTalk = 3.4;
    jab()?.setState?.('acordado');
    const lines = c.name === 'radhija'
      ? [['bento', 'Bom… dia… mo…ci…nhas…'], ['radhija', 'Com licença, Seu Jabuti! A gente precisa passar!'], ['bento', 'Tô… com… fo…me…']]
      : [['rhaenyra', 'Oi! Você é uma pedra que anda?'], ['bento', 'Hmmm… al…fa…ce…'], ['rhaenyra', 'Radhija! Ele quer alface!']];
    const i = Y.talkI++ % lines.length;
    say(lines[i][0], lines[i][1], true, 2.6);
    if (i === 2 || Y.talkI > 2) hints.now(HINTS.jabuti, 4.6, 8);
    refresh();
  }

  // ---------------------------------------------------------------- a mangueira e o balde
  function stepHose(dt) {
    const q = P();
    if (Y.tugWhat === 'mangueira') {
      if (!tug.busy?.()) Y.tugWhat = null;
      else if (tug.holding?.()) {
        const pulled = tug.pulled?.() ?? 0;
        q?.hose?.setOpen?.(Math.min(1, pulled / HS.pull));
        if (pulled >= HS.pull) {
          // a torneira temporizada abriu: a água corre por um tempo e a mola fecha sozinha
          tug.release?.();
          Y.tugWhat = null;
          Y.tapT = TAP_OPEN;
          emit('story:sfx', { name: 'waterGush', x: BK.x, z: BK.z });
          dir?.onomato?.('SHHHH!', { at: { x: BK.x, y: 0.9, z: BK.z }, size: 0.8, color: '#8fd3ff', rot: -4 });
          say('radhija', 'Abriu! Enche, baldão, enche!', true);
        }
      }
    }
    if (Y.tapT > 0) {
      Y.tapT -= dt;
      if (!Y.full) {
        Y.level = Math.min(1, Y.level + dt / HS.fill);
        q?.bucket?.setLevel?.(Y.level);
        if (Y.level >= 1) {
          Y.full = true;
          emit('story:sfx', { name: 'waterFull', x: BK.x, z: BK.z });
          dir?.onomato?.('PLOC!', { at: { x: BK.x, y: 0.85, z: BK.z }, size: 0.8, color: '#cfe04a', rot: 6 });
          say('rhaenyra', 'A bolinha subiu! É a MINHA bolinha!', true);
          emit('story:bucket', { full: true });
          refresh();
        }
      }
      q?.bucket?.setFlow?.(true);
      q?.hose?.setOpen?.(1);
      if (Y.tapT <= 0) {
        Y.tapT = -1;
        emit('story:sfx', { name: 'waterStop', x: BK.x, z: BK.z, volume: 0.6 });
        if (!Y.full) say('radhija', 'Fechou sozinha! Mais um puxão…', true);
      }
    } else if (Y.tugWhat !== 'mangueira') {
      q?.bucket?.setFlow?.(false);
      // a mola volta a alavanca
      Y.leverK = Math.max(0, (Y.leverK ?? 0) - dt * 3);
      q?.hose?.setOpen?.(Y.leverK);
    }
    if (Y.tapT > 0 || Y.tugWhat === 'mangueira') Y.leverK = 1;
    // a meia amarrada na bolinha aparece na borda com o balde cheio
    const sock = props.socks?.find?.((s) => s.id === 'balde');
    if (sock && !Y.toyTaken) sock.object.visible = Y.full;
  }
  /** A bolinha de meia: pega (a meia do balde conta; a bolinha some). */
  function takeToy() {
    if (Y.toyTaken) return;
    Y.toyTaken = true;
    const sock = props.socks?.find?.((s) => s.id === 'balde');
    const S = K.S;
    if (S?.socks && !S.socks.has('balde')) {
      S.socks.add('balde');
      sock?.collect?.();
      const def = L.SOCKS.find((s) => s.id === 'balde');
      emit('story:sock', { id: 'balde', count: S.socks.size, total: L.SOCKS.length, x: def?.x, y: def?.y, z: def?.z });
    }
    const ball = P()?.bucket?.ball;
    if (ball) ball.visible = false;
    emit('story:sfx', { name: 'pickupBall', x: BK.x, z: BK.z });
  }

  // ---------------------------------------------------------------- a pipa
  function dropKite(c) {
    const k = P()?.kite;
    const free = L.KITE.land.find((p) => NAMES.every((n) => { const d = R(n); return !d || Math.hypot(d.x - p.x, d.z - p.z) > d.r + 0.4; }) && !world.overlaps(p.x, p.z, 0.2, 'small')) || L.KITE.land[0];
    Y.kite = 'cai';
    Y.kiteAt = { x: free.x, z: free.z };
    k?.drop?.(free.x, free.z);
    emit('story:sfx', { name: 'leafRustle', x: GV.x, z: GV.z });
    dir?.onomato?.('FLAP-FLAP!', { at: { x: GV.kite.x, y: GV.kite.y, z: GV.kite.z }, size: 0.9, color: '#f2c230', rot: -8 });
    say(c?.name || 'rhaenyra', 'A pipa caiu! Tem um monte de coisa enroscada na rabiola…', true);
    emit('story:kite', { phase: 'cai', x: free.x, z: free.z });
  }

  // ---------------------------------------------------------------- objetivo, nuvem de cheiro e o E da vez
  function objective() {
    if (!Y || K.S?.stage !== 'quintal') return null;
    const a = R(ctx.activeDog);
    if (!inYardSouth(a)) return null;
    const T = (text, p, y = 0.6) => ({ text, target: p ? { x: p.x, y, z: p.z } : null });
    if (!Y.jabutiMoved) {
      if (Y.jabuti === 'anda') return T(YARD_TEXTS.andando, null);
      if (Y.leaf === 'boca') return T(YARD_TEXTS.entregar, { x: jabCol.x, z: jabCol.z }, 0.6);
      if (!Y.metJabuti) return T(YARD_TEXTS.jabuti, { x: jabCol.x, z: jabCol.z }, 0.6);
      return T(YARD_TEXTS.alface, LT, 0.55);
    }
    if (!Y.irrigationOff) {
      const rad = R('radhija');
      if (rad && rad.z < SP.lane.z0 - 0.05) return T(YARD_TEXTS.registro, VV, 0.5);
      return T(YARD_TEXTS.irrigacao, SP.heads[1], 0.7);
    }
    return null;
  }
  function lead() {
    if (!Y || K.S?.stage !== 'quintal') return null;
    const a = R(ctx.activeDog);
    if (!inYardSouth(a)) return null;
    if (!Y.jabutiMoved) {
      if (Y.leaf === 'boca' || !Y.metJabuti || Y.jabuti === 'anda') return { x: JB.x, z: JB.path[0].z + 0.3, color: SCENT.cenoura };
      return { x: LT.bite.x, z: LT.bite.z - 0.35, color: SCENT.cenoura };
    }
    if (!Y.irrigationOff) {
      const rad = R('radhija');
      if (rad && rad.z < SP.lane.z0 - 0.05) return { x: VV.at.x, z: VV.at.z, color: SCENT.cenoura };
      return { x: SP.heads[1].x, z: SP.heads[1].z, color: SCENT.pombos };
    }
    return null;
  }
  /** O E perto de quê, para o aviso do botão (o texto), ou null. */
  function promptFor(c) {
    if (!c || !Y || K.S?.scene?.active || tug.busy?.()) return null;
    const rad = c.name === 'radhija';
    if (rad && Y.leaf === 'pe' && near(c, LT.bite, LT.grabR + 0.3)) return 'Morder a folha';
    if (rad && Y.leaf === 'boca' && near(c, jabCol, JB.giveR)) return 'Dar a folha';
    if (rad && !Y.full && Y.tapT < 0 && near(c, HS.bite, HS.grabR + 0.3)) return 'Puxar a mangueira';
    if (rad && !Y.irrigationOff && near(c, VV.at, VV.r)) return 'Fechar o registro';
    if (Y.kite === 'chao' && !Y.kiteSeen && Y.kiteAt && near(c, Y.kiteAt, L.KITE.examR)) return 'Examinar';
    if (Y.full && !Y.toyTaken && near(c, BK, BK.colR + c.r + 0.4)) return 'Pegar a bolinha';
    return null;
  }

  // ---------------------------------------------------------------- a API
  const yard = {
    get prompt() { return promptFor(R(ctx.activeDog)); },
    objective,
    lead,
    update(dt, { active = null, playing = true } = {}) {
      if (!Y) return;
      Y.time += dt;
      Y.sayCd = Math.max(0, Y.sayCd - dt);
      Y.rattleCd = Math.max(0, Y.rattleCd - dt);
      shoveTree.update(dt);
      stepIrrigation(dt, playing);
      if (!playing) return;
      stepLettuce(dt);
      stepJabuti(dt);
      stepHose(dt);
      // a pipa no chão: o brilho da pista
      const kite = P()?.kite;
      if (Y.kite === 'cai' && kite?.phase === 'chao') {
        Y.kite = 'chao';
        emit('story:kite', { phase: 'chao' });
        refresh();
      }
      kite?.setGlow?.(Y.kite === 'chao' && !Y.kiteSeen ? 1 : 0);
      const a = active ?? R(ctx.activeDog);
      // trocando da Rhaenyra para a Radhija com ela em cima de um aspersor ou junto do pé de alface, ela fica (Fica)
      if (ctx.activeDog !== Y.lastActive) {
        const rha = R('rhaenyra');
        if (ctx.activeDog === 'radhija' && Y.lastActive === 'rhaenyra' && rha && !ctx.isStaying?.('rhaenyra')) {
          const onHead = !Y.irrigationOff && SP.heads.some((hd) => near(rha, hd, 0.7));
          const atLettuce = Y.leaf === 'pe' && near(rha, LT, LT.holdR);
          if (onHead || atLettuce) {
            ctx.setStay?.('rhaenyra', true);
            if (atLettuce) say('rhaenyra', 'Tô segurando o pé de alface! Puxa, Radhija!', true);
          }
        }
        Y.lastActive = ctx.activeDog;
      }
      // a cena da chegada: a primeira vez que alguém está do lado de fora, no fundo do quintal
      if (!Y.introSeen && K.S?.stage === 'quintal' && a && a.z > HR.z1 + 0.2 && (a.x > L.HOUSE.x1 + 0.2 || a.z > L.HOUSE.z1 + 0.2)) {
        Y.introWait += dt;
        if (Y.introWait > 0.5) { Y.introSeen = true; play(YARD_SCENES.chega); }
      } else Y.introWait = 0;
      // o objetivo depende de onde ela está (o jardim para o sul é deste módulo): avisa quando muda
      const radN = (R('radhija')?.z ?? 99) < SP.lane.z0 - 0.05; // a Radhija do outro lado do jardim (o registro)
      const zone = K.S?.stage === 'quintal' && inYardSouth(a) ? (radN ? 'sul-registro' : 'sul') : 'fora';
      if (zone !== Y.zone) { Y.zone = zone; refresh(); }
      // dicas de lugar
      if (a?.name === 'rhaenyra' && Y.kite === 'arvore' && near(a, GV, 1.6)) hints.cond?.(HINTS.pipa, 4.5, 20);
    },
    interact(c) {
      if (!Y || K.S?.scene?.active) return false;
      const rad = c.name === 'radhija';
      // a folha na boca: entregar ao Seu Bento
      if (Y.leaf === 'boca' && near(c, jabCol, JB.giveR) && Y.jabuti !== 'anda') {
        if (rad) { play(YARD_SCENES.jabuti); return true; }
      }
      // morder a folha de alface (a Radhija); a Rhaenyra é desajeitada com a boca
      if (Y.leaf === 'pe' && near(c, LT.bite, LT.grabR + 0.3)) {
        if (!rad) { say('rhaenyra', 'Se eu morder, arranco o pé inteiro! Eu seguro, e você puxa, Radhija.', true); hints.now(HINTS.alface, 5, 8); return true; }
        const B = LT.bite, A = { x: LT.x, y: 0.27, z: LT.z };
        tug.start(c, { bite: { x: B.x, y: B.y, z: B.z }, anchor: A, len: Math.hypot(B.x - A.x, B.z - A.z, B.y - A.y) + LT.pull + 0.15 });
        Y.tugWhat = 'alface';
        return true;
      }
      // a mangueira enroscada na alavanca da torneira
      if (!Y.full && Y.tapT < 0 && near(c, HS.bite, HS.grabR + 0.3)) {
        if (!rad) { say('rhaenyra', 'Eu? Com esses dentes eu furo a mangueira! Puxa você, Radhija.', true); hints.now(HINTS.mangueira, 4.5, 8); return true; }
        const lever = P()?.hose?.leverPoint?.() ?? { x: L.TAP.lever.x, y: L.TAP.lever.y, z: L.TAP.lever.z };
        const bite = P()?.hose?.bitePoint?.() ?? { x: HS.bite.x, y: 0.03, z: HS.bite.z };
        tug.start(c, { bite, anchor: lever, len: Math.hypot(bite.x - lever.x, bite.z - lever.z, bite.y - lever.y) + HS.pull + 0.2 });
        Y.tugWhat = 'mangueira';
        return true;
      }
      // o registro da irrigação
      if (!Y.irrigationOff && near(c, VV.at, VV.r)) {
        if (!rad) { say('rhaenyra', 'Meu focinho não cabe nessa caixinha… Radhija!', true); hints.now(HINTS.registro, 4, 8); return true; }
        closeValve(c);
        return true;
      }
      // a pipa no chão: examinar a rabiola
      if (Y.kite === 'chao' && !Y.kiteSeen && Y.kiteAt && near(c, Y.kiteAt, L.KITE.examR)) { play(YARD_SCENES.pipa); return true; }
      // a bolinha de meia na borda do balde cheio
      if (Y.full && !Y.toyTaken && near(c, BK, BK.colR + c.r + 0.4)) { play(YARD_SCENES.bolinha); return true; }
      // conversar com o jabuti (sem a folha)
      if (Y.jabuti !== 'anda' && !Y.jabutiMoved && near(c, jabCol, JB.r + c.r + 0.7)) { talkJabuti(c); return true; }
      return false;
    },
    /** O empurrão em pé na goiabeira (de qualquer lado), enquanto houver pipa ou só para balançar. */
    shoveSpots() { return Y ? treeSpots : []; },
    onShove(c, spot, C) {
      if (!Y || !spot?.id?.startsWith?.('goiabeira')) return false;
      guavaSway.dx = -spot.nx;
      guavaSway.dz = -spot.nz;
      shoveTree.shove(c, C);
      Y.shoves++;
      emit('story:sfx', { name: 'leafRustle', x: GV.x, z: GV.z, volume: 0.8 });
      if (Y.kite === 'arvore') {
        if (Y.shoves === 1) say('rhaenyra', 'Sai daí, pipa! Empurra… empurra…', true);
        if (Y.shoves >= GV.pushes) dropKite(c);
      }
      return true;
    },
    onBark(c) {
      if (!Y) return;
      // o latido assusta o Seu Bento: ele se esconde no casco
      const j = jab();
      if (j && near(c, jabCol, 2.6) && Y.jabuti !== 'anda') {
        j.setState('esconde');
        say(c.name === 'radhija' ? 'rhaenyra' : 'radhija', c.name === 'radhija' ? 'Radhija! Você assustou o Seu Bento!' : 'Rhaenyra! Você assustou o Seu Bento!', true);
      }
    },
    /** Empurrar o jabuti (a Rhaenyra com Shift) não adianta: ela fica no lugar e ganha a dica. */
    modifyIntent(dt, c, intent, { shift } = {}) {
      if (!Y || Y.jabuti === 'anda' || c.size !== 'large' || !shift || intent.speed < 0.05) return null;
      const dx = jabCol.x - c.x, dz = jabCol.z - c.z, d = Math.hypot(dx, dz);
      if (d > JB.r + c.r + 0.12 || (intent.dx * dx + intent.dz * dz) / (d || 1) < 0.5) return null;
      if (Y.rattleCd <= 0) { Y.rattleCd = 3; say('rhaenyra', 'Ele nem se mexe! É mais pesado que eu…', true); hints.now(HINTS.empurraJabuti, 3.6, 6); }
      return { intent: { ...intent, speed: Math.min(intent.speed, 0.25) }, action: 'push' };
    },
    lookTarget(c) {
      if (!Y) return null;
      if (c.name === 'rhaenyra' && holdingLettuce() && Y.leaf === 'pe') return { x: LT.x, y: 0.35, z: LT.z };
      if (Y.full && !Y.toyTaken && near(c, BK, 1.6)) { const b = P()?.bucket?.ball?.position; return b ? { x: b.x, y: b.y, z: b.z } : null; }
      if (near(c, jabCol, 1.8) && Y.jabuti !== 'fim') return { x: jabCol.x, y: 0.15, z: jabCol.z };
      if (Y.kite === 'chao' && !Y.kiteSeen && Y.kiteAt && near(c, Y.kiteAt, 2.0)) return { x: Y.kiteAt.x, y: 0.05, z: Y.kiteAt.z };
      return null;
    },
    navFlags() { return { jabutiMoved: !!Y?.jabutiMoved, irrigationOff: !!Y?.irrigationOff }; },
    /** Onde fica a cabeça do Seu Bento (o balão das falas dele). */
    anchorOf() { const p = jab()?.headPoint?.(); return p ? { x: p.x, y: p.y + 0.12, z: p.z } : { x: jabCol.x, y: 0.4, z: jabCol.z }; },

    // ---------------------------------------------------------------- o que as cenas chamam (nos commits)
    get state() { return Y; },
    get jabutiPos() { return { x: jabCol.x, z: jabCol.z }; },
    /** A folha entregue (commit da cena do jabuti): no cantinho, e ele começa a andar até ela. */
    giveLeaf() {
      if (Y.leaf === 'jabuti') return;
      Y.leaf = 'jabuti';
      Y.jabuti = 'anda';
      Y.jabT = 0;
      Y.jabWait = 0;
      Y.metJabuti = true;
      P()?.lettuce?.putLeaf?.(JB.leaf.x, JB.leaf.z, 1);
      jab()?.setState?.('anda');
      // quem ficou no caminho dele vai para o lado (o corte do fim da cena; o mesmo lugar, pulando ou não)
      const SAFE = [{ x: -9.35, z: 17.95 }, { x: -9.95, z: 18.75 }, { x: -10.45, z: 17.85 }];
      for (const n of NAMES) {
        const c = R(n);
        if (!c) continue;
        let close = false;
        for (let i = 0; i <= 20 && !close; i++) { const p = jabutiAt(i / 20, { x: 0, z: 0 }); close = Math.hypot(c.x - p.x, c.z - p.z) < c.r + JB.r + 0.12; }
        if (!close) continue;
        const o = R(n === 'radhija' ? 'rhaenyra' : 'radhija');
        const spot = SAFE.find((p) => !o || Math.hypot(o.x - p.x, o.z - p.z) > 0.6) || SAFE[2];
        ctx.place?.(n, spot.x, spot.z, -Math.PI * 0.75);
      }
      emit('story:leaf', { state: 'jabuti' });
      refresh();
    },
    /** A pista da rabiola (commit da cena da pipa). */
    kiteSeen() {
      Y.kiteSeen = true;
      const at = Y.kiteAt || L.KITE.land[0];
      K.book?.add?.('rabiola', { x: at.x, y: 0.1, z: at.z });
      P()?.kite?.setGlow?.(0);
      refresh();
    },
    takeToy,
    /** A cena da chegada já passou (commit). */
    introDone() { Y.introSeen = true; },
    /** Testes e jumps: o quintal obrigatório feito (o jabuti comeu e cochila no cantinho, a irrigação desligada). */
    skipAll() {
      Y.introSeen = true;
      Y.metJabuti = true;
      Y.leaf = 'jabuti';
      Y.jabuti = 'fim';
      Y.jabT = 1;
      Y.jabutiMoved = true;
      Y.eatT = 99;
      placeJabuti(1);
      jab()?.setState?.('cochila');
      P()?.lettuce?.setTorn?.(true);
      P()?.lettuce?.putLeaf?.(JB.leaf.x, JB.leaf.z, 0);
      Y.irrigationOff = true;
      Y.offT = -1;
      for (const col of jetCols) col.enabled = false;
      SP.heads.forEach((hd) => { P()?.sprinklers?.set?.(hd.id, { up: 0, spray: 0, plugged: false }); P()?.sprinklers?.setLit?.(hd.id, false); });
      P()?.valve?.setClosed?.(1);
    },
    /** Testes: a pipa já no chão (sem a queda). */
    landKite() {
      const p = L.KITE.land[0];
      Y.kite = 'chao';
      Y.kiteAt = { x: p.x, z: p.z };
      Y.shoves = GV.pushes;
      P()?.kite?.land?.(p.x, p.z);
    },
    /** Testes: o balde cheio (sem puxar a mangueira). */
    fillBucket() { Y.level = 1; Y.full = true; P()?.bucket?.setLevel?.(1); },
    /** O tempo do programa da irrigação (testes: esperar o aspersor certo). */
    get irrT() { return Y?.irrT ?? 0; },
    headState: (i, t = Y?.irrT ?? 0) => headState(i, t),
    spraying: (id) => { const i = SP.heads.findIndex((h) => h.id === id); return i >= 0 && !!Y && spraying(i); },

    info() {
      if (!Y) return null;
      return {
        intro: Y.introSeen, metJabuti: Y.metJabuti, leaf: Y.leaf, tugWhat: Y.tugWhat,
        jabuti: { phase: Y.jabuti, t: +Y.jabT.toFixed(3), x: +jabCol.x.toFixed(2), z: +jabCol.z.toFixed(2), moved: Y.jabutiMoved, anim: jab()?.state ?? null },
        irrigation: { off: Y.irrigationOff, t: +Y.irrT.toFixed(2), on: SP.heads.filter((_, i) => spraying(i)).map((h) => h.id), plugged: Y.plugged, wet: Y.wet },
        kite: { phase: Y.kite, seen: Y.kiteSeen, shoves: Y.shoves, at: Y.kiteAt || null },
        bucket: { level: +Y.level.toFixed(2), full: Y.full, toy: Y.toyTaken, open: Y.tapT > 0 },
      };
    },
    /** O que importa comparar nas cenas (pular ou assistir). */
    snapshot() {
      if (!Y) return null;
      return { intro: Y.introSeen, leaf: Y.leaf, jabuti: Y.jabuti, moved: Y.jabutiMoved, off: Y.irrigationOff, kiteSeen: Y.kiteSeen, toy: Y.toyTaken, full: Y.full };
    },
    reset() {
      Y = fresh();
      jabCol.x = JB.x;
      jabCol.z = JB.z;
      jabCol.enabled = true;
      for (const col of jetCols) col.enabled = false;
      shoveTree.reset();
      P()?.guava?.setSway?.(0);
      // a meia do balde fica escondida até o balde encher (o atores.js mostra todas as meias no reset dele)
      const sock = props.socks?.find?.((s) => s.id === 'balde');
      if (sock) sock.object.visible = false;
    },
    HINTS,
  };
  yard.reset();
  return yard;
}
