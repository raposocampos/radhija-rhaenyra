// Tipos das APIs públicas do jogo (usados por JSDoc nos arquivos .js; checados com `npm run typecheck`).
// Documentação em prosa: docs/ARQUITETURA.md. Para usar num arquivo .js:
//   /** @import { LevelDef, PuzzleContext, Puzzle } from '../../types' */
import type * as THREE from 'three';

// =====================================================================================================
// Básico
// =====================================================================================================

/** Nome de uma cachorrinha. */
export type DogName = 'radhija' | 'rhaenyra';
/** Porte: 'small' (Radhija, passa por aberturas) ou 'large' (Rhaenyra, pesa e empurra). */
export type DogSize = 'small' | 'large';
/** Ponto no chão (plano XZ, metros). Norte = -Z, Leste = +X. */
export interface XZ { x: number; z: number }
/** Ponto 3D simples (ex.: alvo do marcador do objetivo; y = altura). */
export interface XYZ { x: number; y: number; z: number }
export type Vec3Tuple = [number, number, number];
/** Item principal de uma fase (ícone na UI, pose de boca da dog). */
export type ItemKind = 'carrot' | 'ball' | 'slipper' | 'duck' | 'bear' | 'frisbee' | 'sock' | 'glasses' | 'book';

// =====================================================================================================
// Colisão (src/game/collision.js) — círculos das dogs contra o mundo, no plano XZ
// =====================================================================================================

export interface ColliderBase {
  id?: string;
  /** 'static' (padrão), 'water', 'gate', 'cart', 'wedge'… (informativo; aparece nos contatos). */
  kind?: string;
  /** Quem é bloqueado: 'all' (padrão), 'large' (só a Rhaenyra) ou 'small' (só a Radhija). */
  blocks?: 'all' | DogSize;
  /** Colisor ignorado quando o CENTRO da dog está dentro deste retângulo (ex.: água sob a ponte). */
  except?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Só a IA da companheira desvia (ex.: o disco do irrigador ligado). */
  companionOnly?: boolean;
  /** Dinâmicos: liga/desliga sem remover. */
  enabled?: boolean;
  /** Obstáculo baixo que dá para pular (tronco, mureta baixa): não bloqueia quem está no ar. */
  jumpable?: boolean;
  /** Altura visual (m), usada pelo cenário provisório para desenhar obstáculos puláveis. */
  height?: number;
}
export interface BoxCollider extends ColliderBase { shape: 'box'; x: number; z: number; hx: number; hz: number }
export interface CircleCollider extends ColliderBase { shape: 'circle'; x: number; z: number; r: number }
/** Segmento com meia-espessura t (cápsula): cercas, portões, mureta fina. */
export interface SegmentCollider extends ColliderBase { shape: 'segment'; ax: number; az: number; bx: number; bz: number; t?: number }
export type Collider = BoxCollider | CircleCollider | SegmentCollider;

export interface Contact { id: string; kind: string; nx: number; nz: number; depth: number }

export interface CollisionWorld {
  statics: Collider[];
  dynamics: Collider[];
  bounds: Bounds;
  /** Registra um colisor dinâmico e devolve o PRÓPRIO objeto (mova x/z/ax…, ligue com enabled). */
  addDynamic<T extends Collider>(c: T): T & { enabled: boolean; blocks: 'all' | DogSize; kind: string };
  removeDynamic(c: Collider): void;
  getDynamic(id: string): Collider | null;
  setCompanionMode(on: boolean): void;
  readonly companionMode: boolean;
  contacts(x: number, z: number, r: number, size: DogSize, opts?: { margin?: number; ignore?: Set<string>; airborne?: boolean }): Contact[];
  resolve(x: number, z: number, r: number, size: DogSize, opts?: { iterations?: number; ignore?: Set<string>; airborne?: boolean }): { x: number; z: number; hits: Contact[] };
  /** Move com sub-passos (nunca atravessa paredes finas). */
  move(x: number, z: number, dx: number, dz: number, r: number, size: DogSize, opts?: { ignore?: Set<string>; airborne?: boolean }): { x: number; z: number; hits: Contact[] };
  overlaps(x: number, z: number, r: number, size: DogSize, opts?: { ignore?: Set<string>; airborne?: boolean }): boolean;
  /** Linha de visão "gorda": um círculo de raio r vai de A a B em linha reta? */
  segmentClear(ax: number, az: number, bx: number, bz: number, r: number, size: DogSize, opts?: { ignore?: Set<string>; airborne?: boolean }): boolean;
  clampBounds(x: number, z: number, r: number): XZ;
}

// =====================================================================================================
// Layout (src/levels/faseN/layout.js) — coordenadas e regras de uma fase
// =====================================================================================================

export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }

/** Estatísticas e posição inicial de uma dog (layout.DOGS[nome]). */
export interface DogStats {
  displayName: string;
  size: DogSize;
  /** Raio do círculo de colisão (m). */
  radius: number;
  walkSpeed: number;
  /** Só a Radhija: velocidade, duração e recarga da arrancada. */
  dashSpeed?: number;
  dashTime?: number;
  dashCooldown?: number;
  /** Só a Rhaenyra: velocidade ao empurrar. */
  pushSpeed?: number;
  /** Só a Radhija: superbafo — velocidade inicial da nuvem (m/s), duração da nuvem (s) e recarga (s). */
  bafoSpeed?: number;
  bafoLife?: number;
  bafoCooldown?: number;
  /** Só a Rhaenyra: pulo — altura (m), duração no ar (s), impulso horizontal mínimo (m/s) e recarga (s). */
  jumpHeight?: number;
  jumpTime?: number;
  jumpSpeed?: number;
  jumpCooldown?: number;
  /**
   * Só a Rhaenyra: impulso na parede — duração do impulso inteiro (s), distância máxima até o ponto de impulso para
   * começar (m) e quanto ela se afasta da parede ao voltar ao chão (m).
   */
  wallJumpTime?: number;
  wallReach?: number;
  wallBack?: number;
  /** Lambe-Lambe (as duas) — duração de cada lambida (s) e distância máxima até a irmã para começar (m). */
  lickStroke?: number;
  lickReach?: number;
  accel: number;
  decel: number;
  /** Giro máximo do corpo (rad/s). */
  turnSpeed: number;
  start: XZ & { yaw: number };
  /** Guia visual (não é colisão). */
  visual: { length: number; headTop: number; shoulder: number };
}

/**
 * Aresta do grafo de navegação: [nóA, nóB, { requires }]. `requires`: 'small' | 'large' | flag do puzzle, ou uma
 * lista delas (todas precisam valer, ex.: ['small', 'tunnel']).
 */
export type NavEdge = [string, string] | [string, string, { requires?: string | string[] }];

export interface Collectible { id: string; x: number; z: number; hint?: string }

