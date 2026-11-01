// MODO HISTÓRIA · Capítulo 1 · Cadê a Cenoura? — o puzzle de área do Recanto das Patinhas (docs/HISTORIA.md, cap. 1).
// A missão em 7 passos, com as cenas entre eles:
//   abertura → cozinha (impulso da Rhaenyra na maçaneta) → galho (a Rhaenyra empurra; embaixo, as telhas) → piscina
//   (o Faro mostra a Reconstrução) → varal (arrancada da Radhija no poste; o Farelo pega a cenoura no ar) → torre (a
//   porta de mola, que a Rhaenyra segura com o Fica; cena do terraço) → portaria (o latido grosso acorda o porteiro)
//   → fechamento (os pombos passam pelo portal) → mural (o provisório, só o caso 3) → fim.
// Paralelos: a ilha do lago (latido de longe distrai a Dona Gansa; a Rhaenyra empurra o barquinho até o canal; só a
// Radhija atravessa), o telhado da guarita (a lixeira com o Fica; a Radhija sobe até a meia da antena) e a garagem (a
// Radhija puxa a corda debaixo da caminhonete; o balde cai na bola; a Rhaenyra empurra a porta do depósito).
// Pistas na lupa (src/story/clues.js), Faro em pulso (src/story/faro/faro.js), meias e petiscos.
// Eventos novos: story:* (HUD, sons e música da história: src/story/ui/storyHud.js). O núcleo chama onFaro (V, L3 ou o
// botão do focinho) e bloqueia a entrada enquanto cinematic() for verdadeiro.
import * as THREE from 'three';
import { events } from '../../../core/events.js';
import { createPushCrate, createHingedGate, createWallButton, createGooseNPC, createDogEffects } from '../../../game/mechanics/index.js';
import { createMouthTug } from '../../../game/mechanics/mouthTug.js';
import { createCollectibles, createHints } from '../../../game/puzzleKit.js';
import { createGoose } from '../../../characters/goose.js';
import { createBalloons } from '../../scene/balloons.js';
import { createDirector } from '../../scene/director.js';
import { createSkipInput } from '../../scene/skip.js';
import { createMood } from '../../scene/mood.js';
import { createFaro, SCENT } from '../../faro/faro.js';
import { createReconstruction } from '../../faro/reconstruction.js';
import { createClueBook, CLUES } from '../../clues.js';
import { MORNING } from './lighting.js';
import {
  createOpening, createReconScene, createVaralScene, createTerraceScene, createPorteiroScene, createClosingScene,
  squadOnLine, squadOnTank,
} from './scenes.js';

export const STAGES = ['abertura', 'cozinha', 'galho', 'piscina', 'varal', 'torre', 'portaria', 'fechamento', 'mural', 'fim'];
const stageIndex = (s) => STAGES.indexOf(s);

/** Os objetivos curtos do HUD (texto curto, como no roteiro). */
const OBJECTIVES = {
  cozinha: 'Abram a porta da cozinha',
  galho: 'Tirem o galho da porta',
  porta: 'Abram a porta da área de serviço',
  piscina: 'Farejem a piscina',
  varal: 'Peguem a cenoura no varal',
  torre: 'Subam no terraço da torre',
  portaria: 'Acordem o porteiro',
  fechamento: 'Saiam pelo portãozinho',
};
/** Dicas de controle (somem no modo sem dicas). */
const HINTS = {
  faroRhaenyra: 'Só a Radhija tem o Faro! (Q)',
  maçaneta: 'A maçaneta é alta: troque (Q) e pule na porta com a Rhaenyra.',
  galho: 'O galho trava a porta: a Rhaenyra empurra (segure Shift).',
  latidoFino: 'O latido fino não acorda o porteiro: troque (Q) e lata com a Rhaenyra (E).',
  lixeira: 'A lixeira tem rodinhas: a Rhaenyra precisa segurar (Fica: F).',
  portaMola: 'A porta de mola fecha sozinha: a Rhaenyra segura (Fica: F) e a irmã passa.',
  barquinho: 'O barquinho é pequeno: só a Radhija cabe nele.',
  porta: 'A porta do depósito está travada por dentro.',
};

/** @type {import('../../../types').DogName[]} */
const DOG_NAMES = ['radhija', 'rhaenyra'];

