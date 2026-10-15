// Registro das fases, em ordem. Para criar uma fase nova: copie a estrutura de uma pasta
// (index.js + layout.js + puzzle.js + world/) e acrescente aqui. Ver docs/CONTRATO.md §4.
import fase1 from './fase1/index.js';
import fase2 from './fase2/index.js';
import fase3 from './fase3/index.js';

export const LEVELS = [fase1, fase2, fase3];
export default LEVELS;