export interface Goal {
  x: number;
  z: number;
  /** Raio da zona de entrega. */
  r: number;
  /** Onde cada dog comemora. */
  celebrate: Record<DogName, XZ>;
  /** Pontos fora de quadro de onde uma dog distante reaparece andando para a comemoração. */
  entryPoints?: XZ[];
}

export interface CameraConfig {
  fov?: number;
  /** Deslocamento da câmera de seguimento em relação à dog ativa. Define também a base WASD. */
  offset: Vec3Tuple;
  lookHeight?: number;
  /** Limites do ponto de foco (não mostrar o vazio além do cenário). */
  limits?: Bounds;
  /** Plano cinematográfico da tela inicial. */
  title?: {
    center: XZ; radius?: number; radiusAmp?: number; angle?: number; angleAmp?: number;
    height?: number; heightAmp?: number; look: XYZ; lookSway?: number; fov?: number;
  };
  celebrate: { pos: Vec3Tuple; look: Vec3Tuple };
  victoryOffset?: { pos: Vec3Tuple; look: Vec3Tuple };
  /**
   * Zonas (retângulos do ponto de foco) onde o seguimento olha mais alto (lookY, em m acima de lookHeight) e
   * deslocado (dx, dz): para mostrar algo no alto da parede do fundo. Entra e sai suave. Com `id`, a fase liga e
   * desliga a zona com cam.setZone(id, on).
   */
  zones?: { id?: string; minX: number; maxX: number; minZ: number; maxZ: number; lookY?: number; dx?: number; dz?: number }[];
}

/**
 * Campos do layout que o NÚCLEO usa. Cada fase acrescenta os seus (portões, placas, itens…), por isso
 * o índice livre no fim.
 */
export interface LevelLayout {
  WORLD: { bounds: Bounds; [k: string]: any };
  DOGS: Record<DogName, DogStats>;
  STATIC_COLLIDERS: Collider[];
  NAV_NODES: Record<string, XZ>;
  NAV_EDGES: NavEdge[];
  COLLECTIBLES: Collectible[];
  COLLECTIBLE_PICKUP_R?: number;
  GOAL: Goal;
  CAMERA: CameraConfig;
  [k: string]: any;
}

// =====================================================================================================
// Iluminação (formato de LIGHTING_DEFAULT em src/core/engine.js; a fase passa só o que muda)
// =====================================================================================================

/** Cores em string hex = sRGB; arrays [r,g,b] = linear. */
export interface LightingPreset {
  sun?: { dir?: Vec3Tuple | number[]; color?: string; intensity?: number; castShadow?: boolean; shadowBias?: number; shadowNormalBias?: number };
  hemi?: { sky?: string; ground?: string; intensity?: number };
  fog?: { color?: string; near?: number; far?: number };
  exposure?: number;
  sky?: {
    zenith?: string; mid?: string; horizon?: string; ground?: string; sun?: string;
    stars?: number; clouds?: number; glow?: number; disk?: number; cloudTint?: number[];
  };
  env?: { intensity?: number; ground?: string };
  grade?: { warm?: number[]; sat?: number; lift?: number[]; vignette?: number };
  bloom?: { strength?: number; radius?: number; threshold?: number };
}

// =====================================================================================================
// Definição de fase (src/levels/faseN/index.js)
// =====================================================================================================

export interface LevelTexts { celebrate?: string; victoryTitle?: string; victorySub?: string }

/** Motor gráfico (src/core/engine.js), do ponto de vista das fases. */
export interface Engine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer | { compile?(scene: THREE.Object3D, camera: THREE.Camera): unknown; [k: string]: any };
  applyLighting(preset: LightingPreset, bounds?: Bounds): void;
  [k: string]: any;
}

export interface LevelBuildArgs {
  engine: Engine;
  /** Group descartado ao trocar de fase: tudo o que é da fase mora aqui dentro. */
  root: THREE.Group;
  layout: LevelLayout;
  params: URLSearchParams;
}

export interface LevelBuild<P extends LevelProps = LevelProps> {
  /** Props visuais que o puzzle anima (portão, item, placas…). Ver Fase1Props…Fase5Props. */
  props: P;
  /** Objetos que podem ficar entre a câmera e as dogs (recebem o "ver através" pontilhado). */
  seeThrough?: (THREE.Object3D | null | undefined)[];
  /** Cenário estático (informativo, para depuração e capturas). */
  env?: any;
  /** Ganchos dos extras (balanço, bolinha). */
  extras?: ExtraHooks;
  update?(dt: number, t: number): void;
  dispose?(): void;
}

/** Resultado do import sob demanda. Não substitui metadados nem o puzzle da definição. */
export interface LevelModule<P extends LevelProps = LevelProps> {
  build(args: LevelBuildArgs): LevelBuild<P>;
}

export interface LevelDef<P extends LevelProps = LevelProps> {
  /** Identificador estável (chave do progresso salvo). */
  id: string;
  /** Número exibido ("Fase 2"); padrão = posição + 1. */
  number?: number;
  name: string;
  subtitle?: string;
  /** Texto do cartão de abertura. */
  intro?: string;
  item: ItemKind;
  /** Som ambiente. */
  ambience?: 'day' | 'dusk' | 'night' | 'city' | 'rain';
  texts?: LevelTexts;
  layout: LevelLayout;
  lighting: LightingPreset;
  /** Monta o cenário e os props dentro de `root`. Numa fase com cenário pesado, vem de `load()`. */
  build?(args: LevelBuildArgs): LevelBuild<P>;
  /**
   * Campos pesados da definição (o cenário: `{ build }`), trazidos sob demanda por import dinâmico, fora do
   * pacote inicial do jogo. O núcleo chama ao carregar a fase (junto com a cortina) e usa o que vier no lugar
   * dos campos da definição. Metadados, layout e puzzle ficam estáticos: a UI e os testes em Node usam sem o cenário.
   */
  load?(): Promise<LevelModule<P>>;
  createPuzzle(ctx: PuzzleContext<P>): Puzzle;
  /** Pontos das animações do cenário (extras escondidos; docs/ARQUITETURA.md, "Extras"). */
  extras?: ExtraSpot[];
}

// Eventos da fronteira de carregamento. Eventos específicos de mecânicas continuam abertos;
// este mapa não pretende ser um catálogo completo do barramento.
export type GameState = 'loading' | 'load-error' | 'title' | 'intro' | 'playing' | 'paused' | 'celebrating' | 'victory';
export interface LevelLoadingInfo {
  index: number;
  count: number;
  id: string;
  number: number;
  name: string;
  subtitle?: string;
  initial: boolean;
}
export interface LevelInfo extends Omit<LevelLoadingInfo, 'initial'> {
  intro?: string;
  item: ItemKind;
  ambience?: LevelDef['ambience'];
  texts: LevelTexts;
  total: number;
  hasNext: boolean;
}
export interface LevelErrorInfo {
  index: number;
  id?: string;
  name?: string;
  initial: boolean;
  canReturn: boolean;
  message: string;
}
export interface LifecycleEvents {
  'game:state': { state: GameState; prev: GameState; level: number };
  'level:loading': LevelLoadingInfo;
  'level:loaded': LevelInfo;
  'level:error': LevelErrorInfo;
}
export type EventArgs<K extends string> = K extends keyof LifecycleEvents
  ? [payload: LifecycleEvents[K]] : [payload?: object];
