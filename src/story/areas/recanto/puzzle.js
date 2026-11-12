// MODO HISTÓRIA · Capítulo 1 · Cadê a Cenoura? — o puzzle de área do Recanto das Patinhas (docs/HISTORIA.md, cap. 1).
// A missão é uma investigação: o Faro (das duas) solta a nuvem de cheiro até a próxima pista, as pistas se examinam
// com o E, e cada passagem do caminho é um puzzle de causa e efeito para as duas resolverem juntas:
//   abertura → QUARTO (farejar e examinar a trilha, o pote e a pena; a cena dos pombos na janela) → CASA (só a Radhija
//   passa pela portinha de gato da grade; o pedal solta a grade para a irmã; a Rhaenyra empurra o saco de ração e
//   alcança a maçaneta) → QUINTAL (a Rhaenyra empurra o galho; a Radhija passa pela passagem do muro e puxa a argola
//   do ferrolho pelo outro lado) → PISCINA (o Faro mostra a Reconstrução) → VARAL (a Rhaenyra põe o cesto embaixo da
//   cenoura e a arrancada da Radhija no poste solta o pregador; o Farelo pega no ar) → TORRE (o Faro mostra o Farelo
//   apertando a senha do interfone; a Rhaenyra aperta os três botões na ordem, segura a porta de mola com o Fica e a
//   irmã sobe; cena do terraço) → PORTARIA (o Superbafo da Radhija entra pela grelha da guarita e a janela abre; aí o
//   latido grosso da Rhaenyra acorda o porteiro) → fechamento → mural (o provisório, só o caso 3) → fim.
// Paralelos: a ilha do lago (latido de longe distrai a Dona Gansa; a Rhaenyra empurra o barquinho até o canal; só a
// Radhija atravessa), o telhado da guarita (a lixeira com o Fica; a Radhija sobe até a meia da antena) e a garagem (a
// Radhija puxa a corda debaixo da caminhonete; o balde cai na bola; a Rhaenyra empurra a porta do depósito).
// Eventos: story:* (HUD, sons e música da história: src/story/ui/storyHud.js). O núcleo chama onFaro (V, L3 ou o botão
// do focinho) e bloqueia a entrada enquanto cinematic() for verdadeiro.
import * as THREE from 'three';
import { events } from '../../../core/events.js';
import { createPushCrate, createHingedGate, createWallButton, createGooseNPC, createDogEffects, createPressurePlate } from '../../../game/mechanics/index.js';
import { createMouthTug } from '../../../game/mechanics/mouthTug.js';
import { createShoveTarget } from '../../../game/mechanics/shoveTarget.js';
import { createCollectibles, createHints } from '../../../game/puzzleKit.js';
import { createGoose } from '../../../characters/goose.js';
import { createBalloons } from '../../scene/balloons.js';
import { createDirector } from '../../scene/director.js';
import { createSkipInput } from '../../scene/skip.js';
import { createMood } from '../../scene/mood.js';
import { createFaro, SCENT } from '../../faro/faro.js';
import { createScentCloud } from '../../faro/scentCloud.js';
import { createFaroMode } from '../../faro/faroMode.js';
import { createReconstruction } from '../../faro/reconstruction.js';
import { createClueBook, CLUES } from '../../clues.js';
import { createDeduction } from '../../deduction.js';
import { createStoryteller } from '../../scene/storyteller.js';
import { createButterflies } from '../../scene/butterfly.js';
import { createBubbles } from '../../scene/bubbles.js';
import { createLesada } from '../../scene/lesada.js';
import { MORNING } from './lighting.js';
import {
  createOpening, createWindowScene, createReconScene, createCodeScene, createVaralScene, createTerraceScene,
  createSmellScene, createPorteiroScene, createClosingScene, createWitnessScene, squadOnLine, squadOnTank, morningRoom,
} from './scenes.js';
import { createRooftop } from './rooftop.js';
import { createRooftopScenes } from './scenesTelhado.js';

export const STAGES = ['abertura', 'quarto', 'casa', 'quintal', 'piscina', 'varal', 'torre', 'portaria', 'fechamento', 'mural', 'fim'];
const stageIndex = (s) => STAGES.indexOf(s);

