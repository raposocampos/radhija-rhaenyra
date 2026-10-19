// Empurrão em pé (a pose; o roteiro é do controlador, src/game/dogController.js): como a Rhaenyra dos vídeos de
// referência, de pé nas traseiras com o corpo inclinado (mais em pé quanto mais alto o apoio), as patas da frente
// apoiadas na coisa (na face de um tronco ou em cima de uma beirada), a cabeça erguida e o rabo para fora,
// equilibrando. Cada empurrão sai das patas da frente e dos ombros: as patas armam (cotovelos dobram, um tiquinho para
// trás e para cima) e batem esticando, os ombros dão um tranco curto para a frente e ela solta uma rosnadinha. O
// quadril e as traseiras ficam firmes (o corpo não vai e volta pela pelve).
// Funções puras (sem Three): dogAnimation.js usa para o corpo, as pernas, o pescoço, a boca e o rabo.
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
/** As patas da frente armam (0..1): saem um tiquinho para trás e para cima, com os cotovelos dobrando, e batem. */
export const SHOVE_COCK = [[0, 0], [0.08, 0], [0.26, 1], [0.34, 0.9], [0.41, 0], [1, 0]];
/** Tranco dos ombros para a frente (0..1): curto, no empurrão, e volta devagar. */
export const SHOVE_JOLT = [[0, 0], [0.32, 0], [0.42, 1], [0.54, 0.75], [0.8, 0], [1, 0]];
/** A coisa cede um pouquinho sob as patas no empurrão (0..1). */
export const SHOVE_PRESS = [[0, 0], [0.36, 0], [0.43, 1], [0.6, 0.75], [0.78, 0], [1, 0]];
/** Rosnadinha (0..1): boquinha franzida enquanto empurra. */
export const SHOVE_GROWL = [[0, 0], [0.3, 0], [0.38, 1], [0.6, 1], [0.74, 0], [1, 0]];

/**
 * O que muda em cada instante do ciclo de empurrão (cycle = 0..1; −1 = sem empurrar): cock (as patas armando), jolt
 * (o tranco dos ombros), press (a coisa cedendo) e growl (a rosnadinha).
 * @param {number} cycle
 */
export function shoveBeat(cycle) {
  if (!(cycle >= 0)) return { cock: 0, jolt: 0, press: 0, growl: 0 };
  return {
    cock: keys(SHOVE_COCK, cycle),
    jolt: keys(SHOVE_JOLT, cycle),
    press: keys(SHOVE_PRESS, cycle),
    growl: keys(SHOVE_GROWL, cycle),
  };
}

/**
 * Pose de pé: o ângulo do corpo (theta, rad, focinho para cima, girando pelo quadril), onde fica a articulação do
 * quadril (hy, hz) e o alvo da articulação das patas da frente (wy, wz), para patas a `y` m de altura numa superfície a
 * `gap` m do centro da dog, apoiando `over` m além dela (0 = na face; > 0 = em cima de uma beirada).
 * hip/shoulder = posições de repouso das articulações do quadril e do ombro (HLu, FLu); lf = dianteira, do ombro à
 * pata (m); s = escala da dog. A pose não muda no ciclo de empurrão (o quadril fica parado).
 * Quanto mais alto o apoio, mais em pé (≈ 50° num tronco, ≈ 60° numa mesinha, ≈ 70° num tampo alto); o ombro fica um
 * pouco acima das patas e o braço quase esticado, como nos vídeos.
 * @param {{ hip: {y:number,z:number}, shoulder: {y:number,z:number}, lf: number, y: number, gap: number, over?: number,
 *   s?: number }} o
 */
export function shoveStand({ hip, shoulder, lf, y, gap, over = 0, s = 1 }) {
  const top = over > 0.005;
  // alvo da IK = a articulação da pata (no chão, ~4,5 cm acima dele): em cima de uma beirada, a essa altura do tampo,
  // com a almofadinha apoiada logo à frente; na face, a almofadinha (pata virada para cima) fica ~3,5 cm além dela
  const wy = y + (top ? 0.045 * s : 0);
  const wz = top ? gap + over - 0.015 * s : gap - 0.035 * s;
  const yu = y / s;
  const hy = (0.235 + clamp((yu - 0.45) * 0.25, 0, 0.04)) * s;
  const vy = shoulder.y - hip.y;
  const vz = shoulder.z - hip.z;
  const R = Math.hypot(vy, vz);
  const phi = Math.atan2(vy, vz);
  // ombro um pouco acima das patas (menos nos apoios altos)
  const yS = wy + (0.12 - (yu - 0.3) * 0.4) * s;
  const theta = clamp(Math.asin(clamp((yS - hy) / R, -1, 1)) - phi, 0.45, 1.2);
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const Sy = hy + vy * c + vz * sn;
  const Sz = -vy * sn + vz * c; // ombro em relação ao quadril
  // braço quase esticado: sobra para armar e bater
  const reach = lf * 0.88;
  const dy = wy - Sy;
  const dz = Math.sqrt(Math.max(0, reach * reach - dy * dy)) || 0.02 * s;
  const hz = wz - dz - Sz;
  return { theta, hy, hz, wy, wz, top };
}

/** Envelope de entrar/sair da pose (0..1 do shoveK do controlador → peso suave nas pontas). */
export const shoveEnv = (k) => sstep(0, 1, clamp(k, 0, 1));