export type GameEmit = <K extends string>(name: K, ...args: EventArgs<K>) => void;

// =====================================================================================================
// Controle de movimento (src/game/dogController.js) — usado pela jogadora e pela IA
// =====================================================================================================

export interface DogController {
  name: DogName;
  cfg: DogStats;
  size: DogSize;
  /** Raio de colisão. */
  r: number;
  x: number;
  z: number;
  /** rotation.y = atan2(dir.x, dir.z); yaw 0 olha para +Z. */
  yaw: number;
  /** Velocidade escalar ao longo da orientação. */
  v: number;
  vx: number;
  vz: number;
  yawRate: number;
  animSpeed: number;
  pivoting: boolean;
  dashT: number;
  dashCd: number;
  dashDx: number;
  dashDz: number;
  blockedFrames: number;
  bumpCd: number;
  prevHitIds: Set<string>;
  /** Contatos do último integrate(). */
  hits: Contact[];
  stillT: number;
  /** Altura do pulo (m); 0 = no chão. */
  y: number;
  /** Tempo restante no ar (s); 0 = no chão. */
  jumpT: number;
  jumpDur: number;
  jumpCd: number;
  jumpDx: number;
  jumpDz: number;
  /** Pousou neste quadro (o jogo emite dog:land e zera). */
  landed: boolean;
  /** Impulso na parede: ponto em uso (null = nenhum), tempo decorrido e duração (0 = fora do impulso). */
  wall: WallSpot | null;
  wallT: number;
  wallDur: number;
  /** Onde o impulso começou (a dog avança dali até a parede). */
  wallFrom: XZ;
  /** Onde a dog deve estar neste quadro (steer calcula, integrate move com colisão). */
  wallGoalX: number;
  wallGoalZ: number;
  /** As patas já alcançaram o alto neste impulso (o toque acontece uma vez). */
  wallTouched: boolean;
  /** O ponto alcançado neste quadro (o jogo emite wall:touch, chama puzzle.onWallTouch e zera). */
  wallHit: WallSpot | null;
  /** Empurrão em pé: ponto em uso (null = fora dele) e etapa (de pé, empurrando, descendo). */
  shove: ShoveSpot | null;
  shoveStage: 'up' | 'push' | 'down' | null;
  /** Tempo na etapa (s); no 'push', no ciclo de empurrão atual. */
  shoveT: number;
  /** 0..1 do ciclo de empurrão atual (o empurrão conta em SHOVE_HIT). */
  shoveCycle: number;
  /** Empurrões dados desde que ficou de pé. */
  shoveN: number;
  /** 0 nas quatro patas … 1 de pé (para a pose). */
  shoveK: number;
  /** Deslocamento lateral na face, escolhido ao começar (m). */
  shoveLat: number;
  shoveFrom: XZ;
  /** Onde a dog deve estar neste quadro (steer calcula, integrate move com colisão). */
  shoveGoalX: number;
  shoveGoalZ: number;
  /** O botão continua seguro (o jogo atualiza a cada quadro). */
  shoveHeld: boolean;
  /** O jogo pede para descer ao fim do ciclo (a irmã saiu do lugar). */
  shoveStop: boolean;
  /** Empurrou neste quadro (o jogo emite dog:shove, chama puzzle.onShove ou a irmã reage, e zera). */
  shoveHit: ShoveSpot | null;
}

/**
 * Algo empurrável no alto (empurrão em pé da Rhaenyra) ou a irmã. (x, z): pé da superfície no meio da face onde as patas
 * da frente apoiam; (nx, nz): normal unitária, para o lado de onde a dog vem; y: altura das patas (m); w: meia largura
 * da face (m; 0 = redonda, ela fica de frente para o meio); over: quanto além da face as patas apoiam (em cima de uma
 * beirada ou das costas da irmã, m); kind: o que é ('tree', 'table', 'shelf', 'sister'…); sister: quem, se for a irmã.
 */
export interface ShoveSpot { id: string; x: number; z: number; nx: number; nz: number; y: number; w?: number; over?: number; kind?: string; sister?: DogName | null }
/**
 * Empurrável do layout (createShoveTarget): o ponto de apoio como em ShoveSpot, quantos empurrões até o item cair, a
 * mola do balanço e o item lá em cima: from/edge = onde ele está e de onde sai do apoio (mundo), land = pontos do chão
 * onde ele pode parar (o primeiro livre), r = raio no chão, center = altura do meio acima da origem dele, restY = altura
 * do meio parado no chão, rB = raio da esfera que o contém, roll = rola (bola), bounce = restituição.
 */
export interface ShoveTargetCfg {
  x: number; z: number; nx: number; nz: number; y: number; w?: number; over?: number;
  kind?: 'tree' | 'table' | 'shelf';
  pushes?: number;
  sway?: { w?: number; zeta?: number; kick?: number; grow?: number; oneSided?: boolean };
  item?: {
    from: XYZ; edge?: XYZ; land: XZ[]; r: number;
    restY?: number; center?: number; rB?: number; roll?: boolean; bounce?: number;
  };
}
/** Visual de um empurrável (src/world/shoveProps.js): inclina para longe da dog (a = rad, va = rad/s). */
export interface ShoveTargetProp extends PropBase { setSway(a: number, va: number): void }

/**
 * Parede marcada para o impulso da Rhaenyra (botão ou alavanca no alto). (x, z): pé da parede, no meio das
 * patinhas; (nx, nz): normal unitária da parede, para o lado de onde a dog vem; top: altura do que a pata toca (m);
 * out: quanto isso sai da parede (m); paws e side: altura das patinhas dianteiras pintadas e o afastamento de cada
 * uma para o lado (m), onde as patas da frente apoiam; lat: quanto a dog fica à esquerda do botão (m).
 */
export interface WallSpot { id: string; x: number; z: number; nx: number; nz: number; top: number; out?: number; paws?: number; side?: number; lat?: number }
/**
 * Botão/alavanca do alto no layout (createWallButton): o pé da parede e a normal como em WallSpot; top = altura do
 * que a pata toca. mode: 'timed' liga por holdTime s (padrão do botão), 'toggle' troca a cada impulso (padrão da
 * alavanca), 'once' liga e fica.
 */
