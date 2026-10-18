// Biblioteca completa de sons (v1 + v2 + bafo + v3 + expresso + lambe + parede + lavanderia + extras) e tabelas de mixagem. Para um som novo: escreva a
// função em soundsV1.js/soundsV2.js (ou num arquivo novo) e acrescente aqui; createAudio().play(nome) já toca.
import { SOUNDS, MIN_GAP, PITCH_VAR, VERB, UI_SOUNDS, LOW_PRIORITY } from './soundsV1.js';
import { SOUNDS2, MIN_GAP_V2, PITCH_VAR_V2, VERB_V2 } from './soundsV2.js';
import { SOUNDS_BAFO, MIN_GAP_BAFO, PITCH_VAR_BAFO, VERB_BAFO } from './soundsBafo.js';
import { SOUNDS3, MIN_GAP_V3, PITCH_VAR_V3, VERB_V3 } from './soundsV3.js';
import { SOUNDS_EXPRESSO, MIN_GAP_EXPRESSO, PITCH_VAR_EXPRESSO, VERB_EXPRESSO } from './soundsExpresso.js';
import { SOUNDS_LAMBE, MIN_GAP_LAMBE, PITCH_VAR_LAMBE, VERB_LAMBE } from './soundsLambe.js';
import { SOUNDS_PAREDE, MIN_GAP_PAREDE, PITCH_VAR_PAREDE, VERB_PAREDE } from './soundsParede.js';
import { SOUNDS_LAVANDERIA, MIN_GAP_LAVANDERIA, PITCH_VAR_LAVANDERIA, VERB_LAVANDERIA } from './soundsLavanderia.js';
import { SOUNDS_EXTRAS, MIN_GAP_EXTRAS, PITCH_VAR_EXTRAS, VERB_EXTRAS } from './soundsExtras.js';

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
Object.assign(SOUNDS, SOUNDS_EXPRESSO);
Object.assign(MIN_GAP, MIN_GAP_EXPRESSO);
Object.assign(PITCH_VAR, PITCH_VAR_EXPRESSO);
Object.assign(VERB, VERB_EXPRESSO);
Object.assign(SOUNDS, SOUNDS_LAMBE);
Object.assign(MIN_GAP, MIN_GAP_LAMBE);
Object.assign(PITCH_VAR, PITCH_VAR_LAMBE);
Object.assign(VERB, VERB_LAMBE);
Object.assign(SOUNDS, SOUNDS_PAREDE);
Object.assign(MIN_GAP, MIN_GAP_PAREDE);
Object.assign(PITCH_VAR, PITCH_VAR_PAREDE);
Object.assign(VERB, VERB_PAREDE);
Object.assign(SOUNDS, SOUNDS_LAVANDERIA);
Object.assign(MIN_GAP, MIN_GAP_LAVANDERIA);
Object.assign(PITCH_VAR, PITCH_VAR_LAVANDERIA);
Object.assign(VERB, VERB_LAVANDERIA);
Object.assign(SOUNDS, SOUNDS_EXTRAS);
Object.assign(MIN_GAP, MIN_GAP_EXTRAS);
Object.assign(PITCH_VAR, PITCH_VAR_EXTRAS);
Object.assign(VERB, VERB_EXTRAS);
['curtainIn', 'curtainOut', 'uiMove', 'uiBack', 'uiDenied'].forEach((n) => UI_SOUNDS.add(n));
LOW_PRIORITY.add('uiMove');

export const SOUND_NAMES = [...Object.keys(SOUNDS), 'cartRoll', 'crateDrag'];

export { SOUNDS, MIN_GAP, PITCH_VAR, VERB, UI_SOUNDS, LOW_PRIORITY };
