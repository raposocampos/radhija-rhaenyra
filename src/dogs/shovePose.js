// Empurrão em pé (a pose; o roteiro é do controlador, src/game/dogController.js): como a Rhaenyra dos vídeos de
// referência, de pé nas traseiras com o corpo inclinado (mais em pé quanto mais alto o apoio), as patas da frente
// apoiadas na coisa (na face de um tronco, em cima de uma beirada ou nas costas da irmã), a cabeça erguida e o rabo
// para fora, equilibrando. Cada empurrão: as patas saem um tiquinho, voltam batendo e o peito vai junto.
// Funções puras (sem Three): dogAnimation.js usa para o corpo, as pernas, o pescoço e o rabo.
// Referencial do objeto da dog: x lateral, y para cima, z para a frente (rumo à superfície).

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Rampa suave por quadros-chave [[p, valor], …] (smoothstep entre eles; p crescente). */
function keys(K, p) {
  if (p <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) {
    if (p <= K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * sstep(K[i - 1][0], K[i][0], p);
  }
  return K[K.length - 1][1];
}

// Ciclo de um empurrão (p = 0..1; o empurrão conta em 0,42, como SHOVE_HIT do controlador):
/** As patas da frente saem um pouquinho da superfície (0..1): para trás e para cima, antes de bater. */
const LIFT = [[0, 0], [0.06, 0], [0.2, 1], [0.32, 0.7], [0.41, 0], [1, 0]];
/** O peito vai para trás (carrega, −) e para a frente (empurra, +). */
const LUNGE = [[0, 0], [0.16, -0.45], [0.3, -0.6], [0.42, 1], [0.6, 0.8], [0.86, 0.1], [1, 0]];
/** A coisa cede um pouquinho sob as patas no empurrão (0..1). */
const PRESS = [[0, 0], [0.36, 0], [0.43, 1], [0.6, 0.75], [0.78, 0], [1, 0]];
/** Passinho de uma traseira se ajeitando no fim do ciclo (0..1; a outra no ciclo seguinte). */
const SHUFFLE = [[0, 0], [0.62, 0], [0.72, 1], [0.84, 0], [1, 0]];

/**
 * O que muda em cada instante do ciclo de empurrão (cycle = 0..1; −1 = sem empurrar): lift (patas saindo), lunge
 * (−1..1, peito), press (a coisa cedendo) e shuffle (passinho de uma traseira: 0 = esquerda, 1 = direita; amp 0..1).
 * @param {number} cycle @param {number} n empurrões já dados (alterna a traseira)
 */
export function shoveBeat(cycle, n = 0) {
  if (!(cycle >= 0)) return { lift: 0, lunge: 0, press: 0, step: 0, foot: 0 };
  return {
    lift: keys(LIFT, cycle),
    lunge: keys(LUNGE, cycle),
    press: keys(PRESS, cycle),
    step: keys(SHUFFLE, cycle),
    foot: n % 2,
  };
}

/**
 * Pose de pé: o ângulo do corpo (theta, rad, focinho para cima, girando pelo quadril), onde fica a articulação do
 * quadril (hy, hz) e o alvo do punho das dianteiras (wy, wz), para patas a `y` m de altura numa superfície a `gap` m do
 * centro da dog, apoiando `over` m além dela (0 = na face; > 0 = em cima de uma beirada ou das costas da irmã).
 * hip/shoulder = posições de repouso das articulações do quadril e do ombro (HLu, FLu); lf = dianteira, do ombro ao
 * punho (m); s = escala da dog. lunge (−1..1) = o peito indo para trás/para a frente no ciclo.
 * Quanto mais alto o apoio, mais em pé (≈ 30° nas costas da irmã, ≈ 50° num tronco, ≈ 70° num tampo alto); o ombro
 * fica um pouco acima das patas e o braço quase esticado, como nos vídeos.
 * @param {{ hip: {y:number,z:number}, shoulder: {y:number,z:number}, lf: number, y: number, gap: number, over?: number,
 *   s?: number, lunge?: number }} o
 */
export function shoveStand({ hip, shoulder, lf, y, gap, over = 0, s = 1, lunge = 0 }) {
  const top = over > 0.005;
  // alvo da IK = a articulação da pata (no chão, ~4,5 cm acima dele): em cima de uma beirada, a essa altura do tampo,
  // com a almofadinha apoiada logo à frente; na face, a almofadinha (pata virada para cima) fica ~3,5 cm além dela
  const wy = y + (top ? 0.045 * s : 0);
  const wz = top ? gap + over - 0.015 * s : gap - 0.035 * s;
  const yu = y / s;
  const hy = (0.235 + clamp((yu - 0.45) * 0.25, 0, 0.04)) * s + lunge * 0.004 * s;
  const vy = shoulder.y - hip.y;
  const vz = shoulder.z - hip.z;
  const R = Math.hypot(vy, vz);
  const phi = Math.atan2(vy, vz);
  // ombro um pouco acima das patas (menos nos apoios altos)
  const yS = wy + (0.12 - (yu - 0.3) * 0.4) * s;
  let theta = Math.asin(clamp((yS - hy) / R, -1, 1)) - phi;
  theta = clamp(theta, 0.45, 1.2) + lunge * 0.05;
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const Sy = hy + vy * c + vz * sn;
  const Sz = -vy * sn + vz * c; // ombro em relação ao quadril
  // braço quase esticado (o peito vai para a frente no empurrão: o cotovelo dobra um pouco)
  const reach = lf * 0.88;
  const dy = wy - Sy;
  const dz = Math.sqrt(Math.max(0, reach * reach - dy * dy)) || 0.02 * s;
  const hz = wz - dz - Sz + lunge * 0.022 * s;
  return { theta, hy, hz, wy, wz, top };
}

/** Envelope de entrar/sair da pose (0..1 do shoveK do controlador → peso suave nas pontas). */
export const shoveEnv = (k) => sstep(0, 1, clamp(k, 0, 1));
