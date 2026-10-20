// =====================================================================
//  FASE 2 · Operação Bolinha — LAYOUT (fonte única de verdade para coordenadas).
//  Área de serviço do condomínio ao crepúsculo: lavanderia + varal (zona A),
//  gramado com irrigador (zona B), caixote + canal de água (zona C) e faixa leste com a bolinha.
//  Mesmas convenções da fase 1: metros, Y para cima, Norte = -Z (parede), câmera ao sul.
//
//  Beats do puzzle:
//   1. TÁBUA DE PRESSÃO: só a Rhaenyra (large) pesa o bastante; enquanto ela está na tábua, uma
//      corda com roldana abre o PORTÃO da mureta. Comando Fica (F) para ela ficar lá.
//      A Radhija passa e dá uma ARRANCADA no CALÇO (com o portão aberto) → o calço trava o portão.
//   2. IRRIGADOR: 3 jatos giratórios cobrem o caminho até o REGISTRO. Molhou → empurrada para fora
//      do círculo + chacoalha. A Radhija passa no ritmo com a arrancada; E no registro desliga tudo.
//   3. CAIXOTE (mini-Sokoban, só a Rhaenyra empurra, em X ou Z): levar até o VÃO do meio-fio
//      (CHANNEL.slot) e empurrar para leste → cai no canal e vira PONTE.
//   Bolinha na faixa leste → levar até a CAMINHA (GOAL).
// =====================================================================
import { withStart } from '../../dogs/config.js';

export const WORLD = {
  bounds: { minX: -6.5, maxX: 6.6, minZ: -4.8, maxZ: 4.4 },
  houseWallZ: -4.8, // parede dos fundos da casa / muro do condomínio (face voltada ao pátio)
};

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -4.4, z: -3.25, yaw: 2.3 }),
  rhaenyra: withStart('rhaenyra', { x: -5.1, z: -3.4, yaw: 2.6 }),
};

// Porta da lavanderia (na parede z = -4.8) e caminha das dogs (objetivo final).
export const LAUNDRY_DOOR = { x: -4.4, width: 0.95, height: 2.1 };
// A caminha é pequena para as duas (80 × 60 cm, com o encosto de 36 cm atrás): sólida, elas a contornam e entregam a
// bolinha na beirada (antes era só visual e elas a atravessavam; retorno do usuário).
export const DOG_BED = { x: -5.5, z: -3.95, w: 0.8, d: 0.6 };

// Mureta que separa a zona A da B, com portão de ferro (mesma convenção de dobradiça da fase 1:
// folha ao longo de -Z local; yaw = openYaw * t; abre para o LESTE). Ponta aberta ≈ (-1.12, 1.71).
export const WALL_AB = { x: -2.3, thickness: 0.2, height: 0.9, segments: [{ zMin: -4.8, zMax: 0.3 }, { zMin: 1.5, zMax: 4.4 }] };
export const GATE = {
  hinge: { x: -2.3, z: 1.5 },
  latchPost: { x: -2.3, z: 0.3 },
  length: 1.2,
  closedYaw: 0,
  openYaw: -1.75,
  openTime: 0.7, // s para abrir (tábua pressionada)
  closeTime: 0.9, // s para fechar (tábua solta, sem calço)
};

// Tábua de pressão (pallet com molas). Corda: tábua → roldana → longo da mureta → folha do portão.
export const PLANK = { x: -3.5, z: 2.6, hx: 0.45, hz: 0.32, requires: 'large', pulley: { x: -2.55, z: 2.75, y: 1.15 } };

// Calço de madeira (lado leste do portão). Arrancada da Radhija com o portão ≥ 85% aberto → desliza
// até `lockedAt` (sob a folha aberta) e trava o portão aberto para sempre. Com o portão fechado: quica e volta (dica).
// lockedAt: a 85% do comprimento da folha aberta, de frente para ela, com a ponta fina enfiada por baixo, como um calço
// de porta de verdade: a rampa para a 1 cm da barra de baixo da folha e nada da madeira entra nela, em nenhuma posição
// (world/props.js, buildProps: o desenho do calço; teste em test/fase2.test.mjs).
const leaf = { x: -Math.sin(GATE.openYaw), z: -Math.cos(GATE.openYaw) }; // da dobradiça para a ponta, com o portão aberto
const wedgeAt = 0.85 * GATE.length; // onde, ao longo da folha
const wedgeBack = 0.0785; // centro do calço ao sul da folha (o calço vem do sul)
export const WEDGE = {
  x: -1.35, z: 2.35, r: 0.14, needGateT: 0.85,
  lockedAt: { x: GATE.hinge.x + leaf.x * wedgeAt - leaf.z * wedgeBack, z: GATE.hinge.z + leaf.z * wedgeAt + leaf.x * wedgeBack },
  /** Rumo da ponta fina travado: atravessando a folha, para o norte (yaw do Three.js; a ponta é o +X local). */
  lockedYaw: Math.atan2(leaf.x, leaf.z),
};

