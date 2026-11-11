// O quadro de dedução do Modo História (no estilo do "espaço de dedução" dos jogos do Sherlock Holmes): uma tela escura
// com a pergunta-raiz do capítulo no topo; dela descem as perguntas (nós) e, de cada pergunta, as pistas ligadas a ela
// (cartões com desenho e frase), por fios de luz com faíscas correndo. Pergunta aberta: "?" pulsando e encaixes vazios
// ("falta 1 pista"); pronta: brilho âmbar, o jogador escolhe a conclusão entre as opções (ui:storyDeduce); resolvida:
// a CONCLUSÃO escrita, dourada.
// Estado (story:board, inteiro a cada mudança): { root: { text }, nodes: [{ id, text, conclusion, state, options?, need,
// clues: [{ id, picto, text }] }], fresh? }. Resposta errada: story:deduceWrong { node } (tremidinho, a opção fica riscada).
// Navegação: arrastar e rodinha (mouse), arrastar e pinça (toque), analógico esquerdo e gatilhos/analógico direito
// (controle), setas e +/− (teclado); ←/→ e o D-pad passam de pergunta em pergunta; Enter/E/✕(A) deduz.
// A parte pura (layout, HTML, câmera) fica exportada para os testes (test/historia-ui.test.mjs).
import { pictoSvg } from './pictos.js';

/** @typedef {{ id: string, picto?: string, text: string }} BoardClue */
/** @typedef {{ id: string, text: string, conclusion: string | null, state: 'aberta' | 'pronta' | 'resolvida', options?: string[], need: number, clues: BoardClue[] }} BoardNode */
/** @typedef {{ root: { text: string }, nodes: BoardNode[], fresh?: string }} BoardState */

/** Medidas do quadro (px do "mundo"; a câmera escala). As pistas de cada pergunta ficam lado a lado embaixo dela e as
 * perguntas lado a lado na largura: o quadro é largo e baixo, como a tela deitada. */
export const BOARD = {
  pad: 40, top: 24, rootW: 520, rootH: 96,
  nodeW: 270, nodeH: 132, nodeTop: 186, colGap: 44,
  clueW: 210, clueH: 178, clueTop: 376, clueGap: 18,
};
/**
 * Zoom: o menor legível (PC: pergunta ≥ 15 px e pista ≥ 13 px na tela; no celular, os px CSS valem mais), o maior, o
 * maior ao abrir e o passo da rodinha/botões.
 */
export const ZOOM = { readable: 0.75, readableCompact: 0.62, max: 1.6, open: 1.1, step: 1.18 };
/** O zoom mínimo legível para a altura da janela (tela baixa = celular deitado). */
export const readableFor = (vh) => (vh < 500 ? ZOOM.readableCompact : ZOOM.readable);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** "falta 1 pista" / "faltam 2 pistas" ('' quando não falta). */
export function missingLabel(n) {
  if (!(n > 0)) return '';
  return n === 1 ? 'falta 1 pista' : `faltam ${n} pistas`;
}

/**
 * Onde fica cada coisa do quadro (centros, em px do mundo) e os fios entre elas.
 * Fio: { kind: 'tronco' (raiz → pergunta) | 'pista' (pergunta → pista) | 'vazio' (pergunta → encaixe), glow:
 * 'ouro' (resolvida) | 'luz' (ligada) | 'apagado', d: caminho SVG, node, clue? }.
 * @param {BoardState} state
 */
