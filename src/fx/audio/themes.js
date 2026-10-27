// Trilha do jogo: um tema para o menu, um para o mapa das fases (Pandorópolis) e um para cada fase, combinando com o
// lugar e a hora do dia dela. Cada tema são 8 compassos em loop: a melodia escrita nota a nota (16 semicolcheias por
// compasso, "." é pausa ou sustentação), os acordes e o estilo do baixo, do acompanhamento e da percussão. O motor
// (music.js) transforma isso em notas e toca tudo sintetizado, sem arquivos.
//   lead: marimba | whistle | flute | keys | bell | toy | clarinet | vibes | accordion
//   arp (acompanhamento em colcheias): pluck | marimba | null — com arpStyle 'updown' (sobe e desce o acorde) ou
//        'gaps' (só nas colcheias em que a melodia descansa)
//   bass: pop | walk | calm | pizz | train | stroll
//   perc: pop | walk | soft | brush | train | party | clock | none
//   pad: volume do tapete de acordes (0 = sem)
//   gain: volume do tema (as fases ficam um pouco abaixo do menu, por baixo dos sons do jogo)

/** @typedef {{ id: string, name: string, bpm: number, swing?: number, gain?: number, lead: string, arp?: string | null,
 *   arpStyle?: 'updown' | 'gaps', bass: string, perc: string, pad?: number, chords: string[], melody: string[] }} ThemeDef */