export interface WallButtonCfg {
  x: number; z: number; nx: number; nz: number; top: number;
  kind?: 'button' | 'lever';
  mode?: 'timed' | 'toggle' | 'once';
  holdTime?: number;
}

/** Intenção de movimento de um quadro (steer). */
export interface MoveIntent {
  dx: number;
  dz: number;
  speed: number;
  /** Encarar um ponto em vez da direção do movimento. */
  faceX?: number;
  faceZ?: number;
  turnScale?: number;
  [k: string]: any;
}

// =====================================================================================================
// Cheiro (src/game/mechanics/scent.js) — nuvens do superbafo, vento, dutos e narizes
// =====================================================================================================

export interface ScentCloud { id: number; x: number; z: number; vx: number; vz: number; r: number; age: number; life: number; state: 'free' | 'duct' }
/** Faixa de vento a partir de (x, z) na direção (dirX, dirZ). Mova/desligue mexendo no próprio objeto. */
export interface ScentWind { id?: string; x: number; z: number; dirX: number; dirZ: number; length?: number; halfWidth?: number; strength?: number; funnel?: number; enabled?: boolean }
export interface ScentDuct {
  id?: string;
  inlet: { x: number; z: number; r: number };
  outlet: { x: number; z: number; dirX: number; dirZ: number; speed?: number };
  /** Segundos dentro do duto. */
  travel?: number;
  /** O duto só engole nuvens quando ativo (ex.: ventilador alinhado). */
  active?: () => boolean;
}
export interface ScentNose { id: string; x: number; z: number; r?: number; enabled?: boolean; onSmell?(cloud: ScentCloud, nose: ScentNose): void }
export interface ScentShot { x: number; z: number; dirX?: number; dirZ?: number; speed?: number; life?: number }
export interface ScentField {
  spawn(shot: ScentShot): ScentCloud;
  update(dt: number): void;
  preview(shot: ScentShot, opts?: { secs?: number; dt?: number }): { points: XZ[]; exits: XZ[]; inDuct: boolean };
  near(x: number, z: number, margin?: number): ScentCloud | null;
  windAt(x: number, z: number): XZ;
  addWind<T extends ScentWind>(w: T): T & Required<Pick<ScentWind, 'length' | 'halfWidth' | 'strength' | 'enabled'>>;
  addDuct(d: ScentDuct): ScentDuct;
  addNose(n: ScentNose): ScentNose;
  reset(): void;
  /** Encerra a fase: libera a vista e remove ventos, dutos, narizes e callbacks. */
  dispose(): void;
  showPreview(p: { points: XZ[]; exits: XZ[] }): void;
  hidePreview(): void;
  readonly clouds: ScentCloud[];
  info(): object;
  [k: string]: any;
}

// =====================================================================================================
// Puzzle (src/levels/faseN/puzzle.js) — interface entre o núcleo e a lógica da fase
// =====================================================================================================

/** O que o núcleo entrega para createPuzzle(ctx). */
export interface PuzzleContext<P extends LevelProps = LevelProps> {
  layout: LevelLayout;
  /** Os props devolvidos pelo build() da fase. */
  props: P;
  world: CollisionWorld;
  nav: any;
  /** Cheiro do superbafo: addWind / addDuct / addNose, nuvens (src/game/mechanics/scent.js). */
  scent: ScentField;
  /** Modelos das dogs (sobrevivem entre fases). */
  dogs: Record<DogName, DogModel>;
  /** Controladores de movimento (posição, velocidade, raio…). */
  ctrls: Record<DogName, DogController>;
  emit: GameEmit;
  /** Planos de foco curtos (focusShot). */
  cam: { focusShot(x: number, z: number, opts?: { hold?: number; inT?: number; outT?: number; scale?: number; y?: number; target?: { x: number; y: number; z: number } }): void; [k: string]: any };
  root: THREE.Group;
  /** Teletransporta uma dog (e reinicia a IA dela). */
  place(name: DogName, x: number, z: number, yaw?: number): void;
  params: URLSearchParams;
  engine: Engine;
  readonly activeDog: DogName;
  isStaying(name: DogName): boolean;
  setStay(name: DogName, on: boolean): void;
  brains: Record<DogName, any>;
}

export interface Objective {
  text: string | null;
  /** Onde fica o marcador (y = altura da gota; ground = altura do piso do anel, se não for o chão); null = sem marcador. */
  target: (XYZ & { ground?: number }) | null;
  stage: string;
}

/** Trava a entrada da dog (ex.: puxando a corda, girando o registro). */
export interface InputLock {
  action: string;
  faceX: number;
  faceZ: number;
  /** Pose roteirizada: a fase move a dog (x, z, yaw, y, animSpeed) e o núcleo não chama steer/integrate. */
  drive?: boolean;
  /** Inclinação do corpo inteiro (rad, + = focinho para cima), por exemplo numa rampa. */
  slope?: number;
  /** Só a companheira: anda nesta direção (unitária) a speed m/s, com colisão (a irmã dando espaço no cocô). */
  move?: { dx: number; dz: number; speed: number };
}

/** Uma lambida do Lambe-Lambe que chegou à irmã (puzzle.onLick; quem lambeu é o ctrl recebido). */
export interface LickInfo {
  /** Quem foi lambida (a irmã de quem lambeu). */
  target: DogName;
  /** Número da lambida nesta sessão (1, 2…). */
  stroke: number;
  /** Ponto lambido no mundo (y = altura) e no referencial da irmã (z para a frente, x para a esquerda dela). */
  point: XYZ;
  local: XYZ;
}