export function layoutBoard(state) {
  const B = BOARD;
  const list = state?.nodes || [];
  // a largura de cada coluna: a pergunta ou a fileira das pistas e encaixes embaixo dela, o que for maior
  const cols = list.map((nd) => {
    const have = (nd.clues || []).length;
    const slots = nd.state === 'resolvida' ? 0 : Math.max(0, (nd.need || 0) - have);
    const total = have + slots;
    const row = total ? total * B.clueW + (total - 1) * B.clueGap : 0;
    return { have, slots, total, row, w: Math.max(B.nodeW, row) };
  });
  const inner = cols.reduce((a, c) => a + c.w, 0) + Math.max(0, cols.length - 1) * B.colGap;
  const width = Math.max(inner, B.rootW, B.nodeW) + 2 * B.pad;
  const root = { x: width / 2, y: B.top + B.rootH / 2, w: B.rootW, h: B.rootH };
  const nodeY = B.nodeTop + B.nodeH / 2;
  const nb = B.nodeTop + B.nodeH;
  const cy = B.clueTop + B.clueH / 2;
  let bottom = nb;
  const links = [];
  let x = (width - inner) / 2;
  // os troncos saem espalhados pela base da raiz, na ordem das perguntas
  const spread = list.length > 1 ? Math.min(46, (B.rootW - 120) / (list.length - 1)) : 0;
  const nodes = list.map((nd, i) => {
    const c = cols[i];
    const cx = x + c.w / 2;
    x += c.w + B.colGap;
    const node = { id: nd.id, x: cx, y: nodeY, w: B.nodeW, h: B.nodeH, clues: [], slots: [] };
    const solved = nd.state === 'resolvida';
    let px = cx - c.row / 2 + B.clueW / 2;
    for (let j = 0; j < c.total; j++, px += B.clueW + B.clueGap) {
      const top = B.clueTop;
      const my = (nb + top) / 2;
      const d = `M${cx.toFixed(1)},${nb} C${cx.toFixed(1)},${my} ${px.toFixed(1)},${my} ${px.toFixed(1)},${top}`;
      if (j < c.have) {
        const cl = nd.clues[j];
        node.clues.push({ id: cl.id, x: px, y: cy, w: B.clueW, h: B.clueH });
        links.push({ kind: 'pista', glow: solved ? 'ouro' : 'luz', d, node: nd.id, clue: cl.id });
      } else {
        node.slots.push({ x: px, y: cy, w: B.clueW, h: B.clueH });
        links.push({ kind: 'vazio', glow: 'apagado', d, node: nd.id });
      }
      bottom = Math.max(bottom, B.clueTop + B.clueH);
    }
    const sx = root.x + (i - (list.length - 1) / 2) * spread;
    const y1 = root.y + root.h / 2;
    const my = (y1 + B.nodeTop) / 2;
    links.push({
      kind: 'tronco', glow: solved ? 'ouro' : c.have > 0 || nd.state === 'pronta' ? 'luz' : 'apagado',
      d: `M${sx.toFixed(1)},${y1} C${sx.toFixed(1)},${my} ${cx.toFixed(1)},${my} ${cx.toFixed(1)},${B.nodeTop}`, node: nd.id,
    });
    return node;
  });
  return { width, height: bottom + B.pad, root, nodes, links };
}

/** Atraso da entrada em cascata (s): a raiz, os fios e as perguntas da esquerda para a direita, depois as pistas. */
export const cascade = { root: 0, tronco: (i) => 0.12 + i * 0.1, node: (i) => 0.22 + i * 0.1, clue: (i, j) => 0.42 + i * 0.1 + j * 0.09 };

/**
 * O HTML do quadro inteiro (fios em SVG embaixo, cartões por cima), no sistema do mundo.
 * @param {BoardState} state @param {ReturnType<typeof layoutBoard>} L
 * @param {{ sel?: string | null, fresh?: string | null, solved?: string | null, motion?: boolean }} [o]
 */
