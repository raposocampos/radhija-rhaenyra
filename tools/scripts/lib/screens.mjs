// Tamanhos de tela das verificações de layout (suítes menu e toque e capturas do celular): Android compacto deitado e
// de pé (640×360, 568×320), Infinix Note 30 5G (893×393, DPR 2,75), iPhone 13 (844×390, DPR 3), tablet (1180×820),
// PC (1280×720), notebook com a barra do navegador (1366×630) e uma janela pequena no PC (640×360, sem toque), que
// precisa do layout compacto mesmo sem o celular reconhecido. Também as caixas e as sobreposições dos elementos.

export const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
export const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** Opções de página do Playwright de um aparelho de toque. */
export const touchDevice = (w, h, dpr, userAgent = ANDROID_UA) => ({
  viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent,
});

/**
 * id (nome das capturas), opts (página), compact (layout compacto esperado), mobile (data-mobile esperado),
 * portrait (de pé: o aviso de girar cobre a tela), touch (aparelho de toque), fakeHover (fakeHoverScript).
 * @type {{ id: string, label: string, opts: any, compact: boolean, mobile: string | null, portrait?: boolean, touch: boolean, fakeHover?: boolean }[]}
 */
export const SCREENS = [
  { id: 'android-640x360', label: 'Android compacto deitado', opts: touchDevice(640, 360, 2), compact: true, mobile: 'phone', touch: true },
  { id: 'android-360x640', label: 'Android compacto de pé', opts: touchDevice(360, 640, 2), compact: true, mobile: 'phone', portrait: true, touch: true },
  { id: 'android-568x320', label: 'Android pequeno deitado', opts: touchDevice(568, 320, 2), compact: true, mobile: 'phone', touch: true },
  { id: 'android-320x568', label: 'Android pequeno de pé', opts: touchDevice(320, 568, 2), compact: true, mobile: 'phone', portrait: true, touch: true },
  { id: 'infinix-893x393', label: 'Infinix Note 30 5G deitado', opts: touchDevice(893, 393, 2.75), compact: true, mobile: 'phone', touch: true },
  { id: 'iphone13-844x390', label: 'iPhone 13 deitado', opts: touchDevice(844, 390, 3, IPHONE_UA), compact: true, mobile: 'phone', touch: true },
  { id: 'tablet-1180x820', label: 'tablet deitado', opts: touchDevice(1180, 820, 2), compact: false, mobile: 'tablet', touch: true },
  { id: 'pc-1280x720', label: 'PC 1280×720', opts: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, compact: false, mobile: null, touch: false },
  { id: 'notebook-1366x630', label: 'notebook com a barra do navegador', opts: { viewport: { width: 1366, height: 630 }, deviceScaleFactor: 1 }, compact: false, mobile: null, touch: false },
  { id: 'janela-640x360', label: 'janela pequena no PC (sem toque)', opts: { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }, compact: true, mobile: null, touch: false },
  // o caso da cunhada: um Android cujo navegador diz que tem hover e que o ponteiro principal é fino (fakeHover)
  { id: 'android-hover-640x360', label: 'Android que diz ter mouse (hover)', opts: touchDevice(640, 360, 2), compact: true, mobile: 'phone', touch: true, fakeHover: true },
];

/** Script de início: o navegador diz hover e ponteiro principal fino (só para o JavaScript; o CSS vê o aparelho real). */
export function fakeHoverScript() {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => {
    const fake = { '(hover: hover)': true, '(pointer: coarse)': false, '(pointer: fine)': true }[String(q).trim()];
    if (fake === undefined) return real(q);
    return { matches: fake, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  };
}

/** Caixas dos elementos visíveis (seletor → caixa, null se escondido ou sem tamanho). Roda na página. */
export const boxesIn = (page, sels) => page.evaluate((list) => list.map((sel) => {
  const el = document.querySelector(sel);
  if (!el || !el.getClientRects().length) return null;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
}), sels);

export const overlaps = (a, b) => !!a && !!b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
/** Pares que se sobrepõem numa lista de caixas (as nulas ficam de fora). */
export function overlapPairs(list, ignore = []) {
  const out = [];
  const xs = list.filter(Boolean);
  for (let a = 0; a < xs.length; a++) {
    for (let b = a + 1; b < xs.length; b++) {
      const pair = [xs[a].sel, xs[b].sel];
      if (ignore.some(([x, y]) => (x === pair[0] && y === pair[1]) || (x === pair[1] && y === pair[0]))) continue;
      if (overlaps(xs[a], xs[b])) out.push(pair);
    }
  }
  return out;
}
/** Caixas que saem da tela (meio pixel de tolerância). */
export const outside = (list, vw, vh) => list.filter(Boolean).filter((r) => r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5).map((r) => r.sel);
