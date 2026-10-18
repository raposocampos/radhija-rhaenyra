// Fases de desenvolvimento: fora do menu e do progresso normal. Abra pelo id na URL, por exemplo
// http://127.0.0.1:5173/?level=pulo&play. O main.js só carrega este arquivo quando ?level= não é um número.
import pulo from './_pulo/index.js';
import bafo from './_bafo/index.js';
import modelo from './_modelo/index.js';
import fase6 from './fase6/index.js';
import fase7 from './fase7/index.js';

// Cada definição valida o contrato concreto antes de entrar neste catálogo heterogêneo.
/** @type {import('../types').LevelDef[]} */
export const DEV_LEVELS = [pulo, bafo, modelo, fase6, fase7];

/**
 * Catálogo de uma partida aberta por ?level=<id> de desenvolvimento. As fases novas ainda em protótipo (as
 * de número depois da última publicada: fase6, fase7…) entram juntas e em ordem depois das publicadas, para
 * o menu da prévia mostrar a sequência 1…7; uma arena (pulo, bafo, modelo) entra sozinha. → { levels, index }
 * com o índice da fase pedida, ou null se o id não existe.
 * @param {import('../types').LevelDef[]} published @param {string} id
 */
export function devCatalog(published, id) {
  const wanted = DEV_LEVELS.find((d) => d.id === id);
  if (!wanted) return null;
  const isNext = (d) => Number.isFinite(d.number) && d.number > published.length;
  const extra = isNext(wanted) ? DEV_LEVELS.filter(isNext).sort((a, b) => a.number - b.number) : [wanted];
  const levels = [...published, ...extra];
  return { levels, index: levels.indexOf(wanted) };
}