/** @param {import('../../../types').PuzzleContext<any>} ctx */
export function createPuzzle(ctx) {
  const { layout: L, props, world, dogs, ctrls, emit, root, engine } = ctx;
  const R = (n) => ctrls[n];

  // ---------------------------------------------------------------- sistemas da história
  const balloons = createBalloons({ root });
  const dir = createDirector({ ctx, balloons, emit });
  const skip = createSkipInput({ emit });
  const mood = createMood(engine, { base: MORNING });
  const faro = createFaro({ root, engine, world });
  const book = createClueBook({ emit });
  const hints = createHints(emit, { hint: HINTS, prompt: {} });

  // trilhas de cheiro e pistas do Faro
  faro.addTrail('cenoura', L.CARROT_TRAIL, { color: SCENT.cenoura, fadeEnd: true, spacing: 0.1, size: 1.15 });
  faro.addTrail('pombos-piscina', [{ x: L.RECON.x - 0.4, z: L.RECON.z + 0.6 }, { x: L.RECON.x, z: L.RECON.z }, { x: L.RECON.x + 0.5, z: L.RECON.z - 0.4 }], { color: SCENT.pombos, spacing: 0.18, size: 0.9 });
  faro.addTrail('pombos-varal', [{ x: L.LINE.a.x + 0.6, z: L.LINE.a.z + 0.5 }, { x: L.CARROT_PIN.x, z: L.CARROT_PIN.z + 0.5 }, { x: L.LINE.b.x + 0.4, z: L.LINE.b.z + 0.9 }], { color: SCENT.pombos, spacing: 0.22 });
  faro.addTrail('gansa', [{ x: L.PIER.x0 + 0.2, z: (L.PIER.z0 + L.PIER.z1) / 2 }, { x: L.GOOSE.home.x, z: L.GOOSE.home.z }], { color: SCENT.gansa, spacing: 0.2 });
  const spots = L.CLUE_SPOTS;
  faro.addSpot('pote', { ...spots.pote, y: 0.03, kind: 'pista' });
  faro.addSpot('pena', { ...spots.pena, kind: 'pista', size: 0.6 });
  // a baba fica no parapeito de dentro, em cima da caminha: a linha de visão confere de um ponto do chão do quarto ao
  // lado da caminha (o próprio parapeito fica dentro dela e da parede)
  faro.addSpot('baba', { ...spots.baba, kind: 'escondida', size: 0.55, los: { x: L.BED.x + L.BED.r + 0.05, z: L.WINDOW.z + 0.35 } });
  faro.addSpot('boia', { ...spots.boia, kind: 'reconstrucao' });
  faro.addSpot('ralo', { ...spots.ralo, kind: 'escondida', size: 0.6, los: { x: spots.ralo.x, z: L.TANKS.z1 + 0.35 } });

  // a Reconstrução da piscina: o pombo pousa na borda, pega a boia murcha e sai baixo e torto para o nordeste
  const RC = L.RECON;
  const gp = props.ghosts.pigeon;
  const recon = createReconstruction({
    root,
    material: props.ghosts.material,
    actors: [
      {
        id: 'pombo', object: gp.object,
        keys: [
          { t: 0, x: RC.x + 3.0, y: 2.3, z: RC.z - 2.6, yaw: -2.3, flying: true, prog: 0.2 },
          { t: 1.05, x: RC.x + 0.7, y: 0.6, z: RC.z - 0.5, yaw: -2.3, flying: true, prog: 0.85 },
          { t: 1.45, x: RC.x + 0.2, y: 0.0, z: RC.z - 0.1, yaw: -2.0, flying: false, prog: 1 },
          { t: 2.45, x: RC.x + 0.1, y: 0.0, z: RC.z - 0.05, yaw: -1.6, flying: false, peck: true },
          { t: 2.75, x: RC.x + 0.3, y: 0.45, z: RC.z - 0.4, yaw: 0.9, flying: true, prog: 0 },
          { t: 3.6, x: RC.x + 1.6, y: 0.35, z: RC.z - 1.6, yaw: 0.8, flying: true, prog: 0 },
          { t: 4.4, x: RC.x + 2.9, y: 0.75, z: RC.z - 2.6, yaw: 0.6, flying: true, prog: 0 },
          { t: 5.2, x: RC.x + 4.4, y: 1.15, z: RC.z - 4.2, yaw: 0.7, flying: true, prog: 0 },
        ],
        pose(o, k, dt) {
          gp.setPose({ x: k.x, y: k.y, z: k.z, yaw: k.yaw, flying: !!k.flying, flightProgress: k.prog ?? 0 });
          if (k.peck && !gp._pecked) { gp._pecked = true; gp.peck(); }
          if (!k.peck) gp._pecked = false;
          gp.update(dt, S.time);
        },
      },
      {
        id: 'boia', object: props.ghosts.float,
        keys: [
          { t: 0, x: RC.x, y: 0.01, z: RC.z, yaw: 0.3 },
          { t: 2.6, x: RC.x, y: 0.01, z: RC.z, yaw: 0.3 },
          { t: 2.75, x: RC.x + 0.3, y: 0.28, z: RC.z - 0.4, yaw: 0.9 },
          { t: 3.6, x: RC.x + 1.6, y: 0.18, z: RC.z - 1.6, yaw: 1.2 },
          { t: 4.4, x: RC.x + 2.9, y: 0.55, z: RC.z - 2.6, yaw: 0.6 },
          { t: 5.2, x: RC.x + 4.4, y: 0.95, z: RC.z - 4.2, yaw: 0.9 },
        ],
      },
    ],
  });

  // a pena molhada no parapeito de fora e a borboleta do fechamento (miudezas das cenas)
  const feather = new THREE.Mesh(
    (() => { const g = new THREE.ConeGeometry(0.025, 0.16, 6); g.scale(1, 1, 0.25); return g; })(),
    new THREE.MeshStandardMaterial({ color: '#cfd5e2', roughness: 0.7 }),
  );
  feather.name = 'historia:pena';
  feather.visible = false;
  root.add(feather);
  const butterfly = new THREE.Group();
  butterfly.name = 'historia:borboleta';
  const wingMat = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.6, side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), wingMat);
    w.position.x = s * 0.045;
    butterfly.add(w);
    return w;
  });
  butterfly.visible = false;
  root.add(butterfly);

  // ---------------------------------------------------------------- mecânicas
  const effects = createDogEffects({ world, dogs });
  const handle = createWallButton({ id: 'macaneta', cfg: L.KITCHEN_HANDLE, emit, prop: props.kitchenHandle });
  const kitchenDoor = createHingedGate({ id: 'porta-cozinha', cfg: L.KITCHEN_DOOR, world, prop: props.kitchenDoor });
  const serviceDoor = createHingedGate({ id: 'porta-servico', cfg: L.SERVICE_DOOR, world, prop: props.serviceDoor });
  const towerDoor = createHingedGate({ id: 'porta-torre', cfg: L.TOWER_DOOR, world, prop: props.towerDoor });
  const storageDoor = createHingedGate({ id: 'porta-deposito', cfg: L.STORAGE_DOOR, world, prop: props.storageDoor });
  const gate = createHingedGate({ id: 'portaozinho', cfg: L.GATE_LEAF, world, prop: props.gateLeaf });
  const branch = createPushCrate({ id: 'galho', cfg: L.BRANCH, world, emit, prop: props.branch });
  const bin = createPushCrate({ id: 'lixeira', cfg: L.BIN, world, emit, prop: props.bin });
  const boat = createPushCrate({
    id: 'barquinho', cfg: L.BOAT, world, emit, prop: props.boat,
    onLimit: (lim) => {
      if (S.boatDocked || S.dockT >= 0 || lim.axis !== 'z' || lim.dir >= 0) return false;
      if (Math.abs(boat.x - L.BOAT.dock.x) > 0.15) return false;
      S.dockT = 0;
      boat.disable?.();
      emit('story:sfx', { name: 'splash', x: L.BOAT.dock.x, z: L.BOAT.dock.z });
      return true;
    },
  });
  const goose = createGooseNPC({ cfg: L.GOOSE, world, nav: ctx.nav, root, emit, effects, createGoose });
  const tug = createMouthTug({ dogs, ctrls, world });
  props.rope?.setGrip?.(() => tug.grip());
  const collect = createCollectibles({ list: L.COLLECTIBLES, props, emit, pickupR: L.COLLECTIBLE_PICKUP_R });
  // o canal fechado até o barquinho encaixar; depois, a ponte que só a Radhija atravessa
  const CH = L.CHANNEL;
  const channelMouth = world.addDynamic({ id: 'canal-boca', kind: 'water', shape: 'segment', ax: CH.x0 - 0.05, az: CH.z1, bx: CH.x1 + 0.05, bz: CH.z1, t: 0.1 });
  const boatBridge = world.addDynamic({ id: 'barquinho-ponte', kind: 'static', shape: 'box', x: (CH.x0 + CH.x1) / 2, z: (CH.z0 + CH.z1) / 2, hx: (CH.x1 - CH.x0) / 2, hz: (CH.z1 - CH.z0) / 2, blocks: 'large' });
  // a bola e o balde no chão do depósito (depois da queda) também colidem
  const ballCol = world.addDynamic({ id: 'bola', kind: 'static', shape: 'circle', x: L.BALL.x, z: L.BALL.z, r: L.BALL.r });
  const bucketCol = world.addDynamic({ id: 'balde', kind: 'static', shape: 'circle', x: L.SHELF.landing.x, z: L.SHELF.landing.z, r: 0.17 });

  // ---------------------------------------------------------------- estado
  /** @type {any} */
  let S = null;
  function fresh() {
    return {
      stage: 'abertura', time: 0, scene: null, pending: 'abertura',
      kitchenOpen: false, branchFree: false, serviceOpen: false, reconDone: false, varalDone: false, terraceDone: false,
      porterDone: false, gateOpen: false, closingDone: false, muralDone: false,
      boatDocked: false, dockT: -1, bucketT: -1, ballClear: false, storageOpen: false,
      towerPush: false, towerHeld: false, storagePush: false, lastActive: null, socks: new Set(), climb: null,
      snoreT: 1.5, radioT: 0.6, radioOn: true, prompt: null, music: null, mandaCd: 0, rattleCd: 0, mural: null,
    };
  }

  // ---------------------------------------------------------------- o contexto das cenas
  const K = {
    ctx, dir, props, L, faro, recon, book, mood, emit, feather, butterfly,
    get S() { return S; },
    clueAt(id) {
      const s = spots[id];
      return s ? { x: s.x, y: s.y ?? 0.3, z: s.z } : {};
    },
    placeStart() {
      for (const n of DOG_NAMES) {
        const s = L.DOGS[n].start;
        ctx.place(n, s.x, s.z, s.yaw);
      }
      for (const n of DOG_NAMES) ctx.setStay(n, false);
    },
    placeAt(rad, rha) {
      ctx.place('radhija', rad.x, rad.z, rad.yaw ?? 0);
      ctx.place('rhaenyra', rha.x, rha.z, rha.yaw ?? 0);
      for (const n of DOG_NAMES) ctx.setStay(n, false);
    },
    setStage,
    closeTowerDoor() { towerDoor.setTarget(0); towerDoor.set?.(0); },
    gateOpened() { S.gateOpen = true; clearSweep(gate, { x: (L.GATE.x0 + L.GATE.x1) / 2, z: L.GATE.z }); gate.lock(); gate.set?.(1); },
    set snoring(on) { S.snoreT = on ? 1.5 : Infinity; },
  };
  let scenes = null;
  function makeScenes() {
    return {
      abertura: createOpening(K),
      reconstrucao: createReconScene(K),
      varal: createVaralScene(K),
      terraco: createTerraceScene(K),
      porteiro: createPorteiroScene(K),
      fechamento: createClosingScene(K),
    };
  }

  function setStage(st) {
    if (S.stage === st) return;
    S.stage = st;
    emit('story:stage', { stage: st });
    puzzle.onStageChange?.(st);
    if (st === 'mural') openMural();
  }
  function startScene(id) {
    if (S.scene?.active) return false;
    const sc = scenes[id];
    if (!sc) return false;
    S.scene = sc;
    tug.release?.();
    cam()?.setZone?.('telhado', false);
    skip.arm();
    sc.start({});
    return true;
  }
  const cam = () => ctx.cam;

  // ---------------------------------------------------------------- mural e fim do capítulo
  function openMural() {
    S.mural = { openedAt: S.time };
    emit('story:mural', { open: true, case: 'C3', owned: book.ofCase('C3'), clues: book.found });
  }
  /** O primeiro Faro da abertura (o botão do aparelho ou o toque no próprio aviso: ui:storyFaro). */
  function pressOpeningFaro() {
    if (!scenes || !S?.scene || S.scene !== scenes.abertura || !scenes.abertura.waitingFaro) return false;
    scenes.abertura.pressFaro();
    return true;
  }
  const offFaro = events.on('ui:storyFaro', () => { pressOpeningFaro(); });
  const offMural = events.on('ui:muralDone', (/** @type {{ errors?: number }} */ p = {}) => {
    if (!S || S.stage !== 'mural') return;
    S.muralDone = true;
    S.muralErrors = p.errors ?? 0;
    setStage('fim');
    const hid = book.hidden(1);
    emit('story:chapterEnd', {
      chapter: 1, title: 'Cadê a Cenoura?', clues: book.count, hidden: hid.found, hiddenTotal: hid.total,
      socks: S.socks.size, socksTotal: L.SOCKS.length, treats: collect.count, treatsTotal: collect.total,
      timeSec: Math.round(S.time),
    });
  });

  // ---------------------------------------------------------------- ajudas
  const near = (c, p, r) => Math.hypot(c.x - p.x, c.z - p.z) <= r;
  const inRect = (c, Q) => c.x >= Q.x0 && c.x <= Q.x1 && c.z >= Q.z0 && c.z <= Q.z1;
  const boothCenter = { x: (L.BOOTH.x0 + L.BOOTH.x1) / 2, z: (L.BOOTH.z0 + L.BOOTH.z1) / 2 };
  const distVol = (p, R0 = 9) => {
    const c = R(ctx.activeDog);
    return Math.max(0, 1 - Math.hypot(c.x - p.x, c.z - p.z) / R0);
  };
  const doorMid = (D) => ({ x: (D.hinge.x + D.latchPost.x) / 2, z: (D.hinge.z + D.latchPost.z) / 2 });

  // ---------------------------------------------------------------- a subida da Radhija pela lixeira (paralelo B)
  function startClimb() {
    const c = R('radhija');
    const bx = bin.x, bz = bin.z;
    // ela sobe pelo lado da lixeira em que está (a irmã segurando fica do outro lado, sem ninguém passar por ninguém)
    const rha = R('rhaenyra');
    const side = c.x >= bx ? 1 : -1;
    let ax = bx + side * (L.BIN.half + 0.3);
    if (Math.hypot(rha.x - ax, rha.z - bz) < rha.r + c.r + 0.08) ax = bx - side * (L.BIN.half + 0.3);
    const foot = { x: ax, z: bz };
    const steps = [
      { kind: 'walk', to: foot, dur: 0.45, y: 0 },
      { kind: 'hop', to: { x: bx, z: bz }, y: L.CLIMB.bin, dur: 0.55 },
      { kind: 'hop', to: { x: bx, z: L.CLIMB.awning.z }, y: L.CLIMB.awning.y, dur: 0.55 },
      { kind: 'hop', to: { x: bx, z: L.CLIMB.roof.z }, y: L.CLIMB.roof.y, dur: 0.55 },
      { kind: 'walk', to: { x: L.CLIMB.antenna.x, z: L.CLIMB.antenna.z }, dur: 0.9, y: L.CLIMB.roof.y },
      { kind: 'grab', dur: 0.8, y: L.CLIMB.roof.y },
      { kind: 'walk', to: { x: bx, z: L.CLIMB.roof.z }, dur: 0.9, y: L.CLIMB.roof.y },
      { kind: 'hop', to: { x: bx, z: L.CLIMB.awning.z }, y: L.CLIMB.awning.y, dur: 0.5 },
      { kind: 'hop', to: { x: bx, z: bz }, y: L.CLIMB.bin, dur: 0.5 },
      { kind: 'hop', to: foot, y: 0, dur: 0.5 },
    ];
    S.climb = { i: 0, t: 0, from: { x: c.x, z: c.z, y: 0 }, steps };
    dir.hold('radhija');
    cam()?.setZone?.('telhado', true);
    emit('story:sfx', { name: 'lixeira', x: bx, z: bz });
  }
  function stepClimb(dt) {
    const C = S.climb;
    if (!C) return;
    const st = C.steps[C.i];
    if (!st) {
      S.climb = null;
      dir.release('radhija');
      cam()?.setZone?.('telhado', false);
      return;
    }
    C.t += dt;
    const k = Math.min(1, C.t / st.dur);
    const a = dir.actor('radhija');
    const f = C.from;
    if (st.kind === 'grab') {
      a.press = { x: L.ANTENNA.x, y: L.ANTENNA.sock, z: L.ANTENNA.z, k: Math.sin(k * Math.PI) };
      a.look = { x: L.ANTENNA.x, y: L.ANTENNA.sock, z: L.ANTENNA.z };
      a.speed = 0;
      if (k > 0.5 && !S.socks.has('antena')) takeSock('antena');
    } else {
      const to = st.to;
      const e = k * k * (3 - 2 * k);
      a.x = f.x + (to.x - f.x) * e;
      a.z = f.z + (to.z - f.z) * e;
      const yy = f.y + (st.y - f.y) * e;
      a.y = st.kind === 'hop' ? yy + Math.sin(k * Math.PI) * 0.25 : yy;
      a.airK = st.kind === 'hop' && k < 1 ? k : -1;
      a.press = null;
      const dx = to.x - f.x, dz = to.z - f.z;
      if (Math.hypot(dx, dz) > 0.05) a.yaw = Math.atan2(dx, dz);
      a.speed = st.kind === 'walk' ? Math.hypot(dx, dz) / st.dur : 0.8;
      if (st.kind === 'hop' && k >= 1) emit('story:sfx', { name: 'pulinho', x: a.x, z: a.z, volume: 0.7 });
    }
    if (k >= 1) {
      C.from = { x: a.x, z: a.z, y: st.y ?? a.y };
      C.i++;
      C.t = 0;
    }
  }
  const climbing = () => !!S.climb;

  function takeSock(id) {
    const sock = props.socks?.find((s) => s.id === id);
    if (!sock || S.socks.has(id)) return;
    S.socks.add(id);
    sock.collect();
    const def = L.SOCKS.find((s) => s.id === id);
    emit('story:sock', { id, count: S.socks.size, total: L.SOCKS.length, x: def?.x, y: def?.y, z: def?.z });
  }

  // ---------------------------------------------------------------- o barquinho encaixando no canal (paralelo A)
  const boatFloat = () => props.boat?.floatY ?? -0.15;
  function stepDock(dt) {
    if (S.dockT < 0 || S.boatDocked) return;
    S.dockT += dt;
    const k = Math.min(1, S.dockT / 1.1);
    const e = k * k * (3 - 2 * k);
    const D = L.BOAT.dock;
    const z = L.BOAT.start.z + (D.z - L.BOAT.start.z) * e;
    // assentando na água do canal (o casco afunda até a linha d'água: props.boat.floatY)
    props.boat?.setPos?.(D.x, z, boatFloat() * e, Math.sin(k * Math.PI) * 0.12);
    if (k >= 1) dock();
  }
  function dock() {
    S.boatDocked = true;
    S.dockT = 99;
    props.boat?.setPos?.(L.BOAT.dock.x, L.BOAT.dock.z, boatFloat(), 0);
    channelMouth.enabled = false;
    boatBridge.enabled = true;
    emit('story:boat', { docked: true });
  }

  // ---------------------------------------------------------------- o balde e a bola (paralelo C)
  function stepBucket(dt) {
    if (S.bucketT < 0) return;
    S.bucketT += dt;
    const k = Math.min(1, S.bucketT / 1.4);
    props.bucket?.setTip?.(k);
    // a bola começa a rolar quando o balde encosta nela (props.bucket.hitT, na escala da queda)
    const hitT = props.bucket?.hitT ?? 0.55;
    if (k > hitT) {
      const u = Math.min(1, (S.bucketT - hitT * 1.4) / 0.9);
      const e = 1 - (1 - u) * (1 - u);
      const B = L.BALL, T = B.rollTo;
      const x = B.x + (T.x - B.x) * e, z = B.z + (T.z - B.z) * e;
      props.ball?.setPos?.(x, z, B.r, e * 9);
      ballCol.x = x;
      ballCol.z = z;
      if (!S.clang) { S.clang = true; emit('story:sfx', { name: 'balde', x: L.SHELF.x, z: L.SHELF.z }); }
      if (u >= 1 && !S.ballClear) {
        S.ballClear = true;
        bucketCol.enabled = true;
        emit('story:sfx', { name: 'bola', x: T.x, z: T.z });
        emit('story:ball', { clear: true });
      }
    }
    if (k >= 1 && S.ballClear) S.bucketT = -2;
  }

  // ---------------------------------------------------------------- avanço de etapas (para ?stage= e os testes)
  const APPLY = {
    cozinha() {
      mood.set(MORNING);
      props.rain?.setOn?.(0);
      props.windowLeaf?.setOpen?.(0);
      props.bowl?.setTipped?.(1);
      feather.visible = true;
      feather.position.set(L.SILL.out.x + 0.25, L.SILL.out.y + 0.03, L.SILL.out.z);
      feather.rotation.set(0, 0.4, 1.45);
      squadOnLine(K);
      for (const id of ['pombos', 'abraco', 'pote', 'trilha', 'pena']) book.add(id, { silent: true });
      S.music = 'recanto';
    },
    galho() { S.kitchenOpen = true; handle.setOn?.(true); kitchenDoor.setTarget(1); kitchenDoor.set?.(1); kitchenDoor.lock(); },
    piscina() {
      branch.setPos(L.BRANCH.maxX, L.BRANCH.start.z);
      S.branchFree = true;
      book.add('telhas', { silent: true });
      S.serviceOpen = true;
      serviceDoor.setTarget(1); serviceDoor.set?.(1); serviceDoor.lock();
    },
    varal() { S.reconDone = true; book.add('boia', { silent: true }); },
    torre() { S.varalDone = true; props.line?.setPin?.(1); squadOnTank(K); },
    portaria() {
      S.terraceDone = true;
      for (const p of Object.values(props.squad || {})) p.setVisible(false);
      if (props.carrot) props.carrot.object.visible = false;
    },
    fechamento() { S.porterDone = true; props.gateLeaf?.setOpen?.(1); S.gateOpen = true; gate.setTarget(1); gate.set?.(1); gate.lock(); S.snoreT = Infinity; },
    mural() { S.closingDone = true; },
    fim() {},
  };
  /** Onde as dogs começam numa etapa pulada (perto do objetivo dela). */
  const STAGE_SPOTS = {
    cozinha: null,
    galho: [{ x: -5.6, z: 3.3, yaw: 0 }, { x: -6.1, z: 3.9, yaw: 0 }],
    piscina: [{ x: -4.8, z: 0.2, yaw: Math.PI }, { x: -4.2, z: 0.5, yaw: Math.PI }],
    varal: [{ x: 1.6, z: -6.5, yaw: Math.PI }, { x: 0.8, z: -6.4, yaw: Math.PI }],
    torre: [{ x: 2.7, z: -6.4, yaw: Math.PI / 2 }, { x: 2.6, z: -5.5, yaw: Math.PI / 2 }],
    portaria: [{ x: 2.85, z: -6.5, yaw: -Math.PI / 2 }, { x: 2.75, z: -5.55, yaw: -Math.PI / 2 }],
    fechamento: [{ x: 11.0, z: -5.6, yaw: Math.PI }, { x: 11.7, z: -5.5, yaw: Math.PI }],
    mural: [{ x: 12.6, z: -6.7, yaw: Math.PI }, { x: 13.2, z: -6.3, yaw: Math.PI }],
    fim: [{ x: 12.6, z: -6.7, yaw: Math.PI }, { x: 13.2, z: -6.3, yaw: Math.PI }],
  };

  // ---------------------------------------------------------------- o puzzle
  /** @type {import('../../../types').Puzzle & Record<string, any>} */
  const puzzle = {
    stages: STAGES,
    get stage() { return S.stage; },
    carrier: null,
    get collected() { return collect.count; },
    get total() { return collect.total; },
    onStageChange: () => {},

    objective() {
      const st = S.stage;
      if (S.scene?.active || climbing()) return { text: null, target: null, stage: st };
      const T = (text, p, y = 0.6) => ({ text, target: p ? { x: p.x, y, z: p.z } : null, stage: st });
      switch (st) {
        case 'cozinha': return T(OBJECTIVES.cozinha, { x: L.KITCHEN_HANDLE.x - 0.25, z: L.KITCHEN_HANDLE.z }, 1.3);
        case 'galho': return S.branchFree ? T(OBJECTIVES.porta, doorMid(L.SERVICE_DOOR), 1.2) : T(OBJECTIVES.galho, branch, 0.9);
        case 'piscina': return T(OBJECTIVES.piscina, L.RECON, 0.6);
        case 'varal': return T(OBJECTIVES.varal, L.CARROT_PIN, L.CARROT_PIN.y + 0.4);
        case 'torre': return T(OBJECTIVES.torre, doorMid(L.TOWER_DOOR), 1.4);
        case 'portaria': return T(OBJECTIVES.portaria, props.booth?.windowAnchor ?? boothCenter, 1.7);
        case 'fechamento': return T(OBJECTIVES.fechamento, { x: (L.GATE.x0 + L.GATE.x1) / 2, z: L.GATE.z + 0.3 }, 1.3);
        default: return { text: null, target: null, stage: st };
      }
    },

    update(dt, { active, comp, ctrls: C }) {
      S.time += dt;
      S.mandaCd = Math.max(0, S.mandaCd - dt);
      S.rattleCd = Math.max(0, S.rattleCd - dt);
      hints.frame?.(dt);
      // a cena (com o pular) e o diretor
      if (!S.scene?.active && S.pending) {
        const id = S.pending;
        S.pending = null;
        startScene(id);
      }
      if (S.scene?.active) {
        if (S.scene.skippable && skip.update(dt)) S.scene.skip();
        S.scene.update(dt);
        if (!S.scene.active) {
          S.scene = null;
          skip.disarm();
          emit('objective', puzzle.objective(ctx.activeDog));
        }
      }
      stepClimb(dt);
      dir.update(dt);
      balloons.update(dt);
      faro.update(dt, S.time);
      recon.update(dt);
      if (faro.k === 0 && S.faroWasOn) { S.faroWasOn = false; emit('story:faroEnd', {}); }

      // portas (e a alavanca da maçaneta)
      handle.update?.(dt);
      kitchenDoor.update(dt, { ctrls: C });
      serviceDoor.update(dt, { ctrls: C });
      // a mola fecha sozinha: aberta enquanto a Rhaenyra empurra ou segura (no Fica, encostada na folha aberta)
      if (S.towerHeld && (!ctx.isStaying('rhaenyra') || !near(R('rhaenyra'), towerHoldSpot, 0.5))) S.towerHeld = false;
      towerDoor.setTarget(S.towerPush || S.towerHeld ? 1 : 0);
      S.towerPush = false;
      towerDoor.update(dt, { ctrls: C });
      if (S.ballClear && S.storagePush && !S.storageOpen) storageDoor.setTarget(1);
      S.storagePush = false;
      storageDoor.update(dt, { ctrls: C });
      if (!S.storageOpen && storageDoor.t > 0.6) { S.storageOpen = true; storageDoor.lock(); emit('door:open', { id: 'deposito', x: L.STORAGE.x0, z: 7.15 }); }
      gate.update(dt, { ctrls: C });
      // empurráveis, a Dona Gansa, a corda
      branch.update(dt, { comp });
      bin.update(dt, { comp });
      if (!S.boatDocked && S.dockT < 0) boat.update(dt, { comp });
      stepDock(dt);
      if (!S.scene?.active) goose.update(dt, { active, ctrls: C });
      goose.animate?.(dt);
      effects.update(dt, C);
      tug.update(dt);
      props.rope?.setPull?.(Math.min(1, (tug.pulled?.() ?? 0) / L.ROPE.pull));
      if (S.bucketT === -1 && tug.holding?.() && (tug.pulled?.() ?? 0) >= L.ROPE.pull) {
        S.bucketT = 0;
        tug.release?.();
        emit('story:sfx', { name: 'corda', x: L.ROPE.end.x, z: L.ROPE.end.z });
      }
      stepBucket(dt);
      // petiscos e meias
      if (!S.scene?.active && !climbing()) {
        collect.update(active);
        for (const s of L.SOCKS) {
          if (s.id === 'antena' || S.socks.has(s.id)) continue;
          if (near(active, s, L.SOCK_PICKUP_R) && (s.id !== 'deposito' || S.storageOpen)) takeSock(s.id);
        }
      }
      // a guarita: ronco e radinho enquanto o porteiro dorme
      if (!S.porterDone && stageIndex(S.stage) >= stageIndex('cozinha')) {
        S.snoreT -= dt;
        if (S.snoreT <= 0) {
          S.snoreT = 2.8;
          const v = distVol(boothCenter, 10);
          if (v > 0.05) {
            balloons.show('zzz', { at: { ...(props.booth?.windowAnchor ?? { x: boothCenter.x, y: 1.4, z: L.BOOTH.z1 }) }, kind: 'solto', life: 2.2, size: 0.34 });
            emit('story:sfx', { name: 'ronco', x: boothCenter.x, z: boothCenter.z, volume: v });
          }
        }
      }
      if (S.radioOn) {
        S.radioT -= dt;
        if (S.radioT <= 0) {
          S.radioT = 3.2;
          const v = distVol(boothCenter, 8);
          if (v > 0.05) emit('story:sfx', { name: 'radinho', x: boothCenter.x, z: boothCenter.z, volume: v * 0.8 });
        }
      }
      props.booth?.radio?.setOn?.(S.radioOn);

      // gatilhos da missão
      const rad = R('radhija');
      if (!S.scene?.active) {
        if (stageIndex(S.stage) >= stageIndex('cozinha') && !book.has('telhas') && branch.x >= L.BRANCH.start.x + 0.55) {
          book.add('telhas', K.clueAt('telhas'));
        }
        if (!S.branchFree && branch.x >= L.BRANCH.freeX) {
          S.branchFree = true;
          emit('objective', puzzle.objective(ctx.activeDog));
        }
        // a arrancada da Radhija no poste do varal: sacode o varal (com a Reconstrução feita, o pregador solta)
        if (rad.dashT > 0 && near(rad, L.DASH_POST, L.DASH_POST.r) && stageIndex(S.stage) >= stageIndex('piscina') && !S.varalDone) {
          if (S.stage === 'varal') { S.varalDone = true; startScene('varal'); }
          else if (S.rattleCd <= 0) {
            S.rattleCd = 1.6;
            props.line?.shake?.(0.6);
            S.lineShakeT = 0;
            for (const p of Object.values(props.squad || {})) p.peck?.();
            emit('story:sfx', { name: 'varal', x: L.DASH_POST.x, z: L.DASH_POST.z });
          }
        }
        if (S.lineShakeT !== undefined && S.lineShakeT >= 0 && !S.varalDone) {
          S.lineShakeT += dt;
          props.line?.shake?.(0.6 * Math.exp(-S.lineShakeT * 2.5));
          if (S.lineShakeT > 2.5) { S.lineShakeT = -1; props.line?.shake?.(0); }
        }
        if (S.stage === 'torre' && inRect(rad, L.TOWER_LOBBY)) startScene('terraco');
        if (S.stage === 'fechamento' && (near(active, { x: (L.GATE.x0 + L.GATE.x1) / 2, z: L.GATE.z + 0.35 }, 0.75))) startScene('fechamento');
      }
      // a Rhaenyra segurando a porta de mola: trocar de cachorrinha com ela no vão a deixa no Fica
      if (S.lastActive !== ctx.activeDog) {
        const rha = R('rhaenyra');
        if (ctx.activeDog === 'radhija' && towerDoor.t > 0.45 && inDoorway(rha, L.TOWER_DOOR)) {
          // ela fica segurando: encosta na folha aberta, do lado da dobradiça, e o vão fica livre para a irmã passar
          ctx.setStay('rhaenyra', true);
          S.towerHeld = true;
          effects.pushTo(rha, towerHoldSpot.x, towerHoldSpot.z, { dur: 0.45, action: 'push', face: { x: towerHoldSpot.x, z: L.TOWER_DOOR.hinge.z - 0.6 } });
        }
        S.lastActive = ctx.activeDog;
      }
      // a borboleta bate as asas
      if (butterfly.visible) { const f = Math.sin((K.butterflyFlap ?? 0) * 26) * 0.9; wings[0].rotation.y = f; wings[1].rotation.y = -f; }
      return null;
    },

    interact(c) {
      if (S.scene?.active || climbing()) return true;
      const st = S.stage;
      // a Radhija manda: aponta a maçaneta (a irmã é quem alcança)
      if (st === 'cozinha' && c.name === 'radhija' && near(c, doorMid(L.KITCHEN_DOOR), 1.7)) {
        if (S.mandaCd <= 0) {
          S.mandaCd = 2.2;
          dir.bark('radhija');
          balloons.show('seta', { follow: () => dir.head('radhija', 0.3), kind: 'fala', life: 1.4, size: 0.38 });
          hints.now('maçaneta', 3.6, 6);
        }
        return true;
      }
      // a porta da área de serviço: abre com o galho fora do caminho
      if (st === 'galho' && near(c, doorMid(L.SERVICE_DOOR), 1.35)) {
        if (S.branchFree) {
          openServiceDoor();
        } else if (S.rattleCd <= 0) {
          S.rattleCd = 2;
          emit('story:sfx', { name: 'trancado', x: L.SERVICE_DOOR.hinge.x, z: L.SERVICE_DOOR.hinge.z });
          balloons.show('ex', { at: { x: branch.x, y: 0.95, z: branch.z }, kind: 'solto', life: 1.2, size: 0.32 });
          hints.now('galho', 3.4, 6);
        }
        return true;
      }
      // a lixeira encostada no toldo, segura pela irmã: a Radhija sobe
      if (c.name === 'radhija' && !S.socks.has('antena') && near(c, bin, L.BIN.half + 0.55)) {
        const atSpot = bin.x >= L.BIN_SPOT.x0 && bin.x <= L.BIN_SPOT.x1 && bin.z >= L.BIN_SPOT.z0 && bin.z <= L.BIN_SPOT.z1;
        const rha = R('rhaenyra');
        const held = ctx.isStaying('rhaenyra') && near(rha, bin, L.BIN.half + 0.62);
        if (atSpot && held) { startClimb(); return true; }
        if (atSpot) {
          // sem a irmã segurando, a lixeira escapa um pouquinho
          bin.setPos(bin.x, Math.min(L.BIN.maxZ, bin.z + 0.12));
          emit('story:sfx', { name: 'lixeira', x: bin.x, z: bin.z });
          hints.now('lixeira', 3.6, 6);
          return true;
        }
      }
      // soltar a corda (com ela na boca, o E chega aqui)
      if (tug.busy?.() && tug.who === c.name) { tug.release?.(); return true; }
      // a corda debaixo da caminhonete: a Radhija morde e puxa
      if (c.name === 'radhija' && S.bucketT === -1 && near(c, L.ROPE.end, L.ROPE.grabR + 0.25)) {
        const E = L.ROPE.end, G = L.ROPE.gap;
        const len = Math.hypot(E.x - G.x, E.z - G.z) + L.ROPE.pull + 0.15;
        tug.start(c, { bite: { x: E.x, y: 0.05, z: E.z }, anchor: { x: G.x, y: G.y, z: G.z }, len });
        return true;
      }
      return false;
    },

    lockFor(name) {
      return dir.lockFor(name) || effects.lockFor(name) || tug.lockFor(name) || null;
    },
    lookTarget(c) {
      const held = dir.lockFor(c.name);
      if (held) return held.look || null;
      if (S.stage === 'varal' && near(c, L.CARROT_PIN, 3.2)) return { x: L.CARROT_PIN.x, y: L.CARROT_PIN.y, z: L.CARROT_PIN.z };
      if (S.stage === 'portaria' && near(c, boothCenter, 3)) return { x: boothCenter.x, y: 1.3, z: L.BOOTH.z1 };
      return null;
    },
    modifyIntent(dt, c, intent, { shift }) {
      if (S.scene?.active || climbing()) return null;
      for (const cr of [branch, bin, ...(S.boatDocked || S.dockT >= 0 ? [] : [boat])]) {
        const r = cr.modifyIntent(dt, c, intent, { shift });
        if (r?.contact) {
          if (cr === boat && r.contact === 'push' && goose.state === 'patrol' && Math.hypot(goose.x - boat.x, goose.z - boat.z) < 1.8) hints.cond?.('barquinho', 3, 8);
          return r;
        }
      }
      // as portas de empurrar: a de mola (torre) e a do depósito, a Rhaenyra com Shift, de fora, indo contra a folha
      if (c.size === 'large' && shift && intent.speed > 0.05) {
        for (const [D, key] of [[L.TOWER_DOOR, 'towerPush'], [L.STORAGE_DOOR, 'storagePush']]) {
          const x0 = D.hinge.x;
          const z0 = Math.min(D.hinge.z, D.latchPost.z) + 0.1, z1 = Math.max(D.hinge.z, D.latchPost.z) - 0.1;
          if (c.x > x0 - 0.62 && c.x < x0 + 0.05 && c.z > z0 && c.z < z1 && intent.dx > 0.5) {
            S[key] = true;
            if (key === 'storagePush' && !S.ballClear && S.rattleCd <= 0) {
              S.rattleCd = 2.4;
              emit('story:sfx', { name: 'trancado', x: x0, z: (z0 + z1) / 2 });
              hints.now('porta', 3, 6);
            }
            return { intent: { ...intent, speed: Math.min(intent.speed, 0.55) }, action: 'push' };
          }
        }
      }
      return null;
    },
    navFlags() {
      return {
        kitchenOpen: S.kitchenOpen, serviceOpen: S.serviceOpen, towerOpen: towerDoor.t > 0.6,
        boatDocked: S.boatDocked, storageOpen: S.storageOpen,
      };
    },
    wallSpots() { return S.stage === 'cozinha' && !S.kitchenOpen ? [handle.spot] : []; },
    onWallTouch(c, spot) {
      if (spot.id !== handle.id || S.kitchenOpen) return;
      handle.touch();
      S.kitchenOpen = true;
      clearSweep(kitchenDoor, doorMid(L.KITCHEN_DOOR));
      kitchenDoor.setTarget(1);
      kitchenDoor.lock();
      emit('door:open', { id: 'cozinha', x: L.KITCHEN_DOOR.hinge.x, z: L.KITCHEN_DOOR.hinge.z });
      setStage('galho');
    },
    onBark(c) {
      if (S.scene?.active) return;
      goose.onBark?.(c);
      if (S.stage === 'portaria' && !S.porterDone && near(c, boothCenter, 3.6)) {
        if (c.name === 'rhaenyra') {
          S.porterDone = true;
          S.snoreT = Infinity;
          startScene('porteiro');
        } else {
          // o latido fino não adianta: o ronco continua, e ela manda a irmã latir
          balloons.show('zzz', { at: { ...(props.booth?.windowAnchor ?? { x: boothCenter.x, y: 1.4, z: L.BOOTH.z1 }) }, kind: 'solto', life: 1.6, size: 0.4 });
          balloons.show('seta', { follow: () => dir.head('radhija', 0.3), kind: 'fala', life: 1.3, size: 0.36 });
          hints.now('latidoFino', 3.8, 7);
        }
      }
    },
    /** O botão do Faro (V, L3 ou o do focinho no toque). */
    onFaro(c) {
      // na abertura, o primeiro pulso é sempre da Radhija (a cena espera o botão, quem estiver ativa)
      if (S.scene?.active) return pressOpeningFaro();
      if (S.stage === 'mural' || S.stage === 'fim' || S.stage === 'abertura') return false;
      if (c.name !== 'radhija') { hints.now('faroRhaenyra', 2.6, 4); return false; }
      if (faro.active || climbing()) return false;
      const found = faro.pulse(c);
      S.faroWasOn = true;
      emit('story:faro', { x: c.x, z: c.z });
      emit('story:sfx', { name: 'faro', x: c.x, z: c.z });
      for (const id of found) {
        if (id === 'baba' || id === 'ralo') book.add(id, K.clueAt(id));
        if (id === 'boia' && S.stage === 'piscina' && !S.reconDone) {
          S.reconDone = true;
          S.pending = 'reconstrucao';
        }
      }
      return true;
    },
    /** Uma cena (ou o mural) está tocando: o núcleo não deixa a entrada passar. */
    cinematic() { return !!S.scene?.active || !!S.pending || S.stage === 'abertura' || S.stage === 'mural' || S.stage === 'fim'; },
    /** O tema que deve tocar agora (main.js; story:music avisa a troca). */
    get music() { return S.music; },
    /** A abertura está esperando o primeiro Faro (o aviso com o botão do aparelho na tela)? */
    get waitingFaro() { return !!scenes && !!S?.scene && S.scene === scenes.abertura && !!scenes.abertura.waitingFaro; },

    setPrompt() {},
    reset() {
      S?.scene?.abort?.();
      S = fresh();
      if (!scenes) scenes = makeScenes();
      props.reset?.();
      handle.reset?.();
      for (const g of [kitchenDoor, serviceDoor, towerDoor, storageDoor, gate]) g.reset();
      branch.reset(); bin.reset(); boat.reset?.();
      goose.reset();
      tug.reset?.();
      effects.reset?.();
      collect.reset();
      book.reset();
      faro.stop();
      faro.setSpot('baba', true);
      recon.stop();
      balloons.clear();
      dir.cleanup({ snap: false });
      skip.disarm();
      mood.set(MORNING);
      feather.visible = false;
      butterfly.visible = false;
      channelMouth.enabled = true;
      boatBridge.enabled = false;
      ballCol.x = L.BALL.x; ballCol.z = L.BALL.z;
      bucketCol.enabled = false;
      props.ball?.setPos?.(L.BALL.x, L.BALL.z, L.BALL.r, 0);
      props.bucket?.setTip?.(0);
      props.boat?.setPos?.(L.BOAT.start.x, L.BOAT.start.z, 0, 0);
      props.line?.setPin?.(0);
      props.line?.shake?.(0);
      props.gateLeaf?.setOpen?.(0);
      cam()?.setZone?.('telhado', false);
      emit('story:reset', {});
    },
    /** Pula para uma etapa (testes, E2E e ?stage=): aplica o que as etapas anteriores deixam. */
    jumpToStage(st, { who } = {}) {
      const target = stageIndex(st);
      if (target < 0) return null;
      puzzle.reset();
      S.pending = null;
      if (target === 0) { S.pending = 'abertura'; return 'radhija'; }
      for (let i = 1; i <= target; i++) APPLY[STAGES[i]]?.();
      S.stage = st;
      emit('story:music', { id: 'recanto' });
      const spot = STAGE_SPOTS[st];
      if (spot) K.placeAt(spot[0], spot[1]);
      else K.placeStart();
      if (st === 'mural') openMural();
      emit('story:stage', { stage: st });
      return who || 'radhija';
    },
    endActions() { tug.release?.(); },
    dispose() {
      offMural();
      offFaro();
      skip.dispose();
      faro.dispose();
      recon.dispose();
      balloons.dispose();
    },
    info() {
      return {
        story: {
          stage: S.stage, scene: S.scene?.active ? S.scene.id : null, beat: S.scene?.beat ?? null,
          clues: book.found, socks: [...S.socks], faro: faro.info(), recon: { active: recon.active, plays: recon.plays },
          flags: {
            kitchenOpen: S.kitchenOpen, branchFree: S.branchFree, serviceOpen: S.serviceOpen, reconDone: S.reconDone,
            boatDocked: S.boatDocked, ballClear: S.ballClear, storageOpen: S.storageOpen, gateOpen: S.gateOpen,
          },
          climb: S.climb ? S.climb.i : null, tug: tug.phase?.() ?? null, goose: goose.state,
          doors: { kitchen: +kitchenDoor.t.toFixed(2), service: +serviceDoor.t.toFixed(2), tower: +towerDoor.t.toFixed(2), storage: +storageDoor.t.toFixed(2), gate: +gate.t.toFixed(2) },
          balloons: balloons.active, music: S.music, waitingFaro: puzzle.waitingFaro, cinematic: puzzle.cinematic(),
        },
      };
    },
    /** Para os testes: o estado que importa comparar (pulando ou não as cenas). */
    snapshot() {
      const d = (n) => ({ x: +R(n).x.toFixed(3), z: +R(n).z.toFixed(3), yaw: +R(n).yaw.toFixed(3), y: +(R(n).y || 0).toFixed(3) });
      return {
        stage: S.stage, clues: book.snapshot().slice().sort(), socks: [...S.socks].sort(),
        dogs: { radhija: d('radhija'), rhaenyra: d('rhaenyra') },
        window: props.windowLeaf ? 'ok' : null, music: S.music,
        locks: { radhija: !!puzzle.lockFor('radhija'), rhaenyra: !!puzzle.lockFor('rhaenyra') },
      };
    },
  };

  function openServiceDoor() {
    if (S.serviceOpen) return;
    S.serviceOpen = true;
    clearSweep(serviceDoor, doorMid(L.SERVICE_DOOR));
    serviceDoor.setTarget(1);
    serviceDoor.lock();
    emit('door:open', { id: 'servico', x: L.SERVICE_DOOR.hinge.x, z: L.SERVICE_DOOR.hinge.z });
    setStage('piscina');
  }
  /** Onde a Rhaenyra segura a porta de mola: logo depois do vão, encostada na folha aberta (do lado da dobradiça). */
  const towerHoldSpot = { x: L.TOWER_DOOR.hinge.x + 0.36, z: L.TOWER_DOOR.hinge.z + 0.29 };
  /** A folha vai abrir por cima de quem está no caminho: a dog dá um pulinho para fora dele (como na fase 7). */
  function clearSweep(door, face) {
    for (const n of ['radhija', 'rhaenyra']) {
      const c = R(n);
      const out = door.sweepExit?.(c);
      if (out) effects.pushTo(c, out.x, out.z, { dur: 0.3, action: 'startled', face });
    }
  }
  function inDoorway(c, D) {
    const x0 = D.hinge.x - 0.35, x1 = D.hinge.x + 0.95;
    const z0 = Math.min(D.hinge.z, D.latchPost.z), z1 = Math.max(D.hinge.z, D.latchPost.z);
    return c.x > x0 && c.x < x1 && c.z > z0 - 0.1 && c.z < z1 + 0.1;
  }

  // a música da história acompanha as cenas (main.js toca o que vier aqui)
  const offMusic = events.on('story:music', (/** @type {{ id?: string | null }} */ p = {}) => { if (S) S.music = p.id ?? null; });
  const disposeBase = puzzle.dispose;
  puzzle.dispose = () => { offMusic(); disposeBase(); };

  S = fresh();
  scenes = makeScenes();
  return puzzle;
}

/** Pistas do capítulo que a lupa pode ter (para a UI). */
export const CHAPTER_CLUES = Object.keys(CLUES);
