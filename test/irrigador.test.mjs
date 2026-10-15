// Equilíbrio do irrigador da fase 2 (simulação de tools/scripts/sim-sprinkler.mjs, mesmo código do jogo).
// Garante o desenho do puzzle: a arrancada da Radhija tem uma janela justa; andando é bem mais difícil;
// a Rhaenyra a pé não passa (por isso a dica "A Rhaenyra é devagar para os jatos…").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, bestWindow, goodPhases } from '../tools/scripts/sim-sprinkler.mjs';

test('irrigador: a arrancada da Radhija tem janela justa (≥ 0,5 s por volta dos jatos)', () => {
  const dash = bestWindow(BASE, 'radhija', 'dash');
  assert.ok(dash.window >= 0.5, `janela da arrancada ${dash.window.toFixed(2)} s`);
  const walk = bestWindow(BASE, 'radhija', 'walk');
  assert.ok(walk.window < dash.window, `andando (${walk.window.toFixed(2)} s) é mais difícil que com arrancada`);
});

test('irrigador: a Rhaenyra a pé não atravessa seca', () => {
  assert.equal(bestWindow(BASE, 'rhaenyra', 'walk').frac, 0);
});

test('irrigador: a fase dos jatos usada pelas partidas automatizadas (0,45–0,85 rad) é boa', () => {
  const good = goodPhases();
  for (const ph of [0.45, 0.55, 0.65, 0.75, 0.85]) {
    assert.ok(good.some((g) => Math.abs(g - ph) < 0.02), `fase ${ph} rad deveria passar`);
  }
});
