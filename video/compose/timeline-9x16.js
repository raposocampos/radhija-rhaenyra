// Corte vertical (9:16, 1080×1920, 26 s) para redes: gancho, logo, as habilidades, as fases e o convite.
// As cenas com `-v` foram gravadas em retrato (a mesma encenação com a câmera um pouco mais afastada).
import { C } from './draw.js';
import { B } from './timeline-util.js';

const kbIn = (a = 1.0, b = 1.06) => ({ s: [a, b], ease: 'inOutCubic' });

export default {
  id: '9x16',
  width: 1080,
  height: 1920,
  duration: B(14) + 0.4,
  form: [
    { type: 'chorus', chords: ['G'] },
    { type: 'logo', chords: ['D', 'A'] },
    { type: 'chorus', chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D'] },
    { type: 'outro', chords: ['D', 'G', 'D'], end: true },
  ],
  clips: [
    { clip: 'superbafo-v', start: 0, end: B(2), in: 0.55, kb: kbIn(1.0, 1.06) },
    { clip: 'retrato-radhija-v', start: B(2), end: B(3), in: 1.0, blur: 4, dark: 0.3, mute: true, tr: { type: 'zoom', dur: 0.3 } },
    { clip: 'retrato-rhaenyra-v', start: B(3), end: B(4), in: 1.2, blur: 4, dark: 0.3, mute: true, tr: { type: 'fade', dur: 0.25 } },
    { clip: 'arrancada-v', start: B(4), end: B(5), sync: { mark: 'arrancada', at: B(4, 0.5) }, tr: { type: 'paw', dur: 0.45, color: C.honey } },
    { clip: 'parede-v', start: B(5), end: B(6), in: 0.1, tr: { type: 'slide', dur: 0.3 } },
    { clip: 'empurrao-v', start: B(6), end: B(7), in: 0.4, tr: { type: 'slide', dur: 0.3, dir: -1 } },
    { clip: 'lambe-v', start: B(7), end: B(8), sync: { mark: 'limpa', at: B(7, 2) }, tr: { type: 'circle', dur: 0.4, color: C.pink } },
    { clip: 'porcos-v', start: B(8), end: B(9), in: 2.2, kb: kbIn(1.0, 1.05), tr: { type: 'whip', dur: 0.28 } },
    { clip: 'fase6-trem-v', start: B(9), end: B(10), sync: { mark: 'partiu', at: B(9, 1) }, tr: { type: 'slide', dur: 0.3 } },
    { clip: 'coop-balde-v', start: B(10), end: B(11), sync: { mark: 'deque', at: B(10, 3) }, tr: { type: 'slide', dur: 0.3, dir: -1 } },
    { clip: 'final-fundo-v', start: B(11), end: B(14) + 0.4, in: 0, blur: [2, 7], dark: [0.15, 0.5], mute: true, tr: { type: 'fade', dur: 0.4 } },
  ],
  overlays: [
    { type: 'fade', start: 0, end: 0.35, mode: 'in', layer: 1 },
    { type: 'skill', start: 0.5, end: B(2) - 0.05, text: 'Superbafo!', icon: 'wind', who: 'radhija', pos: 'tc' },
    { type: 'flash', start: B(2), end: B(2) + 0.3, layer: 1 },
    { type: 'logo', start: B(2), end: B(4) - 0.05, y: 0.45, size: 130, lines: ['Radhija &', 'Rhaenyra'], sub: 'Aventura cooperativa', subSize: 32 },
    { type: 'skill', start: B(4, 0.5), end: B(5) - 0.05, text: 'Arrancada', icon: 'bolt', who: 'radhija' },
    { type: 'skill', start: B(5, 0.5), end: B(6) - 0.05, text: 'Pulo na parede', icon: 'arrowUp', who: 'rhaenyra' },
    { type: 'skill', start: B(6, 0.5), end: B(7) - 0.05, text: 'Empurrão em pé', icon: 'push', who: 'rhaenyra' },
    { type: 'skill', start: B(7, 0.5), end: B(8) - 0.05, text: 'Lambe-Lambe', icon: 'heart', color: C.pink },
    { type: 'bigTitle', start: B(8, 0.25), end: B(10) - 0.05, text: '10 fases', sub: 'do jardim à festa no quintal', size: 120, y: 0.17 },
    { type: 'bigTitle', start: B(10, 0.25), end: B(11) - 0.05, text: 'Juntas!', size: 130, y: 0.17 },
    {
      type: 'endCard', start: B(11), end: B(14) + 0.4,
      portraits: [
        { clip: 'retrato-radhija-v', in: 0.6, speed: 0.6, name: 'Radhija', who: 'radhija', focus: [0.5, 0.45] },
        { clip: 'retrato-rhaenyra-v', in: 0.6, speed: 0.6, name: 'Rhaenyra', who: 'rhaenyra', focus: [0.5, 0.45] },
      ],
    },
    { type: 'fade', start: B(14) - 0.3, end: B(14) + 0.4, mode: 'out', layer: 1 },
  ],
  cues: [
    { type: 'sparkle', t: B(7, 2), vel: 0.22 },
    { type: 'sparkle', t: B(11, 1.8), vel: 0.2, base: 81 },
  ],
};