/** @type {Record<string, ThemeDef>} */
export const THEMES = {
  menu: {
    id: 'menu', name: 'Recanto das Patinhas', bpm: 112, gain: 1, lead: 'marimba', arp: 'marimba', arpStyle: 'gaps', bass: 'pop', perc: 'pop', pad: 0.045,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G7'],
    melody: [
      'E5 . G5 . A5 . G5 . E5 . C5 . D5 . E5 .',
      'C5 . . . A4 . C5 . E5 . . . D5 . C5 .',
      'F5 . E5 . D5 . C5 . D5 . . . F5 . A5 .',
      'G5 . . . . . D5 . B4 . D5 . G5 . . .',
      'E5 . G5 . A5 . G5 . C6 . . . B5 . A5 .',
      'G5 . E5 . C5 . E5 . A5 . . . G5 . E5 .',
      'F5 . . . A5 . G5 . F5 . E5 . D5 . C5 .',
      'D5 . . . B4 . . . C5 . . . . . . .',
    ],
  },
  mapa: {
    id: 'mapa', name: 'Passeio em Pandorópolis', bpm: 96, swing: 0.18, gain: 0.9, lead: 'whistle', arp: 'pluck', arpStyle: 'updown', bass: 'stroll', perc: 'walk', pad: 0.04,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C7'],
    melody: [
      'A5 . . . G5 . F5 . . . C5 . . . . .',
      'D5 . . . F5 . A5 . . . G5 . . . . .',
      'Bb5 . . . A5 . G5 . F5 . . . D5 . . .',
      'E5 . . . . . . . G5 . . . . . . .',
      'A5 . . . C6 . . . A5 . G5 . F5 . . .',
      'D5 . F5 . A5 . . . G5 . . . F5 . . .',
      'G5 . . . F5 . D5 . Bb4 . . . D5 . . .',
      'C5 . . . . . E5 . F5 . . . . . . .',
    ],
  },
  // fase 1: o jardim no fim de tarde — teclado macio e cavaquinho, sem pressa
  fase1: {
    id: 'fase1', name: 'Cenoura no Jardim', bpm: 104, swing: 0.1, gain: 0.72, lead: 'keys', arp: 'pluck', arpStyle: 'updown', bass: 'walk', perc: 'soft', pad: 0.035,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D7'],
    melody: [
      'B4 . D5 . G5 . . . F#5 . G5 . A5 . B5 .',
      'G5 . . . E5 . . . B4 . . . E5 . G5 .',
      'E5 . . . C5 . E5 . G5 . . . E5 . D5 .',
      'D5 . . . . . A4 . F#5 . . . D5 . . .',
      'B4 . D5 . G5 . . . B5 . A5 . G5 . D5 .',
      'E5 . G5 . B5 . . . A5 . G5 . E5 . . .',
      'C5 . E5 . A5 . . . G5 . E5 . C5 . . .',
      'D5 . . . F#5 . . . A5 . . . C6 . . .',
    ],
  },
  // fase 2: a área de serviço no crepúsculo — clarineta na ponta dos pés, baixo em pizzicato
  fase2: {
    id: 'fase2', name: 'Bolinha no Crepúsculo', bpm: 100, gain: 0.72, lead: 'clarinet', arp: null, bass: 'pizz', perc: 'clock', pad: 0.03,
    chords: ['Dm', 'Dm', 'Gm', 'A7', 'Dm', 'Bb', 'Gm', 'A7'],
    melody: [
      'D5 . . F5 . . A5 . . . G5 . F5 . E5 .',
      'D5 . . . . . . . A4 . . . . . . .',
      'G4 . . Bb4 . . D5 . . . C5 . Bb4 . A4 .',
      'A4 . . . C#5 . E5 . G5 . . . E5 . . .',
      'D5 . F5 . A5 . . . D6 . . . C6 . A5 .',
      'Bb5 . . . F5 . D5 . . . F5 . . . . .',
      'G5 . . . Bb5 . A5 . G5 . F5 . E5 . . .',
      'C#5 . . . E5 . . . A4 . . . . . . .',
    ],
  },
  // fase 3: o jardim do lago à noite — caixinha de música por cima de um tapete de acordes
  fase3: {
    id: 'fase3', name: 'Pantufa ao Luar', bpm: 84, gain: 0.7, lead: 'bell', arp: null, bass: 'calm', perc: 'none', pad: 0.06,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E7'],
    melody: [
      'A5 . . . E5 . . . C6 . . . B5 . A5 .',
      'A5 . . . . . . . F5 . . . . . . .',
      'G5 . . . E5 . . . G5 . C6 . . . . .',
      'B5 . . . . . . . D6 . . . B5 . . .',
      'A5 . . . C6 . . . E6 . . . D6 . C6 .',
      'C6 . . . A5 . . . F5 . . . . . . .',
      'F5 . . . A5 . . . D6 . . . C6 . A5 .',
      'G#5 . . . . . . . B5 . . . E5 . . .',
    ],
  },
  // fase 4: o terraço de manhã — flauta com vento e cavaquinho
  fase4: {
    id: 'fase4', name: 'Patinho no Terraço', bpm: 108, gain: 0.72, lead: 'flute', arp: 'pluck', arpStyle: 'updown', bass: 'pop', perc: 'walk', pad: 0.03,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'Am', 'Bb', 'C7'],
    melody: [
      'C5 . F5 . A5 . . . G5 . F5 . . . C5 .',
      'E5 . . . G5 . . . C6 . . . . . . .',
      'D5 . F5 . A5 . . . C6 . A5 . . . F5 .',
      'F5 . . . D5 . . . Bb4 . . . . . . .',
      'A5 . . . C6 . . . A5 . G5 . F5 . . .',
      'E5 . . . A5 . . . C6 . . . B5 . A5 .',
      'Bb5 . . . A5 . . . G5 . F5 . D5 . . .',
      'E5 . . . G5 . . . Bb5 . . . . . . .',
    ],
  },
  // fase 5: dentro de casa, tarde de chuva — teclado aconchegante e vassourinha
  fase5: {
    id: 'fase5', name: 'Ursinho em Dia de Chuva', bpm: 88, swing: 0.12, gain: 0.72, lead: 'keys', arp: null, bass: 'calm', perc: 'brush', pad: 0.055,
    chords: ['Eb', 'Cm', 'Ab', 'Bb', 'Eb', 'Gm', 'Ab', 'Bb7'],
    melody: [
      'G5 . . . Bb5 . . . Eb6 . . . D6 . Bb5 .',
      'C6 . . . . . . . G5 . . . Eb5 . . .',
      'Eb5 . . . Ab5 . . . C6 . . . Bb5 . Ab5 .',
      'F5 . . . . . . . Bb5 . . . . . . .',
      'G5 . Bb5 . Eb6 . . . G6 . . . F6 . Eb6 .',
      'D6 . . . Bb5 . . . G5 . . . . . . .',
      'C6 . . . Eb6 . . . C6 . Bb5 . Ab5 . . .',
      'Bb5 . . . D6 . . . F6 . . . Ab5 . . .',
    ],
  },
  // fase 6: a brinquedoteca — piano de brinquedo e o tchu-tchu do trenzinho
  fase6: {
    id: 'fase6', name: 'Expresso de Brinquedo', bpm: 120, gain: 0.72, lead: 'toy', arp: null, bass: 'train', perc: 'train', pad: 0,
    chords: ['C', 'F', 'C', 'G', 'C', 'F', 'G', 'C'],
    melody: [
      'C5 . E5 . G5 . E5 . C5 . E5 . G5 . . .',
      'A5 . . . F5 . . . A5 . C6 . . . . .',
      'G5 . E5 . G5 . C6 . G5 . E5 . C5 . . .',
      'D5 . G5 . B5 . . . D6 . . . B5 . . .',
      'C6 . . . G5 . . . E5 . G5 . C6 . . .',
      'A5 . F5 . C5 . F5 . A5 . . . G5 . F5 .',
      'D5 . F5 . G5 . B5 . D6 . B5 . G5 . . .',
      'C6 . . . G5 . . . C5 . . . . . . .',
    ],
  },
  // fase 7: a pracinha depois da chuva — marimba saltitante e palminhas
  fase7: {
    id: 'fase7', name: 'Poças na Pracinha', bpm: 116, gain: 0.72, lead: 'marimba', arp: 'marimba', arpStyle: 'gaps', bass: 'pop', perc: 'pop', pad: 0.04,
    chords: ['A', 'F#m', 'D', 'E', 'A', 'F#m', 'D', 'E7'],
    melody: [
      'C#5 . E5 . A5 . E5 . C#5 . E5 . A5 . B5 .',
      'C#6 . . . A5 . F#5 . . . E5 . C#5 . . .',
      'D5 . F#5 . A5 . . . F#5 . A5 . D6 . . .',
      'B5 . . . G#5 . E5 . . . B4 . E5 . . .',
      'A5 . C#6 . E6 . . . C#6 . A5 . E5 . . .',
      'F#5 . A5 . C#6 . . . B5 . A5 . F#5 . . .',
      'A5 . . . F#5 . . . D5 . F#5 . A5 . . .',
      'G#5 . . . B5 . . . D6 . . . E5 . . .',
    ],
  },
  // fase 8: a lavanderia num domingo de manhã — vibrafone preguiçoso, suingado
  fase8: {
    id: 'fase8', name: 'Domingo de Varal', bpm: 92, swing: 0.2, gain: 0.72, lead: 'vibes', arp: null, bass: 'walk', perc: 'soft', pad: 0.045,
    chords: ['Bb', 'Gm', 'Eb', 'F', 'Bb', 'Dm', 'Eb', 'F7'],
    melody: [
      'D5 . . . F5 . . . Bb5 . . . A5 . F5 .',
      'G5 . . . . . D5 . . . Bb4 . . . . .',
      'Eb5 . G5 . Bb5 . . . G5 . . . Eb5 . . .',
      'F5 . . . . . . . C5 . . . A4 . . .',
      'Bb4 . D5 . F5 . Bb5 . . . D6 . . . C6 .',
      'A5 . . . F5 . . . D5 . . . . . . .',
      'G5 . . . Bb5 . . . G5 . F5 . Eb5 . . .',
      'A5 . . . C6 . . . Eb6 . . . . . . .',
    ],
  },
  // fase 9: a biblioteca do vovô numa noite de chuva — sininhos, o relógio de parede e um mistério bom
  fase9: {
    id: 'fase9', name: 'Biblioteca do Vovô', bpm: 80, gain: 0.7, lead: 'bell', arp: null, bass: 'calm', perc: 'clock', pad: 0.06,
    chords: ['Em', 'C', 'Am', 'B7', 'Em', 'C', 'Am', 'B7'],
    melody: [
      'E5 . . . G5 . . . B5 . . . A5 . G5 .',
      'E5 . . . . . . . C5 . . . . . . .',
      'A4 . . . C5 . . . E5 . . . D5 . C5 .',
      'B4 . . . D#5 . . . F#5 . . . . . . .',
      'G5 . . . B5 . . . E6 . . . D6 . B5 .',
      'C6 . . . G5 . . . E5 . . . . . . .',
      'A5 . . . C6 . . . E5 . . . G5 . F#5 .',
      'D#5 . . . . . . . B4 . . . . . . .',
    ],
  },
  // fase 10: a festa no quintal — sanfona, palmas e pandeiro
  fase10: {
    id: 'fase10', name: 'Festa no Quintal', bpm: 126, gain: 0.72, lead: 'accordion', arp: 'marimba', arpStyle: 'gaps', bass: 'pop', perc: 'party', pad: 0.03,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G7'],
    melody: [
      'G4 . C5 . E5 . G5 . E5 . C5 . E5 . G5 .',
      'D5 . . . B4 . D5 . G5 . . . . . . .',
      'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .',
      'F5 . . . A5 . . . C6 . . . A5 . . .',
      'G5 . . . E5 . G5 . C6 . . . B5 . C6 .',
      'D6 . . . B5 . G5 . D5 . . . G5 . . .',
      'A5 . . . C6 . A5 . F5 . A5 . G5 . F5 .',
      'F5 . . . D5 . . . B4 . . . D5 . . .',
    ],
  },
};

