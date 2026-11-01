// Ajudas dos testes do Modo História (test/historia-*.test.mjs): o jogo headless com a área do Recanto das Patinhas
// (cenário de verdade, test/helpers/headless.mjs), tocar uma cena até o fim ou pulando (segurar E), e o detector de
// "nada atravessa nada" que roda a cada quadro das cenas e das transições.
import STORY from '../../src/story/areas/recanto/index.js';
import { createHeadlessGame } from './headless.mjs';

export { STORY };

/** O jogo headless na área da história (query: 'stage=varal', 'dog=rhaenyra'...). */
export function createStoryGame({ query = '', ...rest } = {}) {
  return createHeadlessGame({ story: STORY, query, ...rest });
}

/** O estado da história no debug.info(). */
export const storyInfo = (h) => h.info().story;

/**
 * Dog no chão dentro de um colisor, ou uma dentro da outra (o que nem as cenas nem as transições podem fazer).
 * No alto (caminha, lixeira, toldo, terraço: y acima de 5 cm) ela está em cima de algo: fica de fora.
 * As duas deitadas juntas na caminha (o abraço) encostam de propósito.
 * @returns {string[]}
 */
export function intrusions(h, { tol = 0.02, shrink = 0.8 } = {}) {
  const out = [];
  const C = h.ctrls;
  const w = h.world;
  for (const n of ['radhija', 'rhaenyra']) {
    const c = C[n];
    if ((c.y || 0) > 0.05) continue;
    for (const k of w.contacts(c.x, c.z, c.r * shrink, c.size)) {
      if (k.depth > tol) out.push(`${n} dentro de ${k.id} (${k.depth.toFixed(3)} m) em (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`);
    }
  }
  const a = C.radhija, b = C.rhaenyra;
  const lying = !!(h.puzzle.lockFor('radhija')?.lie && h.puzzle.lockFor('rhaenyra')?.lie);
  if (!lying && Math.abs((a.y || 0) - (b.y || 0)) < 0.3 && Math.hypot(a.x - b.x, a.z - b.z) < (a.r + b.r) * shrink) {
    out.push(`uma dog dentro da outra em (${a.x.toFixed(2)}, ${a.z.toFixed(2)}) e (${b.x.toFixed(2)}, ${b.z.toFixed(2)})`);
  }
  return out;
}

/**
 * Toca a cena que está para começar (ou já começou) até o fim, ou pulando (segurando E logo depois de ela começar).
 * Cada quadro passa pelo detector de intrusões e pelo `each(h)` opcional. Na abertura, quando ela espera o Faro, aperta V.
 * @returns {{ id: string | null, frames: number, seconds: number, bad: string[], skipped: boolean }}
 */
export function playScene(h, { skip = false, max = 120, each = null, faroKey = 'KeyV' } = {}) {
  const bad = new Set();
  let frames = 0;
  // começa (a cena pendente entra no próximo quadro)
  for (let i = 0; i < 5 && !storyInfo(h).scene; i++) { h.step(); frames++; }
  const id = storyInfo(h).scene;
  if (!id) return { id: null, frames, seconds: frames / 60, bad: [], skipped: false };
  if (skip) h.keyDown('KeyE');
  let pressedFaro = false;
  while (storyInfo(h).scene && frames < max * 60) {
    if (!skip && !pressedFaro && storyInfo(h).beat === 'pulso' && h.puzzle.waitingFaro) {
      h.tap(faroKey);
      frames += 2;
      pressedFaro = true;
    }
    h.step();
    frames++;
    for (const m of intrusions(h)) bad.add(`[${id}/${storyInfo(h).beat ?? 'fim'}] ${m}`);
    each?.(h);
  }
  if (skip) h.keyUp('KeyE');
  // o quadro seguinte (as dogs soltas, a etapa nova)
  h.step();
  frames++;
  for (const m of intrusions(h)) bad.add(`[${id}/depois] ${m}`);
  return { id, frames, seconds: frames / 60, bad: [...bad], skipped: skip };
}

/** Anda com a dog ativa por (dx, dz) do mundo durante `sec` s e devolve quanto ela andou (controle livre?). */
export function moved(h, sec = 0.6, dir = [0, -1]) {
  const c = h.ctrls[h.game.activeDog];
  const x0 = c.x, z0 = c.z;
  h.hold(dir);
  h.run(sec);
  h.hold(null);
  h.run(0.1);
  return Math.hypot(c.x - x0, c.z - z0);
}