/** O que createPuzzle(ctx) devolve. Campos com ? são opcionais. */
export interface Puzzle {
  /** Etapas em ordem (a última costuma ser 'done'). */
  stages: string[];
  readonly stage: string;
  /** Quem carrega o item da fase (ou null). */
  readonly carrier: DogName | null;
  /** Com mais de um item, cada dog pode levar um na boca: esta dog leva algo? (padrão: carrier === name) */
  carries?(name: DogName): boolean;
  readonly collected: number;
  readonly total: number;
  /** Chamado pelo núcleo quando a etapa muda (para reemitir o objetivo). */
  onStageChange: (stage: string) => void;
  objective(activeName: DogName): Objective;
  /** Por quadro em 'playing'. Devolva 'delivered' quando o item chegou ao objetivo (qualquer outra coisa: segue). */
  update(dt: number, ctx: { active: DogController; comp: DogController; ctrls: Record<DogName, DogController>; stay: Record<DogName, boolean> }): string | null | void;
  /** Por quadro em 'playing' e 'celebrating' (animações). */
  updateAlways?(dt: number): void;
  /** E / A: devolva true se tratou (senão a dog late). */
  interact(active: DogController): boolean;
  lockFor(name: DogName): InputLock | null;
  /** Para onde a dog ativa olha. */
  lookTarget(ctrl: DogController): XYZ | null;
  /** Ajusta a intenção da dog ativa (empurrar, forçar…). */
  modifyIntent?(dt: number, ctrl: DogController, intent: MoveIntent, opts: { shift: boolean; comp: DogController }): { intent?: MoveIntent; action?: string } | null | undefined;
  /** "Funis" de movimento (ajuda a entrar em passagens). */
  assist?(ctrl: DogController, intent: MoveIntent, dt: number): void;
  /** Flags que liberam arestas do grafo de navegação ({ requires: 'gateOpen' }…). */
  navFlags(): Record<string, boolean>;
  setPrompt?(kind: string | null): void;
  reset(): void;
  /** Pula para uma etapa (testes, ?stage=). Devolve a dog que fica ativa, ou null se não suportar. */
  jumpToStage?(stage: string, opts?: { who?: DogName }): DogName | null;
  /** Fim da fase: encerra ações em andamento (ex.: soltar a corda). */
  endActions?(): void;
  /** Campos extras para game.debug.info(). */
  info?(): object;
  dispose?(): void;
  /** Latido da dog ativa (ex.: atrair a gansa). */
  onBark?(ctrl: DogController): void;
  /** Multiplicador da velocidade de andar (ex.: 0,5 enlameada). Vale para a ativa e para a companheira. */
  speedScale?(ctrl: DogController): number;
  /** false impede a arrancada (Shift) desta dog; o núcleo emite dog:dashBlocked e chama onDashBlocked. */
  canDash?(ctrl: DogController): boolean;
  onDashBlocked?(ctrl: DogController): void;
  /**
   * Lambe-Lambe: cada lambida que chega à irmã. As duas dogs lambem: ctrl é quem lambeu e lick.target quem foi
   * lambida. Declarar este método diz ao núcleo que a fase dá um efeito às lambidas (e cuida das dicas). Devolva
   * { stop: true } para encerrar depois desta lambida.
   */
  onLick?(ctrl: DogController, lick: LickInfo): { stop?: boolean } | null | void;
  /**
   * L / L2 sem alcançar a irmã (ctrl é quem tentou), numa fase que declarou onLick (para a dica da fase);
   * blocked = ela está perto, mas há algo no meio (cerca, portão fechado).
   */
  onLickMiss?(ctrl: DogController, miss?: { blocked: boolean }): void;
  /** Paredes marcadas onde o pulo da Rhaenyra vira impulso na parede (as que valem agora). */
  wallSpots?(): WallSpot[];
  /** O impulso na parede alcançou o alto do ponto `spot` (uma vez por impulso, no meio dele). */
  onWallTouch?(ctrl: DogController, spot: WallSpot): void;
  /** Coisas empurráveis no alto onde o empurrar da Rhaenyra vira empurrão em pé (as que valem agora). */
  shoveSpots?(): ShoveSpot[];
  /** Um empurrão em pé chegou ao ponto `spot` (um por ciclo de empurrão). */
  onShove?(ctrl: DogController, spot: ShoveSpot, ctrls: Record<DogName, DogController>): void;
  [k: string]: any;
}

// =====================================================================================================
// Props visuais (devolvidos por build() como `props`; o puzzle anima por eles, sempre com ?.)
// =====================================================================================================

export interface PropBase { object: THREE.Object3D }
export interface HighlightProp { setHighlight(on: boolean): void }
/** Item carregável: Object3D centrado e posição de origem (reset volta para lá). */
export interface ItemProp extends PropBase, HighlightProp { home: THREE.Vector3 }
export interface CollectibleProp { id: string; object: THREE.Object3D; collect(): void; reset(): void }
export interface GateProp extends PropBase { setOpen(t: number): void }
export interface PressProp extends PropBase { setPress(t: number): void }
/** Botão ou alavanca no alto da parede (src/world/wallButton.js), acionado pelo impulso na parede. */
export interface WallButtonProp extends PropBase {
  /** 0..1: o botão afundado pela patinha (ou a alavanca puxada no toque). */
  setPress(t: number): void;
  /** Ligado: luz acesa (botão) ou alavanca para baixo. */
  setOn(on: boolean): void;
  /** Botão com tempo: fração que falta (1 → 0) no anel de luzes; null apaga o anel. */
  setTimer?(k: number | null): void;
  update?(dt: number, t: number): void;
}

/** Props comuns a todas as fases. */
export interface LevelProps {
  collectibles?: CollectibleProp[];
  update?(dt: number, t: number): void;
  reset?(): void;
  /** Permite ao cenário desativar os vagalumes automáticos do feedback. */
  fireflies?: boolean;
}

/** Cenário em blocos de _modelo/_pulo: só o item é obrigatório; decoração pode estar ausente. */
export interface PlaceholderProps extends LevelProps {
  item: PropBase & HighlightProp;
  ball?: PropBase & HighlightProp;
  gate?: GateProp;
  plate?: PressProp;
}

/** Arena do Pulo: o cenário provisório e a parede de treino do impulso na parede. */
export interface PuloProps extends PlaceholderProps {
  wallButton: WallButtonProp;
  wallLever: WallButtonProp;
  /** Portinhola do armarinho (0 fechada … 1 levantada). */
  hatch: GateProp;
  lights: PropBase & { setOn(on: boolean): void };
}

/** Arena do Empurrão: os três empurráveis (src/world/shoveProps.js) e os itens lá em cima de cada um. */
export interface EmpurraProps extends LevelProps {
  item: PropBase & HighlightProp;
  tree: ShoveTargetProp;
  table: ShoveTargetProp;
  shelf: ShoveTargetProp;
  ball: PropBase;
  duck: PropBase;
  bear: PropBase;
}

/** Arena de desenvolvimento do bafo (não confundir a placa simples com a da fase 4). */
export interface BafoProps extends LevelProps {
  fan: PropBase & { setPos(x: number, z: number): void; setAligned(on: boolean): void };
  gate: GateProp;
  plate: PressProp;
  pigeon: PropBase & { setPose(p: PigeonPose): void };
  carrot: ItemProp;
  collectibles: CollectibleProp[];
}

/** Fase 1 (src/world/props.js). */
export interface Fase1Props extends LevelProps {
  gate: GateProp;
  rope: PropBase & { setTug(t: number): void };
  cart: PropBase & { setX(x: number): void };
  carrot: ItemProp;
  door: HighlightProp;
  collectibles: CollectibleProp[];
}

