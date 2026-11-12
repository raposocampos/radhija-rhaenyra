// MODO HISTÓRIA · Capítulo 1 — os PUZZLES DA CASA, na ala sul (4ª rodada, pedido do usuário em 2026-11-11: "precisamos
// de uma casa maior, com mais detalhes, pensar em puzzles que se enquadrem melhor na casa"; ele escolheu os quatro).
// A cadeia até a porta dos fundos, com as duas (o cenário em world/casaSul.js; as cenas em scenesCasa.js):
//   1. a GRADE do quarto e o SACO de ração na frente da maçaneta (puzzle.js, como antes; a porta da cozinha agora dá no
//      corredor): a porta abrindo acorda o ASPIRADOR ROBÔ (a cena 'aspirador');
//   2. o ASPIRADOR anda em zigue-zague pelo corredor e a Radhija, medrosa, não entra nele. O latido grosso da Rhaenyra
//      perto dele, ou ela no caminho dele com o Fica, o manda de volta para a base, e lá ele fica (sem o Fica, ele
//      desvia; na terceira trombada, desiste). Ele nunca atravessa ninguém: para antes de encostar;
//   3. a DESPENSA (a copa de passagem para a sala de jantar) está no escuro: a Radhija não entra. O interruptor fica do
//      lado de fora, alto: o impulso na parede da Rhaenyra acende a luz. Lá dentro, a GOTEIRA (pista escondida, com o E);
//   4. na SALA, o TRINCO da porta dos fundos é alto: a Rhaenyra empurra o PUFE até o sofá e a Radhija sobe pelo pufe,
//      pelo sofá e pelo parapeito da janela até o trinco (E). Destrancada, a Rhaenyra empurra a porta (Shift) e a cena
//      'portaFundos' leva ao quintal.
// O paralelo: na SALA DE JANTAR, a Radhija morde a ponta comprida da TOALHA (E, como as cordas) e puxa; a LATA de biscoito
// escorrega junto, cai, a tampa salta e de dentro saem o biscoito (o petisco 'lata') e a ETIQUETA da cenoura (pista
// escondida, com o E).
// O puzzle de área (puzzle.js) chama este módulo pelos ganchos (a API abaixo); o que fica de permanente sai nos commits
// das cenas e em skipAll() (?stage=quintal e os testes).
// API: createCasaPuzzles(K, { world, emit, effects, ctx, props, dir, hints, tug, sack, collectList }) →
//   { update(dt, o), interact(c), modifyIntent(dt, c, intent, o), wallSpots(), onWallTouch(c, spot), onBark(c),
//     lockFor(name), lookTarget(c), navFlags(), objective(), lead(), prompt, onKitchenOpen(), skipAll(), jump(step),
//     reset(), info(), snapshot(), e o que as cenas usam: wakeVacuum(), vacuumPose(x, z, yaw), lanePose(z, dir),
//     startPatrol(), openExit(), afterExit() }.
import { createPushCrate, createWallButton, createHingedGate } from '../../../game/mechanics/index.js';
import { lerpAngle } from '../../scene/sequencer.js';
import { SCENT } from '../../faro/faro.js';

/** Os ids das cenas da casa (registradas no puzzle: createCasaScenes, scenesCasa.js). */
export const CASA_SCENES = Object.freeze({ aspirador: 'aspirador', saida: 'portaFundos' });
/** Os passos da casa, na ordem da cadeia (para jump, os testes e o E2E). */
export const CASA_STEPS = ['grade', 'aspirador', 'despensa', 'jantar', 'sala', 'porta'];

const NAMES = ['radhija', 'rhaenyra'];
const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Os objetivos curtos do HUD, passo a passo. */
const TEXTS = {
  grade: 'Atrás dos pombos! Saiam de casa',
  saco: 'O saco de ração tapa a maçaneta',
  macaneta: 'A maçaneta é alta: a Rhaenyra pula nela',
  aspirador: 'Um aspirador robô! A Radhija morre de medo dele',
  despensa: 'A despensa está no escuro: acendam a luz',
  pufe: 'O trinco da porta é alto: levem o pufe até o sofá',
  subir: 'A Radhija sobe pelo pufe até o trinco',
  porta: 'Destrancada! A Rhaenyra empurra a porta',
};
/** As dicas (somem no modo sem dicas). */
const HINTS = {
  aspirador: 'A Radhija tem medo do aspirador. Com a Rhaenyra, lata perto dele (E) ou fique no caminho dele (Fica: F).',
  escuro: 'A Radhija não entra no escuro. O interruptor é alto: a Rhaenyra pula na parede (Espaço).',
  pufe: 'O trinco é alto. A Rhaenyra empurra o pufe (segure Shift) até encostar no sofá, embaixo da janela.',
  subir: 'Com o pufe encostado no sofá, a Radhija sobe (E) até o trinco.',
  empurrar: 'Destrancada! A Rhaenyra empurra a porta dos fundos (segure Shift).',
  trancada: 'O trinco lá no alto segura a porta. Do chão, ninguém alcança…',
  pesada: 'A porta é pesada para a Radhija: a Rhaenyra empurra (segure Shift).',
  toalha: 'A ponta da toalha está pendurada: a Radhija morde (E) e puxa para trás.',
  pufePesado: 'O pufe é pesado para a Radhija: a Rhaenyra empurra (segure Shift).',
};
const PROMPTS = { toalha: 'Puxar a toalha', subir: 'Subir' };
/** As falas da Radhija com medo (uma de cada vez, alternando). */
const FEAR_VACUUM = ['Esse monstro barulhento não sai do corredor! Eu não passo!', 'Rhaenyra! Espanta esse troço daqui!', 'Nem pensar. Ele tem olhos que piscam!'];
const FEAR_DARK = ['Tá um breu lá dentro… e tem alguma coisa pingando!', 'Acende a luz, Rhaenyra! O interruptor é ali, ó.', 'Eu? Entrar no escuro? Primeiro a luz!'];

/**
 * @param {any} K o contexto das cenas do puzzle (dir, props, L, S, book, faro, placeAt, setStage, reveal, openKitchenSide…)
 * @param {{ world: any, emit: any, effects: any, ctx: any, props: any, dir: any, hints: any, tug: any,
 *   sack?: any, collectList?: { id: string, x: number, z: number, y?: number }[] }} o
 */
