// Fases de desenvolvimento: fora do menu e do progresso normal. Abra pelo id na URL, por exemplo
// http://127.0.0.1:5173/?level=pulo&play. O main.js só carrega este arquivo quando ?level= não é um número.
import pulo from './_pulo/index.js';
import modelo from './_modelo/index.js';

/** @type {import('../types').LevelDef[]} */
export const DEV_LEVELS = [pulo, modelo];