/** Fase 2 (src/levels/fase2/world/). */
export interface Fase2Props extends LevelProps {
  /** Pivô na dobradiça, folha ao longo de -Z local; yaw = GATE.openYaw * t. */
  gate: GateProp;
  /** 0..1: tábua afunda nas molas, a corda estica e a roldana gira. */
  plank: PressProp;
  /** t: 0 em WEDGE.x/z → 1 travado em WEDGE.lockedAt; bump(): quica (portão fechado). */
  wedge: PropBase & { setState(t: number): void; bump(): void };
  /** a: ângulo do 1º jato; k 0..1 liga/desliga. */
  sprinkler: PropBase & { setAngle(a: number): void; setOn(k: number): void };
  valve: PropBase & { setTurn(t: number): void };
  /** sink 0..1: caindo no canal até virar ponte. */
  crate: PropBase & { setPos(x: number, z: number): void; setSink(t: number): void };
  ball: ItemProp;
  /** Alias mantido pelo cenário para o puzzle provisório. */
  item?: ItemProp;
  bed: HighlightProp;
  collectibles: CollectibleProp[];
}

/** Fase 3 (src/levels/fase3/world/). */
export interface Fase3Props extends LevelProps {
  gate: GateProp;
  plateH: PressProp;
  plateL: PressProp;
  /** 0..1 brilho. */
  lanternH: PropBase & { setOn(k: number): void };
  lanternL: PropBase & { setOn(k: number): void };
  slipper: ItemProp;
  /** Alias mantido pelo cenário para o puzzle provisório. */
  item?: ItemProp;
  /** Porta de vidro mais quente quando a pantufa está a caminho. */
  door: HighlightProp;
  collectibles: CollectibleProp[];
}

/** Fase 4 (src/levels/fase4/world/). */
export interface Fase4Props extends LevelProps {
  /** Ventilador no trilho: setAligned(on) acende a luz verde do encaixe. */
  fan: PropBase & { setPos(x: number, z: number): void; setAligned(on: boolean): void };
  gate: GateProp;
  /** Placa no poleiro B (o pombo pousa). */
  plate: PressProp & { readonly surfaceY: number };
  /** Pombo do portão / pombo da passagem: pose dos pés; flying bate as asas; asleep cochila. */
  pigeon: PropBase & { setPose(p: PigeonPose): void };
  napPigeon: PropBase & { setPose(p: PigeonPose): void; peek(): void };
  duck: ItemProp;
  /** Bacia d'água: setRipple(k) agita a água (ao pegar o patinho). */
  basin: PropBase & { setRipple(k: number): void };
  /** Capacho da casa da escada (brilha com o patinho a caminho). */
  goal: PropBase & HighlightProp;
  collectibles: CollectibleProp[];
}
/** Fase 5 (src/levels/fase5/world/). */
export interface Fase5Props extends LevelProps {
  /** Portãozinho de bebê: pivô na dobradiça (folha ao longo de -Z local). */
  petGate: GateProp;
  /** Alavanca da trava: setTurn(0..1). */
  latch: PropBase & { setTurn(k: number): void };
  /** Caixa de almofadas: setCollapse(0..1) = desmontando. */
  pillowBox: PropBase & { setPos(x: number, z: number): void; setCollapse(k: number): void };
  /** Ursinho: setCarried(on) deita (na boca) ou senta (no cenário). */
  bear: ItemProp & { setCarried(on: boolean): void };
  /** Caminha das dogs (brilha com o ursinho a caminho). */
  bed: PropBase & HighlightProp;
  collectibles: CollectibleProp[];
}
/** Expresso do Superbafo (fase 6). */
/** Posições da agulha: a volta, a estrela (canaleta e bandeja) e a lua (o pórtico onde o trem busca a lua). */
export type Fase6Route = 'loop' | 'delivery' | 'moon';
/** As duas cargas do foguete. */
export type Fase6Cargo = 'planet' | 'moon';
/** Trecho do trilho: reta ['line', m] ou curva ['arc', raio, graus] (+ = esquerda). */
export type Fase6TrackCommand = ['line', number] | ['arc', number, number];
/** Desenho do trilho (src/levels/fase6/track.js): o mesmo para o movimento e para os trilhos visíveis. */
export interface Fase6TrackSpec {
  width: number; gauge: number;
  stem: Fase6TrackCommand[]; loop: Fase6TrackCommand[]; delivery: Fase6TrackCommand[]; moon: Fase6TrackCommand[];
  tail: { delivery: number; moon: number }; returnDistance: number;
}
export interface Fase6CarPose { x: number; z: number; yaw: number }
/**
 * Pose da composição: a locomotiva em (x, z, yaw); o vagão na própria pose do trilho (nas curvas ele não
 * fica alinhado à locomotiva) ou, sem `wagon`, rígido atrás dela; `tip` 0..1 = caçamba basculando.
 */
