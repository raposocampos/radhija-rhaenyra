// Voltinha da comemoração: a animação anda um círculo pequeno em volta do lugar da dog (dogAnimation.js), só no
// visual — o controle fica parado. Aqui o jogo escolhe o lado e o tamanho que cabem no cenário antes de ela começar.
import { celebrateLoopAt, CEL_LOOP_MIN } from '../dogs/dogAnimation.js';

/** Pontos conferidos por volta (o primeiro e o último são o próprio lugar dela). */
const SAMPLES = 16;
/** Folga (m) para o trecho entre dois pontos conferidos também caber. */
const MARGIN = 0.01;

/**
 * Por onde o corpo passa na voltinha, no mundo: dog em (x, z) olhando para yaw; s = escala da dog.
 * @returns {{ x: number, z: number }[]}
 */
export function celebrateLoopPath({ x, z, yaw, s, side, loop }, n = SAMPLES) {
  const lx = Math.cos(yaw), lz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
  const pts = [];
  for (let i = 1; i < n; i++) {
    const p = celebrateLoopAt(s, side, loop, side * Math.PI * 2 * (i / n));
    pts.push({ x: x + p.x * lx + p.z * fx, z: z + p.x * lz + p.z * fz });
  }
  return pts;
}

/**
 * A voltinha que cabe: primeiro para o lado longe da irmã, depois para o outro, em círculos cada vez menores; nada
 * cabe → loop 0 (pulinhos no lugar). O corpo (círculo r) não encosta em colisor nem no lugar da irmã, e a borda de
 * uma caminha (rim: GOAL.celebrateRim) não fica mais perto do que já estava: ela não passa por cima da borda.
 * @param {{ x: number, z: number, r: number, size: import('../types').DogSize, s: number, yaw: number,
 *           sister: { x: number, z: number, r: number }, rim?: { x: number, z: number, r: number, tube?: number } | null,
 *           overlaps: (x: number, z: number, r: number, size: import('../types').DogSize) => boolean }} o
 * @returns {{ side: number, loop: number }} side: ±1 (+ = esquerda dela); loop: 0..1 do raio
 */
export function planCelebrateLoop({ x, z, r, size, s, yaw, sister, rim = null, overlaps }) {
  const rimGap = (px, pz) => Math.hypot(px - rim.x, pz - rim.z) - rim.r; // + fora da borda, − dentro
  const gap0 = rim ? rimGap(x, z) : 0;
  const keep = rim ? Math.min(Math.abs(gap0), r + (rim.tube ?? 0.1)) - 0.02 : 0;
  const away = (x - sister.x) * Math.cos(yaw) - (z - sister.z) * Math.sin(yaw);
  const pref = away < 0 ? -1 : 1;
  const fits = (p) => {
    if (overlaps(p.x, p.z, r + MARGIN, size) || Math.hypot(p.x - sister.x, p.z - sister.z) <= r + sister.r + MARGIN) return false;
    if (!rim) return true;
    const g = rimGap(p.x, p.z);
    return Math.sign(g) === Math.sign(gap0) && Math.abs(g) >= keep;
  };
  for (const loop of [1, 0.75, 0.5]) {
    if (loop < CEL_LOOP_MIN) break;
    for (const side of [pref, -pref]) {
      if (celebrateLoopPath({ x, z, yaw, s, side, loop }).every(fits)) return { side, loop };
    }
  }
  return { side: pref, loop: 0 };
}