/** Os objetivos curtos do HUD: a pergunta do mistério e o que fazer agora. */
const OBJECTIVES = {
  quarto: 'A cenoura sumiu! Farejem o quarto',
  deduzir: 'Quem entrou no quarto? Abram a árvore de pistas',
  ligar: 'Abram a árvore de pistas e liguem as três pistas à pergunta',
  casa: 'Atrás dos pombos! Saiam de casa',
  quintal: 'Atrás dos pombos! Saiam pela porta do quintal',
  galho: 'Tem uma passagem no muro, atrás do galho',
  ferrolho: 'O ferrolho fica do outro lado do muro',
  piscina: 'Farejem o rastro dos pombos',
  varal: 'A cenoura está no varal!',
  senha: 'A torre tem senha: farejem a porta',
  torre: 'Subam na torre atrás dos pombos',
  portaria: 'Os pombos saíram pela rua: acordem o porteiro',
  fechamento: 'Saiam pelo portãozinho',
};
/** Dicas de controle (somem no modo sem dicas). */
const HINTS = {
  // sem nome de tecla solto: o aviso do focinho ao lado mostra a do aparelho, e "(E)" vira o botão certo na tela
  faro: 'Fareje (aperte de novo para desligar): a nuvem de cheiro leva até a próxima pista. O fôlego acaba!',
  examinar: 'Chegue perto do que brilha e examine (E).',
  arvore: 'Três pistas! Abra a árvore de pistas (Tab, Select ou o botão do quadro), ligue cada pista à pergunta e responda: quem entrou no quarto?',
  grade: 'A grade é alta. Só a Radhija passa pela portinha de gato.',
  pedal: 'O pedal solta a grade: pise nele.',
  saco: 'O saco de ração está na frente da maçaneta: a Rhaenyra empurra (segure Shift).',
  maçaneta: 'A maçaneta é alta: troque (Q) e pule na porta com a Rhaenyra.',
  galho: 'A porta tem ferrolho por fora. O galho tapa a passagem do muro: a Rhaenyra empurra (segure Shift).',
  ferrolho: 'A porta tem ferrolho por fora: a Radhija cabe na passagem do muro.',
  argola: 'A Radhija puxa a argola do ferrolho com a boca (E).',
  cesto: 'Se a cenoura cair no chão, os pombos pegam: ponha o cesto de roupa embaixo dela.',
  poste: 'Com o cesto no lugar, a Rhaenyra empurra o poste do varal (segure Shift / R1) até o pregador soltar.',
  interfone: 'A porta da torre só abre com a senha do interfone.',
  senha: 'Fareje perto da porta: alguém apertou esses botões.',
  senhaErrada: 'Senha errada. O Faro mostra a ordem.',
  botoes: 'Os botões são altos: a Rhaenyra alcança com o pulo.',
  portaMola: 'A porta de mola fecha sozinha: a Rhaenyra segura (Fica: F) e a irmã passa.',
  janela: 'A janela está fechada: o latido não entra.',
  grelha: 'A grelha deixa o cheiro entrar: o Superbafo da Radhija dá conta.',
  latidoFino: 'O latido fino não acorda o porteiro: troque (Q) e lata com a Rhaenyra (E).',
  lixeira: 'A lixeira tem rodinhas: a Rhaenyra precisa segurar (Fica: F).',
  barquinho: 'O barquinho é pequeno: só a Radhija cabe nele.',
  porta: 'A porta do depósito está travada por dentro.',
};
const PROMPTS = { examinar: 'Examinar', argola: 'Puxar a argola', corda: 'Puxar a corda', subir: 'Subir' };
/** O ícone do balão de cada pista examinada (a dog "pensa" o que achou). */
const CLUE_ICON = { trilha: 'cenoura', pote: 'pote', pena: 'pena', baba: 'gota', telhas: 'chuva', ralo: 'gota' };
/** Quanto tempo a dog fica examinando (s) e a que distância do ponto ela precisa estar (m). */
const EXAM = { time: 1.0, at: 0.55, r: 1.2 };
/** As pistas que o Faro revela e o E examina (as de cena e as Reconstruções chegam de outro jeito). */
const EXAMINABLE = ['trilha', 'pote', 'pena', 'baba', 'ralo'];
const ROOM_CLUES = ['trilha', 'pote', 'pena'];

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
  const cloud = createScentCloud({ root, layout: L, world });
  // o modo Faro (pedido do usuário em 2026-11-11): liga e desliga no botão, com fôlego por dog
  const faroMode = createFaroMode({ faro, cloud, emit, onReveal: (ids) => onFound(ids) });
  // a árvore de pistas (src/story/deduction.js): cada pista nova refaz o quadro; a conclusão certa segue a história
  /** @type {ReturnType<typeof createDeduction> | null} */
  let deduction = null;
  const book = createClueBook({
    emit,
    onAdd: (id, silent) => {
      // as telhas da tempestade abrem a pergunta do capítulo 2
      if (id === 'telhas') deduction?.ask('tempestade', { silent });
      deduction?.sync(silent ? null : id);
    },
  });
  deduction = createDeduction({
    emit, book,
    onResolve: (id) => {
      // "Quem entrou no quarto?" respondida: os pombos passam pela janela com a cenoura, depois de o quadro mostrar a
      // conclusão dourada (a cena fecharia o quadro na hora)
      if (id === 'quem' && S?.stage === 'quarto' && !S.windowSeen) S.janelaT = 1.3;
      emit('objective', puzzle.objective(ctx.activeDog));
    },
  });
  // as falas (balões de HQ nas cenas, legendas no jogo) e a página de HQ, pelo diretor
  const teller = createStoryteller({
    dir, emit, cam: () => ctx.cam,
    anchorOf: (who) => {
      const sq = props.squad || {};
      const bird = { capitao: sq.cap, farelo: sq.far, soneca: sq.son }[who];
      if (bird?.object?.visible) { const q = bird.object.position; return { x: q.x, y: q.y + 0.32, z: q.z }; }
      if (who === 'porteiro') {
        // o Sr. Luiz: o balão sai da cabeça dele (na guarita ou no portãozinho); sem o modelo, do guichê
        const lu = props.srLuiz, hb = lu?.parts?.head, o = lu?.object;
        if (hb && o?.visible) {
          hb.updateWorldMatrix(true, false);
          const v = hb.localToWorld(o.position.clone().set(0, 0.08, 0));
          return { x: v.x, y: v.y, z: v.z };
        }
        const w = props.booth?.windowAnchor;
        return w ? { x: w.x, y: w.y + 0.2, z: w.z } : null;
      }
      if (who === 'gansa') return { x: goose.x, y: 0.62, z: goose.z };
      if (who === 'bichano') { const o = props.bichano?.object; return o ? { x: o.position.x, y: o.position.y + 0.32, z: o.position.z } : null; }
      return null;
    },
  });
  for (const k of ['say', 'clearSay', 'comic', 'panel', 'onomato', 'caption', 'fx', 'lens']) dir[k] = teller[k];
  {
    // o fim de cada cena (assistida ou pulada) também fecha a página de HQ e as falas
    const baseCleanup = dir.cleanup.bind(dir);
    dir.cleanup = (o) => { teller.clearSay(); if (teller.comicOn) teller.comic(false); baseCleanup(o); teller.lens(38); };
  }
  const hints = createHints(emit, { hint: HINTS, prompt: PROMPTS });

  // trilhas de cheiro e pistas do Faro
  faro.addTrail('cenoura', L.CARROT_TRAIL, { color: SCENT.cenoura, fadeEnd: true, spacing: 0.1, size: 1.15 });
  faro.addTrail('pombos-piscina', [{ x: L.RECON.x - 0.4, z: L.RECON.z + 0.6 }, { x: L.RECON.x, z: L.RECON.z }, { x: L.RECON.x + 0.5, z: L.RECON.z - 0.4 }], { color: SCENT.pombos, spacing: 0.18, size: 0.9 });
  faro.addTrail('pombos-varal', [{ x: L.CARROT_PIN.x - 2.4, z: L.LINE.a.z + 0.5 }, { x: L.CARROT_PIN.x, z: L.CARROT_PIN.z + 0.5 }, { x: L.LINE.b.x + 0.4, z: L.LINE.b.z + 0.9 }], { color: SCENT.pombos, spacing: 0.22 });
  faro.addTrail('pombos-torre', [{ x: L.INTERCOM.recon.x - 1.2, z: L.INTERCOM.recon.z + 0.8 }, { x: L.INTERCOM.recon.x, z: L.INTERCOM.recon.z }, { x: L.TOWER.x0 - 0.3, z: (L.TOWER_DOOR.hinge.z + L.TOWER_DOOR.latchPost.z) / 2 }], { color: SCENT.pombos, spacing: 0.2 });
  faro.addTrail('gansa', [{ x: L.PIER.x0 + 0.2, z: (L.PIER.z0 + L.PIER.z1) / 2 }, { x: L.GOOSE.home.x, z: L.GOOSE.home.z }], { color: SCENT.gansa, spacing: 0.2 });
  const spots = L.CLUE_SPOTS;
  faro.addSpot('trilha', { ...spots.trilha, y: 0.03, kind: 'pista' });
  faro.addSpot('pote', { ...spots.pote, y: 0.03, kind: 'pista' });
  faro.addSpot('pena', { ...spots.pena, kind: 'pista', size: 0.6 });
  // a baba fica no parapeito de dentro, em cima da caminha: a linha de visão confere de um ponto do chão do quarto ao
  // lado da caminha (o próprio parapeito fica dentro dela e da parede)
  faro.addSpot('baba', { ...spots.baba, kind: 'escondida', size: 0.55, los: { x: L.BED.x + L.BED.r + 0.05, z: L.WINDOW.z + 0.35 } });
  faro.addSpot('boia', { ...spots.boia, kind: 'reconstrucao' });
  faro.addSpot('senha', { ...spots.senha, kind: 'reconstrucao' });
  faro.addSpot('ralo', { ...spots.ralo, kind: 'escondida', size: 0.6, los: { x: spots.ralo.x, z: L.TANKS.z1 + 0.35 } });

  // ---------------------------------------------------------------- as Reconstruções (o mesmo pombo fantasma nas duas)
  const RC = L.RECON;
  const gp = props.ghosts.pigeon;
  const ghostPose = (o, k, dt) => {
    gp.setPose({ x: k.x, y: k.y, z: k.z, yaw: k.yaw, flying: !!k.flying, flightProgress: k.prog ?? 0 });
    if (k.peck && !gp._pecked) { gp._pecked = true; gp.peck(); }
    if (!k.peck) gp._pecked = false;
    gp.update(dt, S.time);
  };
  // a da piscina: o pombo pousa na borda, pega a boia murcha e sai baixo e torto para o nordeste
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
        pose: ghostPose,
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
  // a do interfone: o Farelo (gordo demais para voar até lá em cima) sobe até cada botão, aperta os três na ordem da
  // senha e entra pela porta. CODE_TIMES: quando cada botão é apertado (a plaquinha acende junto).
  const IC = L.INTERCOM;
  const btnOf = (id) => IC.buttons.find((b) => b.id === id);
  const CODE_TIMES = [1.5, 3.0, 4.5];
  const codeKeys = (() => {
    const g = IC.recon;
    const keys = [{ t: 0, x: g.x, y: 0, z: g.z, yaw: Math.PI / 2, flying: false }, { t: 0.5, x: g.x, y: 0, z: g.z, yaw: Math.PI / 2, flying: false }];
    IC.code.slice(0, 2).forEach((id, i) => {
      const b = btnOf(id);
      const t = CODE_TIMES[i];
      const hover = { x: b.x - 0.34, y: b.top - 0.2, z: b.z, yaw: Math.PI / 2, flying: true, prog: 0.5 };
      keys.push({ t: t - 0.45, ...hover }, { t, ...hover, x: b.x - 0.2 }, { t: t + 0.3, ...hover });
    });
    const door = { x: L.TOWER.x0 - 0.5, z: (L.TOWER_DOOR.hinge.z + L.TOWER_DOOR.latchPost.z) / 2 };
    keys.push({ t: 5.5, x: door.x, y: 0, z: door.z, yaw: Math.PI / 2, flying: false }, { t: 6.4, x: door.x + 0.5, y: 0, z: door.z, yaw: Math.PI / 2, flying: false });
    return keys;
  })();
  const reconCode = createReconstruction({ root, material: props.ghosts.material, actors: [{ id: 'pombo', object: gp.object, keys: codeKeys, pose: ghostPose }] });
  // o pombo fantasma é um só: quem vai tocar leva o desenho para o grupo dela
  recon.group.add(gp.object);
  /** Toca uma Reconstrução ('piscina' ou 'senha'). */
  function playRecon(which) {
    const rc = which === 'senha' ? reconCode : recon;
    (which === 'senha' ? recon : reconCode).stop();
    rc.group.add(gp.object);
    rc.play();
    return rc;
  }

  // a pena molhada no parapeito de fora e a borboleta do fechamento (miudezas das cenas)
  // a pena de pombo que fica no parapeito (src/story/scene/feather.js, montada em world/atores.js)
  const feather = props.feather?.object ?? (() => {
    const m = new THREE.Mesh(
      (() => { const g = new THREE.ConeGeometry(0.025, 0.16, 6); g.scale(1, 1, 0.25); return g; })(),
      new THREE.MeshStandardMaterial({ color: '#cfd5e2', roughness: 0.7 }),
    );
    m.name = 'historia:pena';
    root.add(m);
    return m;
  })();
  feather.visible = false;
  // a borboleta do fechamento (hero, a cena move) e as do cenário, que a Rhaenyra persegue (src/story/scene/butterfly.js),
  // e as bolhas de sabão (src/story/scene/bubbles.js)
  const flutter = createButterflies({ root, world, layout: L });
  const butterfly = flutter.hero.object;
  const bubbles = createBubbles({ root, blocked: flutter.blocked });
  // o broche de campanha da Dona Gansa (os pombos deixaram cair na ilha): uma roseta azul e branca com fitas
  const broche = new THREE.Group();
  broche.name = 'historia:broche-da-gansa';
  {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 20), new THREE.MeshStandardMaterial({ color: '#2f6fcf', roughness: 0.55 }));
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.016, 18), new THREE.MeshStandardMaterial({ color: '#fff6e6', roughness: 0.5 }));
    mid.position.y = 0.004;
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.35, metalness: 0.4 }));
    dot.position.y = 0.008;
    broche.add(ring, mid, dot);
    for (const s of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.11), new THREE.MeshStandardMaterial({ color: '#2f6fcf', roughness: 0.6 }));
      rib.position.set(s * 0.025, -0.002, 0.07);
      rib.rotation.y = s * 0.25;
      broche.add(rib);
    }
    broche.rotation.x = -0.25;
  }
  broche.position.set(L.WITNESSES.broche.x, L.WITNESSES.broche.y, L.WITNESSES.broche.z);
  root.add(broche);

  // ---------------------------------------------------------------- mecânicas
  const effects = createDogEffects({ world, dogs });
  const handle = createWallButton({ id: 'macaneta', cfg: L.KITCHEN_HANDLE, emit, prop: props.kitchenHandle });
  const petGate = createHingedGate({ id: 'grade-quarto', cfg: L.PET_GATE, world, prop: props.petGate });
  const pedal = createPressurePlate({ id: 'pedal-da-grade', x: L.PET_PEDAL.x, z: L.PET_PEDAL.z, r: L.PET_PEDAL.r, requires: 'any', emit, prop: props.petPedal });
  const kitchenDoor = createHingedGate({ id: 'porta-cozinha', cfg: L.KITCHEN_DOOR, world, prop: props.kitchenDoor });
  const serviceDoor = createHingedGate({ id: 'porta-servico', cfg: L.SERVICE_DOOR, world, prop: props.serviceDoor });
  const towerDoor = createHingedGate({ id: 'porta-torre', cfg: L.TOWER_DOOR, world, prop: props.towerDoor });
  const storageDoor = createHingedGate({ id: 'porta-deposito', cfg: L.STORAGE_DOOR, world, prop: props.storageDoor });
  const gate = createHingedGate({ id: 'portaozinho', cfg: L.GATE_LEAF, world, prop: props.gateLeaf });
  const sack = createPushCrate({ id: 'saco-de-racao', cfg: L.FOOD_SACK, world, emit, prop: props.foodSack });
  const branch = createPushCrate({ id: 'galho', cfg: L.BRANCH, world, emit, prop: props.branch });
  const laundry = createPushCrate({ id: 'cesto-de-roupa', cfg: L.LAUNDRY, world, emit, prop: props.laundry });
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
  const buttons = IC.buttons.map((b) => ({ id: b.id, btn: createWallButton({ id: `interfone-${b.id}`, cfg: b, emit, prop: props.intercom?.buttons?.[b.id] ?? null }) }));
  const goose = createGooseNPC({ cfg: L.GOOSE, world, nav: ctx.nav, root, emit, effects, createGoose });
  const tug = createMouthTug({ dogs, ctrls, world });
  // o empurra-empurra da Rhaenyra no poste do varal (o balanço do poste sacode o varal)
  const poleShove = createShoveTarget({
    id: 'poste-varal', cfg: L.POLE_SHOVE, emit, world, root,
    // só o balanço: o poste não tem objeto próprio para inclinar (o varal sacode)
    prop: /** @type {any} */ ({ setSway: (a) => props.line?.shake?.(Math.min(1, Math.abs(a) * 3.2)) }),
  });
  // a Rhaenyra distraída (src/story/scene/lesada.js): só com nada mais da área segurando ela
  const lesada = createLesada({ ctx, dir, emit, flutter, bubbles, layout: L, busy: (n) => !!(dir.lockFor(n) || effects.lockFor(n) || tug.lockFor(n)) });
  props.rope?.setGrip?.(() => (S.tugWhat === 'corda' ? tug.grip() : null));
  props.serviceBolt?.setGrip?.(() => (S.tugWhat === 'ferrolho' ? tug.grip() : null));
  const collect = createCollectibles({ list: L.COLLECTIBLES, props, emit, pickupR: L.COLLECTIBLE_PICKUP_R });
  // o canal fechado até o barquinho encaixar; depois, a ponte que só a Radhija atravessa
  const CH = L.CHANNEL;
  const channelMouth = world.addDynamic({ id: 'canal-boca', kind: 'water', shape: 'segment', ax: CH.x0 - 0.05, az: CH.z1, bx: CH.x1 + 0.05, bz: CH.z1, t: 0.1 });
  const boatBridge = world.addDynamic({ id: 'barquinho-ponte', kind: 'static', shape: 'box', x: (CH.x0 + CH.x1) / 2, z: (CH.z0 + CH.z1) / 2, hx: (CH.x1 - CH.x0) / 2, hz: (CH.z1 - CH.z0) / 2, blocks: 'large' });
  // de pé no convés, o pescoço do patinho e a caixa da roda de pá: a Radhija passa ENTRE os dois, nunca por dentro
  const boatNeck = world.addDynamic({ id: 'barquinho-pescoco', kind: 'static', shape: 'circle', x: L.BOAT.dock.x + 0.35, z: L.BOAT.dock.z, r: 0.09 });
  const boatWheel = world.addDynamic({ id: 'barquinho-roda', kind: 'static', shape: 'circle', x: L.BOAT.dock.x - 0.36, z: L.BOAT.dock.z, r: 0.1 });
  // a bola e o balde no chão do depósito (depois da queda) também colidem
  const ballCol = world.addDynamic({ id: 'bola', kind: 'static', shape: 'circle', x: L.BALL.x, z: L.BALL.z, r: L.BALL.r });
  const bucketCol = world.addDynamic({ id: 'balde', kind: 'static', shape: 'circle', x: L.SHELF.landing.x, z: L.SHELF.landing.z, r: 0.17 });
  // o galho fica na frente da passagem baixa do muro do quintal (só a Radhija passaria) até ser empurrado
  const YG = L.YARD_GAP;
  const gapPlug = world.addDynamic({ id: 'galho-copa', kind: 'static', shape: 'box', x: (YG.x0 + YG.x1) / 2, z: YG.z + 0.2, hx: (YG.x1 - YG.x0) / 2 + 0.1, hz: 0.3, blocks: 'small' });
  // o Superbafo entra pela grelha da guarita e sai lá dentro, no nariz do porteiro
  const V = L.BOOTH_VENT;
  const ventDuct = ctx.scent?.addDuct?.({
    id: 'grelha-da-guarita', inlet: { x: V.x - 0.08, z: V.z, r: V.r, dirX: -1, dirZ: 0 }, outlet: { x: V.inside.x, z: V.inside.z, dirX: 1, dirZ: 0, speed: 0.4 },
    travel: 0.7, active: () => !!S && !S.windowOpen && !S.scene?.active && stageIndex(S.stage) >= stageIndex('quintal') && stageIndex(S.stage) <= stageIndex('portaria'),
  }) ?? null;
  ctx.scent?.addNose?.({
    id: 'porteiro', x: V.inside.x + 0.2, z: V.inside.z, r: 1.0,
    onSmell: (c) => {
      if (!S || S.windowOpen || /** @type {any} */ (c).duct !== ventDuct) return;
      /** @type {any} */ (c).age = /** @type {any} */ (c).life; // o cheiro fica lá dentro
      props.booth?.setVentPuff?.(1);
      S.pending = S.pending || 'cheiro';
    },
  });

  // ---------------------------------------------------------------- estado
  /** @type {any} */
  let S = null;
  function fresh() {
    return {
      stage: 'abertura', time: 0, scene: null, pending: 'abertura', janelaT: 0, broche: null, brocheGiven: false, bichanoTalked: false,
      petGateOpen: false, windowSeen: false, kitchenOpen: false, branchFree: false, boltOpen: false, boltT: -1, serviceOpen: false,
      reconDone: false, varalDone: false, codeSeen: false, towerUnlocked: false, terraceDone: false, windowOpen: false,
      porterDone: false, gateOpen: false, closingDone: false, muralDone: false,
      boatDocked: false, dockT: -1, bucketT: -1, ballClear: false, storageOpen: false,
      towerPush: false, towerHeld: false, towerHoldAt: null, towerHoldT: 0, storagePush: false, lastActive: null, socks: new Set(), climb: null,
      snoreT: 1.5, radioT: 0.6, radioOn: true, prompt: null, music: null, mandaCd: 0, rattleCd: 0, mural: null,
      revealed: new Set(), exam: null, faroCd: 0, sniffT: 0, tugWhat: null, code: [], codeT: -1, codeErrT: -1, gapShown: false,
      firstFaro: false, promptOn: false,
    };
  }

  // ---------------------------------------------------------------- o contexto das cenas
  const K = {
    ctx, dir, props, L, faro, cloud, recon, reconCode, playRecon, book, deduction, mood, emit, feather, butterfly, balloons, CODE_TIMES,
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
    /** A plaquinha de um botão do interfone acesa (a Reconstrução da senha). */
    lightCode(id, on) { props.intercom?.setLit?.(id, on); },
    set snoring(on) { S.snoreT = on ? 1.5 : Infinity; },
  };
  // o terraço da torre, jogável (um cenário à parte, fora do mapa: world/telhado.js; pedido de 2026-11-11)
  const roof = createRooftop(K, { world, root, emit, effects, ctx, props, dir, hints });
  let scenes = null;
  function makeScenes() {
    return {
      abertura: createOpening(K),
      janela: createWindowScene(K),
      reconstrucao: createReconScene(K),
      senha: createCodeScene(K),
      varal: createVaralScene(K),
      terraco: createTerraceScene(K),
      ...createRooftopScenes(K, roof),
      cheiro: createSmellScene(K),
      porteiro: createPorteiroScene(K),
      fechamento: createClosingScene(K),
      gansa: createWitnessScene(K, {
        id: 'gansa', who: 'gansa', clue: 'dep-gansa',
        at: () => ({ x: goose.x, y: 0.55, z: goose.z }),
        lines: [
          ['gansa', 'Meu broche de campanha! Onde vocês acharam?'],
          ['radhija', 'Na ilha. A senhora viu os pombos ontem à noite?'],
          ['gansa', 'Vi o gordinho! Voando torto, com uma coisa laranja…'],
          ['gansa', '…e cantarolando a noite toda: “plim-plim, a nota é o fim!”'],
          ['rhaenyra', 'Plim-plim? É o carrinho de sorvete!'],
          ['radhija', 'Não, Rhaenyra… é uma pista. Anota aí: a nota é o fim.'],
          ['gansa', 'E não se esqueçam: votem na Dona Gansa!', { mood: 'grito' }],
        ],
        onCommit: () => { S.brocheGiven = true; S.broche = 'devolvido'; broche.visible = false; },
      }),
      bichano: createWitnessScene(K, {
        id: 'bichano', who: 'bichano', clue: 'dep-bichano',
        at: () => { const o = props.bichano?.object; return o ? { x: o.position.x, y: o.position.y + 0.3, z: o.position.z } : { x: L.CAR.x0, y: 0.6, z: L.CAR.z0 }; },
        lines: [
          ['bichano', 'Miau. Minha bolinha! Tá bom, tá bom… eu conto.'],
          ['bichano', 'Pombo não come borracha, não. Estão tapando alguma coisa…'],
          ['bichano', '…ouvi falar em goteira.', { mood: 'sussurro' }],
          ['radhija', 'Goteira? Onde?'],
          ['bichano', 'Isso eu não sei. Gato não sobe em telhado molhado.'],
          ['rhaenyra', 'Goteira é uma torneira filhote?'],
          ['radhija', 'Não, Rhaenyra. É um furinho no telhado.'],
        ],
        onCommit: () => { S.bichanoTalked = true; },
      }),
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
    S.exam = null;
    tug.release?.();
    hints.setPrompt(null);
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
  // o botão do Faro na tela de toque e o aviso tocável do HUD (ui:storyFaro)
  const offFaro = events.on('ui:storyFaro', () => { if (S && !S.scene?.active) puzzle.onFaro(R(ctx.activeDog)); });
  // a conclusão escolhida no quadro de dedução (src/story/ui): certa, a história segue; errada, o quadro treme
  const offDeduce = events.on('ui:storyDeduce', (/** @type {{ node?: string, option?: number }} */ p = {}) => {
    if (!S || S.scene?.active || !p.node) return;
    deduction.deduce(p.node, p.option ?? -1);
  });
  // ligar uma pista a uma pergunta e confrontar um depoimento no quadro de dedução
  const offLink = events.on('ui:storyLink', (/** @type {{ clue?: string, node?: string }} */ p = {}) => {
    if (!S || S.scene?.active || !p.clue || !p.node) return;
    if (deduction.link(p.clue, p.node)) emit('objective', puzzle.objective(ctx.activeDog));
  });
  const offConfront = events.on('ui:storyConfront', (/** @type {{ testimony?: string, clue?: string }} */ p = {}) => {
    if (!S || S.scene?.active || !p.testimony || !p.clue) return;
    deduction.confront(p.testimony, p.clue);
  });

  // ---------------------------------------------------------------- ajudas
  const near = (c, p, r) => Math.hypot(c.x - p.x, c.z - p.z) <= r;
  const inRect = (c, Q) => c.x >= Q.x0 && c.x <= Q.x1 && c.z >= Q.z0 && c.z <= Q.z1;
  const boothCenter = { x: (L.BOOTH.x0 + L.BOOTH.x1) / 2, z: (L.BOOTH.z0 + L.BOOTH.z1) / 2 };
  const boothWindow = () => props.booth?.windowAnchor ?? { x: boothCenter.x, y: 1.4, z: L.BOOTH.z1 };
  const distVol = (p, R0 = 9) => {
    const c = R(ctx.activeDog);
    return Math.max(0, 1 - Math.hypot(c.x - p.x, c.z - p.z) / R0);
  };
  const doorMid = (D) => ({ x: (D.hinge.x + D.latchPost.x) / 2, z: (D.hinge.z + D.latchPost.z) / 2 });
  const gateMid = { x: (L.GATE.x0 + L.GATE.x1) / 2, z: L.GATE.z };
  const sackFree = () => sack.z <= L.FOOD_SACK.freeZ + 0.02;
  const basketUnder = () => Math.abs(laundry.x - L.CARROT_PIN.x) <= L.LAUNDRY.under;
  const after = (st) => stageIndex(S.stage) >= stageIndex(st);

  // ---------------------------------------------------------------- pistas: revelar (Faro) e examinar (E)
  /** Onde a dog para para examinar a pista (ou o próprio lugar dela). */
  const examPoint = (id) => spots[id].at ?? { x: spots[id].x, z: spots[id].z };
  /**
   * A pista revelada e ainda não examinada mais perto da dog (até EXAM.r m). Entre duas no mesmo canto, a do caminho
   * principal vem antes da escondida (o E seguinte pega a outra).
   */
  function examNear(c) {
    let best = null;
    let bd = Infinity;
    for (const id of S.revealed) {
      if (book.has(id)) continue;
      const p = examPoint(id);
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d > EXAM.r) continue;
      const score = d + (CLUES[id]?.type === 'escondida' ? 0.6 : 0);
      if (score < bd) { bd = score; best = id; }
    }
    return best;
  }
  function reveal(id) {
    if (S.revealed.has(id) || book.has(id) || !EXAMINABLE.includes(id)) return;
    S.revealed.add(id);
    faro.pin?.(id, true);
  }
  /** O modo Faro achou pistas no alcance: revela as examináveis e dispara as Reconstruções. */
  function onFound(ids) {
    if (!S) return;
    let changed = false;
    for (const id of ids) {
      if (EXAMINABLE.includes(id) && !S.revealed.has(id) && !book.has(id)) { reveal(id); changed = true; }
      if (id === 'boia' && S.stage === 'piscina' && !S.reconDone) { S.reconDone = true; S.pending = 'reconstrucao'; changed = true; }
      if (id === 'senha' && S.stage === 'torre' && !S.towerUnlocked && !S.pending) { S.pending = 'senha'; changed = true; }
    }
    if (changed) emit('objective', puzzle.objective(ctx.activeDog));
  }
  function startExam(c, id) {
    const s = spots[id];
    S.exam = { id, who: c.name, t: 0, done: false };
    effects.act(c.name, 'none', EXAM.time, { x: s.x, z: s.z });
    emit('story:sfx', { name: 'faro', x: c.x, z: c.z, volume: 0.5 });
  }
  function stepExam(dt) {
    const E = S.exam;
    if (!E) return;
    E.t += dt;
    if (!E.done && E.t >= EXAM.time * 0.55) {
      E.done = true;
      S.revealed.delete(E.id);
      faro.pin?.(E.id, false);
      book.add(E.id, K.clueAt(E.id));
      // um close rápido na pista, e quem achou diz o que concluiu
      const sp = spots[E.id];
      cam()?.focusShot?.(sp.x, sp.z, { hold: 1.1, inT: 0.4, outT: 0.6, scale: 0.72, y: (sp.y ?? 0.1) + 0.2 });
      dir.say(E.who, CLUES[E.id]?.text ?? CLUES[E.id]?.name ?? '', { mode: 'jogo' });
    }
    if (E.t >= EXAM.time) {
      S.exam = null;
      // as três do quarto examinadas: a pergunta fica pronta na árvore de pistas (a resposta certa traz os pombos)
      if (S.stage === 'quarto' && ROOM_CLUES.every((id) => book.has(id))) hints.now('arvore', 6, 10);
      emit('objective', puzzle.objective(ctx.activeDog));
    }
  }

  // ---------------------------------------------------------------- a nuvem de cheiro: para onde ela leva agora
  /** A próxima pista do mistério: { x, z, color } (o Faro solta a nuvem até lá). */
  function lead() {
    const c = R(ctx.activeDog);
    switch (S.stage) {
      case 'quarto': {
        let best = null;
        let bd = Infinity;
        for (const id of ROOM_CLUES) {
          if (book.has(id)) continue;
          const p = examPoint(id);
          const d = Math.hypot(c.x - p.x, c.z - p.z);
          if (d < bd) { bd = d; best = p; }
        }
        return best ? { x: best.x, z: best.z, color: SCENT.cenoura } : null;
      }
      case 'casa': case 'quintal': case 'piscina': return { x: L.RECON.x, z: L.RECON.z, color: SCENT.pombos };
      case 'varal': return { x: L.CARROT_PIN.x, z: L.CARROT_PIN.z + 0.4, y: 0.7, color: SCENT.cenoura };
      case 'torre': if (roof.active) return roof.lead(); return S.towerUnlocked || S.codeSeen
        ? { x: L.TOWER.x0 - 0.5, z: doorMid(L.TOWER_DOOR).z, color: SCENT.cenoura }
        : { x: IC.recon.x, z: IC.recon.z, color: SCENT.pombos };
      case 'portaria': case 'fechamento': return { x: gateMid.x, z: gateMid.z + 0.6, color: SCENT.cenoura };
      default: return null;
    }
  }

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
    emit('story:sfx', { name: 'lixeira', x: bx, z: bz });
  }
  function stepClimb(dt) {
    const C = S.climb;
    if (!C) return;
    const st = C.steps[C.i];
    if (!st) {
      S.climb = null;
      dir.release('radhija');
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

  // ---------------------------------------------------------------- a porta do quintal, trancada por fora
  /** A dog tenta a porta do quintal: ela chacoalha e não abre; a câmera mostra o galho na frente da passagem do muro. */
  function tryServiceDoor(c) {
    if (S.rattleCd > 0) return;
    S.rattleCd = 2;
    const sd = L.SERVICE_DOOR, YG = L.YARD_GAP;
    emit('story:sfx', { name: 'trancado', x: sd.hinge.x, z: sd.hinge.z });
    // a câmera mostra a passagem baixa do muro (uma vez) e o objetivo passa a apontar para o galho ou para ela
    if (!S.gapShown) {
      S.gapShown = true;
      cam()?.focusShot?.((YG.x0 + YG.x1) / 2, YG.z + 0.3, { hold: 1.6, inT: 0.6, outT: 0.7, scale: 0.7 });
      emit('objective', puzzle.objective(ctx.activeDog));
    }
    if (!S.branchFree) {
      dir.say(c.name, c.name === 'radhija' ? 'Trancada por fora! Mas aquele buraco no muro… atrás do galho!' : 'Não abre! E se a gente tirar aquele galho dali?', { mode: 'jogo' });
      hints.now('galho', 4.6, 6);
    } else {
      dir.say(c.name, 'O ferrolho é do lado de fora… a Radhija cabe naquele buraco!', { mode: 'jogo' });
      hints.now('ferrolho', 4.2, 6);
    }
  }
  // ---------------------------------------------------------------- as testemunhas
  /** O E perto da Dona Gansa ou do Bichano: a conversa (com o que eles querem) ou o pedido. */
  function talkWitness(c) {
    const W = L.WITNESSES;
    if (Math.hypot(c.x - goose.x, c.z - goose.z) <= W.gansa.talk && !book.has('dep-gansa')) {
      if (S.broche === 'achado') { startScene('gansa'); return true; }
      if (S.rattleCd <= 0) {
        S.rattleCd = 2.6;
        dir.say('gansa', 'Quém! Uns pombos roubaram meu broche de campanha… e deixaram cair na ilha!', { mode: 'jogo' });
      }
      return true;
    }
    const bo = props.bichano?.object;
    if (bo && Math.hypot(c.x - bo.position.x, c.z - bo.position.z) <= W.bichano.talk && !book.has('dep-bichano')) {
      if (S.ballClear) { startScene('bichano'); return true; }
      if (S.rattleCd <= 0) {
        S.rattleCd = 2.6;
        dir.say('bichano', 'Miau… minha bolinha ficou presa no depósito. Sem bolinha, sem fofoca.', { mode: 'jogo' });
      }
      return true;
    }
    return false;
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
    boatNeck.enabled = true;
    boatWheel.enabled = true;
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

  // ---------------------------------------------------------------- o interfone da torre (a senha de três botões)
  function pressCode(id) {
    if (S.towerUnlocked || S.codeT >= 0 || S.codeErrT >= 0) return;
    S.code.push(id);
    props.intercom?.setLit?.(id, true);
    emit('story:sfx', { name: 'bip', x: L.TOWER.x0, z: btnOf(id).z, volume: 0.8 });
    if (S.code.length >= IC.code.length) S.codeT = 0.35;
  }
  function stepCode(dt) {
    if (S.codeT >= 0) {
      S.codeT -= dt;
      if (S.codeT < 0) {
        const ok = S.code.every((id, i) => id === IC.code[i]);
        const at = { x: L.TOWER.x0 - 0.3, y: 1.6, z: btnOf('nota').z };
        if (ok) {
          S.towerUnlocked = true;
          props.intercom?.setState?.('ok');
          emit('story:sfx', { name: 'interfone-ok', x: at.x, z: at.z });
          dir.onomato('PLIM!', { at, size: 0.9, color: '#8ee08e', rot: -6 });
          emit('door:unlock', { id: 'torre', x: at.x, z: at.z });
          emit('objective', puzzle.objective(ctx.activeDog));
        } else {
          S.codeErrT = 0.9;
          props.intercom?.setState?.('erro');
          emit('story:sfx', { name: 'interfone-erro', x: at.x, z: at.z });
          dir.onomato('BÉÉÉ!', { at, size: 0.9, color: '#ff6b6b', rot: 6, style: 'shake' });
          hints.now(S.codeSeen ? 'senhaErrada' : 'senha', 3.6, 5);
        }
      }
    }
    if (S.codeErrT >= 0) {
      S.codeErrT -= dt;
      if (S.codeErrT < 0) resetCode();
    }
  }
  function resetCode() {
    S.code = [];
    S.codeT = S.codeErrT = -1;
    for (const b of buttons) { b.btn.setOn(false); props.intercom?.setLit?.(b.id, false); }
    props.intercom?.setState?.(S.towerUnlocked ? 'ok' : 'idle');
  }

  // ---------------------------------------------------------------- avanço de etapas (para ?stage= e os testes)
  const APPLY = {
    quarto() {
      morningRoom(K);
      for (const id of ['pombos', 'abraco']) book.add(id, { silent: true });
      deduction.ask('quem', { silent: true });
      S.music = 'recanto';
    },
    casa() {
      S.windowSeen = true;
      for (const id of ROOM_CLUES) book.add(id, { silent: true });
      deduction.resolve('quem', { silent: true });
      deduction.ask('onde', { silent: true });
      squadOnLine(K);
    },
    quintal() {
      S.petGateOpen = true;
      petGate.setTarget(1); petGate.set?.(1); petGate.lock();
      sack.setPos(L.FOOD_SACK.start.x, L.FOOD_SACK.minZ);
      S.kitchenOpen = true;
      handle.setOn?.(true);
      kitchenDoor.setTarget(1); kitchenDoor.set?.(1); kitchenDoor.lock();
    },
    piscina() {
      branch.setPos(L.BRANCH.minX, L.BRANCH.start.z);
      S.branchFree = true;
      book.add('telhas', { silent: true });
      S.boltOpen = true;
      S.boltT = -1;
      props.serviceBolt?.setSlid?.(1);
      S.serviceOpen = true;
      serviceDoor.setTarget(1); serviceDoor.set?.(1); serviceDoor.lock();
    },
    varal() { S.reconDone = true; book.add('boia', { silent: true }); deduction.ask('borracha', { silent: true }); },
    torre() { S.varalDone = true; deduction.resolve('onde', { silent: true }); laundry.setPos(L.LAUNDRY.maxX, L.LAUNDRY.start.z); props.line?.setPin?.(1); squadOnTank(K); },
    portaria() {
      book.add('tampa', { silent: true });
      roof.skipAll();
      S.codeSeen = true;
      book.add('senha', { silent: true });
      deduction.ask('senha', { silent: true });
      deduction.ask('rua', { silent: true });
      S.towerUnlocked = true;
      props.intercom?.setState?.('ok');
      S.terraceDone = true;
      for (const p of Object.values(props.squad || {})) p.setVisible(false);
      if (props.carrot) { props.carrot.holdBy?.(null); props.carrot.object.visible = false; }
    },
    fechamento() {
      book.add('grelha', { silent: true });
      book.add('dep-luiz', { silent: true });
      props.srLuiz?.setPose?.('sentado', undefined, { instant: true });
      S.windowOpen = true;
      props.booth?.setWindow?.(1);
      S.porterDone = true;
      props.gateLeaf?.setOpen?.(1);
      S.gateOpen = true;
      gate.setTarget(1); gate.set?.(1); gate.lock();
      S.snoreT = Infinity;
    },
    mural() { S.closingDone = true; },
    fim() {},
  };
  /** Onde as dogs começam numa etapa pulada (perto do objetivo dela): [Radhija, Rhaenyra]. */
  const sd = L.SERVICE_DOOR, td = L.TOWER_DOOR;
  const STAGE_SPOTS = {
    quarto: null,
    casa: null,
    quintal: [{ x: L.HOUSE.x1 + 1.6, z: 5.6, yaw: 0 }, { x: L.HOUSE.x1 + 1.1, z: 6.5, yaw: 0 }],
    piscina: [{ x: doorMid(sd).x, z: sd.hinge.z - 1.7, yaw: Math.PI }, { x: doorMid(sd).x + 0.9, z: sd.hinge.z - 1.3, yaw: Math.PI }],
    varal: [{ x: L.LINE.b.x - 0.4, z: L.LINE.b.z + 2.0, yaw: Math.PI }, { x: L.LINE.b.x - 1.5, z: L.LINE.b.z + 2.2, yaw: Math.PI }],
    torre: [{ x: td.hinge.x - 1.5, z: doorMid(td).z + 0.9, yaw: Math.PI / 2 }, { x: td.hinge.x - 1.6, z: doorMid(td).z - 0.3, yaw: Math.PI / 2 }],
    portaria: [{ x: td.hinge.x - 1.2, z: doorMid(td).z + 0.2, yaw: -Math.PI / 2 }, { x: td.hinge.x - 1.3, z: doorMid(td).z + 1.2, yaw: -Math.PI / 2 }],
    fechamento: [{ x: boothCenter.x - 0.2, z: L.BOOTH.awning.z1 + 1.9, yaw: Math.PI }, { x: boothCenter.x + 0.9, z: L.BOOTH.awning.z1 + 2.1, yaw: Math.PI }],
    mural: [{ x: gateMid.x - 0.3, z: gateMid.z + 1.6, yaw: Math.PI }, { x: gateMid.x + 0.4, z: gateMid.z + 2.2, yaw: Math.PI }],
    fim: [{ x: gateMid.x - 0.3, z: gateMid.z + 1.6, yaw: Math.PI }, { x: gateMid.x + 0.4, z: gateMid.z + 2.2, yaw: Math.PI }],
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
      if (S.scene?.active || S.pending || climbing()) return { text: null, target: null, stage: st };
      const T = (text, p, y = 0.6) => ({ text, target: p ? { x: p.x, y, z: p.z } : null, stage: st });
      switch (st) {
        case 'quarto': {
          if (deduction.isReady('quem')) return T(OBJECTIVES.deduzir, null);
          if (deduction.hasClues('quem') && !deduction.isSolved('quem')) return T(OBJECTIVES.ligar, null);
          const l = lead();
          return T(OBJECTIVES.quarto, l && S.revealed.size ? l : null, 0.7);
        }
        case 'casa': return T(OBJECTIVES.casa, { x: L.KITCHEN_HANDLE.x - 0.25, z: L.KITCHEN_HANDLE.z }, 1.3);
        case 'quintal':
          // primeiro a porta (trancada por fora); depois o galho na frente da passagem; por fim, a passagem
          if (!S.gapShown) return T(OBJECTIVES.quintal, doorMid(sd), 1.2);
          if (!S.branchFree) return T(OBJECTIVES.galho, branch, 0.9);
          return T(OBJECTIVES.ferrolho, { x: (YG.x0 + YG.x1) / 2, z: YG.z + 0.5 }, 0.6);
        case 'piscina': return T(OBJECTIVES.piscina, L.RECON, 0.6);
        case 'varal': return T(OBJECTIVES.varal, L.CARROT_PIN, L.CARROT_PIN.y + 0.4);
        case 'torre':
          if (roof.active) return { ...roof.objective(), stage: st };
          if (!S.towerUnlocked) return T(S.codeSeen ? OBJECTIVES.torre : OBJECTIVES.senha, { x: L.TOWER.x0 - 0.3, z: btnOf('nota').z }, 1.6);
          return T(OBJECTIVES.torre, doorMid(td), 1.4);
        case 'portaria': return T(OBJECTIVES.portaria, boothWindow(), 1.7);
        case 'fechamento': return T(OBJECTIVES.fechamento, { x: gateMid.x, z: gateMid.z + 0.3 }, 1.3);
        default: return { text: null, target: null, stage: st };
      }
    },

    update(dt, { active, comp, ctrls: C }) {
      S.time += dt;
      S.mandaCd = Math.max(0, S.mandaCd - dt);
      S.rattleCd = Math.max(0, S.rattleCd - dt);
      if (S.janelaT > 0) { S.janelaT -= dt; if (S.janelaT <= 0) S.pending = S.pending || 'janela'; }
      S.faroCd = Math.max(0, S.faroCd - dt);
      S.sniffT = Math.max(0, S.sniffT - dt);
      hints.frame?.(dt);
      // a cena (com o pular) e o diretor
      if (!S.scene?.active && S.pending && !S.exam) {
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
      const playing = !S.scene?.active;
      // o aviso do Faro com o botão do aparelho: no quarto, até o primeiro pulso
      const wantPrompt = playing && !S.pending && S.stage === 'quarto' && !S.firstFaro;
      if (wantPrompt !== S.promptOn) { S.promptOn = wantPrompt; emit('story:prompt', { kind: 'faro', on: wantPrompt }); }
      stepClimb(dt);
      roof.update(dt, { active, comp, playing: !S.scene?.active });
      stepExam(dt);
      dir.update(dt);
      // nas cenas, as faixas de cinema cobrem 11% do alto da tela: os balões ficam abaixo delas
      balloons.update(dt, engine?.camera, S.scene?.active ? 0.36 : 0.45);
      teller.update(dt);
      faroMode.update(dt, { active, cinematic: puzzle.cinematic() });
      faro.update(dt, S.time);
      // a nuvem de cheiro: enquanto o Faro está aceso, do focinho de quem está com a jogadora até a próxima pista
      cloud.setLead(playing ? lead() : null);
      cloud.update(dt, S.time, playing ? faro.k : 0, playing ? active : null);
      recon.update(dt);
      reconCode.update(dt);
      if (faro.k === 0 && S.faroWasOn) { S.faroWasOn = false; emit('story:faroEnd', {}); }

      // a grade do quarto: o pedal solta, e ela fica aberta
      const pr = pedal.update(dt, { ctrls: C });
      if (pr.pressed && !S.petGateOpen && playing && after('quarto')) {
        S.petGateOpen = true;
        clearSweep(petGate, doorMid(L.PET_GATE));
        petGate.setTarget(1);
        petGate.lock();
        emit('door:open', { id: 'grade', x: L.PET_GATE.hinge.x, z: L.PET_GATE.hinge.z });
        emit('story:sfx', { name: 'trinco', x: L.PET_GATE.hinge.x, z: L.PET_GATE.hinge.z });
      }
      petGate.update(dt, { ctrls: C });
      // portas (e a alavanca da maçaneta)
      handle.update?.(dt);
      for (const b of buttons) b.btn.update?.(dt);
      props.intercom?.update?.(dt, S.time);
      stepCode(dt);
      kitchenDoor.update(dt, { ctrls: C });
      serviceDoor.update(dt, { ctrls: C });
      // a mola fecha sozinha: aberta enquanto a Rhaenyra empurra ou segura (no Fica, encostada na folha aberta)
      // segurando a porta: vale enquanto ela está no Fica e no lugar (o passinho até o lugar leva um instante)
      S.towerHoldT = Math.max(0, S.towerHoldT - dt);
      if (S.towerHeld && (!ctx.isStaying('rhaenyra') || (S.towerHoldT <= 0 && !near(R('rhaenyra'), S.towerHoldAt, 0.6)))) S.towerHeld = false;
      towerDoor.setTarget(S.towerPush || S.towerHeld ? 1 : 0);
      S.towerPush = false;
      towerDoor.update(dt, { ctrls: C });
      if (S.ballClear && S.storagePush && !S.storageOpen) storageDoor.setTarget(1);
      S.storagePush = false;
      storageDoor.update(dt, { ctrls: C });
      if (!S.storageOpen && storageDoor.t > 0.6) { S.storageOpen = true; storageDoor.lock(); emit('door:open', { id: 'deposito', x: L.STORAGE.x0, z: doorMid(L.STORAGE_DOOR).z }); }
      gate.update(dt, { ctrls: C });
      // empurráveis, a Dona Gansa, as cordas
      if (!S.kitchenOpen) sack.update(dt, { comp });
      branch.update(dt, { comp });
      if (!S.varalDone) laundry.update(dt, { comp });
      bin.update(dt, { comp });
      if (!S.boatDocked && S.dockT < 0) boat.update(dt, { comp });
      stepDock(dt);
      if (playing) goose.update(dt, { active, ctrls: C });
      goose.animate?.(dt);
      effects.update(dt, C);
      tug.update(dt);
      if (!tug.busy?.()) S.tugWhat = null;
      const pulled = tug.pulled?.() ?? 0;
      props.rope?.setPull?.(S.tugWhat === 'corda' ? Math.min(1, pulled / L.ROPE.pull) : S.bucketT !== -1 ? 1 : 0);
      if (S.tugWhat === 'corda' && S.bucketT === -1 && tug.holding?.() && pulled >= L.ROPE.pull) {
        S.bucketT = 0;
        tug.release?.();
        emit('story:sfx', { name: 'corda', x: L.ROPE.end.x, z: L.ROPE.end.z });
      }
      stepBucket(dt);
      // o ferrolho da porta de serviço: a argola puxada corre o ferrolho e a porta abre
      const SB = L.SERVICE_BOLT;
      props.serviceBolt?.setPull?.(S.tugWhat === 'ferrolho' ? Math.min(1, pulled / SB.pull) : 0);
      if (S.tugWhat === 'ferrolho' && !S.boltOpen && tug.holding?.() && pulled >= SB.pull) {
        S.boltOpen = true;
        S.boltT = 0;
        tug.release?.();
        emit('story:sfx', { name: 'trinco', x: SB.ring.x, z: SB.ring.z });
      }
      if (S.boltT >= 0) {
        S.boltT += dt;
        props.serviceBolt?.setSlid?.(Math.min(1, S.boltT / 0.35));
        if (S.boltT >= 0.35) { S.boltT = -1; openServiceDoor(); }
      }
      gapPlug.enabled = !S.branchFree;
      // petiscos e meias
      if (playing && !climbing()) {
        collect.update(active);
        if (!S.broche && broche.visible && Math.hypot(active.x - L.WITNESSES.broche.x, active.z - L.WITNESSES.broche.z) <= L.WITNESSES.broche.pickR) {
          S.broche = 'achado';
          broche.visible = false;
          emit('story:sfx', { name: 'pista' });
          dir.say(active.name, 'Um broche de campanha! “Vote Dona Gansa”… vamos devolver.', { mode: 'jogo' });
        }
        for (const s of L.SOCKS) {
          if (s.id === 'antena' || S.socks.has(s.id)) continue;
          if (near(active, s, L.SOCK_PICKUP_R) && (s.id !== 'deposito' || S.storageOpen)) takeSock(s.id);
        }
      }
      // a guarita: ronco e radinho enquanto o porteiro dorme
      if (!S.porterDone && after('quarto')) {
        S.snoreT -= dt;
        if (S.snoreT <= 0) {
          S.snoreT = 2.8;
          const v = distVol(boothCenter, 12);
          if (v > 0.05) {
            dir.onomato('ZZZ…', { at: { ...boothWindow() }, size: 0.6, color: '#c9d6ff', rot: -4 });
            emit('story:sfx', { name: 'ronco', x: boothCenter.x, z: boothCenter.z, volume: v * (S.windowOpen ? 1 : 0.55) });
          }
        }
      }
      if (S.radioOn) {
        S.radioT -= dt;
        if (S.radioT <= 0) {
          S.radioT = 3.2;
          const v = distVol(boothCenter, 9);
          if (v > 0.05) emit('story:sfx', { name: 'radinho', x: boothCenter.x, z: boothCenter.z, volume: v * (S.windowOpen ? 0.8 : 0.4) });
        }
      }
      props.booth?.radio?.setOn?.(S.radioOn);

      // gatilhos da missão
      const rad = R('radhija');
      if (playing) {
        if (after('quintal') && !book.has('telhas') && Math.abs(branch.x - L.BRANCH.start.x) >= 0.5) book.add('telhas', K.clueAt('telhas'));
        // chegando à porta do quintal, as dogs já percebem que ela não abre por dentro
        if (S.stage === 'quintal' && !S.gapShown && !S.serviceOpen && active.z > L.YARD.z0 && near(active, doorMid(sd), 0.95)) tryServiceDoor(active);
        if (!S.branchFree && branch.x <= L.BRANCH.freeX) {
          S.branchFree = true;
          emit('objective', puzzle.objective(ctx.activeDog));
        }
        // o poste do varal balança com o empurra-empurra da Rhaenyra (puzzle.onShove)
        if (!S.varalDone) poleShove.update(dt);
        // com o cesto no lugar, a dica do poste
        if (S.stage === 'varal' && basketUnder() && near(active, L.CARROT_PIN, 3.5)) hints.cond?.('poste', 4, 14);
        if (S.stage === 'torre' && inRect(rad, L.TOWER_LOBBY) && !roof.active && !roof.done) roof.enter();
        if (S.stage === 'fechamento' && (near(active, { x: gateMid.x, z: gateMid.z + 0.35 }, 0.85))) startScene('fechamento');
        // dicas de lugar
        if (S.stage === 'quarto' && !S.revealed.size && !ROOM_CLUES.some((id) => book.has(id)) && S.time > 4) hints.cond?.('faro', 5, 16);
        if (S.stage === 'quarto' && S.revealed.size && !S.exam) hints.cond?.('examinar', 4.5, 18);
        if (!S.petGateOpen && after('casa') && active.name === 'rhaenyra' && near(active, doorMid(L.PET_GATE), 1.5)) hints.cond?.('grade', 4, 12);
        if (!S.petGateOpen && active.name === 'radhija' && near(active, L.PET_PEDAL, 1.6) && active.x > L.PET_GATE.hinge.x) hints.cond?.('pedal', 3.6, 14);
        // o E do que dá para fazer aqui
        const ex = examNear(active);
        if (ex) hints.setPrompt('examinar');
        else if (active.name === 'radhija' && !S.boltOpen && S.branchFree && active.z < L.YARD.z0 && near(active, SB.ring, SB.grabR + 0.3) && !tug.busy?.()) hints.setPrompt('argola');
        else if (active.name === 'radhija' && S.bucketT === -1 && near(active, L.ROPE.end, L.ROPE.grabR + 0.25) && !tug.busy?.()) hints.setPrompt('corda');
        else if (roof.prompt) hints.setPrompt(roof.prompt);
        else hints.setPrompt(null);
      }
      // a Rhaenyra segurando a porta de mola: trocar de cachorrinha com ela no vão a deixa no Fica
      if (S.lastActive !== ctx.activeDog) {
        const rha = R('rhaenyra');
        if (ctx.activeDog === 'radhija' && towerDoor.t > 0.45 && inDoorway(rha, td)) {
          // ela fica segurando, do lado da dobradiça em que está: dentro, encostada na folha toda aberta; no batente ou
          // fora, junto da parede. Nos dois casos o vão fica livre para a irmã passar e a mola não fecha.
          const inside = rha.x >= td.hinge.x + 0.15;
          S.towerHoldAt = inside ? towerHoldSpot : towerHoldOut;
          if (inside) towerDoor.set?.(1);
          ctx.setStay('rhaenyra', true);
          S.towerHeld = true;
          S.towerHoldT = 0.7;
          effects.pushTo(rha, S.towerHoldAt.x, S.towerHoldAt.z, { dur: 0.4, action: 'push', face: { x: td.hinge.x + 0.3, z: td.hinge.z } });
        }
        S.lastActive = ctx.activeDog;
      }
      // as borboletas (as do cenário somem na noite da abertura) e as bolhas; a Rhaenyra distraída, fora das cenas
      flutter.update(dt, { ambient: S.stage !== 'abertura' });
      bubbles.update(dt);
      lesada.update(dt, { playing: playing && !S.pending && !climbing() && !roof.active && after('quarto') && stageIndex(S.stage) < stageIndex('mural') });
      return null;
    },

    interact(c) {
      if (S.scene?.active || S.pending || climbing() || S.exam) return true;
      if (roof.active) return roof.interact(c);
      const st = S.stage;
      // examinar uma pista revelada pelo Faro
      const ex = examNear(c);
      if (ex) { startExam(c, ex); return true; }
      // soltar a corda ou a argola (com ela na boca, o E chega aqui)
      if (tug.busy?.() && tug.who === c.name) { tug.release?.(); return true; }
      // a Radhija manda: aponta a maçaneta (a irmã é quem alcança), ou o saco na frente dela
      if (st === 'casa' && near(c, doorMid(L.KITCHEN_DOOR), 1.9) && c.x < L.HOUSE.x1) {
        if (S.mandaCd <= 0) {
          S.mandaCd = 2.2;
          if (!sackFree()) {
            dir.say(c.name, 'Esse saco de ração tá bem na frente da maçaneta…', { mode: 'jogo' });
            hints.now('saco', 4, 6);
          } else if (c.name === 'radhija') {
            dir.bark('radhija');
            dir.say('radhija', 'A maçaneta é alta demais pra mim. Rhaenyra, pula nela!', { mode: 'jogo' });
            hints.now('maçaneta', 3.6, 6);
          } else hints.now('maçaneta', 3.6, 6);
        }
        return true;
      }
      // a porta da área de serviço: o ferrolho fica do outro lado
      if (st === 'quintal' && !S.serviceOpen && c.z > L.YARD.z0 && near(c, doorMid(sd), 1.45)) {
        tryServiceDoor(c);
        return true;
      }
      // a argola do ferrolho, do lado de fora: a Radhija morde e puxa
      const SB = L.SERVICE_BOLT;
      if (!S.boltOpen && S.branchFree && c.z < L.YARD.z0 && near(c, SB.ring, SB.grabR + 0.3)) {
        tug.start(c, { bite: { x: SB.ring.x, y: SB.ring.y, z: SB.ring.z }, anchor: { x: SB.anchor.x, y: SB.anchor.y, z: SB.anchor.z }, len: Math.hypot(SB.ring.z - SB.anchor.z, SB.ring.y - SB.anchor.y) + SB.pull + 0.15 });
        S.tugWhat = 'ferrolho';
        hints.now('argola', 3, 8);
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
      // a corda debaixo da caminhonete: a Radhija morde e puxa
      if (c.name === 'radhija' && S.bucketT === -1 && near(c, L.ROPE.end, L.ROPE.grabR + 0.25)) {
        const E = L.ROPE.end, G = L.ROPE.gap;
        const len = Math.hypot(E.x - G.x, E.z - G.z) + L.ROPE.pull + 0.15;
        tug.start(c, { bite: { x: E.x, y: 0.05, z: E.z }, anchor: { x: G.x, y: G.y, z: G.z }, len });
        S.tugWhat = 'corda';
        return true;
      }
      // as testemunhas: a Dona Gansa (com o broche dela) e o Bichano (com a bolinha solta). Por último: o Bichano fica
      // no capô da caminhonete, perto da corda, e a corda (quando dá para morder) vem antes da conversa
      if (talkWitness(c)) return true;
      return false;
    },

    /** O poste do varal, para o empurrão em pé da Rhaenyra (Shift / R1 de frente para ele). */
    shoveSpots() { return S && after('piscina') && !S.varalDone && !S.scene?.active ? [poleShove.spot] : []; },
    /** Cada empurrão no poste: os pombos se assustam; com o cesto embaixo, no terceiro o pregador solta. */
    onShove(c, spot, C) {
      if (spot.id !== poleShove.spot.id || S.varalDone) return;
      poleShove.shove(c, C);
      for (const p of Object.values(props.squad || {})) p.peck?.();
      emit('story:sfx', { name: 'varal', x: L.DASH_POST.x, z: L.DASH_POST.z, volume: 0.7 });
      if (S.stage !== 'varal') return;
      if (!basketUnder()) {
        S.poleN = 0;
        if (S.rattleCd <= 0) {
          S.rattleCd = 2.2;
          dir.say('radhija', 'Para! Se a cenoura cair no chão, eles pegam! Põe alguma coisa embaixo…', { mode: 'jogo' });
          hints.now('cesto', 4.2, 6);
        }
        return;
      }
      S.poleN = (S.poleN || 0) + 1;
      if (S.poleN === 1) dir.say('rhaenyra', 'Empurra… empurra…', { mode: 'jogo' });
      if (S.poleN >= (L.POLE_SHOVE.pushes ?? 3)) { S.varalDone = true; startScene('varal'); }
    },
    lockFor(name) {
      return dir.lockFor(name) || effects.lockFor(name) || tug.lockFor(name) || lesada.lockFor(name) || null;
    },
    lookTarget(c) {
      const held = dir.lockFor(c.name);
      if (held) return held.look || null;
      if (S.exam?.who === c.name) return K.clueAt(S.exam.id);
      if (roof.active) return roof.lookTarget(c);
      // farejando: o focinho vai ao chão por um instante
      if (S.sniffT > 0 && S.sniffWho === c.name) return { x: c.x + Math.sin(c.yaw) * 0.42, y: 0.02, z: c.z + Math.cos(c.yaw) * 0.42 };
      if (S.stage === 'varal' && near(c, L.CARROT_PIN, 3.6)) return { x: L.CARROT_PIN.x, y: L.CARROT_PIN.y, z: L.CARROT_PIN.z };
      if (S.stage === 'portaria' && near(c, boothCenter, 3.4)) return { ...boothWindow() };
      return null;
    },
    modifyIntent(dt, c, intent, { shift }) {
      if (S.scene?.active || climbing()) return null;
      if (roof.active) return roof.modifyIntent(dt, c, intent, { shift });
      for (const cr of [...(S.kitchenOpen ? [] : [sack]), branch, ...(S.varalDone ? [] : [laundry]), bin, ...(S.boatDocked || S.dockT >= 0 ? [] : [boat])]) {
        const r = cr.modifyIntent(dt, c, intent, { shift });
        if (r?.contact) {
          if (cr === boat && r.contact === 'push' && goose.state === 'patrol' && Math.hypot(goose.x - boat.x, goose.z - boat.z) < 1.8) hints.cond?.('barquinho', 3, 8);
          return r;
        }
      }
      // as portas de empurrar: a de mola (torre) e a do depósito, a Rhaenyra com Shift, de fora, indo contra a folha
      if (c.size === 'large' && shift && intent.speed > 0.05) {
        for (const [D, key] of [[td, 'towerPush'], [L.STORAGE_DOOR, 'storagePush']]) {
          const x0 = D.hinge.x;
          const z0 = Math.min(D.hinge.z, D.latchPost.z) + 0.1, z1 = Math.max(D.hinge.z, D.latchPost.z) - 0.1;
          if (c.x > x0 - 0.62 && c.x < x0 + 0.05 && c.z > z0 && c.z < z1 && intent.dx > 0.5) {
            if (key === 'towerPush' && !S.towerUnlocked) {
              if (S.rattleCd <= 0) {
                S.rattleCd = 2.4;
                emit('story:sfx', { name: 'trancado', x: x0, z: (z0 + z1) / 2 });
                props.intercom?.setState?.('erro');
                S.codeErrT = Math.max(S.codeErrT, 0.6);
                hints.now(S.codeSeen ? 'interfone' : 'senha', 3.6, 6);
              }
              return { intent: { ...intent, speed: Math.min(intent.speed, 0.3) }, action: 'push' };
            }
            S[key] = true;
            if (key === 'towerPush') hints.cond?.('portaMola', 3.6, 16);
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
        petGateOpen: S.petGateOpen, kitchenOpen: S.kitchenOpen, gapOpen: S.branchFree, serviceOpen: S.serviceOpen,
        towerOpen: towerDoor.t > 0.6, boatDocked: S.boatDocked, storageOpen: S.storageOpen,
      };
    },
    wallSpots() {
      if (roof.active) return roof.wallSpots();
      const out = [];
      if (after('casa') && !S.kitchenOpen && sackFree()) out.push(handle.spot);
      if (after('quintal') && !S.towerUnlocked && S.codeT < 0 && S.codeErrT < 0) for (const b of buttons) if (!S.code.includes(b.id)) out.push(b.btn.spot);
      return out;
    },
    onWallTouch(c, spot) {
      if (roof.onWallTouch(c, spot)) return;
      if (spot.id === handle.id) {
        if (S.kitchenOpen) return;
        handle.touch();
        S.kitchenOpen = true;
        clearSweep(kitchenDoor, doorMid(L.KITCHEN_DOOR));
        kitchenDoor.setTarget(1);
        kitchenDoor.lock();
        emit('door:open', { id: 'cozinha', x: L.KITCHEN_DOOR.hinge.x, z: L.KITCHEN_DOOR.hinge.z });
        setStage('quintal');
        return;
      }
      const b = buttons.find((x) => x.btn.id === spot.id);
      if (b) { b.btn.touch(); pressCode(b.id); }
    },
    onBark(c) {
      if (S.scene?.active) return;
      if (roof.active) { roof.onBark(c); return; }
      goose.onBark?.(c);
      if (S.stage === 'portaria' && !S.porterDone && near(c, boothCenter, 4.2)) {
        if (!S.windowOpen) {
          // de janela fechada, nenhum latido entra
          dir.say(c.name, S.barkedShut ? 'A janela fechada abafa tudo… e aquela grelha embaixo?' : 'Ele nem ouviu! A janela tá fechada.', { mode: 'jogo' });
          // a primeira vez explica a janela; depois, a grelha
          hints.now(S.barkedShut ? 'grelha' : 'janela', 4.2, 4);
          S.barkedShut = true;
        } else if (c.name === 'rhaenyra') {
          S.porterDone = true;
          S.snoreT = Infinity;
          startScene('porteiro');
        } else {
          // o latido fino não adianta: o ronco continua, e ela manda a irmã latir
          dir.onomato('ZZZ…', { at: { ...boothWindow() }, size: 0.6, color: '#c9d6ff', rot: -4 });
          dir.say('radhija', 'Meu latido é fininho demais… Rhaenyra, late você!', { mode: 'jogo' });
          hints.now('latidoFino', 3.8, 7);
        }
      }
    },
    /** O botão do Faro (V, L3 ou o do focinho no toque): as duas farejam. */
    /** O botão do Faro: liga o modo (a visão de cheiro, gastando o fôlego da dog); apertar de novo desliga. */
    onFaro(c) {
      if (faroMode.on) { faroMode.toggle(c); return true; } // desligar vale sempre
      if (S.scene?.active || S.pending || S.exam || climbing()) return false;
      if (S.stage === 'mural' || S.stage === 'fim' || S.stage === 'abertura') return false;
      if (!faroMode.toggle(c)) return false; // sem fôlego: funga cansada (o som e o medidor são do faroMode)
      S.firstFaro = true;
      S.faroWasOn = true;
      emit('story:faro', { x: c.x, z: c.z, who: c.name });
      emit('objective', puzzle.objective(ctx.activeDog));
      return true;
    },
    /** Uma cena (ou o mural) está tocando: o núcleo não deixa a entrada passar. */
    cinematic() { return !!S.scene?.active || !!S.pending || S.stage === 'abertura' || S.stage === 'mural' || S.stage === 'fim'; },
    /** O tema que deve tocar agora (main.js; story:music avisa a troca). */
    get music() { return S.music; },
    /** O Faro já pode ser usado (o HUD mostra o botão do focinho aceso)? */
    get faroReady() { return !!S && !S.scene?.active && !S.pending && (faroMode.on || faroMode.canStart(ctx.activeDog)) && after('quarto') && stageIndex(S.stage) < stageIndex('mural'); },

    setPrompt() {},
    reset() {
      S?.scene?.abort?.();
      if (S?.promptOn) emit('story:prompt', { kind: 'faro', on: false });
      S = fresh();
      if (!scenes) scenes = makeScenes();
      props.reset?.();
      roof.reset();
      handle.reset?.();
      for (const b of buttons) b.btn.reset?.();
      pedal.reset?.();
      for (const g of [petGate, kitchenDoor, serviceDoor, towerDoor, storageDoor, gate]) g.reset();
      sack.reset(); branch.reset(); laundry.reset(); bin.reset(); boat.reset?.(); poleShove.reset?.();
      broche.visible = true;
      goose.reset();
      tug.reset?.();
      effects.reset?.();
      collect.reset();
      book.reset();
      deduction.reset();
      teller.reset();
      emit('story:sayClear', {});
      emit('story:comic', { on: false });
      faro.stop();
      faroMode.reset();
      for (const id of EXAMINABLE) faro.pin?.(id, false);
      cloud.setLead(null);
      cloud.update(0, 0, 0, null);
      recon.stop();
      reconCode.stop();
      balloons.clear();
      dir.cleanup({ snap: false });
      skip.disarm();
      mood.set(MORNING);
      feather.visible = false;
      flutter.reset();
      bubbles.reset();
      lesada.reset();
      channelMouth.enabled = true;
      boatBridge.enabled = false;
      boatNeck.enabled = false;
      boatWheel.enabled = false;
      gapPlug.enabled = true;
      ballCol.x = L.BALL.x; ballCol.z = L.BALL.z;
      bucketCol.enabled = false;
      props.ball?.setPos?.(L.BALL.x, L.BALL.z, L.BALL.r, 0);
      props.bucket?.setTip?.(0);
      props.boat?.setPos?.(L.BOAT.start.x, L.BOAT.start.z, 0, 0);
      props.line?.setPin?.(0);
      props.line?.shake?.(0);
      props.gateLeaf?.setOpen?.(0);
      props.serviceBolt?.setSlid?.(0);
      props.serviceBolt?.setPull?.(0);
      props.booth?.setWindow?.(0);
      props.carrot?.holdBy?.(null);
      props.intercom?.setState?.('idle');
      for (const b of buttons) props.intercom?.setLit?.(b.id, false);
      hints.setPrompt(null);
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
      offDeduce();
      offLink();
      offConfront();
      skip.dispose();
      faro.dispose();
      cloud.dispose();
      recon.dispose();
      reconCode.dispose();
      balloons.dispose();
      lesada.dispose();
      flutter.dispose();
      bubbles.dispose();
    },
    info() {
      return {
        story: {
          stage: S.stage, scene: S.scene?.active ? S.scene.id : null, beat: S.scene?.beat ?? null,
          clues: book.found, socks: [...S.socks], faro: faro.info(), faroMode: faroMode.info(), cloud: cloud.info(), roof: roof.info(), board: deduction.snapshot(), lines: teller.lines,
          recon: { active: recon.active || reconCode.active, plays: recon.plays, codePlays: reconCode.plays },
          revealed: [...S.revealed], exam: S.exam?.id ?? null, code: S.code.slice(),
          flags: {
            petGateOpen: S.petGateOpen, sackFree: sackFree(), kitchenOpen: S.kitchenOpen, branchFree: S.branchFree, boltOpen: S.boltOpen,
            serviceOpen: S.serviceOpen, reconDone: S.reconDone, basketUnder: basketUnder(), varalDone: S.varalDone, codeSeen: S.codeSeen,
            towerUnlocked: S.towerUnlocked, windowOpen: S.windowOpen, porterDone: S.porterDone,
            boatDocked: S.boatDocked, ballClear: S.ballClear, storageOpen: S.storageOpen, gateOpen: S.gateOpen,
          },
          climb: S.climb ? S.climb.i : null, tug: tug.phase?.() ?? null, tugWhat: S.tugWhat, goose: goose.state,
          doors: {
            petGate: +petGate.t.toFixed(2), kitchen: +kitchenDoor.t.toFixed(2), service: +serviceDoor.t.toFixed(2), tower: +towerDoor.t.toFixed(2),
            storage: +storageDoor.t.toFixed(2), gate: +gate.t.toFixed(2),
          },
          pushables: {
            sack: { x: +sack.x.toFixed(2), z: +sack.z.toFixed(2) }, branch: { x: +branch.x.toFixed(2), z: +branch.z.toFixed(2) },
            laundry: { x: +laundry.x.toFixed(2), z: +laundry.z.toFixed(2) }, bin: { x: +bin.x.toFixed(2), z: +bin.z.toFixed(2) },
          },
          balloons: balloons.active, music: S.music, faroReady: puzzle.faroReady, cinematic: puzzle.cinematic(),
          lesada: lesada.info(),
        },
      };
    },
    /** Para os testes: o estado que importa comparar (pulando ou não as cenas). */
    snapshot() {
      const d = (n) => ({ x: +R(n).x.toFixed(3), z: +R(n).z.toFixed(3), yaw: +R(n).yaw.toFixed(3), y: +(R(n).y || 0).toFixed(3) });
      return {
        stage: S.stage, clues: book.snapshot().slice().sort(), socks: [...S.socks].sort(), board: deduction.snapshot(),
        dogs: { radhija: d('radhija'), rhaenyra: d('rhaenyra') },
        window: props.windowLeaf ? 'ok' : null, music: S.music,
        flags: { windowOpen: S.windowOpen, codeSeen: S.codeSeen, towerUnlocked: S.towerUnlocked, gateOpen: S.gateOpen },
        locks: { radhija: !!puzzle.lockFor('radhija'), rhaenyra: !!puzzle.lockFor('rhaenyra') },
      };
    },
  };

  function openServiceDoor() {
    if (S.serviceOpen) return;
    S.serviceOpen = true;
    clearSweep(serviceDoor, doorMid(sd));
    serviceDoor.setTarget(1);
    serviceDoor.lock();
    emit('door:open', { id: 'servico', x: sd.hinge.x, z: sd.hinge.z });
    setStage('piscina');
  }
  /** Onde a Rhaenyra segura a porta de mola: logo depois do vão, encostada na folha aberta (do lado da dobradiça). */
  const towerHoldSpot = { x: td.hinge.x + 0.36, z: td.hinge.z + 0.29 };
  /** Segurando do batente ou de fora: junto da parede, ao norte do vão (a passagem fica do lado do trinco). */
  const towerHoldOut = { x: td.hinge.x - 0.35, z: td.hinge.z + 0.12 };
  /** A folha vai abrir por cima de quem está no caminho: a dog dá um pulinho para fora dele (como na fase 7). */
  function clearSweep(door, face) {
    for (const n of DOG_NAMES) {
      const c = R(n);
      const out = door.sweepExit?.(c);
      if (out) effects.pushTo(c, out.x, out.z, { dur: 0.3, action: 'startled', face });
    }
  }
  function inDoorway(c, D) {
    // de fora, empurrando a folha, ela fica a um corpo da parede: o vão conta desde ali
    const x0 = D.hinge.x - 0.8, x1 = D.hinge.x + 0.95;
    const z0 = Math.min(D.hinge.z, D.latchPost.z), z1 = Math.max(D.hinge.z, D.latchPost.z);
    return c.x > x0 && c.x < x1 && c.z > z0 - 0.1 && c.z < z1 + 0.1;
  }

  // a música da história acompanha as cenas (main.js toca o que vier aqui)
  const offMusic = events.on('story:music', (/** @type {{ id?: string | null }} */ p = {}) => { if (S) S.music = p.id ?? null; });
  const disposeBase = puzzle.dispose;
  puzzle.dispose = () => { offMusic(); disposeBase(); };

  // o que as cenas deixam no estado da missão
  K.windowSeen = () => { S.windowSeen = true; };
  K.codeSeen = () => { S.codeSeen = true; };
  K.windowOpened = () => { S.windowOpen = true; props.booth?.setWindow?.(1); };

  S = fresh();
  scenes = makeScenes();
  puzzle.rooftop = roof;
  // a Rhaenyra distraída e as borboletas (testes, E2E e medições: lesada.setOn(false) tira o sorteio)
  puzzle.lesada = lesada;
  puzzle.flutter = flutter;
  return puzzle;
}

/** Pistas do capítulo que a lupa pode ter (para a UI). */
export const CHAPTER_CLUES = Object.keys(CLUES);
