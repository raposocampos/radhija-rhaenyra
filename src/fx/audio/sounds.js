// Biblioteca completa de sons (v1 + v2 + bafo + v3) e tabelas de mixagem. Para um som novo: escreva a função em
// soundsV1.js/soundsV2.js (ou num arquivo novo) e acrescente aqui; createAudio().play(nome) já toca.
import { SOUNDS, MIN_GAP, PITCH_VAR, VERB, UI_SOUNDS, LOW_PRIORITY } from './soundsV1.js';
import { SOUNDS2, MIN_GAP_V2, PITCH_VAR_V2, VERB_V2 } from './soundsV2.js';
import { SOUNDS_BAFO, MIN_GAP_BAFO, PITCH_VAR_BAFO, VERB_BAFO } from './soundsBafo.js';
import { SOUNDS3, MIN_GAP_V3, PITCH_VAR_V3, VERB_V3 } from './soundsV3.js';

Object.assign(SOUNDS, SOUNDS2);
Object.assign(MIN_GAP, MIN_GAP_V2);
Object.assign(PITCH_VAR, PITCH_VAR_V2);
Object.assign(VERB, VERB_V2);
Object.assign(SOUNDS, SOUNDS_BAFO);
Object.assign(MIN_GAP, MIN_GAP_BAFO);
Object.assign(PITCH_VAR, PITCH_VAR_BAFO);
Object.assign(VERB, VERB_BAFO);
Object.assign(SOUNDS, SOUNDS3);
Object.assign(MIN_GAP, MIN_GAP_V3);
Object.assign(PITCH_VAR, PITCH_VAR_V3);
Object.assign(VERB, VERB_V3);
['curtainIn', 'curtainOut', 'uiMove', 'uiBack', 'uiDenied'].forEach((n) => UI_SOUNDS.add(n));
LOW_PRIORITY.add('uiMove');

export const SOUND_NAMES = [...Object.keys(SOUNDS), 'cartRoll', 'crateDrag'];

export { SOUNDS, MIN_GAP, PITCH_VAR, VERB, UI_SOUNDS, LOW_PRIORITY };