// Irrigador giratório (zona B). Disco de alcance r; jatos igualmente espaçados girando a omega rad/s.
// Um jato "molha" quem estiver dentro do disco e a menos de halfWidth (rad) do ângulo do jato.
export const SPRINKLER = { x: -0.4, z: -1.5, r: 2.2, jets: 3, omega: 1.25, halfWidth: 0.2, minR: 0.25 };
// Registro (válvula na parede) que desliga o irrigador.
export const VALVE = { x: 1.2, z: -4.62, y: 0.55, interact: { x: 1.2, z: -4.1, r: 0.6 } };

// Cerca-viva entre B e C (passagem só pelo norte, z < -2.6, depois do registro).
export const HEDGE_BC = { x: 1.8, hx: 0.25, zMin: -2.6, zMax: 4.4, height: 0.75 };

// Canal de drenagem (água corrente) separando a faixa leste. Meio-fio na margem oeste (x = 4.4)
// com um VÃO em slot.zMin..zMax: único lugar por onde o caixote entra no canal.
export const CHANNEL = { xMin: 4.4, xMax: 5.2, zMin: -4.8, zMax: 4.4, depth: 0.56, /* = altura do caixote: afundado, o topo fica rente ao chão */ slot: { zMin: 0.95, zMax: 1.85, z: 1.4 } };

// Caixote de feira (só a Rhaenyra empurra; desliza no eixo do empurrão, X ou Z).
// Limites garantem que sempre dá para chegar atrás dele (sem beco sem saída).
export const CRATE = {
  start: { x: 2.95, z: -3.25 },
  half: 0.38,
  height: 0.55,
  minX: 2.95, maxX: 4.02, minZ: -3.5, maxZ: 3.57,
  pushSpeed: 0.8,
  slotSnap: 0.3, // perto do vão (|z - slot.z| < slotSnap) e empurrando para leste → alinha e cai
};
// Pilha de tijolos: impede empurrar o caixote direto para o sul a partir do início.
export const BRICKS = { x: 3.0, z: -1.0, hx: 0.3, hz: 0.26 };

// A bolinha de tênis (item da fase), na faixa leste, diante de um canteiro.
export const BALL = { x: 5.85, z: -3.15, pickupR: 0.55 };

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'osso-samambaia', x: -5.9, z: 1.2, hint: 'perto do vaso de samambaia' },
  { id: 'osso-irrigador', x: 0.9, z: -0.6, hint: 'no gramado do irrigador' },
  { id: 'osso-canal', x: 6.1, z: 3.7, hint: 'do outro lado do canal' },
];
export const COLLECTIBLE_PICKUP_R = 0.42;

// Objetivo final: levar a bolinha até a caminha.
/** @type {import('../../types').Goal} */
export const GOAL = {
  x: -5.2, z: -3.55, r: 0.95,
  celebrate: { radhija: { x: -4.8, z: -3.2 }, rhaenyra: { x: -5.6, z: -3.2 } },
  entryPoints: [{ x: -6.0, z: -0.5 }, { x: -3.7, z: -0.8 }, { x: -4.8, z: 0.9 }],
};

