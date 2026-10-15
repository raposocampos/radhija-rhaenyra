// =====================================================================
//  FASE 1 · Operação Cenoura — LAYOUT (fonte única de verdade para coordenadas).
//  Visual (cenário/props), mecânica (colisões/IA) e câmera leem daqui.
//  Unidades: metros. Y para cima. Plano do chão = XZ (y = 0).
//  Norte = -Z (casa), Sul = +Z (lado da câmera), Leste = +X.
//  Yaw: rotation.y = atan2(dir.x, dir.z)  → yaw 0 olha para +Z.
//  NÃO mude coordenadas sem atualizar docs/CONTRATO.md.
// =====================================================================

export const WORLD = {
  // Retângulo andável (paredes/limites). Centros das dogs ficam em [min + r, max - r].
  bounds: { minX: -6.0, maxX: 6.8, minZ: -4.8, maxZ: 4.5 },
  houseWallZ: -4.8, // fachada da casa (face voltada para o jardim)
  fenceX: 1.0, // cerca divisória (corre de norte a sul)
  fenceHeight: 0.9,
  fenceThickness: 0.14,
};

export const DOGS = {
  radhija: {
    displayName: 'Radhija',
    size: 'small',
    radius: 0.17, // colisão (círculo no plano XZ)
    walkSpeed: 2.4,
    dashSpeed: 6.0,
    dashTime: 0.3,
    dashCooldown: 0.8,
    accel: 16,
    decel: 20,
    turnSpeed: 13, // rad/s máx. de giro do corpo
    start: { x: -3.25, z: -3.75, yaw: 0.6 },
    // Guia visual (não é colisão): comprimento focinho→garupa e altura do topo da cabeça
    visual: { length: 0.6, headTop: 0.48, shoulder: 0.3 },
  },
  rhaenyra: {
    displayName: 'Rhaenyra',
    size: 'large',
    radius: 0.22,
    walkSpeed: 2.0,
    pushSpeed: 0.85,
    accel: 12,
    decel: 16,
    turnSpeed: 10,
    start: { x: -3.95, z: -3.85, yaw: 0.9 },
    visual: { length: 0.72, headTop: 0.56, shoulder: 0.34 },
  },
};

// Porta da casa (na fachada z = -4.8) e zona de retorno/vitória.
export const DOOR = {
  x: -3.6,
  width: 1.0,
  height: 2.1,
  mat: { x: -3.6, z: -4.45, w: 1.0, d: 0.6 }, // capacho (só visual)
  zone: { x: -3.6, z: -3.95, r: 0.95 }, // entregar a cenoura aqui = vitória
};

// Cerca divisória x = 1.0 com abertura (só a Radhija passa) e portão.
export const FENCE = {
  x: 1.0,
  gap: { zMin: -2.35, zMax: -1.85, center: -2.1 }, // 0.5 m — blocker invisível só para 'large'
  gate: {
    hinge: { x: 1.0, z: 2.4 }, // dobradiça (poste sul do vão)
    latchPost: { x: 1.0, z: 1.2 }, // poste do trinco (norte do vão)
    length: 1.2, // folha vai da dobradiça para -Z quando fechada (local -Z)
    closedYaw: 0,
    openYaw: -1.75, // gira para dentro do lado LESTE; ponta aberta ≈ (2.18, 2.61)
  },
  // Segmentos sólidos da cerca (para visual e colisão)
  segments: [
    { zMin: -4.8, zMax: -2.35 },
    { zMin: -1.85, zMax: 1.2 },
    { zMin: 2.4, zMax: 4.5 },
  ],
};

// Mecanismo: cordinha com brinquedo de corda pendurada no trinco, do lado LESTE.
export const ROPE = {
  anchor: { x: 1.1, z: 1.1, y: 0.82 }, // onde a corda fica presa (no poste do trinco, face leste)
  interact: { x: 1.45, z: 1.0, r: 0.6, requireEastOfX: 1.0 },
};

// Carrinho de jardim (vagão de madeira) bloqueando o nicho da cenoura.
export const CART = {
  start: { x: 4.4, z: -2.25 },
  halfSize: { x: 0.575, z: 0.31 }, // eixo longo em X
  minX: 4.4,
  maxX: 5.9, // desliza só em X
  revealX: 5.25, // ao passar disso, a cenoura é liberada
  height: 0.5,
};

// Cenoura de brinquedo (pelúcia), no fundo do nicho.
export const CARROT = { x: 4.4, z: -4.0, pickupR: 0.55 };