export function createCasaPuzzles(K, { world, emit, effects, ctx, props, dir, hints, tug, sack = null, collectList = null }) {
  const L = K.L;
  const R = (n) => ctx.ctrls?.[n] ?? K.ctx?.ctrls?.[n];
  const V = L.VACUUM, LN = V.lane, PN = L.PANTRY, DT = L.DINING_TABLE, TC = L.TABLECLOTH, CK = L.COOKIE_TIN;
  const SF = L.SOFA, SL = L.LIVING_SILL, EX = L.HOUSE_EXIT, LT = L.EXIT_LATCH, PS = L.POUF_SPOT;
  const SR = L.SMALL_ROOMS, KD = L.KITCHEN_DOOR;
  const COR = SR.corredor;
  const TOP = DT.h + 0.006;

  // ---------------------------------------------------------------- mecânicas e colisores
  // o aspirador (um círculo que anda: ninguém o atravessa) e o medo da Radhija (as faixas que barram só a pequena)
  const vacCol = world.addDynamic({ id: 'aspirador', kind: 'static', shape: 'circle', x: V.dock.x, z: V.dock.z, r: V.r });
  const F = V.fear;
  const fearHall = world.addDynamic({ id: 'medo-do-aspirador', kind: 'static', shape: 'box', x: (F.x0 + F.x1) / 2, z: (F.z0 + F.z1) / 2, hx: (F.x1 - F.x0) / 2, hz: (F.z1 - F.z0) / 2, blocks: 'small', enabled: false });
  const PF = PN.fear;
  const fearDark = world.addDynamic({ id: 'medo-do-escuro', kind: 'static', shape: 'box', x: (PF.x0 + PF.x1) / 2, z: (PF.z0 + PF.z1) / 2, hx: (PF.x1 - PF.x0) / 2, hz: (PF.z1 - PF.z0) / 2, blocks: 'small', enabled: true });
  const sw = createWallButton({ id: 'interruptor-despensa', cfg: PN.switch, emit, prop: props.pantrySwitch ?? null });
  const pouf = createPushCrate({ id: 'pufe', cfg: L.POUF, world, emit, prop: props.pouf ?? null });
  const exitGate = createHingedGate({ id: 'porta-fundos', cfg: L.EXIT_DOOR, world, prop: props.exitDoor ?? null });
  // a lata caída no chão também colide
  const tinCol = world.addDynamic({ id: 'lata', kind: 'static', shape: 'circle', x: CK.rest.x, z: CK.rest.z, r: 0.12, enabled: false });
  // as pistas da casa (o Faro mostra quando elas aparecem; o E do puzzle examina)
  const spots = L.CLUE_SPOTS;
  K.faro?.addSpot?.('goteira', { ...spots.goteira, kind: 'escondida', size: 0.6, los: spots.goteira.at, enabled: false });
  K.faro?.addSpot?.('etiqueta', { ...spots.etiqueta, kind: 'escondida', size: 0.5, los: spots.etiqueta.at, enabled: false });
  props.tablecloth?.setGrip?.(() => (K.S?.tugWhat === 'toalha' ? tug.grip() : null));
  const treatEntry = () => collectList?.find((c) => c.id === 'lata') ?? null;
  const treatItem = () => props.collectibles?.find?.((c) => c.id === 'lata') ?? null;

  /** @type {any} */
  let S = null;
  const fresh = () => ({
    time: 0, vac: 'sleep', vx: V.dock.x, vz: V.dock.z, vyaw: V.dock.yaw, vdir: -1, vt: 0, vYaw0: 0, vYaw1: 0, bumps: 0,
    home: null, homeI: 0, vacuumSeen: false, sayCd: 0, fearCd: 0, fearI: 0, darkI: 0, rattleCd: 0, dripT: 0,
    pantryLit: false, litT: -1, clothP: 0, clothBase: 0, tin: 'mesa', tinT: 0, latchOpen: false, latchT: -1,
    exitPush: false, exitOpen: false, climb: null, shownLatch: false, seenRha: false,
  });

  // ---------------------------------------------------------------- falas
  function say(who, text, force = false) {
    if (!force && S.sayCd > 0) return;
    S.sayCd = 2.4;
    dir?.say?.(who, text, { mode: 'jogo' });
  }
  const objectiveNow = () => emit('objective', K.objective?.() ?? casa.objective());

  // ---------------------------------------------------------------- o aspirador
  /** O x da trilha em zigue-zague para um z do corredor. */
  const laneX = (z) => LN.x + LN.zig * Math.sin(((z - LN.z0) / LN.wave) * Math.PI * 2);
  /** Para onde ele aponta andando na trilha (dir: +1 para o sul, −1 para o norte). */
  const laneYaw = (z, d) => {
    const dxdz = LN.zig * Math.cos(((z - LN.z0) / LN.wave) * Math.PI * 2) * ((Math.PI * 2) / LN.wave);
    return Math.atan2(dxdz * d, d);
  };
  function placeVac(x, z, yaw) {
    S.vx = x; S.vz = z; S.vyaw = yaw;
    vacCol.x = x; vacCol.z = z;
    props.vacuum?.setPose?.(x, z, yaw);
  }
  /** Alguma dog (a dog) ficaria encostada no aspirador em (x, z)? */
  function dogAt(x, z) {
    for (const n of NAMES) {
      const c = R(n);
      if (c && (c.y || 0) < 0.3 && Math.hypot(c.x - x, c.z - z) < V.r + c.r + V.gap) return c;
    }
    return null;
  }
  const vacActive = () => S.vac === 'patrol' || S.vac === 'turn' || S.vac === 'bump' || S.vac === 'scared' || S.vac === 'home';
  function setVacMode(m) {
    S.vac = m;
    S.vt = 0;
    const look = { sleep: 'sleep', wake: 'patrol', patrol: 'patrol', turn: 'patrol', bump: 'patrol', scared: 'scared', home: 'home', docked: 'sleep' }[m] ?? 'patrol';
    props.vacuum?.setMode?.(look);
    fearHall.enabled = vacActive();
  }
  function turnAround() {
    S.vdir = -S.vdir;
    S.vYaw0 = S.vyaw;
    S.vYaw1 = laneYaw(S.vz, S.vdir);
    setVacMode('turn');
  }
  /** O susto: ele treme, apita e vai embora para a base (o latido ou a Rhaenyra no Fica). */
  function scare(by) {
    if (!vacActive() || S.vac === 'scared' || S.vac === 'home') return false;
    setVacMode('scared');
    emit('story:sfx', { name: 'aspirador-bip', x: S.vx, z: S.vz });
    dir?.onomato?.('BIP-BIP?!', { at: { x: S.vx, y: 0.5, z: S.vz }, size: 0.8, color: '#ff8a8a', rot: 8, style: 'shake' });
    if (by === 'fica') say('rhaenyra', 'Daqui eu não saio. Vai pra casinha, vai!', true);
    return true;
  }
  function goHome() {
    const zc = Math.min(Math.max(S.vz, LN.z0), LN.z1);
    S.home = [{ x: LN.x, z: zc }, { x: LN.x, z: LN.z1 }, { x: V.dock.x, z: V.dock.z }];
    S.homeI = 0;
    setVacMode('home');
  }
  function docked() {
    placeVac(V.dock.x, V.dock.z, V.dock.yaw);
    setVacMode('docked');
    emit('door:open', { id: 'aspirador', x: V.dock.x, z: V.dock.z });
    emit('story:sfx', { name: 'aspirador-bip', x: V.dock.x, z: V.dock.z, volume: 0.6 });
    const rad = R('radhija');
    if (rad && Math.hypot(rad.x - V.dock.x, rad.z - V.dock.z) < 9) say('radhija', 'Hmpf. Eu nem estava com medo.', true);
    else say('rhaenyra', 'Fica quietinho aí!', true);
    objectiveNow();
  }
  /** Um passo do aspirador andando (sem nunca encostar em ninguém). → a dog no caminho, se houver. */
  function stepTo(x, z, yaw) {
    const c = dogAt(x, z);
    if (c) return c;
    placeVac(x, z, yaw);
    return null;
  }
  function stepVacuum(dt) {
    S.vt += dt;
    switch (S.vac) {
      case 'patrol': {
        const nz = S.vz + S.vdir * V.speed * dt;
        if ((S.vdir > 0 && nz >= LN.z1) || (S.vdir < 0 && nz <= LN.z0)) { turnAround(); break; }
        const c = stepTo(laneX(nz), nz, laneYaw(nz, S.vdir));
        if (c) bump(c);
        break;
      }
      case 'turn': {
        // vira no lugar (é um robô), meia-volta em turnTime
        const k = clamp01(S.vt / V.turnTime);
        placeVac(S.vx, S.vz, lerpAngle(S.vYaw0, S.vYaw1, k * k * (3 - 2 * k)));
        if (k >= 1) setVacMode('patrol');
        break;
      }
      case 'bump': {
        // trombou: recua um tiquinho e dá meia-volta
        if (S.vt < 0.25) stepTo(S.vx - Math.sin(S.vyaw) * 0.25 * dt, S.vz - Math.cos(S.vyaw) * 0.25 * dt, S.vyaw);
        else turnAround();
        break;
      }
      case 'scared': {
        if (S.vt >= 0.9) goHome();
        break;
      }
      case 'home': {
        const p = S.home[S.homeI];
        if (!p) { docked(); break; }
        const dx = p.x - S.vx, dz = p.z - S.vz, d = Math.hypot(dx, dz);
        const step = 0.5 * dt;
        const yaw = lerpAngle(S.vyaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
        if (d <= step) { if (!dogAt(p.x, p.z)) { placeVac(p.x, p.z, yaw); S.homeI++; } }
        else stepTo(S.vx + (dx / d) * step, S.vz + (dz / d) * step, yaw); // com alguém no caminho, espera
        break;
      }
      default: break;
    }
  }
  /** Encostou numa dog: com a Rhaenyra no Fica, desiste e volta para a base; sem, desvia (e na terceira, desiste). */
  function bump(c) {
    emit('story:sfx', { name: 'aspirador-bip', x: S.vx, z: S.vz, volume: 0.6 });
    if (c.name === 'rhaenyra') {
      if (ctx.isStaying?.('rhaenyra')) { scare('fica'); return; }
      S.bumps++;
      if (S.bumps >= V.bumps) { scare('bump'); return; }
      dir?.onomato?.('TUM!', { at: { x: S.vx, y: 0.35, z: S.vz }, size: 0.6, color: '#ffffff', rot: -6 });
    } else fear(c, true);
    setVacMode('bump');
  }

  // ---------------------------------------------------------------- o medo da Radhija (o aspirador e o escuro)
  function fear(c, vacuum) {
    if (S.fearCd > 0 || c.name !== 'radhija') return;
    S.fearCd = 2.6;
    const back = vacuum ? { x: c.x, z: c.z - 0.24 } : { x: c.x + 0.24, z: c.z };
    effects?.pushTo?.(c, back.x, back.z, { dur: 0.3, action: 'startled', face: vacuum ? { x: S.vx, z: S.vz } : { x: COR.x0 - 1, z: c.z } });
    dir?.balloon?.('medo', { who: 'radhija', life: 1.6 });
    emit('story:sfx', { name: 'fungada', x: c.x, z: c.z, volume: 0.5 });
    if (vacuum) { say('radhija', FEAR_VACUUM[S.fearI++ % FEAR_VACUUM.length], true); hints?.now?.(HINTS.aspirador, 5, 7); } else { say('radhija', FEAR_DARK[S.darkI++ % FEAR_DARK.length], true); hints?.now?.(HINTS.escuro, 5, 7); }
  }

  // ---------------------------------------------------------------- a despensa
  function lightOn() {
    if (S.pantryLit) return;
    S.pantryLit = true;
    S.litT = 0;
    fearDark.enabled = false;
    emit('story:sfx', { name: 'interruptor', x: PN.switch.x, z: PN.switch.z });
    emit('door:open', { id: 'despensa', x: PN.switch.x, z: PN.switch.z });
    dir?.onomato?.('CLIC!', { at: { x: PN.switch.x + 0.2, y: PN.switch.top + 0.25, z: PN.switch.z }, size: 0.7, color: '#ffe27a', rot: -8 });
    K.faro?.setSpot?.('goteira', true);
    K.reveal?.('goteira');
    const rad = R('radhija');
    if (rad && near(rad, { x: PN.switch.x, z: PN.switch.z }, 5)) say('radhija', 'Ah… era só uma goteira. Eu sabia.', true);
    else say('rhaenyra', 'Luz! E olha lá: uma goteira!', true);
    objectiveNow();
  }

  // ---------------------------------------------------------------- a toalha e a lata
  const tinOnTable = () => ({ x: CK.x + S.clothP, z: CK.z });
  function placeTinOnCloth() {
    const p = tinOnTable();
    props.cookieTin?.setPose?.(p.x, TOP, p.z);
  }
  function tinFall() {
    if (S.tin !== 'mesa') return;
    S.tin = 'cai';
    S.tinT = 0;
    tug?.release?.();
    emit('story:sfx', { name: 'toalha', x: DT.x + DT.hx, z: DT.z });
  }
  const easeOut = (u) => 1 - (1 - u) * (1 - u);
  /** A queda e a corrida da lata pelo chão (1,7 s), a tampa, o biscoito e a etiqueta saindo. */
  function stepTin(dt) {
    if (S.tin !== 'cai') return;
    S.tinT += dt;
    const t = S.tinT, T = props.cookieTin;
    const from = { x: CK.x + S.clothP, z: CK.z };
    const r = CK.r;
    if (t < 0.45) {
      // tomba da beirada: um arco curto até o chão, girando de lado
      const u = t / 0.45;
      const x = from.x + (CK.land.x - from.x) * u, z = from.z + (CK.land.z - from.z) * u;
      const y = TOP * (1 - u * u) + Math.sin(u * Math.PI) * 0.06 + r * u;
      T?.setPose?.(x - (CK.h / 2) * u, Math.max(0, y - r * u * 0.0), z, 0, 0, -u * (Math.PI / 2));
    } else {
      if (!S.clanged) {
        S.clanged = true;
        emit('story:sfx', { name: 'lata', x: CK.land.x, z: CK.land.z });
        dir?.onomato?.('CLANG!', { at: { x: CK.land.x, y: 0.55, z: CK.land.z }, size: 1.0, color: '#ffd23f', rot: -10, style: 'shake' });
      }
      // corre pelo chão de lado, como uma roda, até parar
      const u = clamp01((t - 0.45) / 1.0), e = easeOut(u);
      const x = CK.land.x + (CK.rest.x - CK.land.x) * e, z = CK.land.z + (CK.rest.z - CK.land.z) * e;
      const dist = Math.hypot(CK.rest.x - CK.land.x, CK.rest.z - CK.land.z) * e;
      T?.setPose?.(x - CK.h / 2, r, z, dist / r, 0, -Math.PI / 2);
    }
    // a tampa salta no impacto e cai deitada mais adiante
    if (t >= 0.45) {
      const u = clamp01((t - 0.45) / 0.55);
      const x = CK.land.x + (CK.lid.x - CK.land.x) * u, z = CK.land.z + (CK.lid.z - CK.land.z) * u;
      T?.setLidPose?.(x, Math.sin(u * Math.PI) * 0.32 + 0.004, z, (1 - u) * 5, 0, 0);
    }
    // o biscoito pula para fora e cai no chão (aí vira o petisco de verdade)
    if (T?.biscuit) {
      const u = clamp01((t - 0.5) / 0.6);
      T.biscuit.visible = t >= 0.5 && u < 1;
      if (T.biscuit.visible) T.biscuit.position.set(CK.land.x + (CK.treat.x - CK.land.x) * u, 0.025 + Math.sin(u * Math.PI) * 0.4, CK.land.z + (CK.treat.z - CK.land.z) * u);
      if (u >= 1 && !S.treatOut) showTreat();
    }
    // a etiqueta sai voando devagar, balançando, e pousa deitada
    if (T?.tag) {
      const u = clamp01((t - 0.55) / 1.1);
      T.tag.visible = t >= 0.55;
      if (T.tag.visible) {
        T.tag.position.set(CK.land.x + (CK.tag.x - CK.land.x) * u + Math.sin(u * 9) * 0.06 * (1 - u), 0.003 + Math.sin(u * Math.PI) * 0.55, CK.land.z + (CK.tag.z - CK.land.z) * u);
        T.tag.rotation.set(Math.sin(u * 7) * 0.5 * (1 - u), u * 2.2, Math.cos(u * 6) * 0.4 * (1 - u));
      }
      if (u >= 1 && !S.tagDown) {
        S.tagDown = true;
        T.tag.rotation.set(0, 2.2, 0);
        K.faro?.setSpot?.('etiqueta', true);
        K.reveal?.('etiqueta');
      }
    }
    if (t >= 1.7) {
      S.tin = 'chao';
      restTin();
      say('radhija', 'Lata de biscoito… cheia de linha e botão! Mas tem um biscoito.', true);
      objectiveNow();
    }
  }
  /** O petisco 'lata' aparece no chão (pode pegar). */
  function showTreat() {
    S.treatOut = true;
    if (props.cookieTin?.biscuit) props.cookieTin.biscuit.visible = false;
    const e = treatEntry();
    if (e) { e.y = 0; }
    treatItem()?.setHidden?.(false);
  }
  /** A lata parada no chão: o colisor (quem estiver ali sai da frente). */
  function restTin() {
    props.cookieTin?.setPose?.(CK.rest.x - CK.h / 2, CK.r, CK.rest.z, 0.7, 0, -Math.PI / 2);
    props.cookieTin?.setLidPose?.(CK.lid.x, 0.004, CK.lid.z, Math.PI, 0.6, 0);
    if (props.cookieTin?.tag) { props.cookieTin.tag.visible = true; props.cookieTin.tag.position.set(CK.tag.x, 0.003, CK.tag.z); props.cookieTin.tag.rotation.set(0, 2.2, 0); }
    if (props.cookieTin?.biscuit) props.cookieTin.biscuit.visible = false;
    for (const n of NAMES) {
      const c = R(n);
      if (c && Math.hypot(c.x - CK.rest.x, c.z - CK.rest.z) < 0.12 + c.r + 0.02) effects?.pushTo?.(c, CK.rest.x + 0.6, CK.rest.z + 0.3, { dur: 0.3, action: 'startled', face: CK.rest });
    }
    tinCol.enabled = true;
  }

  // ---------------------------------------------------------------- o pufe, a subida e o trinco
  const poufAtSofa = () => pouf.x >= PS.x - 0.03 && pouf.z >= PS.z0 && pouf.z <= PS.z1;
  const SEAT_X = SF.x - 0.12, BACK_X = SF.x + SF.hx - 0.11, SILL_X = (SL.x0 + SL.x1) / 2, SILL_Y = SL.y + 0.005;
  const SILL_END = LT.z - 0.45;
  /** Um lugar livre no chão perto do pufe para a Radhija descer (ou começar), longe da irmã. */
  function footSpot() {
    const rad = R('radhija'), rha = R('rhaenyra');
    const cands = [{ x: pouf.x - L.POUF.half - 0.32, z: pouf.z }, { x: pouf.x - L.POUF.half - 0.3, z: pouf.z + 0.45 }, { x: pouf.x - L.POUF.half - 0.3, z: pouf.z - 0.45 }, { x: pouf.x, z: pouf.z + L.POUF.half + 0.34 }];
    for (const p of cands) {
      if (world.overlaps(p.x, p.z, rad.r, rad.size)) continue;
      if (rha && Math.hypot(rha.x - p.x, rha.z - p.z) < rha.r + rad.r + 0.06) continue;
      return p;
    }
    return cands[0];
  }
  function startSofaClimb() {
    const c = R('radhija');
    const foot = footSpot();
    const pz = pouf.z, px = pouf.x;
    const steps = [
      { kind: 'walk', to: foot, dur: 0.45, y: 0 },
      { kind: 'hop', to: { x: px, z: pz }, y: L.POUF.height, dur: 0.5 },
      { kind: 'hop', to: { x: SEAT_X, z: pz }, y: SF.seat + 0.01, dur: 0.45 },
      { kind: 'hop', to: { x: BACK_X, z: Math.min(pz, SL.z1 - 0.5) }, y: SF.h + 0.005, dur: 0.45 },
      { kind: 'hop', to: { x: SILL_X, z: SL.z1 - 0.45 }, y: SILL_Y, dur: 0.45 },
      { kind: 'walk', to: { x: SILL_X, z: SILL_END }, y: SILL_Y, dur: 0.45 },
      { kind: 'press', dur: 1.0, y: SILL_Y },
      { kind: 'walk', to: { x: SILL_X, z: SL.z1 - 0.5 }, y: SILL_Y, dur: 0.5, back: true },
      { kind: 'hop', to: { x: SEAT_X, z: pz }, y: SF.seat + 0.01, dur: 0.5 },
      { kind: 'hop', to: null, y: 0, dur: 0.55 },
    ];
    S.climb = { i: 0, t: 0, from: { x: c.x, z: c.z, y: 0, yaw: c.yaw }, steps };
    dir.hold('radhija');
    emit('story:sfx', { name: 'pulinho', x: px, z: pz });
    objectiveNow();
  }
  function stepClimb(dt) {
    const C = S.climb;
    if (!C) return;
    const st = C.steps[C.i];
    if (!st) {
      S.climb = null;
      dir.release('radhija');
      objectiveNow();
      return;
    }
    // a última descida: o lugar é escolhido na hora (livre, longe da irmã)
    if (!st.to && st.kind === 'hop') st.to = footSpot();
    C.t += dt;
    const k = Math.min(1, C.t / st.dur);
    const a = dir.actor('radhija');
    const f = C.from;
    if (st.kind === 'press') {
      // de pé no parapeito, a patinha no trinco
      a.press = { x: LT.x, y: LT.y, z: LT.z, k: Math.sin(k * Math.PI) };
      a.look = { x: LT.x, y: LT.y, z: LT.z };
      a.speed = 0;
      if (k > 0.55 && !S.latchOpen) latchOpen();
    } else {
      const to = st.to;
      const e = k * k * (3 - 2 * k);
      a.x = f.x + (to.x - f.x) * e;
      a.z = f.z + (to.z - f.z) * e;
      const yy = f.y + (st.y - f.y) * e;
      a.y = st.kind === 'hop' ? yy + Math.sin(k * Math.PI) * 0.22 : yy;
      a.airK = st.kind === 'hop' && k < 1 ? k : -1;
      a.press = null;
      a.look = st.kind === 'walk' && !st.back && C.i >= 5 ? { x: LT.x, y: LT.y, z: LT.z } : null;
      const dx = to.x - f.x, dz = to.z - f.z;
      // vira suave (no parapeito estreito, de frente para onde vai)
      if (Math.hypot(dx, dz) > 0.05) a.yaw = lerpAngle(f.yaw, Math.atan2(dx, dz), Math.min(1, k * 3));
      a.speed = st.kind === 'walk' ? Math.hypot(dx, dz) / st.dur : 0.8;
      if (st.kind === 'hop' && k >= 1) emit('story:sfx', { name: 'pulinho', x: a.x, z: a.z, volume: 0.7 });
    }
    if (k >= 1) {
      C.from = { x: a.x, z: a.z, y: st.y ?? a.y, yaw: a.yaw };
      C.i++;
      C.t = 0;
    }
  }
  function latchOpen() {
    S.latchOpen = true;
    S.latchT = 0;
    pouf.freeze();
    emit('story:sfx', { name: 'trinco', x: LT.x, z: LT.z });
    emit('door:unlock', { id: 'porta-fundos', x: LT.x, z: LT.z });
    dir?.onomato?.('CLEC!', { at: { x: LT.x - 0.15, y: LT.y + 0.3, z: LT.z }, size: 0.8, color: '#ffd23f', rot: -8 });
    say('radhija', 'Destranquei! Agora empurra, Rhaenyra!', true);
    hints?.now?.(HINTS.empurrar, 4.5, 6);
  }

  // ---------------------------------------------------------------- a porta dos fundos
  const exitMid = { x: EX.x, z: (EX.z0 + EX.z1) / 2 };
  /** A Rhaenyra empurrando a porta por dentro (de frente para o leste, no vão)? */
  const inExitPush = (c, intent) => c.x > EX.x - 0.78 && c.x < EX.x + 0.05 && c.z > EX.z0 + 0.1 && c.z < EX.z1 - 0.1 && intent.dx > 0.5;
  function openExit() {
    if (S.exitOpen) return;
    S.exitOpen = true;
    exitGate.setTarget(1);
    exitGate.lock();
    exitGate.set?.(1);
    emit('door:open', { id: 'porta-fundos', x: EX.x, z: exitMid.z });
  }

  // ---------------------------------------------------------------- o objetivo e o rastro do Faro
  /** O passo da casa em que a missão está agora. */
  function step() {
    const KS = K.S;
    if (!KS?.petGateOpen) return 'grade';
    if (!KS.kitchenOpen) return sack && sack.x < L.FOOD_SACK.freeX - 0.02 ? 'saco' : 'macaneta';
    if (vacActive() || S.vac === 'sleep' || S.vac === 'wake') return 'aspirador';
    if (!S.pantryLit) return 'despensa';
    if (!S.latchOpen) return poufAtSofa() ? 'subir' : 'pufe';
    if (!S.exitOpen) return 'porta';
    return 'fora';
  }
  const PG = L.PET_GATE;
  const gateMid = { x: (PG.hinge.x + PG.latchPost.x) / 2, z: (PG.hinge.z + PG.latchPost.z) / 2 };
  /** Onde fica o próximo passo: { x, y, z } (o marcador do HUD) ou null. */
  function target(st) {
    const KH = L.KITCHEN_HANDLE;
    switch (st) {
      case 'grade': return R(ctx.activeDog)?.name === 'radhija' ? { x: L.PET_PEDAL.x, y: 0.5, z: L.PET_PEDAL.z } : { x: gateMid.x, y: 1.0, z: gateMid.z };
      case 'saco': return { x: sack?.x ?? L.FOOD_SACK.start.x, y: 0.9, z: sack?.z ?? L.FOOD_SACK.start.z };
      case 'macaneta': return { x: KH.x, y: 1.3, z: KH.z - 0.25 };
      case 'aspirador': return { x: S.vx, y: 0.55, z: S.vz };
      case 'despensa': return { x: PN.switch.x + 0.12, y: PN.switch.top + 0.3, z: PN.switch.z };
      case 'pufe': return { x: pouf.x, y: L.POUF.height + 0.4, z: pouf.z };
      case 'subir': return { x: LT.x, y: LT.y + 0.3, z: LT.z };
      case 'porta': return { x: EX.x - 0.3, y: 1.4, z: exitMid.z };
      default: return null;
    }
  }

  // ---------------------------------------------------------------- a API
  const casa = {
    get vacuum() { return S.vac; },
    get vacuumAway() { return S.vac === 'sleep' || S.vac === 'docked'; },
    get pantryLit() { return S.pantryLit; },
    get latchOpen() { return S.latchOpen; },
    get exitOpen() { return S.exitOpen; },
    get tinDone() { return S.tin !== 'mesa'; },
    get climbing() { return !!S.climb; },
    get pouf() { return pouf; },
    get exitGate() { return exitGate; },
    get switchButton() { return sw; },
    get step() { return step(); },
    poufAtSofa,
    laneX,
    /** O E do que dá para fazer aqui (texto do botão), ou null. */
    get prompt() {
      if (!S || S.climb || K.S?.stage !== 'casa') return null;
      const c = R(ctx.activeDog);
      if (!c || c.name !== 'radhija' || tug?.busy?.()) return null;
      if (S.tin === 'mesa' && near(c, props.tablecloth?.bitePoint?.() ?? TC.bite, TC.grabR + 0.3)) return PROMPTS.toalha;
      if (!S.latchOpen && poufAtSofa() && near(c, pouf, L.POUF.half + 0.55)) return PROMPTS.subir;
      return null;
    },

    update(dt, { active = null, comp = null, playing = true } = {}) {
      if (!S) return;
      S.time += dt;
      S.sayCd = Math.max(0, S.sayCd - dt);
      S.fearCd = Math.max(0, S.fearCd - dt);
      S.rattleCd = Math.max(0, S.rattleCd - dt);
      sw.update(dt);
      exitGate.update(dt, { ctrls: ctx.ctrls });
      // a luz piscando ao acender (tique-tique-acende), o trinco correndo
      if (S.litT >= 0) {
        S.litT += dt;
        const t = S.litT;
        props.pantry?.setLit?.(t < 0.08 ? 1 : t < 0.18 ? 0.15 : t < 0.26 ? 1 : t < 0.32 ? 0.4 : 1);
        if (t > 0.4) { S.litT = -1; props.pantry?.setLit?.(1); }
      }
      if (S.latchT >= 0) {
        S.latchT += dt;
        props.exitDoor?.setLatch?.(clamp01(S.latchT / 0.25));
        if (S.latchT > 0.3) S.latchT = -1;
      }
      // a goteira pingando (o "ploc" assusta mais no escuro): só quando há alguém por perto
      S.dripT += dt;
      if (S.dripT >= PN.drip.period) {
        S.dripT -= PN.drip.period;
        const c = active ?? R(ctx.activeDog);
        const d = c ? Math.hypot(c.x - PN.drip.x, c.z - PN.drip.z) : 99;
        if (d < 5 && K.S?.stage === 'casa') emit('story:sfx', { name: 'pingo', x: PN.drip.x, z: PN.drip.z, volume: (1 - d / 5) * (S.pantryLit ? 0.4 : 0.8) });
      }
      if (!playing) return;
      // o aspirador
      if (vacActive()) {
        stepVacuum(dt);
        // o zumbido dele, de vez em quando
        if (S.vac === 'patrol' && Math.floor(S.time / 1.6) !== Math.floor((S.time - dt) / 1.6)) {
          const c = active ?? R(ctx.activeDog);
          const d = c ? Math.hypot(c.x - S.vx, c.z - S.vz) : 99;
          if (d < 7) emit('story:sfx', { name: 'aspirador', x: S.vx, z: S.vz, volume: (1 - d / 7) * 0.8 });
        }
        // a Radhija chegando perto dele (fora do corredor também): o susto
        const rad = R('radhija');
        if (rad && (rad.y || 0) < 0.3 && Math.hypot(rad.x - S.vx, rad.z - S.vz) < 1.5 && !S.climb) fear(rad, true);
        // a Rhaenyra entrando no corredor pela primeira vez com ele andando
        const rha = R('rhaenyra');
        if (!S.seenRha && rha && rha.z > COR.z0 + 0.3 && rha.x > COR.x0) { S.seenRha = true; say('rhaenyra', 'É só um aspirador… acho.', true); }
      }
      stepClimb(dt);
      // o pufe (até o trinco abrir)
      if (!S.latchOpen) pouf.update(dt, { comp });
      // a toalha: puxada pela boca da Radhija, ela escorrega; a lata vai junto até passar da beirada
      if (K.S?.tugWhat === 'toalha' && S.tin === 'mesa') {
        const p = Math.min(TC.pull, S.clothBase + (tug.pulled?.() ?? 0));
        if (p > S.clothP) { S.clothP = p; props.tablecloth?.setSlide?.(p); placeTinOnCloth(); }
        if (CK.x + S.clothP >= DT.x + DT.hx - 0.05) tinFall();
        else if (S.clothP >= TC.pull - 1e-3 && tug.holding?.()) tug.release?.();
      }
      stepTin(dt);
      // a porta dos fundos: a Rhaenyra empurrando, ela abre; passou da metade, a cena da saída
      if (S.latchOpen && !S.exitOpen) {
        exitGate.setTarget(S.exitPush ? 1 : exitGate.t);
        if (exitGate.t > 0.55) {
          openExit();
          if (K.S && !K.S.pending && !K.S.scene?.active) K.S.pending = CASA_SCENES.saida;
        }
      }
      S.exitPush = false;
      // as dicas de lugar
      const act = active ?? R(ctx.activeDog);
      if (act && K.S?.stage === 'casa') {
        if (act.name === 'rhaenyra' && !S.pantryLit && S.vac !== 'sleep' && near(act, { x: PN.switch.x + 0.4, z: PN.switch.z }, 1.4)) hints?.cond?.(HINTS.escuro, 4.5, 12);
        if (!S.latchOpen && near(act, pouf, 1.4) && !poufAtSofa() && S.pantryLit) hints?.cond?.(HINTS.pufe, 4.5, 14);
        if (!S.latchOpen && act.name === 'radhija' && poufAtSofa() && near(act, pouf, 1.2)) hints?.cond?.(HINTS.subir, 4, 12);
        if (S.tin === 'mesa' && act.name === 'radhija' && near(act, TC.bite, 1.4)) hints?.cond?.(HINTS.toalha, 4, 16);
      }
    },

    interact(c) {
      if (!S || K.S?.stage !== 'casa') return false;
      if (S.climb) return true;
      // a ponta da toalha: a Radhija morde e puxa (a Rhaenyra puxaria a mesa junto)
      const bp = props.tablecloth?.bitePoint?.() ?? { x: TC.bite.x + S.clothP, y: TC.bite.y, z: TC.bite.z };
      if (S.tin === 'mesa' && near(c, bp, TC.grabR + 0.3)) {
        if (c.name !== 'radhija') { say('rhaenyra', 'Se eu puxar, vem a mesa junto! Vai você, Radhija.', true); return true; }
        const anchor = { x: DT.x + DT.hx - 0.3, y: DT.h, z: DT.z };
        S.clothBase = S.clothP;
        tug.start(c, { bite: bp, anchor, len: Math.hypot(bp.x - anchor.x, bp.y - anchor.y) + (TC.pull - S.clothP) + 0.15 });
        if (K.S) K.S.tugWhat = 'toalha';
        hints?.now?.(HINTS.toalha, 3.6, 8);
        return true;
      }
      // o pufe encostado no sofá: a Radhija sobe
      if (!S.latchOpen && near(c, pouf, L.POUF.half + 0.55)) {
        if (c.name === 'radhija') {
          if (poufAtSofa()) { startSofaClimb(); return true; }
          say('radhija', 'Se esse pufe estivesse encostado no sofá, eu subia!', true);
          hints?.now?.(HINTS.pufe, 4.5, 6);
          return true;
        }
        say('rhaenyra', poufAtSofa() ? 'Eu sou grande demais pra subir aí. Vai você, Radhija!' : 'Esse pufe? Deixa comigo! (segure Shift)', true);
        return true;
      }
      // a porta dos fundos trancada: o trinco lá em cima (a câmera mostra, uma vez)
      if (!S.exitOpen && near(c, { x: EX.x - 0.35, z: exitMid.z }, 1.2) && c.x < EX.x) {
        if (!S.latchOpen) {
          emit('story:sfx', { name: 'trancado', x: EX.x, z: exitMid.z });
          if (!S.shownLatch) {
            S.shownLatch = true;
            K.ctx?.cam?.focusShot?.(LT.x, LT.z, { hold: 1.4, inT: 0.5, outT: 0.6, scale: 0.6, y: LT.y });
          }
          say(c.name, c.name === 'radhija' ? 'Trancada! E o trinco é lá em cima…' : 'O trinco tá lá no alto. Nem pulando!', true);
          hints?.now?.(HINTS.trancada, 4, 6);
        } else if (c.name === 'radhija') { say('radhija', 'Rhaenyra, empurra a porta!', true); hints?.now?.(HINTS.pesada, 4, 6); } else hints?.now?.(HINTS.empurrar, 4, 6);
        return true;
      }
      return false;
    },

    /** @param {number} dt @param {any} c @param {any} intent @param {{ shift?: boolean }} [o] */
    modifyIntent(dt, c, intent, { shift } = {}) {
      if (!S || S.climb || K.S?.stage !== 'casa') return null;
      // o medo: a Radhija indo para o corredor com o aspirador andando, ou para a despensa no escuro
      if (c.name === 'radhija' && intent.speed > 0.05) {
        if (fearHall.enabled && intent.dz > 0.3 && c.x > F.x0 && c.x < F.x1 && c.z > F.z0 - 0.55 && c.z < F.z0 + 0.05) { fear(c, true); return { intent: { ...intent, speed: 0 }, action: 'none' }; }
        if (fearDark.enabled && intent.dx < -0.3 && c.z > PF.z0 && c.z < PF.z1 && c.x < PF.x1 + 0.55 && c.x > PF.x0) { fear(c, false); return { intent: { ...intent, speed: 0 }, action: 'none' }; }
      }
      // o pufe
      if (!S.latchOpen) {
        const r = pouf.modifyIntent(dt, c, intent, { shift });
        if (r?.contact) {
          if (r.contact === 'strain') hints?.cond?.(HINTS.pufePesado, 3.6, 10);
          return r;
        }
      }
      // a porta dos fundos, empurrada por dentro
      if (!S.exitOpen && inExitPush(c, intent)) {
        if (c.size !== 'large') { hints?.cond?.(HINTS.pesada, 3.6, 10); return { intent: { ...intent, speed: Math.min(intent.speed, 0.2) }, action: 'strain' }; }
        if (!shift) return null;
        if (!S.latchOpen) {
          if (S.rattleCd <= 0) {
            S.rattleCd = 2.4;
            emit('story:sfx', { name: 'trancado', x: EX.x, z: exitMid.z });
            hints?.now?.(HINTS.trancada, 3.6, 6);
          }
          return { intent: { ...intent, speed: Math.min(intent.speed, 0.3) }, action: 'push' };
        }
        S.exitPush = true;
        return { intent: { ...intent, speed: Math.min(intent.speed, 0.55) }, action: 'push' };
      }
      return null;
    },
    /** O interruptor da despensa (com a luz apagada e o aspirador já acordado: antes disso a porta da cozinha está fechada). */
    wallSpots() { return S && !S.pantryLit && K.S?.stage === 'casa' ? [sw.spot] : []; },
    onWallTouch(c, spot) {
      if (spot?.id !== sw.id) return false;
      sw.touch();
      lightOn();
      return true;
    },
    /** O latido: o grosso da Rhaenyra perto do aspirador o manda para a base; o fininho da Radhija, não. */
    onBark(c) {
      if (!S || !vacActive() || S.vac === 'scared' || S.vac === 'home') return false;
      const d = Math.hypot(c.x - S.vx, c.z - S.vz);
      const inHall = c.x > COR.x0 - 0.1 && c.z > COR.z0 - 1.0 && c.z < COR.z1;
      if (d > V.barkR || !inHall) return false;
      if (c.name === 'rhaenyra') { scare('latido'); return true; }
      say('radhija', 'Late você, Rhaenyra! Meu latido não assusta nem pernilongo.', true);
      return false;
    },
    lockFor() { return null; },
    lookTarget(c) {
      if (!S) return null;
      if (vacActive() && c.name === 'radhija' && near(c, { x: S.vx, z: S.vz }, 3.2)) return { x: S.vx, y: 0.08, z: S.vz };
      if (vacActive() && c.name === 'rhaenyra' && near(c, { x: S.vx, z: S.vz }, 2.2)) return { x: S.vx, y: 0.08, z: S.vz };
      if (!S.pantryLit && c.name === 'radhija' && near(c, { x: PF.x1 + 0.3, z: (PF.z0 + PF.z1) / 2 }, 1.2)) return { x: PN.drip.x, y: 0.3, z: PN.drip.z };
      return null;
    },
    navFlags() { return { vacuumAway: casa.vacuumAway, pantryLit: S.pantryLit, exitOpen: S.exitOpen }; },
    /** O objetivo do HUD na etapa da casa (com a cena tocando ou na subida, nenhum). */
    objective() {
      const st = step();
      if (S.climb) return { text: null, target: null, stage: 'casa' };
      if (st === 'fora') return { text: null, target: null, stage: 'casa' };
      return { text: TEXTS[st], target: target(st), stage: 'casa' };
    },
    /** Para onde a nuvem de cheiro leva na casa: o próximo passo. */
    lead() {
      const st = step();
      const p = target(st);
      if (!p) return null;
      return { x: p.x, z: p.z, color: st === 'grade' || st === 'aspirador' ? SCENT.pombos : SCENT.cenoura };
    },

    // ---------------------------------------------------------------- o que as cenas chamam
    /** A porta da cozinha abriu (puzzle.onWallTouch): o barulho acorda o aspirador (a cena 'aspirador'). */
    onKitchenOpen() {
      if (S.vacuumSeen) return;
      if (K.S) K.S.pending = K.S.pending || CASA_SCENES.aspirador;
    },
    /** Na cena: ele acorda na base (os olhos acendem). */
    wakeVacuum() { setVacMode('wake'); placeVac(V.dock.x, V.dock.z, V.dock.yaw); },
    vacuumPose(x, z, yaw) { placeVac(x, z, yaw); },
    /** A pose dele na trilha, em z, andando no sentido d (+1 sul, −1 norte). */
    lanePose(z, d = -1) { placeVac(laneX(z), z, laneYaw(z, d)); },
    /** Commit da cena 'aspirador': ele anda pela trilha a partir de V.start, para o norte, e a Radhija não entra. */
    startPatrol() {
      S.vacuumSeen = true;
      S.bumps = 0;
      S.vdir = V.start.dir;
      placeVac(laneX(V.start.z), V.start.z, laneYaw(V.start.z, V.start.dir));
      setVacMode('patrol');
      objectiveNow();
    },
    openExit,
    /** Commit da cena 'portaFundos': a porta aberta de vez (o quintal começa ali). */
    afterExit() {
      openExit();
      if (!S.latchOpen) { S.latchOpen = true; props.exitDoor?.setLatch?.(1); }
    },
    /** Testes, E2E e ?stage=quintal: a casa inteira resolvida (sem a toalha, que é o paralelo). */
    skipAll() {
      S.vacuumSeen = true;
      placeVac(V.dock.x, V.dock.z, V.dock.yaw);
      setVacMode('docked');
      S.pantryLit = true;
      S.litT = -1;
      fearDark.enabled = false;
      props.pantry?.setLit?.(1);
      sw.setOn?.(true);
      K.faro?.setSpot?.('goteira', true);
      pouf.setPos(PS.x, (PS.z0 + PS.z1) / 2);
      pouf.freeze();
      S.latchOpen = true;
      props.exitDoor?.setLatch?.(1);
      openExit();
    },
    /**
     * Testes e E2E: a casa resolvida até antes do passo `st` ('aspirador', 'despensa', 'jantar', 'sala', 'porta'), as
     * duas perto dele. Supõe a etapa 'casa' (setStage/?stage=casa).
     */
    jump(st) {
      const i = CASA_STEPS.indexOf(st);
      if (i < 1) return false;
      K.openKitchenSide?.();
      S.vacuumSeen = true;
      if (i === 1) {
        casa.startPatrol();
        K.placeAt({ x: KD.latchPost.x + 0.1, z: KD.hinge.z - 0.9, yaw: 0 }, { x: KD.hinge.x - 0.15, z: KD.hinge.z - 1.3, yaw: 0 });
        return true;
      }
      placeVac(V.dock.x, V.dock.z, V.dock.yaw);
      setVacMode('docked');
      if (i === 2) {
        K.placeAt({ x: -13.0, z: 12.2, yaw: -Math.PI / 2 }, { x: -12.7, z: 11.2, yaw: -Math.PI / 2 });
        objectiveNow();
        return true;
      }
      S.pantryLit = true;
      fearDark.enabled = false;
      props.pantry?.setLit?.(1);
      sw.setOn?.(true);
      K.faro?.setSpot?.('goteira', true);
      if (i === 3) {
        K.placeAt({ x: -18.4, z: 11.6, yaw: -Math.PI / 2 }, { x: -18.0, z: 12.6, yaw: -Math.PI / 2 });
        objectiveNow();
        return true;
      }
      if (i === 4) {
        K.placeAt({ x: -15.4, z: 17.6, yaw: Math.PI / 2 }, { x: -15.9, z: 18.45, yaw: Math.PI / 2 });
        objectiveNow();
        return true;
      }
      pouf.setPos(PS.x, (PS.z0 + PS.z1) / 2);
      S.latchOpen = true;
      pouf.freeze();
      props.exitDoor?.setLatch?.(1);
      K.placeAt({ x: -13.4, z: 18.2, yaw: Math.PI / 2 }, { x: -12.7, z: 18.85, yaw: Math.PI / 2 });
      objectiveNow();
      return true;
    },
    reset() {
      S = fresh();
      placeVac(V.dock.x, V.dock.z, V.dock.yaw);
      setVacMode('sleep');
      fearDark.enabled = true;
      tinCol.enabled = false;
      sw.reset();
      pouf.reset();
      exitGate.reset();
      props.pantry?.setLit?.(0);
      props.exitDoor?.setLatch?.(0);
      props.tablecloth?.setSlide?.(0);
      props.cookieTin?.closeLid?.();
      props.cookieTin?.setPose?.(CK.x, TOP, CK.z);
      K.faro?.setSpot?.('goteira', false);
      K.faro?.setSpot?.('etiqueta', false);
      const e = treatEntry();
      if (e) e.y = 9; // escondido dentro da lata: alto demais para pegar
      treatItem()?.setHidden?.(true);
    },
    info() {
      return {
        step: step(), vacuum: S.vac, vac: { x: +S.vx.toFixed(2), z: +S.vz.toFixed(2) }, bumps: S.bumps, fearHall: fearHall.enabled, fearDark: fearDark.enabled,
        pantryLit: S.pantryLit, cloth: +S.clothP.toFixed(2), tin: S.tin, pouf: { x: +pouf.x.toFixed(2), z: +pouf.z.toFixed(2) }, poufAtSofa: poufAtSofa(),
        latchOpen: S.latchOpen, exitOpen: S.exitOpen, exit: +exitGate.t.toFixed(2), climb: S.climb ? S.climb.i : null,
      };
    },
    /** Para os testes: o que importa comparar (pulando ou não as cenas). */
    snapshot() {
      return {
        vacuum: S.vac, vac: { x: +S.vx.toFixed(3), z: +S.vz.toFixed(3) }, pantryLit: S.pantryLit, tin: S.tin, latchOpen: S.latchOpen,
        exitOpen: S.exitOpen, pouf: { x: +pouf.x.toFixed(3), z: +pouf.z.toFixed(3) },
      };
    },
    /** Constantes para as cenas e os testes. */
    TEXTS, HINTS,
  };
  S = fresh();
  casa.reset();
  return casa;
}