// ---------------------------------------------------------------------
//  Colisores estáticos (2D, plano XZ). blocks: 'all' | 'large' | 'small'.
//  Dinâmicos (portão, caixote, vão do canal) ficam com o puzzle.
// ---------------------------------------------------------------------
const wt = WALL_AB.thickness / 2;
/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'casa', shape: 'box', x: 0, z: -5.3, hx: 9, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -7.0, z: 0, hx: 0.5, hz: 6 },
  { id: 'limite-leste', shape: 'box', x: 7.1, z: 0, hx: 0.5, hz: 6 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 4.9, hx: 9, hz: 0.5 },

  // Zona A
  ...WALL_AB.segments.map((s, i) => /** @type {import('../../types').BoxCollider} */ ({ id: `mureta-${i}`, shape: 'box', x: WALL_AB.x, z: (s.zMin + s.zMax) / 2, hx: wt, hz: (s.zMax - s.zMin) / 2 })),
  { id: 'caminha', shape: 'box', x: DOG_BED.x, z: DOG_BED.z - 0.02, hx: DOG_BED.w / 2 - 0.02, hz: DOG_BED.d / 2 - 0.01 }, // a borda e o encosto
  { id: 'tanque', shape: 'box', x: -3.3, z: -4.45, hx: 0.45, hz: 0.35 },
  { id: 'cesto-roupa', shape: 'circle', x: -2.85, z: -3.55, r: 0.26 },
  { id: 'cesto-toalha', shape: 'box', x: -2.8, z: -3.27, hx: 0.11, hz: 0.05 }, // a toalha caindo pela borda do cesto
  { id: 'poste-varal-oeste', shape: 'circle', x: -6.15, z: -4.35, r: 0.08 },
  { id: 'poste-varal-leste', shape: 'circle', x: -2.75, z: -4.35, r: 0.08 },
  { id: 'vaso-samambaia', shape: 'circle', x: -6.05, z: 2.0, r: 0.44 }, // o vaso tem 0,25 m; as frondes chegam a ~0,47 m
  { id: 'poste-roldana', shape: 'circle', x: PLANK.pulley.x, z: PLANK.pulley.z, r: 0.08 },
  { id: 'balde', shape: 'circle', x: -5.05, z: -4.55, r: 0.16 }, // balde azul ao lado da porta (world/dressing.js)
  { id: 'vassoura', shape: 'box', x: -6.41, z: -4.73, hx: 0.15, hz: 0.07 }, // vassoura encostada no muro

  // Zona B
  { id: 'registro', shape: 'box', x: VALVE.x, z: -4.62, hx: 0.16, hz: 0.18 }, // com a mangueira descendo dele até o chão
  { id: 'pilar-calha', shape: 'box', x: 1.635, z: -4.745, hx: 0.225, hz: 0.055 }, // pilar do muro e o condutor da calha
  // a cerca-viva: as folhas passam 0,13 m da ponta norte (z = HEDGE_BC.zMin)
  { id: 'sebe-bc', shape: 'box', x: HEDGE_BC.x, z: (HEDGE_BC.zMin - 0.13 + HEDGE_BC.zMax) / 2, hx: HEDGE_BC.hx, hz: (HEDGE_BC.zMax - HEDGE_BC.zMin + 0.13) / 2 },

  // Zona C
  { id: 'tijolos', shape: 'box', x: BRICKS.x, z: BRICKS.z, hx: BRICKS.hx, hz: BRICKS.hz },
  { id: 'vaso-geranio', shape: 'circle', x: 2.25, z: -4.6, r: 0.19 }, // vasos junto à parede norte (world/dressing.js)
  { id: 'vaso-florzinhas', shape: 'circle', x: 3.55, z: -4.6, r: 0.17 },
  // Canal (água) — o trecho do vão é dinâmico (some quando o caixote vira ponte)
  { id: 'canal-norte', shape: 'box', x: (CHANNEL.xMin + CHANNEL.xMax) / 2, z: (CHANNEL.zMin + CHANNEL.slot.zMin) / 2, hx: (CHANNEL.xMax - CHANNEL.xMin) / 2, hz: (CHANNEL.slot.zMin - CHANNEL.zMin) / 2, kind: 'water' },
  { id: 'canal-sul', shape: 'box', x: (CHANNEL.xMin + CHANNEL.xMax) / 2, z: (CHANNEL.slot.zMax + CHANNEL.zMax) / 2, hx: (CHANNEL.xMax - CHANNEL.xMin) / 2, hz: (CHANNEL.zMax - CHANNEL.slot.zMax) / 2, kind: 'water' },

  // Faixa leste
  { id: 'canteiro-bolinha', shape: 'box', x: 6.15, z: -4.2, hx: 0.45, hz: 0.6 },
];

