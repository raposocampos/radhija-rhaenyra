// Registro das fases, em ordem. Para criar uma fase nova: copie a estrutura de uma pasta
// (index.js + layout.js + puzzle.js + world/) e acrescente aqui. Passo a passo: docs/COMO-CRIAR-UMA-FASE.md.
import fase1 from './fase1/index.js';
import fase2 from './fase2/index.js';
import fase3 from './fase3/index.js';
import fase4 from './fase4/index.js';
import fase5 from './fase5/index.js';

/** @type {import('../types').LevelDef[]} */
export const LEVELS = [fase1, fase2, fase3, fase4, fase5];
export default LEVELS;