export interface Fase6TrainPose extends Fase6CarPose { wagon?: Fase6CarPose; tip?: number }
export interface Fase6Props extends LevelProps {
  pedal: PressProp;
  junction: PropBase & { setRoute(route: Fase6Route): void };
  train: PropBase & { setPose(pose: Fase6TrainPose): void };
  /** setSneeze(fase): o espirro inteiro, 0..1 (inspira, "atchim" em TRAIN.burstAt, recupera); 0 e 1 = repouso. */
  nose: PropBase & { setSneeze(t: number): void };
  /** Bolinha-planeta (começa no vagão) e a lua de brinquedo (começa no pórtico, dentro da maquete). */
  ball: ItemProp;
  moon: ItemProp;
  /** Cancela da estrela: setOpen(0 = braço baixado .. 1 = em pé). */
  barrier: PropBase & { setOpen(k: number): void };
  /** Placa do lado de fora que segura a cancela aberta. */
  barrierPlate: PressProp;
  /** Pórtico da lua: setOpen(0 = portinhola da cestinha fechada .. 1 = aberta, a lua cai no vagão). */
  hopper: PropBase & { setOpen(k: number): void };
  /**
   * Tapete com o foguete: socket(carga) = onde a carga encaixa (o puzzle prende o objeto ali);
   * launch() = decolagem, animada pelo próprio cenário durante a comemoração (o reset devolve ao chão).
   */
  goal: PropBase & HighlightProp & { socket(cargo: Fase6Cargo): THREE.Object3D; launch(): void };
  collectibles: CollectibleProp[];
  reset(): void;
}
/** Lambe-Lambe na Pracinha (fase 7): os dois objetos do piquenique. */
export type Fase7Thing = 'ball' | 'frisbee';
export interface Fase7Props extends LevelProps {
  /** Portão do parquinho: pivô na dobradiça, folha ao longo de -Z local (yaw = GATE.closedYaw…openYaw). */
  gate: GateProp;
  /** Trinco do lado de dentro do portão: setTurn(0..1) = destravando. */
  latch: PropBase & { setTurn(k: number): void };
  /** Bolinha no chão do parquinho e frisbee no deque do escorregador. */
  ball: ItemProp;
  frisbee: ItemProp;
  /** Toalha de piquenique: spot(objeto) = onde ele fica (o puzzle prende o objeto ali). */
  goal: PropBase & HighlightProp & { spot(thing: Fase7Thing): THREE.Object3D };
  collectibles: CollectibleProp[];
  reset(): void;
}
export type Fase8Thing = 'sock' | 'blanket';
/** Onde a mantinha está: em cima da máquina, no cesto, no chão (caiu sem o cesto) ou na caminha. */
export type Fase8BlanketPlace = 'machine' | 'basket' | 'floor' | 'bed';
export interface Fase8Props extends LevelProps {
  /** A meia listrada: começa presa no varal (filha de rack.sockAnchor); a boca da Radhija a leva. */
  sock: ItemProp;
  /** Varal elétrico de teto: setLower(0 em cima … 1 embaixo); a meia fica em sockAnchor. */
  rack: PropBase & { setLower(t: number): void; sockAnchor: THREE.Object3D };
  /** Máquina de lavar: setSpin(0 parada … 1 centrifugando: o tambor gira e ela chacoalha). */
  washer: PropBase & { setSpin(k: number): void };
  /**
   * A mantinha dobrada (grande demais para a boca). place(lugar, anima) leva para o lugar (anima = vai num arco
   * suave até lá); wobble(k 0..1) = escorregando na tampa da máquina que chacoalha.
   */
  blanket: PropBase & { place(where: Fase8BlanketPlace, animate?: boolean): void; wobble(k: number): void };
  /** Cesto de roupa com rodinhas (empurrável): a mantinha vai em anchor. */
  basket: PropBase & HighlightProp & { setPos(x: number, z: number): void; anchor: THREE.Object3D };
  spinButton: WallButtonProp;
  rackButton: WallButtonProp;
  /** Caminha: spot(objeto) = onde ele fica (o puzzle prende ali a meia; a mantinha vai com blanket.place('bed')). */
  bed: PropBase & HighlightProp & { spot(thing: Fase8Thing): THREE.Object3D };
  collectibles: CollectibleProp[];
  reset(): void;
}
export type Fase9Thing = 'glasses' | 'book';
/** Pose do gato Bichano (src/world/cat.js): onde está, para onde olha e o que faz (k: progresso ou metros andados). */
export interface CatPose { x: number; y?: number; z: number; yaw?: number; mode: 'sleep' | 'wake' | 'jump' | 'walk' | 'sit'; k?: number }
export interface Fase9Props extends LevelProps {
  /** Óculos do vovô (na prateleira alta da estante leste). */
  glasses: ItemProp;
  /**
   * Livro de histórias: setFall(null = no alto do armário, debaixo do gato; 0..1 caindo; 1 = no chão);
   * setLying(deitado: chão, armário, mesinha | de pé: na boca).
   */
  book: ItemProp & { setFall(k: number | null): void; setLying(on: boolean): void };
  /** Escadinha de biblioteca com rodinhas (empurrável no trilho). */
  ladder: PropBase & HighlightProp & { setPos(x: number, z: number): void };
  /** Globo terrestre de rodinhas. */
  globe: PropBase & { setPos(x: number, z: number): void };
  /**
   * Ventilador de chão: setAligned(on) = encaixado na grade do duto; setPower(on) = o disjuntor ligou a energia;
   * setRunning(on) = o botão da base (com energia, a hélice gira e as fitinhas voam).
   */
  fan: PropBase & { setPos(x: number, z: number): void; setAligned(on: boolean): void; setPower(on: boolean): void; setRunning(on: boolean): void };
  /** Vaso de terra no carrinho de rodinhas (empurrável num trilho) e o botão do registro no chão (setPress 0..1). */
  planter: PropBase & HighlightProp & { setPos(x: number, z: number): void };
  plate: PropBase & { setPress(t: number): void };
  /** Energia do jardim de inverno (lanterna, varal de luzinhas, conduíte com o pulso). */
  power: { setOn(on: boolean): void };
  /** Trava da roda da escadinha ligada por um cabo à alavanca do freio (solta: o pulso corre e ela abre). */
  ladderBrake: { setReleased(on: boolean): void };
  /** Aba da portinha de gato: setSwing(-1..1) (para que lado e quanto ela abre). */
  flap: { setSwing(v: number): void };
  /** Porta do escritório: pivô na dobradiça, folha ao longo de -Z local. */
  door: GateProp;
  /** O gato Bichano. */
  cat: PropBase & { setPose(p: CatPose): void };
  /**
   * Duto do aquecedor: setDamper(registro aberto), setPuffs(progresso 0..1 de cada baforada dentro do cano),
   * outletPuff() = a baforada saindo pela grade do escritório em cima do gato.
   */
  duct: PropBase & { setDamper(on: boolean): void; setPuffs(list: number[]): void; outletPuff(): void };
  brakeLever: WallButtonProp;
  breaker: WallButtonProp;
  doorHandle: WallButtonProp;
  doorHandleIn: WallButtonProp;
  /** Mesinha ao lado da poltrona: spot(objeto) = onde ele fica (o puzzle prende ali). */
  table: PropBase & HighlightProp & { spot(thing: Fase9Thing): THREE.Object3D };
  collectibles: CollectibleProp[];
  reset(): void;
}
export interface PigeonPose {
  x?: number; y?: number; z?: number; yaw?: number; flying?: boolean; asleep?: boolean;
  /** Progresso 0..1 para desacelerar o pouso; null volta à animação livre. */
  flightProgress?: number | null;
}

// =====================================================================================================
// Personagens
// =====================================================================================================

/** Ação de animação pedida a cada quadro (anim.action). */
export type DogAction =
  | 'none' | 'sit' | 'push' | 'strain' | 'tug' | 'celebrate' | 'sniff' | 'dash' | 'turn' | 'shake' | 'startled' | 'jump'
  | 'bafoAim' | 'bafo' | 'proud' | 'yuck' | 'lick' | 'licked' | 'slide' | 'shove';