// Três colecionáveis opcionais: petiscos em formato de osso.
export const COLLECTIBLES = [
  { id: 'osso-banco', x: -4.7, z: 1.7, hint: 'perto do banco' },
  { id: 'osso-bebedouro', x: 3.0, z: 0.15, hint: 'perto do bebedouro de pássaros' },
  { id: 'osso-vasos', x: 5.55, z: 3.35, hint: 'entre os vasos do canto' },
];
export const COLLECTIBLE_PICKUP_R = 0.42;

// ---------------------------------------------------------------------
//  Colisores estáticos (2D no plano XZ).
//  shape: 'box' {x,z,hx,hz}  (alinhado aos eixos)
//         'circle' {x,z,r}
//  blocks: 'all' (padrão) | 'large' (só bloqueia a Rhaenyra)
//  Colisores dinâmicos (portão, carrinho) são gerenciados pela mecânica.
// ---------------------------------------------------------------------
const fx = FENCE.x;
const ft = WORLD.fenceThickness / 2;

export const STATIC_COLLIDERS = [
  // Limites (paredes externas grossas)
  { id: 'casa', shape: 'box', x: 0, z: -5.3, hx: 9, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -6.5, z: 0, hx: 0.5, hz: 6 },
  { id: 'limite-leste', shape: 'box', x: 7.3, z: 0, hx: 0.5, hz: 6 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 5.0, hx: 9, hz: 0.5 },

  // Cerca divisória
  ...FENCE.segments.map((s, i) => ({
    id: `cerca-${i}`,
    shape: 'box',
    x: fx,
    z: (s.zMin + s.zMax) / 2,
    hx: ft,
    hz: (s.zMax - s.zMin) / 2,
  })),
  {
    id: 'abertura-bloqueio-grande',
    shape: 'box',
    x: fx,
    z: FENCE.gap.center,
    hx: ft,
    hz: (FENCE.gap.zMax - FENCE.gap.zMin) / 2,
    blocks: 'large',
  },

  // Lado oeste (quintal da casa)
  { id: 'vaso-porta-oeste', shape: 'circle', x: -4.55, z: -4.45, r: 0.26 },
  { id: 'vaso-porta-leste', shape: 'circle', x: -2.65, z: -4.45, r: 0.26 },
  { id: 'canteiro-fachada', shape: 'box', x: -0.7, z: -4.6, hx: 1.3, hz: 0.2 }, // x[-2.0,0.6] z[-4.8,-4.4]
  { id: 'arvore-vaso-noroeste', shape: 'circle', x: -5.2, z: -3.9, r: 0.55 },
  { id: 'banco', shape: 'box', x: -5.535, z: 0.6, hx: 0.465, hz: 0.75 }, // assento ao longo de Z, de frente p/ leste
  { id: 'vaso-banco', shape: 'circle', x: -5.4, z: 1.75, r: 0.25 },
  { id: 'luminaria', shape: 'circle', x: -1.3, z: 3.7, r: 0.12 },

  // Lado leste (jardim do condomínio)
  { id: 'horta-elevada', shape: 'box', x: 3.2, z: -3.7, hx: 0.6, hz: 1.1 }, // x[2.6,3.8] z[-4.8,-2.6]
  { id: 'armario-jardim', shape: 'box', x: 5.9, z: -3.7, hx: 0.9, hz: 1.1 }, // x[5.0,6.8] z[-4.8,-2.6] (altura ≤ 1.2 m)
  { id: 'bebedouro-passaros', shape: 'circle', x: 3.4, z: -0.6, r: 0.32 },
  { id: 'vaso-canto-1', shape: 'circle', x: 6.1, z: 3.7, r: 0.3 },
  { id: 'vaso-canto-2', shape: 'circle', x: 5.6, z: 4.05, r: 0.22 },
  { id: 'vaso-canto-3', shape: 'circle', x: 6.35, z: 3.05, r: 0.2 },
];

// ---------------------------------------------------------------------
//  Corredores que DEVEM ficar livres de colisores e de objetos altos.
//  (Cenário pode pôr grama/pedras/flores rasteiras < 0.15 m.)
// ---------------------------------------------------------------------
export const KEEP_CLEAR = [
  { id: 'porta→abertura', from: [-3.6, -3.9], to: [0.45, -2.1], width: 1.4 },
  { id: 'trilha porta→portão', from: [-3.6, -3.9], to: [0.4, 1.8], width: 1.2 },
  { id: 'oeste ao longo da cerca', from: [0.45, -2.1], to: [0.4, 1.8], width: 0.9 },
  { id: 'leste ao longo da cerca', from: [1.55, -2.1], to: [1.65, 1.75], width: 0.9 },
  { id: 'portão→carrinho', from: [1.65, 1.75], to: [4.4, -1.3], width: 1.2 },
  { id: 'zona do carrinho', rect: { minX: 3.3, maxX: 6.6, minZ: -2.6, maxZ: -1.6 } },
  { id: 'nicho da cenoura', rect: { minX: 3.8, maxX: 5.0, minZ: -4.8, maxZ: -2.6 } },
];

