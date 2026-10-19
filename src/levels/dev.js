// Fases de desenvolvimento: fora do menu e do progresso normal. Abra pelo id na URL, por exemplo
// http://127.0.0.1:5173/?level=pulo&play. O main.js só carrega este arquivo quando ?level= não é uma posição
// nem o id de uma fase publicada (as fases 6 e 7 começaram aqui e hoje estão em levels/index.js).
import pulo from './_pulo/index.js';
import bafo from './_bafo/index.js';
import modelo from './_modelo/index.js';
import canil from './_canil/index.js';
import porcos from './_porcos/index.js';
import empurra from './_empurra/index.js';

// Cada definição valida o contrato concreto antes de entrar neste catálogo heterogêneo.
/** @type {import('../types').LevelDef[]} */
export const DEV_LEVELS = [pulo, bafo, modelo, canil, porcos, empurra];

/**
 * Catálogo de uma partida aberta por ?level=<id> de desenvolvimento. As fases novas ainda em protótipo (as
 * de número depois da última publicada, como foram a fase6 e a fase7) entram juntas e em ordem depois das
 * publicadas, para o menu da prévia mostrar a sequência inteira; uma arena (pulo, bafo, modelo, canil, porcos, empurra) entra sozinha.
 * → { levels, index } com o índice da fase pedida, ou null se o id não existe.
 * @param {import('../types').LevelDef[]} published @param {string} id
 * @param {import('../types').LevelDef[]} [dev] catálogo de desenvolvimento (os testes passam protótipos de exemplo)
 */
export function devCatalog(published, id, dev = DEV_LEVELS) {
  const wanted = dev.find((d) => d.id === id);
  if (!wanted) return null;
  const isNext = (d) => Number.isFinite(d.number) && d.number > published.length;
  const extra = isNext(wanted) ? dev.filter(isNext).sort((a, b) => a.number - b.number) : [wanted];
  const levels = [...published, ...extra];
  return { levels, index: levels.indexOf(wanted) };
}
