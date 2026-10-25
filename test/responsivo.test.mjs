// Interface responsiva: o layout compacto depende do tamanho da janela (src/ui/screenFit.js), e as medidas dele em
// ui.css são proporcionais à tela (N × --u). Pedido do usuário: no Android compacto da cunhada o HUD aparecia
// "grande demais, como se fosse o de navegador" (o do PC). Aparelhos-alvo: Android compacto (640×360 e 568×320,
// deitado e de pé), Infinix Note 30 5G (893×393), iPhone 13 (844×390), tablet (1180×820) e PC (1280×720 e maiores).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPACT_QUERY, COMPACT_MAX_HEIGHT, COMPACT_MAX_WIDTH, isCompact } from '../src/ui/screenFit.js';

const css = readFileSync(new URL('../src/ui/ui.css', import.meta.url), 'utf8');
/** O CSS sem os comentários (eles citam seletores e medidas de exemplo). */
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

const PHONES = {
  'Android compacto deitado': [640, 360],
  'Android compacto de pé': [360, 640],
  'Android bem pequeno deitado': [568, 320],
  'Android bem pequeno de pé': [320, 568],
  'Infinix Note 30 5G deitado': [893, 393],
  'iPhone 13 deitado': [844, 390],
  'iPhone 13 de pé': [390, 844],
  'Android com a barra do navegador': [640, 290],
};
const BIG = {
  'tablet deitado': [1180, 820],
  'tablet de pé': [820, 1180],
  'PC 1280×720': [1280, 720],
  'notebook 1366×768 com a barra do navegador': [1366, 630],
  'notebook 1280×720 com a barra do navegador': [1280, 580],
  'PC 1920×1080': [1920, 1080],
};

test('layout compacto pelo tamanho da janela, mesmo sem o celular reconhecido', () => {
  for (const [name, [width, height]] of Object.entries(PHONES)) {
    assert.ok(isCompact({ width, height }), `${name} (${width}×${height})`);
  }
  for (const [name, [width, height]] of Object.entries(BIG)) {
    assert.ok(!isCompact({ width, height }), `${name} (${width}×${height}): HUD do PC/tablet de sempre`);
  }
  assert.ok(isCompact({ width: 1180, height: 820, mobile: 'phone' }), 'celular reconhecido: sempre compacto');
  assert.ok(!isCompact({ width: 1180, height: 820, mobile: 'tablet' }));
  assert.equal(COMPACT_QUERY, `(max-height: ${COMPACT_MAX_HEIGHT}px), (max-width: ${COMPACT_MAX_WIDTH}px)`);
});

/** Lê a fórmula clamp(Apx, min(Bvmin, Cvw), Dpx) de uma variável da regra .rr[data-compact] e a avalia. */
function unitOf(varName) {
  const rule = /\.rr\[data-compact\] \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'regra .rr[data-compact] com as unidades');
  const m = new RegExp(`${varName}: clamp\\(([\\d.]+)px, min\\(([\\d.]+)vmin, ([\\d.]+)vw\\), ([\\d.]+)px\\)`).exec(rule[1]);
  assert.ok(m, `${varName} = clamp(min, min(vmin, vw), max)`);
  const [lo, vmin, vw, hi] = m.slice(1).map(Number);
  return (w, h) => Math.min(hi, Math.max(lo, Math.min((vmin * Math.min(w, h)) / 100, (vw * w) / 100)));
}

test('unidade --u: 1 px no iPhone 13 deitado (onde o layout foi desenhado), menor no Android compacto', () => {
  const u = unitOf('--u');
  assert.ok(Math.abs(u(844, 390) - 1) < 0.01, `iPhone 13: ${u(844, 390)}`);
  assert.ok(Math.abs(u(893, 393) - 1.008) < 0.01, `Infinix: ${u(893, 393)}`);
  assert.ok(u(640, 360) < 0.92 && u(640, 360) > 0.85, `640×360: ${u(640, 360)}`);
  assert.ok(u(568, 320) >= 0.82 && u(568, 320) < u(640, 360), `568×320: ${u(568, 320)}`);
  for (const [name, [w, h]] of Object.entries(PHONES)) {
    const v = u(w, h);
    assert.ok(v >= 0.82 && v <= 1.12, `${name}: ${v}`);
  }
  // proporcional: a tela menor nunca ganha um HUD maior
  assert.ok(u(568, 320) <= u(640, 360) && u(640, 360) <= u(844, 390) && u(844, 390) <= u(893, 393));
});

test('botões de toque: escala proporcional, sem ficar pequenos demais para o dedo nem sair da tela', () => {
  const s = unitOf('--s');
  assert.ok(Math.abs(s(844, 390) - 1) < 0.015, `iPhone 13: ${s(844, 390)}`);
  // diâmetros e o arco dos botões (ui.css: --d, --x, --y em unidades de --s)
  const btn = {};
  for (const m of css.matchAll(/\.rr-tbtn--(\w+) \{ --d: (\d+);(?: --x: (\d+); --y: (\d+);)? /g)) btn[m[1]] = { d: +m[2], x: +m[3], y: +m[4] };
  for (const id of ['act', 'jump', 'dash', 'lick', 'bafo', 'swap', 'stay']) assert.ok(btn[id], `botão ${id} no CSS`);
  const smallest = Math.min(...['act', 'jump', 'dash', 'lick', 'bafo', 'swap', 'stay'].map((id) => btn[id].d));
  const top = Math.max(...Object.values(btn).filter((b) => b.y).map((b) => b.y + b.d / 2));
  for (const [name, [w, h]] of Object.entries(PHONES)) {
    if (h > w) continue; // de pé, o aviso de girar cobre a partida
    const k = s(w, h);
    assert.ok(smallest * k >= 39, `${name}: menor botão com ${(smallest * k).toFixed(1)} px`);
    assert.ok(top * k < h - 36, `${name}: o arco de botões (${(top * k).toFixed(0)} px) deixa o canto de cima para o HUD`);
  }
});

test('regras do layout compacto: nada de px fixo (tudo proporcional) e sem depender do celular reconhecido', () => {
  const rules = [...code.matchAll(/([^{}]*\.rr\[data-compact\][^{}]*)\{([^}]*)\}/g)];
  assert.ok(rules.length > 100, `regras compactas: ${rules.length}`);
  const fixed = [];
  for (const [, sel, body] of rules) {
    if (/^\s*\.rr\[data-compact\]\s*$/.test(sel.split('\n').pop())) continue; // a regra das próprias unidades
    // tira os pisos de legibilidade (max(9px, ...)) e o que não é medida
    const clean = body.replace(/max\(9px, /g, 'max(').replace(/--d: \d+;/g, '');
    for (const m of clean.matchAll(/(?<![\w.-])(\d*\.?\d+)px\b/g)) if (Number(m[1]) !== 0) fixed.push(`${sel.trim().split('\n').pop()} → ${m[0]}`);
  }
  assert.deepEqual(fixed, [], 'medidas fixas no layout compacto (usar N * var(--u))');
  // o layout do celular deitado não depende mais de o navegador entregar o aparelho como celular
  const phoneOnly = [...code.matchAll(/\.rr\[data-mobile="phone"\][^{]*\{/g)].map((m) => m[0]);
  assert.deepEqual(phoneOnly, ['.rr[data-mobile="phone"] .rr-rotate {'], 'só o aviso de girar usa data-mobile="phone"');
});
