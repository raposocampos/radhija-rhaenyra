// Empurrão em pé da Rhaenyra, a parte do núcleo (game.js). Com o empurrar seguro (Shift · R1/RB · Empurrar), de frente
// para algo empurrável no alto (puzzle.shoveSpots), ela fica de pé nas traseiras, apoia as patas da frente e empurra no
// ritmo enquanto o botão estiver seguro (o roteiro é do controlador: pickShoveSpot, startShove…). Aqui ficam a escolha
// do alvo, o botão seguro e a entrega de cada empurrão (dog:shove e puzzle.onShove). A irmã não é empurrada.
import { pickShoveSpot, startShove } from './dogController.js';

/**
 * @param {{ emit: import('../types').GameEmit }} opts
 */
export function createShove({ emit }) {
  /**
   * Por quadro, com a dog ativa A e a companheira C. held = empurrar seguro (fora de trava); (dx, dz) = direção do
   * analógico no chão (zero sem entrada); spots = puzzle.shoveSpots(); world = colisão (nada no caminho).
   * → true enquanto A está no empurrão em pé (o jogo zera a entrada e usa a ação 'shove').
   * @param {import('../types').DogController} A @param {import('../types').DogController} C
   * @param {{ held: boolean, dx?: number, dz?: number, spots?: import('../types').ShoveSpot[] | null,
   *   world?: import('../types').CollisionWorld | null }} o
   */
  function frame(A, C, { held, dx = 0, dz = 0, spots = null, world = null }) {
    // trocou de dog no meio: a que virou companheira termina o empurrão em curso e desce
    if (C.shove) C.shoveHeld = false;
    if (A.shove) {
      A.shoveHeld = held;
      return true;
    }
    if (!held || A.size !== 'large' || !spots?.length) return false;
    const spot = pickShoveSpot(A, spots, dx, dz, world);
    if (!spot) return false;
    startShove(A, spot);
    emit('dog:rear', { name: A.name, id: spot.id, kind: spot.kind ?? null, x: A.x, z: A.z });
    return true;
  }

  /**
   * O empurrão de c chegou (c.shoveHit): emite dog:shove (o tum e a rosnadinha) e entrega ao puzzle (puzzle.onShove).
   * @param {import('../types').DogController} c
   * @param {{ puzzle?: import('../types').Puzzle | null, ctrls?: Record<string, import('../types').DogController>, playing?: boolean }} [o]
   */
  function hit(c, { puzzle = null, ctrls = {}, playing = true } = {}) {
    const spot = c.shoveHit;
    c.shoveHit = null;
    if (!spot) return;
    emit('dog:shove', { name: c.name, id: spot.id, kind: spot.kind ?? null, n: c.shoveN, x: spot.x + spot.nx * 0.04, y: spot.y, z: spot.z + spot.nz * 0.04 });
    if (playing) puzzle?.onShove?.(c, spot, ctrls);
  }

  return { frame, hit };
}