export function boardHtml(state, L, { sel = null, fresh = null, solved = null, motion = true } = {}) {
  const list = state?.nodes || [];
  const idx = new Map(list.map((nd, i) => [nd.id, i]));
  const pos = (b) => `left:${b.x - b.w / 2}px;top:${b.y - b.h / 2}px;width:${b.w}px;height:${b.h}px`;
  // os fios: um halo largo e o núcleo fino; nos acesos, o pulso correndo e uma faísca
  let wires = '';
  let sparks = '';
  L.links.forEach((k, li) => {
    const i = idx.get(k.node) ?? 0;
    const j = k.clue ? (list[i]?.clues || []).findIndex((c) => c.id === k.clue) : 0;
    const delay = k.kind === 'tronco' ? cascade.tronco(i) : cascade.clue(i, Math.max(0, j)) - 0.08;
    const cls = `rr-board__wire is-${k.kind} is-${k.glow}${k.clue && k.clue === fresh ? ' is-fresh' : ''}`;
    // os acesos "desenham" na entrada (comprimento 1); os apagados são tracejados (comprimento de verdade)
    const pl = k.glow !== 'apagado' ? ' pathLength="1"' : '';
    wires += `<g class="${cls}" style="--d:${delay.toFixed(2)}s"><path class="w-halo" d="${k.d}"${pl}/><path class="w-core" d="${k.d}"${pl}/>`
      + (k.glow !== 'apagado' ? `<path class="w-pulse" d="${k.d}"/>` : '') + '</g>';
    if (motion && k.glow !== 'apagado') {
      const dur = k.kind === 'tronco' ? 2.6 : 1.9;
      const n = k.glow === 'ouro' ? 2 : 1;
      for (let s = 0; s < n; s++) {
        const begin = ((li * 0.37 + s * dur / n) % dur).toFixed(2);
        sparks += `<circle class="rr-board__spark is-${k.glow}" r="${k.glow === 'ouro' ? 3.2 : 2.6}"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${k.d}"/></circle>`;
      }
    }
  });
  const svg = `<svg class="rr-board__wires" width="${L.width}" height="${L.height}" viewBox="0 0 ${L.width} ${L.height}" aria-hidden="true">${wires}<g class="rr-board__sparks">${sparks}</g></svg>`;

  const rootHtml = `<div class="rr-board__root" style="${pos(L.root)};--d:${cascade.root}s"><span class="rr-board__eyebrow">O caso</span><strong>${esc(state?.root?.text)}</strong></div>`;
  let cards = '';
  L.nodes.forEach((ln, i) => {
    const nd = list[i];
    const miss = missingLabel(nd.state === 'resolvida' ? 0 : (nd.need || 0) - (nd.clues || []).length);
    const flags = `${ln.id === sel ? ' is-sel' : ''}${ln.id === solved ? ' is-solved' : ''}`;
    let inner;
    if (nd.state === 'resolvida') {
      inner = `<span class="rr-board__ask">${esc(nd.text)}</span><strong class="rr-board__conc">${esc(nd.conclusion || '')}</strong><span class="rr-board__seal" aria-hidden="true">✓</span>`;
    } else if (nd.state === 'pronta') {
      inner = `<span class="rr-board__q is-ready" aria-hidden="true">!</span><span class="rr-board__ask">${esc(nd.text)}</span><span class="rr-board__cta">Deduzir</span>`;
    } else {
      inner = `<span class="rr-board__q" aria-hidden="true">?</span><span class="rr-board__ask">${esc(nd.text)}</span>${miss ? `<span class="rr-board__need">${miss}</span>` : ''}`;
    }
    const label = nd.state === 'resolvida' ? `${nd.text} ${nd.conclusion || ''}` : nd.state === 'pronta' ? `${nd.text} (pronta para deduzir)` : `${nd.text}${miss ? ` (${miss})` : ''}`;
    cards += `<button type="button" class="rr-board__node is-${nd.state}${flags}" data-node="${esc(nd.id)}" style="${pos(ln)};--d:${cascade.node(i).toFixed(2)}s" aria-label="${esc(label)}">${inner}</button>`;
    ln.clues.forEach((lc, j) => {
      const c = nd.clues[j];
      const tilt = ((i * 3 + j * 5) % 5) - 2;
      cards += `<div class="rr-board__clue${c.id === fresh ? ' is-fresh' : ''}" data-clue="${esc(c.id)}" style="${pos(lc)};--d:${cascade.clue(i, j).toFixed(2)}s;--tilt:${tilt * 0.7}deg">`
        + `<span class="rr-board__pic">${pictoSvg(c.picto, c.id)}</span><p>${esc(c.text)}</p></div>`;
    });
    ln.slots.forEach((ls, j) => {
      cards += `<div class="rr-board__slot" style="${pos(ls)};--d:${cascade.clue(i, ln.clues.length + j).toFixed(2)}s" aria-hidden="true"><span>?</span></div>`;
    });
  });
  return svg + rootHtml + cards;
}

