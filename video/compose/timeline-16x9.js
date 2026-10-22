// Montagem principal (16:9, 1920×1080, 30 quadros/s, 74 s). 120 BPM: compasso = 2 s, tempo = 0,5 s (15 quadros).
// clips: trechos das cenas gravadas (start/end na linha do tempo; in = tempo dentro da cena, ou sync: a marca da cena
// cai em `at`); tr: transição de entrada. overlays: textos e grafismos (compose.js). form: a música (music.js).
import { C } from './draw.js';
import { B } from './timeline-util.js';

const kbIn = (a = 1.0, b = 1.06) => ({ s: [a, b], ease: 'inOutCubic' });

export default {
  id: '16x9',
  width: 1920,
  height: 1080,
  duration: B(37) + 0.6,
  form: [
    { type: 'intro', chords: ['D', 'Bm', 'G'] },
    { type: 'build', chords: ['Asus'] },
    { type: 'logo', chords: ['D', 'A'] },
    { type: 'verse', chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G'] },
    { type: 'soft', chords: ['G', 'A'] },
    { type: 'fill', chords: ['Bm'] },
    { type: 'chorus', chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'F#m', 'Bm'] },
    { type: 'break', chords: ['Bm', 'G', 'D', 'A'] },
    { type: 'final', chords: ['G', 'A', 'D'] },
    { type: 'outro', chords: ['D', 'G', 'D', 'D'], end: true },
  ],
  clips: [
    // ---- abertura
    { clip: 'abertura', start: 0, end: B(4), in: 0, kb: kbIn(1.02, 1.08) },
    { clip: 'retrato-radhija', start: B(4), end: B(4, 2), in: 2.7, tr: { type: 'zoom', dur: 0.25 } },
    { clip: 'retrato-rhaenyra', start: B(4, 2), end: B(5), in: 1.6, tr: { type: 'zoom', dur: 0.25 } },
    // ---- logo (as duas no fim da descida da câmera, desfocadas)
    { clip: 'abertura', start: B(5), end: B(7), in: 5.0, blur: [5, 9], dark: 0.32, kb: kbIn(1.06, 1.12), mute: true, tr: { type: 'cut', dur: 0 } },
    // ---- Radhija
    { clip: 'superbafo', start: B(7), end: B(8, 3), in: 0, kb: kbIn(1.0, 1.05), tr: { type: 'paw', dur: 0.5, at: [0.5, 0.55], color: C.honey } },
    { clip: 'arrancada', start: B(8, 3), end: B(10), sync: { mark: 'arrancada', at: B(9) }, tr: { type: 'slide', dur: 0.32 } },
    { clip: 'vao', start: B(10), end: B(11), in: 1.5, kb: kbIn(1.0, 1.04), tr: { type: 'whip', dur: 0.28 } },
    // ---- Rhaenyra
    { clip: 'parede', start: B(11), end: B(12, 2), in: 0.05, kb: kbIn(1.0, 1.04), tr: { type: 'paw', dur: 0.5, at: [0.5, 0.55], color: C.teal } },
    { clip: 'empurrao', start: B(12, 2), end: B(14), in: 0.2, tr: { type: 'slide', dur: 0.32 } },
    { clip: 'pulo', start: B(14), end: B(15), sync: { mark: 'pulo', at: B(14, 1.5) }, tr: { type: 'whip', dur: 0.28 } },
    // ---- Lambe-Lambe
    { clip: 'lambe', start: B(15), end: B(16), in: 0.4, kb: kbIn(1.0, 1.05), tr: { type: 'circle', dur: 0.45, color: C.pink } },
    { clip: 'lambe', start: B(16), end: B(17), sync: { mark: 'limpa', at: B(16, 0.5) }, kb: kbIn(1.05, 1.1), tr: { type: 'fade', dur: 0.2 } },
    // ---- 10 fases (o mosaico desenha as próprias cenas) e o passeio pelas fases
    { clip: 'fase2-irrigador', start: B(18), end: B(19), in: 2.0 },
    { clip: 'estab-3', start: B(19), end: B(20), in: 0.8, kb: kbIn(1.0, 1.06), tr: { type: 'slide', dur: 0.3 } },
    { clip: 'fase4-pombo', start: B(20), end: B(21), in: 2.6, tr: { type: 'slide', dur: 0.3, dir: -1 } },
    { clip: 'estab-5', start: B(21), end: B(22), in: 0.8, kb: kbIn(1.0, 1.06), tr: { type: 'slide', dur: 0.3 } },
    { clip: 'fase6-trem', start: B(22), end: B(23), sync: { mark: 'partiu', at: B(22, 1) }, tr: { type: 'slide', dur: 0.3, dir: -1 } },
    { clip: 'parede', start: B(23), end: B(24), sync: { mark: 'mantinha', at: B(23, 1.5) }, tr: { type: 'slide', dur: 0.3 } },
    { clip: 'estab-9', start: B(24), end: B(25), in: 0.8, kb: kbIn(1.0, 1.06), tr: { type: 'slide', dur: 0.3, dir: -1 } },
    { clip: 'porcos', start: B(25), end: B(26), in: 2.2, kb: kbIn(1.0, 1.05), tr: { type: 'slide', dur: 0.3 } },
    // ---- juntas
    { clip: 'coop-portao', start: B(26), end: B(27, 1), sync: { mark: 'aberto', at: B(26, 3) }, kb: kbIn(1.0, 1.05), tr: { type: 'paw', dur: 0.5, color: C.orange } },
    { clip: 'coop-escada', start: B(27, 1), end: B(28, 2), sync: { mark: 'oculos', at: B(28, 1) }, tr: { type: 'slide', dur: 0.32 } },
    { clip: 'coop-balde', start: B(28, 2), end: B(30), sync: { mark: 'deque', at: B(29, 3) }, tr: { type: 'slide', dur: 0.32, dir: -1 } },
    // ---- final
    { clip: 'luzes', start: B(30), end: B(31), in: 1.3, kb: kbIn(1.0, 1.06), tr: { type: 'zoom', dur: 0.3 } },
    { clip: 'bolo', start: B(31), end: B(33), in: 0.1, kb: kbIn(1.0, 1.08), shakes: [B(31, 0.75)], tr: { type: 'whip', dur: 0.28 } },
    // ---- cartão final
    { clip: 'final-fundo', start: B(33), end: B(37) + 0.6, in: 0, speed: 0.5, blur: [2, 7], dark: [0.15, 0.48], mute: true, tr: { type: 'fade', dur: 0.5 } },
  ],
  overlays: [
    { type: 'fade', start: 0, end: 1.3, mode: 'in', layer: 1 },
    { type: 'caption', start: 0.9, end: B(2, 3), text: 'Duas irmãs.', y: 0.8 },
    { type: 'caption', start: B(3), end: B(4) - 0.05, text: 'Dez aventuras.', y: 0.8 },
    { type: 'flash', start: B(5), end: B(5) + 0.35, layer: 1 },
    { type: 'logo', start: B(5), end: B(7) - 0.05, y: 0.42, size: 150, sub: 'Uma aventura cooperativa' },
    // Radhija
    { type: 'nameCard', start: B(7) + 0.2, end: B(8, 1), who: 'radhija', name: 'Radhija', tag: 'A IRMÃ MENOR', line: 'pequena, ágil e cheia de truques' },
    { type: 'skill', start: B(7, 2.5), end: B(8, 3), text: 'Superbafo', icon: 'wind', who: 'radhija', pos: 'br' },
    { type: 'skill', start: B(9), end: B(9, 3.5), text: 'Arrancada', icon: 'bolt', who: 'radhija', pos: 'br' },
    { type: 'skill', start: B(10, 0.25), end: B(10, 3.6), text: 'Cabe nos vãos pequenos', icon: 'paw', who: 'radhija', pos: 'br' },
    // Rhaenyra
    { type: 'nameCard', start: B(11) + 0.2, end: B(12, 2), who: 'rhaenyra', name: 'Rhaenyra', tag: 'A IRMÃ MAIOR', line: 'grande, forte e corajosa', side: 'right' },
    { type: 'skill', start: B(11, 1.5), end: B(12, 1.6), text: 'Pulo na parede', icon: 'arrowUp', who: 'rhaenyra', pos: 'bl' },
    { type: 'skill', start: B(12, 2.5), end: B(13, 3.6), text: 'Empurrão em pé', icon: 'push', who: 'rhaenyra', pos: 'bl' },
    { type: 'skill', start: B(14, 0.25), end: B(14, 3.6), text: 'Pulo', icon: 'arrowUp', who: 'rhaenyra', pos: 'bl' },
    // Lambe-Lambe
    { type: 'bigTitle', start: B(15, 0.5), end: B(17) - 0.05, text: 'Lambe-Lambe!', sub: 'uma limpa a lama da outra', y: 0.2, deco: 'hearts' },
    { type: 'particles', start: B(16, 0.5), end: B(17), kind: 'sparkles', mode: 'burst', seed: 11, n: 22, x: 0.5, y: 0.55, speed: 700, gravity: 300, size: 20, life: 1.4, colors: [C.cream, '#FFF0C8'] },
    // 10 fases
    {
      type: 'mosaic', start: B(17), end: B(18), sub: 'do jardim à festa no quintal', zoomTo: 1, zoomAt: B(17, 3.1), step: 0.1,
      tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (n === 2 ? { clip: 'fase2-irrigador', in: 0.0, label: 2 } : { clip: `estab-${n}`, in: 0.6, label: n })),
    },
    { type: 'phaseTag', start: B(18) + 0.1, end: B(19), n: 2, name: 'Operação Bolinha' },
    { type: 'phaseTag', start: B(19) + 0.15, end: B(20), n: 3, name: 'Operação Pantufa' },
    { type: 'phaseTag', start: B(20) + 0.15, end: B(21), n: 4, name: 'Operação Patinho' },
    { type: 'phaseTag', start: B(21) + 0.15, end: B(22), n: 5, name: 'Operação Ursinho' },
    { type: 'phaseTag', start: B(22) + 0.15, end: B(23), n: 6, name: 'Expresso do Superbafo' },
    { type: 'phaseTag', start: B(23) + 0.15, end: B(24), n: 8, name: 'Lavanderia de Domingo' },
    { type: 'phaseTag', start: B(24) + 0.15, end: B(25), n: 9, name: 'Biblioteca do Vovô' },
    { type: 'phaseTag', start: B(25) + 0.15, end: B(26), n: 10, name: 'Festa no Quintal' },
    // juntas
    { type: 'shade', start: B(26), end: B(27, 3), side: 'top', k: 0.55, size: 0.45 },
    { type: 'bigTitle', start: B(26, 0.5), end: B(27, 3), text: 'Juntas, elas resolvem!', sub: 'cada irmã faz a sua parte', size: 104, y: 0.17 },
    // final
    { type: 'flash', start: B(31, 0.75), end: B(31, 0.75) + 0.3, layer: 1 },
    { type: 'particles', start: B(31, 0.75), end: B(33), kind: 'confetti', mode: 'burst', seed: 3, n: 90, x: 0.5, y: 0.4, speed: 1300, gravity: 1500, size: 18, life: 2.2 },
    { type: 'particles', start: B(32), end: B(33), kind: 'confetti', mode: 'rain', seed: 8, n: 70, y: 0, speed: 700, size: 16, life: 2 },
    {
      type: 'endCard', start: B(33), end: B(37) + 0.6,
      portraits: [
        { clip: 'retrato-radhija', in: 2.4, speed: 0.25, name: 'Radhija', who: 'radhija', focus: [0.56, 0.36], zoom: 1.9 },
        { clip: 'retrato-rhaenyra', in: 2.2, speed: 0.28, name: 'Rhaenyra', who: 'rhaenyra', focus: [0.52, 0.38], zoom: 1.8 },
      ],
    },
    { type: 'fade', start: B(37) - 0.4, end: B(37) + 0.6, mode: 'out', layer: 1 },
  ],
  // efeitos sonoros extras (os sopros das transições e os pops dos textos saem sozinhos, ver render.mjs)
  cues: [
    { type: 'sparkle', t: B(16, 0.5), vel: 0.25 },
    { type: 'sparkle', t: B(33, 1.8), vel: 0.2, base: 81 },
  ],
};