export interface DogAnim {
  /** Velocidade real (m/s). */
  speed?: number;
  /** Velocidade de giro (rad/s). */
  turn?: number;
  action?: DogAction | string;
  /** Ponto para onde olhar (ou null). */
  lookAt?: THREE.Vector3 | XYZ | null;
  carrying?: boolean;
  /** Altura do pulo (m). */
  jump?: number;
  /** Progresso do pulo 0..1 (decolagem → pouso); −1 = no chão. */
  airK?: number;
  /** Lambe-Lambe: fase da lambida atual 0..1 (contato em 0,5) para quem lambe e para quem é lambida; −1 = sem. */
  lickPhase?: number;
  /** Lado da lambida (±1, alterna a cada uma: a cabeça balança). */
  lickSide?: number;
  /** Lambidinha no próprio focinho (ninguém por perto). */
  lickSolo?: boolean;
  /** Quem lambe: altura do ponto lambido na irmã (m; −1 = sem). Acima da boca, ela estica o pescoço. */
  lickY?: number;
  /** Inclinação do corpo inteiro (rad, + = focinho para cima). */
  slope?: number;
  /**
   * Impulso na parede: progresso 0..1 (−1 = sem), distância do centro da dog à parede (m), altura e saliência do
   * que a pata toca (m) e altura das patinhas dianteiras (m).
   */
  wallK?: number;
  wallGap?: number;
  wallTop?: number;
  wallOut?: number;
  wallPaws?: number;
  wallSide?: number;
  wallLat?: number;
  /**
   * Empurrão em pé: 0..1 de pé (0 = nas quatro patas), fase 0..1 do ciclo de empurrão (−1 = sem), distância do centro
   * da dog à superfície (m), altura das patas (m) e quanto além da face elas apoiam (m).
   */
  shoveK?: number;
  shoveCycle?: number;
  shoveGap?: number;
  shoveY?: number;
  shoveOver?: number;
  /** Quem foi empurrada: tranco (k 0..1; side + = para a direita dela, fwd + = para a frente) ou null. */
  shoved?: { k: number; side: number; fwd: number } | null;
  /** Quem foi empurrada: "hmpf" (0..1). */
  huff?: number;
  /** Extras (src/game/extras.js): progresso 0..1 da sequência do cocô (−1 = sem). */
  poopK?: number;
  /** Extras: progresso 0..1 da voltinha antes do cocô (−1 = sem). */
  poopPre?: number;
  /** Extras: pose da comemoração do segredo de quem fez o cocô (null = sem). */
  party?: PoopPartyPose | null;
  /** Extras: segundos desde que a irmã viu a comemoração (−1 = sem). */
  cheer?: number;
  /** Extras: animação do cenário em andamento (k = progresso 0..1, t = segundos) ou null. */
  extra?: { kind: ExtraKind; k: number; t: number; h?: number } | null;
}

/**
 * Comemoração do segredo (src/game/extras.js → dogAnimation.js): glee = alegria (0..1), bow = reverência de
 * brincadeira (0..1), hop = altura do pulinho (m), air = progresso no ar (0..1; −1 no chão), jump = peso da pose do pulo
 * no ar (1 no pulinho virando, menos nos pulinhos de alegria), brace = freio dos zoomies (0..1), zoom = correndo os
 * zoomies (0..1; os apoios giram com o corpo na curva).
 */
export interface PoopPartyPose {
  glee: number;
  bow: number;
  hop: number;
  air: number;
  jump: number;
  brace: number;
  zoom: number;
}
/** Animações do cenário dos extras (as que têm pose própria em dogAnimation.js; swing e spurt usam ações). */
export type ExtraKind = 'drink' | 'eat' | 'dig' | 'sneeze' | 'nudge' | 'roll' | 'swing' | 'spurt';
/**
 * Ponto de uma animação do cenário (EXTRAS na definição da fase): E perto dele, de frente, quando a fase não usou o
 * E. stand = onde a dog fica; face = para onde olha; y = altura em cima de algo (rolar na pilha); size = só uma das
 * dogs; when = flag de puzzle.navFlags() que precisa valer; seat = assento do balanço; color/particles = efeitos.
 */
export interface ExtraSpot {
  id: string;
  kind: ExtraKind;
  x: number;
  z: number;
  r?: number;
  face?: XZ;
  stand?: XZ;
  y?: number;
  /** Altura do que ela cheira (flores no alto: a cabeça abaixa menos). */
  h?: number;
  /** Pula para dentro (caixa de areia) até stand e, no fim, pula de volta. */
  hop?: boolean;
  size?: DogSize;
  when?: string;
  seat?: number;
  color?: string;
  particles?: string;
}
/** Ganchos do cenário para os extras (LevelBuild.extras). */
export interface ExtraHooks {
  /** Balanço: setAngle(assento, rad | null = solto); seatAt = onde a dog senta e para onde fica virada. */
  swing?: { setAngle(seat: number, angle: number | null): void; seatAt(seat: number, angle: number): { x: number; y: number; z: number; faceYaw: number } };
  /** Bolinha solta no chão: posição atual, roll(dirX, dirZ) = rola um pouco nessa direção; reset volta. */
  ball?: { readonly x: number; readonly z: number; roll(dirX: number, dirZ: number): void; reset(): void };
}

/** Cachorrinha procedural (createDog em src/dogs/dog.js). */
export interface DogModel {
  kind: DogName;
  object: THREE.Group;
  /** Pendure o item carregado aqui (posição zerada). */
  mouthSocket: THREE.Object3D;
  /** Âncora do marcador sobre a cabeça. */
  markerAnchor: THREE.Object3D;
  /** Chamado a cada pisada (índice da pata 0..3). */
  onFootstep: ((foot: number) => void) | null;
  update(dt: number, anim?: DogAnim): void;
  triggerBark(): void;
  /** Força a pose de boca ('carrot' | 'ball' | 'slipper' | 'duck' | 'bear' | 'frisbee') ou null para detectar pelo item. */
  setCarryPose(kind: ItemKind | null): void;
  readonly carryKind: ItemKind;
  /** Pelo molhado 0..1. */
  setWet(k: number): void;
  /**
   * Lama 0..1 (manchas que somem em placas conforme k cai) e pontos já limpos no referencial da dog
   * ({ x, y, z, r }, onde a irmã lambeu). Opcional: os dublês dos testes não desenham lama.
   */
  setMud?(k: number, clean?: (XYZ & { r: number })[]): void;
  /** Brilho de pelo limpinho 0..1 (some sozinho no feedback). */
  setShine?(k: number): void;
  /** Lama atual (0..1), para pegadas e respingos. */
  readonly mud?: number;
  stats?: any;
  bones?: THREE.Bone[];
  skeleton?: THREE.Skeleton;
  meshes?: { body: THREE.SkinnedMesh; ears: THREE.SkinnedMesh; fur: THREE.SkinnedMesh };
}

/** Dona Gansa (createGoose em src/characters/goose.js). */
export interface GooseModel {
  object: THREE.Group;
  radius: number;
  update(dt: number, anim: { speed?: number; turn?: number; action?: 'idle' | 'walk' | 'alert' | 'honk' | 'charge' | 'curious' | 'flap' | string; lookAt?: THREE.Vector3 | XYZ | null }): void;
  triggerHonk(): void;
  [k: string]: any;
}

// =====================================================================================================
// Ganchos globais de teste/depuração
// =====================================================================================================

declare global {
  interface Window {
    /** Ganchos de teste e depuração montados por src/main.js (usados por tools/ e pelas partidas automatizadas). */
    __game?: any;
    /** Tempos de montagem do cenário (depuração). */
    __f2Timings?: any;
    __f3Timings?: any;
    __f4Timings?: any;
    __f5Timings?: any;
    __f6Timings?: any;
    __f7Timings?: any;
    __envTimings?: any;
    webkitAudioContext?: typeof AudioContext;
  }
}