// ---------------------------------------------------------------- leitura das partituras
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#5" → 73 (MIDI; C4 = 60). Sem nota válida: null. */
export function noteToMidi(s) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(s);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** Um compasso escrito ("E5 . G5 . …", 16 posições) → 16 alturas MIDI ou null (pausa). */
export function parseBar(str) {
  const toks = String(str).trim().split(/\s+/);
  if (toks.length !== 16) throw new Error(`compasso com ${toks.length} posições (precisa de 16): ${str}`);
  return toks.map((t) => {
    if (t === '.') return null;
    const n = noteToMidi(t);
    if (n == null) throw new Error(`nota inválida "${t}"`);
    return n;
  });
}

const QUALITY = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7] };
/** Acorde ("F#m", "Bb", "G7") → { root (pitch class), notes: alturas MIDI de uma voicing média (a partir de C4) }. */
export function chordNotes(name) {
  const m = /^([A-G])([#b]?)(m7|maj7|m|7|sus4)?$/.exec(name);
  if (!m) throw new Error(`acorde inválido "${name}"`);
  const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const iv = QUALITY[m[3] || ''];
  // a fundamental fica entre G3 e F#4 (55–66): o tapete não sobe demais nem embola no grave
  const base = 55 + ((root - 7 + 12) % 12);
  return { root, notes: iv.map((i) => base + i) };
}

/** Partitura pronta para o motor: os 8 compassos com acorde (fundamental e notas) e melodia já em MIDI. */
export function compileTheme(def) {
  if (def.chords.length !== 8 || def.melody.length !== 8) throw new Error(`${def.id}: 8 compassos de acordes e de melodia`);
  return {
    ...def,
    swing: def.swing ?? 0,
    gain: def.gain ?? 0.8,
    pad: def.pad ?? 0,
    arp: def.arp ?? null,
    arpStyle: def.arpStyle ?? 'updown',
    bars: def.chords.map((c, i) => ({ chord: chordNotes(c), lead: parseBar(def.melody[i]) })),
  };
}

/** O tema da tela/fase: menu, mapa ou o id da fase (fase1…fase10). Sem tema: null. */
export const themeFor = (id) => (id && Object.hasOwn(THEMES, id) ? id : null);