export const KEEP_CLEAR = [
  { id: 'caminha→portão', from: [-5.0, -3.4], to: [-3.0, 0.9], width: 1.3 },
  { id: 'portão→tábua', from: [-3.0, 0.9], to: [-3.5, 2.6], width: 1.2 },
  { id: 'campo do irrigador', rect: { minX: -2.2, maxX: 1.55, minZ: -4.4, maxZ: 0.9 } },
  { id: 'registro→zona C', from: [1.0, -3.9], to: [2.6, -4.2], width: 1.0 },
  { id: 'trilho do caixote', rect: { minX: 2.05, maxX: 4.4, minZ: -4.8, maxZ: 4.4 } }, // só tijolos aqui
  { id: 'ponte→bolinha', from: [5.6, 1.4], to: [5.85, -3.0], width: 1.0 },
];
export const TALL_PROP_RULE = { allowedIfZLessThan: -4.0, orOutsideBounds: true };

// ---------------------------------------------------------------------
//  Navegação da companheira. requires: 'small' | 'large' | flag do puzzle
//  (flags desta fase: gateOpen, sprinklersOff, bridge).
// ---------------------------------------------------------------------
export const NAV_NODES = {
  A_bed: { x: -4.6, z: -2.9 },
  A_mid: { x: -4.2, z: -0.6 },
  A_plank: { x: -3.6, z: 1.75 },
  A_gate: { x: -3.1, z: 0.9 },
  B_gate: { x: -1.5, z: 1.0 },
  B_south: { x: -0.4, z: 2.9 },
  B_field: { x: -0.4, z: -1.5 },
  B_north: { x: 0.2, z: -4.0 },
  B_valve: { x: 1.1, z: -3.9 },
  C_north: { x: 2.45, z: -3.95 }, // longe do vaso de gerânio
  C_mid: { x: 3.6, z: -0.2 },
  C_slot: { x: 3.6, z: 1.4 },
  C_south: { x: 3.4, z: 3.4 },
  E_slot: { x: 5.75, z: 1.4 },
  E_ball: { x: 5.8, z: -2.4 },
  E_south: { x: 5.9, z: 3.2 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['A_bed', 'A_mid'],
  ['A_mid', 'A_gate'],
  ['A_mid', 'A_plank'],
  ['A_plank', 'A_gate'],
  ['A_gate', 'B_gate', { requires: 'gateOpen' }],
  ['B_gate', 'B_south'],
  ['B_gate', 'B_field', { requires: 'sprinklersOff' }],
  ['B_field', 'B_north', { requires: 'sprinklersOff' }],
  ['B_field', 'B_valve', { requires: 'sprinklersOff' }],
  ['B_north', 'B_valve'],
  ['B_valve', 'C_north'],
  ['C_north', 'C_mid'],
  ['C_mid', 'C_slot'],
  ['C_mid', 'C_south'],
  ['C_slot', 'C_south'],
  ['C_slot', 'E_slot', { requires: 'bridge' }],
  ['E_slot', 'E_ball'],
  ['E_slot', 'E_south'],
];

// Crepúsculo: o sol acabou de se pôr a oés-noroeste (luz baixa, quente e fraca) + céu azul profundo.
export const SUN = { direction: [-0.86, 0.16, -0.32], color: '#ff9f72', intensity: 1.7 };

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -3.9, maxX: 4.4, minZ: -3.75, maxZ: 2.6 },
  title: { center: { x: -3.9, z: -3.3 }, radius: 5.4, angle: 0.55, height: 2.0, look: { x: -4.6, y: 0.85, z: -3.7 } },
  celebrate: { pos: [GOAL.x + 0.35, 1.3, GOAL.z + 3.1], look: [GOAL.x, 0.34, GOAL.z + 0.05] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

export const LAYOUT = {
  WORLD, DOGS, LAUNDRY_DOOR, DOG_BED, WALL_AB, GATE, PLANK, WEDGE, SPRINKLER, VALVE, HEDGE_BC, CHANNEL, CRATE, BRICKS, BALL,
  COLLECTIBLES, COLLECTIBLE_PICKUP_R, GOAL, STATIC_COLLIDERS, KEEP_CLEAR, TALL_PROP_RULE, NAV_NODES, NAV_EDGES, SUN, CAMERA,
};
export default LAYOUT;