// Objetos altos (> 1 m) só podem ficar em z < -4.0 (junto à casa) ou fora dos limites.
export const TALL_PROP_RULE = { allowedIfZLessThan: -4.0, orOutsideBounds: true };

// ---------------------------------------------------------------------
//  Grafo de navegação da companheira.
//  requires: 'small' (só Radhija) | 'gateOpen' | 'cartMoved'
// ---------------------------------------------------------------------
export const NAV_NODES = {
  W_door: { x: -3.3, z: -3.3 },
  W_center: { x: -2.0, z: -1.0 },
  // Pontos de espera do lado oeste ficam ~1,1 m da cerca: colados nela, a companheira
  // parecia "deitada" sobre as ripas vista pela câmera a sudeste.
  W_gapApproach: { x: -0.1, z: -2.1 },
  W_south: { x: -1.8, z: 2.4 },
  W_gate: { x: -0.15, z: 1.8 },
  E_gap: { x: 1.55, z: -2.1 },
  E_mid: { x: 2.4, z: -0.9 },
  E_rope: { x: 1.6, z: 0.6 },
  E_gate: { x: 1.65, z: 1.75 },
  E_alcove: { x: 4.4, z: -1.3 },
  E_inAlcove: { x: 4.4, z: -3.6 },
  E_south: { x: 3.6, z: 2.9 },
};

export const NAV_EDGES = [
  ['W_door', 'W_center'],
  ['W_center', 'W_gapApproach'],
  ['W_center', 'W_south'],
  ['W_center', 'W_gate'],
  ['W_south', 'W_gate'],
  ['W_gapApproach', 'W_gate'],
  ['W_gapApproach', 'E_gap', { requires: 'small' }],
  ['W_gate', 'E_gate', { requires: 'gateOpen' }],
  ['E_gap', 'E_mid'],
  ['E_gap', 'E_rope'],
  ['E_rope', 'E_gate'],
  ['E_rope', 'E_mid'],
  ['E_mid', 'E_alcove'],
  ['E_mid', 'E_south'],
  ['E_gate', 'E_south'],
  ['E_south', 'E_alcove'],
  ['E_alcove', 'E_inAlcove', { requires: 'cartMoved' }],
];

// Sol de fim de tarde: vem de oeste-sudoeste, baixo. (direção PARA a luz)
export const SUN = { direction: [-0.62, 0.42, 0.38], color: '#ffc58a', intensity: 3.2 };

// Câmera da fase: seguimento (offset relativo ao alvo), limites do foco, plano da tela inicial
// e plano da comemoração no objetivo final.
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -3.3, maxX: 4.3, minZ: -3.75, maxZ: 2.3 },
  title: { center: { x: DOOR.x + 1.1, z: -3.4 }, radius: 5.6, angle: 0.5, height: 2.0, look: { x: DOOR.x + 0.75, y: 0.85, z: -3.55 } },
  celebrate: { pos: [DOOR.x + 0.35, 1.3, DOOR.zone.z + 3.1], look: [DOOR.x, 0.34, DOOR.zone.z + 0.05] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

// Objetivo final (entrega do item → comemoração). Genérico para todas as fases.
export const GOAL = {
  x: DOOR.zone.x,
  z: DOOR.zone.z,
  r: DOOR.zone.r,
  celebrate: { radhija: { x: DOOR.x + 0.4, z: DOOR.zone.z + 0.4 }, rhaenyra: { x: DOOR.x - 0.4, z: DOOR.zone.z + 0.4 } },
  // Pontos fora de cena de onde uma dog distante "entra andando" na comemoração.
  entryPoints: [{ x: -1.2, z: -3.4 }, { x: -1.4, z: -2.0 }, { x: -5.3, z: -2.6 }, { x: -2.2, z: -0.6 }, { x: -4.6, z: -0.9 }],
};

export const LAYOUT = {
  WORLD, DOGS, DOOR, FENCE, ROPE, CART, CARROT, COLLECTIBLES, COLLECTIBLE_PICKUP_R,
  STATIC_COLLIDERS, KEEP_CLEAR, TALL_PROP_RULE, NAV_NODES, NAV_EDGES, SUN, CAMERA, GOAL,
};
export default LAYOUT;
