// Trilha do jogo (src/fx/audio/themes.js e music.js): um tema para o menu, um para o mapa e um para cada fase
// publicada; as partituras se leem (8 compassos de 16 semicolcheias, acordes válidos, notas em faixas boas), o que
// toca em cada semicolcheia cabe num celular, e a música começa ligada com volume próprio salvo no navegador.
// Sem navegador: o som de verdade é conferido na prévia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, noteToMidi, parseBar, chordNotes, themeFor } from '../src/fx/audio/themes.js';
import { compiled, stepEvents } from '../src/fx/audio/music.js';
import { createAudio } from '../src/fx/audio.js';
import { LEVELS } from '../src/levels/index.js';

test('trilha: um tema para o menu, um para o mapa e um para cada fase publicada', () => {
  assert.ok(THEMES.menu && THEMES.mapa);
  for (const d of LEVELS) assert.ok(THEMES[d.id], `a ${d.id} tem tema`);
  // nomes diferentes: cada tela tem a sua música
  const names = Object.values(THEMES).map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(themeFor('fase3'), 'fase3');
  assert.equal(themeFor('pulo'), null, 'fase de desenvolvimento sem tema: silêncio');
  assert.equal(themeFor(null), null);
});

test('trilha: notas, compassos e acordes se leem', () => {
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('F#5'), 78);
  assert.equal(noteToMidi('Bb4'), 70);
  assert.equal(noteToMidi('H4'), null);
  assert.equal(parseBar('C5 . . . E5 . . . G5 . . . . . . .').filter((n) => n != null).length, 3);
  assert.throws(() => parseBar('C5 . .'), /16 posições/);
  assert.deepEqual(chordNotes('C').notes, [60, 64, 67]);
  assert.deepEqual(chordNotes('Am').notes, [57, 60, 64]);
  assert.equal(chordNotes('G7').notes.length, 4);
  assert.throws(() => chordNotes('X'), /acorde inválido/);
});

test('trilha: cada tema tem 8 compassos de melodia em faixas boas e não pesa no celular', () => {
  for (const id of Object.keys(THEMES)) {
    const T = compiled(id);
    assert.equal(T.bars.length, 8, id);
    assert.ok(T.bpm >= 70 && T.bpm <= 140, `${id}: andamento ${T.bpm}`);
    let notes = 0, events = 0, worst = 0;
    for (let b = 0; b < 8; b++) {
      assert.equal(T.bars[b].lead.length, 16, `${id} compasso ${b + 1}`);
      for (let s = 0; s < 16; s++) {
        const ev = stepEvents(T, b, s);
        events += ev.length;
        worst = Math.max(worst, ev.length);
        for (const e of ev) {
          if (e.part === 'lead') {
            notes++;
            assert.ok(e.midi >= 55 && e.midi <= 96, `${id}: melodia em ${e.midi}`);
            assert.ok(e.steps >= 1 && e.steps <= 6, `${id}: duração ${e.steps}`);
          }
          if (e.part === 'bass') assert.ok(e.midi >= 28 && e.midi <= 56, `${id}: baixo em ${e.midi}`);
          if (e.part === 'pad') assert.ok(e.notes.every((n) => n >= 60 && n <= 84), `${id}: tapete ${e.notes}`);
        }
      }
    }
    assert.ok(notes >= 16, `${id}: a melodia tem corpo (${notes} notas)`);
    // orçamento: até ~2 eventos por semicolcheia em média e 7 no pior momento (cada evento são poucas vozes curtas)
    assert.ok(events <= 300, `${id}: ${events} eventos por volta`);
    assert.ok(worst <= 7, `${id}: ${worst} eventos numa semicolcheia`);
  }
});

test('trilha: a música começa ligada; volume e a nota de liga/desliga ficam salvos', (t) => {
  const values = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k) } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  const a = createAudio();
  assert.equal(a.musicOn, true);
  assert.ok(a.musicVolume > 0.3 && a.musicVolume < 0.8, 'volume médio');
  // antes do primeiro toque o áudio não existe: o tema fica guardado e começa no unlock
  a.setMusic('menu');
  assert.equal(a.musicTheme, 'menu');
  assert.equal(a.musicPlaying, null);
  a.setMusic('fase7');
  assert.equal(a.musicTheme, 'fase7');
  a.setMusic('nao-existe');
  assert.equal(a.musicTheme, null);
  a.setMusicVolume(0.35);
  a.setMusicOn(false);
  const b = createAudio();
  assert.equal(b.musicVolume, 0.35);
  assert.equal(b.musicOn, false);
});
