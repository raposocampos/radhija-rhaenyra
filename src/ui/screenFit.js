// Tamanho da tela → layout da interface. O layout compacto (ui.css, .rr[data-compact]) depende do TAMANHO da janela,
// não de o jogo ter reconhecido um celular: um Android que o navegador não entrega como celular, ou uma janela
// pequena no PC, também ganha o HUD compacto em vez do HUD do PC esticado numa tela pequena. Dentro dele, tudo escala
// com a unidade --u (ui.css: 1 px na tela deitada de 390 px de altura, como o iPhone 13; menor no Android compacto
// e um pouco maior no Infinix). No PC (janela maior que isso) nada muda.
// API: COMPACT_QUERY, isCompact({ width, height, mobile }), watchCompact(root, { mobile, win }) → () => desliga.

/** Janela baixa (celular deitado) ou estreita (celular em pé, janela pequena). O mesmo limite do teste unitário. */
export const COMPACT_MAX_HEIGHT = 500;
export const COMPACT_MAX_WIDTH = 700;
export const COMPACT_QUERY = `(max-height: ${COMPACT_MAX_HEIGHT}px), (max-width: ${COMPACT_MAX_WIDTH}px)`;

/**
 * Layout compacto para esta janela? O celular reconhecido (quality.device 'phone') é sempre compacto.
 * @param {{ width?: number, height?: number, mobile?: string | null }} [env]
 */
export function isCompact({ width = Infinity, height = Infinity, mobile = null } = {}) {
  return mobile === 'phone' || height <= COMPACT_MAX_HEIGHT || width <= COMPACT_MAX_WIDTH;
}

/**
 * Liga/desliga data-compact na raiz da interface conforme a janela (girar o celular, redimensionar a janela).
 * @param {HTMLElement} root
 * @param {{ mobile?: string | null, win?: Window & typeof globalThis }} [opts]
 */
export function watchCompact(root, { mobile = null, win = window } = {}) {
  const apply = () => root.toggleAttribute('data-compact', isCompact({ width: win.innerWidth, height: win.innerHeight, mobile }));
  apply();
  /** @type {MediaQueryList | null} */
  let mq = null;
  try { mq = win.matchMedia?.(COMPACT_QUERY) ?? null; } catch { mq = null; }
  mq?.addEventListener?.('change', apply);
  win.addEventListener('resize', apply);
  win.addEventListener('orientationchange', apply);
  return () => {
    mq?.removeEventListener?.('change', apply);
    win.removeEventListener('resize', apply);
    win.removeEventListener('orientationchange', apply);
  };
}
