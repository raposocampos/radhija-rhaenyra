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