// ---------------------------------------------------------------------------------------------- câmera
/** Folgas da tela (px): em cima a barra do título e do ✕, embaixo a ajuda das teclas; nos lados, um respiro. */
export const VIEW_PAD = { top: 64, side: 36, bottom: 44 };
/** O zoom que mostra o quadro inteiro na janela (vw × vh), sem ficar embaixo das barras. */
export const fitScale = (L, vw, vh) => Math.max(0.05, Math.min((vw - 2 * VIEW_PAD.side) / L.width, (vh - VIEW_PAD.top - VIEW_PAD.bottom) / L.height));
/** Limites do zoom: de um pouco menos que o quadro inteiro até o máximo. */
export const zoomRange = (L, vw, vh) => ({ min: Math.min(fitScale(L, vw, vh) * 0.92, readableFor(vh)), max: ZOOM.max });

/**
 * Prende a câmera ({ x, y } = ponto do mundo no meio da tela, s = zoom) para o quadro não sumir da tela (com as
 * folgas de VIEW_PAD); se o quadro couber, fica no meio do espaço livre.
 */
export function clampView(v, L, vw, vh) {
  const { min, max } = zoomRange(L, vw, vh);
  const s = clamp(v.s, min, max);
  /** lo: folga do começo (esquerda/cima), hi: do fim, em px da tela */
  const axis = (c, size, view, lo, hi) => {
    const half = view / 2 / s;
    if (size * s + lo + hi <= view) return size / 2 - (lo - hi) / 2 / s;
    return clamp(c, half - lo / s, size - half + hi / s);
  };
  return { x: axis(v.x, L.width, vw, VIEW_PAD.side, VIEW_PAD.side), y: axis(v.y, L.height, vh, VIEW_PAD.top, VIEW_PAD.bottom), s };
}

/**
 * Onde olhar para uma pergunta: da raiz até as pistas dela, se couber; senão a pergunta e as pistas; senão a pergunta
 * logo abaixo da barra de cima.
 */
export function focusOf(L, id, vh, s) {
  const ln = L.nodes.find((n) => n.id === id);
  if (!ln) return { x: L.width / 2, y: L.height / 2 };
  const last = [...ln.clues, ...ln.slots].pop();
  const bot = last ? last.y + last.h / 2 + 12 : ln.y + ln.h / 2 + 24;
  const avail = (vh - VIEW_PAD.top - VIEW_PAD.bottom) / s;
  const shift = (VIEW_PAD.top - VIEW_PAD.bottom) / 2 / s;
  for (const top of [L.root.y - L.root.h / 2 - 8, ln.y - ln.h / 2 - 12]) {
    if (bot - top <= avail) return { x: ln.x, y: (top + bot) / 2 - shift };
  }
  const top = ln.y - ln.h / 2 - 12;
  return { x: ln.x, y: top + vh / 2 / s - VIEW_PAD.top / s };
}

/** O zoom e o ponto iniciais: o quadro inteiro se der para ler; senão o zoom legível na pergunta em foco. */
export function initialView(L, vw, vh, focusId) {
  const fit = fitScale(L, vw, vh);
  const readable = readableFor(vh);
  if (fit >= readable) return clampView({ x: L.width / 2, y: L.height / 2, s: Math.min(ZOOM.open, fit) }, L, vw, vh);
  return clampView({ ...focusOf(L, focusId, vh, readable), s: readable }, L, vw, vh);
}

/** Zoom mantendo parado o ponto da tela (px, py) (rodinha e pinça). */
export function zoomAt(v, k, px, py, vw, vh) {
  const wx = v.x + (px - vw / 2) / v.s;
  const wy = v.y + (py - vh / 2) / v.s;
  const s = v.s * k;
  return { x: wx - (px - vw / 2) / s, y: wy - (py - vh / 2) / s, s };
}

