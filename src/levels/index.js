// Registro das fases, em ordem. Para criar uma fase nova: copie a estrutura de uma pasta
// (index.js + layout.js + puzzle.js + world/) e acrescente aqui. Passo a passo: docs/COMO-CRIAR-UMA-FASE.md.
import fase1 from './fase1/index.js';
import fase2 from './fase2/index.js';
import fase3 from './fase3/index.js';
import fase4 from './fase4/index.js';
import fase5 from './fase5/index.js';
import fase6 from './fase6/index.js';
import fase7 from './fase7/index.js';
import fase8 from './fase8/index.js';
import fase9 from './fase9/index.js';

// Fronteira heterogênea do catálogo: cada módulo já valida build/load/puzzle com
// seu próprio LevelDef<FaseNProps>; o núcleo conserva os três na mesma definição.
/** @type {import('../types').LevelDef[]} */
export const LEVELS = [fase1, fase2, fase3, fase4, fase5, fase6, fase7, fase8, fase9];
export default LEVELS;

/**
 * Fase publicada pedida por ?level=: a posição na lista (1-based, limitada à lista; vazio = 1) ou o id de uma
 * fase publicada (?level=fase6 — os links das fases 6 e 7 do tempo de protótipo continuam valendo). → índice
 * 0-based, ou null quando o valor não é nenhum dos dois (um id de desenvolvimento: levels/dev.js).
 * @param {import('../types').LevelDef[]} levels @param {string | null} [param]
 */
export function publishedLevelIndex(levels, param) {
  const value = param || '';
  const byId = levels.findIndex((def) => def.id === value);
  if (byId >= 0) return byId;
  if (value && !/^\d+$/.test(value)) return null;
  return Math.max(1, Math.min(levels.length, parseInt(value || '1', 10) || 1)) - 1;
}