/** A pergunta em foco ao abrir: a pronta para deduzir; senão a da pista nova; senão a primeira aberta. */
export function pickFocus(state) {
  const list = state?.nodes || [];
  return (list.find((n) => n.state === 'pronta')
    || (state?.fresh && list.find((n) => (n.clues || []).some((c) => c.id === state.fresh)))
    || list.find((n) => n.state === 'aberta')
    || list[0])?.id ?? null;
}

/** Quantas pistas há no quadro (sem repetir) e se alguma pergunta está pronta para deduzir. */
export function boardSummary(state) {
  const ids = new Set();
  let ready = 0;
  for (const n of state?.nodes || []) {
    for (const c of n.clues || []) ids.add(c.id);
    if (n.state === 'pronta') ready++;
  }
  return { clues: ids.size, ready };
}

// ---------------------------------------------------------------------------------------------- a tela
/**
 * @param {{ host: HTMLElement, emit: (name: string, p?: object) => void, sfx?: (name: string, o?: object) => void,
 *   onClose?: () => void }} opts
 */
export function createBoardUI({ host, emit, sfx = () => {}, onClose = () => {} }) {
  const el = document.createElement('div');
  el.className = 'rr-board';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Quadro de dedução');
  el.innerHTML = `
    <div class="rr-board__view"><div class="rr-board__world"></div></div>
    <div class="rr-board__top">
      <span class="rr-board__title">Quadro de dedução</span>
      <button type="button" class="rr-board__close" aria-label="Fechar o quadro">✕</button>
    </div>
    <div class="rr-board__help" aria-hidden="true">
      <span data-dev="keyboard"><b>←</b><b>→</b> perguntas · <b>Enter</b> deduzir · <b>+</b><b>−</b> zoom · <b>Tab</b> fechar</span>
      <span data-dev="gamepad"><b>✥</b> perguntas · <b><i class="k-ps">✕</i><i class="k-xb">A</i></b> deduzir · <b><i class="k-ps">○</i><i class="k-xb">B</i></b> fechar</span>
      <span data-dev="touch">arraste e use dois dedos para aproximar</span>
    </div>
    <div class="rr-board__deduce" hidden><div class="rr-board__dcard" role="dialog" aria-label="Qual é a conclusão?">
      <span class="rr-board__eyebrow">Qual é a conclusão?</span><h3></h3><div class="rr-board__opts"></div>
      <button type="button" class="rr-board__back">Voltar ao quadro</button></div></div>`;
  host.appendChild(el);
  const view = /** @type {HTMLElement} */ (el.querySelector('.rr-board__view'));
  const world = /** @type {HTMLElement} */ (el.querySelector('.rr-board__world'));
  const ded = /** @type {HTMLElement} */ (el.querySelector('.rr-board__deduce'));
  const dTitle = /** @type {HTMLElement} */ (ded.querySelector('h3'));
  const dOpts = /** @type {HTMLElement} */ (ded.querySelector('.rr-board__opts'));
  const dCard = /** @type {HTMLElement} */ (ded.querySelector('.rr-board__dcard'));

  /** @type {BoardState | null} */
  let state = null;
  let L = layoutBoard({ root: { text: '' }, nodes: [] });
  let isOpen = false;
  let sel = null;
  let cam = { x: 0, y: 0, s: 1 };
  /** @type {{ x: number, y: number, s: number } | null} */
  let target = null;
  let applied = '';
  /** a pergunta com o painel de conclusão aberto, a opção em foco e as já tentadas (erradas) por pergunta */
  let deduceNode = null;
  let optFocus = 0;
  const tried = new Map();
  let pending = null;
  /** quanto tempo a escolha espera a resposta (sem resposta, destrava) */
  let pendingT = 0;
  let introT = 0;
  /** o que mudou desde o último desenho (para animar só a novidade) */
  let prevStates = new Map();
  let lastFresh = null;
  let solvedNow = null;

  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const vsize = () => ({ vw: view.clientWidth || innerWidth, vh: view.clientHeight || innerHeight });

  function render() {
    if (!state) { world.innerHTML = ''; return; }
    L = layoutBoard(state);
    world.style.width = `${L.width}px`;
    world.style.height = `${L.height}px`;
    world.innerHTML = boardHtml(state, L, { sel, fresh: lastFresh, solved: solvedNow, motion: !reduce() });
    applied = '';
  }
  function apply() {
    const { vw, vh } = vsize();
    const t = `translate(${(vw / 2 - cam.x * cam.s).toFixed(1)}px, ${(vh / 2 - cam.y * cam.s).toFixed(1)}px) scale(${cam.s.toFixed(4)})`;
    if (t !== applied) { world.style.transform = t; applied = t; }
  }
  function setCam(v, smooth = false) {
    const { vw, vh } = vsize();
    const c = clampView(v, L, vw, vh);
    if (smooth && !reduce()) target = c;
    else { cam = c; target = null; apply(); }
  }
  function select(id, { focus = true } = {}) {
    if (!state) return;
    sel = id;
    for (const b of world.querySelectorAll('.rr-board__node')) b.classList.toggle('is-sel', b.getAttribute('data-node') === id);
    if (focus) {
      const { vh } = vsize();
      setCam({ ...focusOf(L, id, vh, cam.s), s: cam.s }, true);
    }
  }
  function step(dir) {
    const list = state?.nodes || [];
    if (!list.length) return;
    const i = Math.max(0, list.findIndex((n) => n.id === sel));
    select(list[(i + dir + list.length) % list.length].id);
    sfx('uiMove');
  }

  // ---------------------------------------------------------------- a escolha da conclusão
  function paintOptions() {
    const nd = state?.nodes.find((n) => n.id === deduceNode);
    if (!nd) return;
    const bad = tried.get(nd.id) || new Set();
    dOpts.innerHTML = (nd.options || []).map((o, i) => `<button type="button" class="rr-board__opt${bad.has(i) ? ' is-wrong' : ''}${i === optFocus ? ' is-focus' : ''}" data-opt="${i}"${bad.has(i) ? ' aria-disabled="true"' : ''}><span class="rr-board__optn">${i + 1}</span>${esc(o)}</button>`).join('');
  }
  function openDeduce(id) {
    const nd = state?.nodes.find((n) => n.id === id);
    if (!nd || nd.state !== 'pronta' || !(nd.options || []).length) return false;
    deduceNode = id;
    const bad = tried.get(id) || new Set();
    optFocus = Math.max(0, (nd.options || []).findIndex((_, i) => !bad.has(i)));
    dTitle.textContent = nd.text;
    paintOptions();
    ded.hidden = false;
    dCard.classList.remove('is-in');
    void dCard.offsetWidth;
    dCard.classList.add('is-in');
    sfx('pergunta', { volume: 0.6 });
    /** @type {HTMLElement} */ (dOpts.querySelector('.rr-board__opt.is-focus'))?.focus?.({ preventScroll: true });
    return true;
  }
  function closeDeduce() { ded.hidden = true; deduceNode = null; pending = null; }
  function choose(i) {
    const nd = state?.nodes.find((n) => n.id === deduceNode);
    if (!nd || pending || !(i >= 0 && i < (nd.options || []).length) || tried.get(nd.id)?.has(i)) return;
    pending = { node: nd.id, option: i };
    pendingT = 1.5;
    optFocus = i;
    dOpts.querySelector(`[data-opt="${i}"]`)?.classList.add('is-chosen');
    emit('ui:storyDeduce', { node: nd.id, option: i });
  }
  function moveOpt(dir) {
    const nd = state?.nodes.find((n) => n.id === deduceNode);
    const n = nd?.options?.length || 0;
    if (!n) return;
    const bad = tried.get(nd.id) || new Set();
    for (let k = 1; k <= n; k++) {
      const i = (optFocus + dir * k + n * 4) % n;
      if (!bad.has(i)) { optFocus = i; break; }
    }
    paintOptions();
    sfx('uiMove');
  }

  // ---------------------------------------------------------------- arrastar, pinça, rodinha, cliques
  const pts = new Map();
  let moved = 0;
  view.addEventListener('pointerdown', (e) => {
    if (!isOpen) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) moved = 0;
    target = null;
  });
  view.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const r = view.getBoundingClientRect();
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const [a2, b2] = [...pts.values()];
      const d1 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      if (d0 > 10) {
        const mx = (a2.x + b2.x) / 2 - r.left;
        const my = (a2.y + b2.y) / 2 - r.top;
        setCam(zoomAt(cam, d1 / d0, mx, my, r.width, r.height));
      }
      moved += 20;
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    // só prende o dedo/mouse depois de arrastar de verdade (com a captura, o clique iria para a tela e não para o nó)
    if (moved > 8 && !view.hasPointerCapture?.(e.pointerId)) { try { view.setPointerCapture(e.pointerId); } catch (_) { /* sem captura */ } }
    setCam({ x: cam.x - dx / cam.s, y: cam.y - dy / cam.s, s: cam.s });
  });
  const up = (e) => { pts.delete(e.pointerId); };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', (e) => {
    if (!isOpen) return;
    e.preventDefault();
    const r = view.getBoundingClientRect();
    setCam(zoomAt(cam, e.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step, e.clientX - r.left, e.clientY - r.top, r.width, r.height));
  }, { passive: false });
  view.addEventListener('click', (e) => {
    if (moved > 8) return; // foi arrasto
    const b = /** @type {HTMLElement} */ (e.target).closest?.('.rr-board__node');
    if (!b) return;
    const id = b.getAttribute('data-node');
    select(id);
    if (!openDeduce(id)) sfx('uiMove');
  });
  el.querySelector('.rr-board__close').addEventListener('click', () => api.close());
  el.querySelector('.rr-board__back').addEventListener('click', () => closeDeduce());
  ded.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement} */ (e.target).closest?.('[data-opt]');
    if (b) choose(Number(b.getAttribute('data-opt')));
    else if (e.target === ded) closeDeduce();
  });
  addEventListener('resize', () => { if (isOpen) setCam(cam); });

  const api = {
    get isOpen() { return isOpen; },
    get deducing() { return deduceNode; },
    get selected() { return sel; },
    get state() { return state; },
    /** @param {BoardState} s */
    set(s) {
      const prev = prevStates;
      state = s && Array.isArray(s.nodes) ? s : null;
      prevStates = new Map((state?.nodes || []).map((n) => [n.id, n.state]));
      lastFresh = state?.fresh || null;
      solvedNow = null;
      for (const n of state?.nodes || []) {
        if (n.state === 'resolvida' && prev.has(n.id) && prev.get(n.id) !== 'resolvida') solvedNow = n.id;
      }
      if (solvedNow) tried.delete(solvedNow);
      if (sel && !state?.nodes.some((n) => n.id === sel)) sel = null;
      // a resposta da dedução: acertou (a pergunta virou conclusão) → fecha o painel e comemora
      if (pending) {
        const nd = state?.nodes.find((n) => n.id === pending.node);
        if (nd?.state === 'resolvida') { closeDeduce(); if (isOpen) { select(nd.id); sfx('deduz-certo'); } }
        else if (nd?.state !== 'pronta') closeDeduce();
      } else if (deduceNode && state?.nodes.find((n) => n.id === deduceNode)?.state !== 'pronta') closeDeduce();
      render();
      if (isOpen) {
        setCam(cam);
        if (lastFresh) sfx('neuronio');
      }
      if (deduceNode) paintOptions();
    },
    /** A conclusão escolhida estava errada: tremidinho, a opção fica riscada e o jogador tenta outra. */
    wrong(id) {
      if (!deduceNode || deduceNode !== id) return;
      const set = tried.get(id) || new Set();
      if (pending) set.add(pending.option);
      tried.set(id, set);
      pending = null;
      sfx('erro');
      const nd = state?.nodes.find((n) => n.id === id);
      const left = (nd?.options || []).map((_, i) => i).filter((i) => !set.has(i));
      if (left.length) optFocus = left[0];
      paintOptions();
      dCard.classList.remove('is-shake');
      void dCard.offsetWidth;
      dCard.classList.add('is-shake');
      world.querySelector(`[data-node="${id}"]`)?.classList.add('is-shake');
      setTimeout(() => world.querySelector(`[data-node="${id}"]`)?.classList.remove('is-shake'), 600);
    },
    open() {
      if (isOpen || !state) return false;
      isOpen = true;
      el.hidden = false;
      el.classList.remove('is-out');
      lastFresh = state.fresh || null;
      sel = sel && state.nodes.some((n) => n.id === sel) ? sel : pickFocus(state);
      render();
      world.classList.add('is-intro');
      introT = 1.6;
      const { vw, vh } = vsize();
      cam = initialView(L, vw, vh, sel);
      target = null;
      apply();
      sfx('quadro-abre');
      emit('ui:storyBoard', { open: true });
      return true;
    },
    close() {
      if (!isOpen) return false;
      isOpen = false;
      // a comemoração e o destaque já foram vistos: ao abrir de novo, não repetem
      solvedNow = null;
      closeDeduce();
      pts.clear();
      el.hidden = true;
      world.classList.remove('is-intro');
      sfx('quadro-fecha');
      emit('ui:storyBoard', { open: false });
      onClose();
      return true;
    },
    toggle() { return isOpen ? api.close() : api.open(); },
    /**
     * Um comando do teclado ou do controle com o quadro aberto: 'left' | 'right' | 'up' | 'down' | 'ok' | 'back' |
     * 'zoomIn' | 'zoomOut' | 'opt1'..'opt3'. Devolve true se usou.
     */
    command(c) {
      if (!isOpen) return false;
      if (deduceNode) {
        if (c === 'up' || c === 'left') moveOpt(-1);
        else if (c === 'down' || c === 'right') moveOpt(1);
        else if (c === 'ok') choose(optFocus);
        else if (c === 'back') closeDeduce();
        else if (/^opt\d$/.test(c)) choose(Number(c.slice(3)) - 1);
        else return false;
        return true;
      }
      if (c === 'left') step(-1);
      else if (c === 'right') step(1);
      else if (c === 'up' || c === 'down') setCam({ x: cam.x, y: cam.y + (c === 'up' ? -1 : 1) * 160 / cam.s, s: cam.s }, true);
      else if (c === 'ok') { if (sel && !openDeduce(sel)) sfx('uiDenied'); }
      else if (c === 'back') api.close();
      else if (c === 'zoomIn' || c === 'zoomOut') {
        const { vw, vh } = vsize();
        setCam(zoomAt(target || cam, c === 'zoomIn' ? ZOOM.step : 1 / ZOOM.step, vw / 2, vh / 2, vw, vh), true);
      } else return false;
      return true;
    },
    /** Analógicos do controle (x, y −1..1 já com zona morta; zoom −1..1), a cada quadro. */
    stick(dt, x, y, z) {
      if (!isOpen || deduceNode) return;
      if (!x && !y && !z) return;
      target = null;
      const sp = 900 * dt / cam.s;
      const k = z ? Math.pow(1.9, z * dt) : 1;
      setCam({ x: cam.x + x * sp, y: cam.y - y * sp, s: cam.s * k });
    },
    update(dt) {
      if (!isOpen) return;
      if (pending && (pendingT -= dt) <= 0) { pending = null; paintOptions(); }
      if (introT > 0) { introT -= dt; if (introT <= 0) world.classList.remove('is-intro'); }
      if (target) {
        const k = 1 - Math.exp(-dt * 9);
        cam = { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k, s: cam.s + (target.s - cam.s) * k };
        if (Math.abs(target.x - cam.x) < 0.5 && Math.abs(target.y - cam.y) < 0.5 && Math.abs(target.s - cam.s) < 0.002) { cam = target; target = null; }
        apply();
      }
    },
    reset() {
      api.close();
      state = null;
      sel = null;
      tried.clear();
      prevStates = new Map();
      world.innerHTML = '';
    },
    dispose() { el.remove(); },
  };
  return api;
}
