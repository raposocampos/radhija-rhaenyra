// O quadro de dedução do Modo História (no estilo do "espaço de dedução" dos jogos do Sherlock Holmes): uma tela escura
// com a pergunta-raiz do capítulo no topo; dela descem as perguntas (nós) e, de cada pergunta, as pistas ligadas a ela
// (cartões com desenho e frase), por fios de luz com faíscas correndo. Pergunta aberta: "?" pulsando e encaixes vazios
// ("falta 1 pista"); pronta: brilho âmbar, o jogador escolhe a conclusão entre as opções (ui:storyDeduce); resolvida:
// a CONCLUSÃO escrita, dourada.
// LIGAR É DO JOGADOR (pedido de 2026-11-11): as pistas achadas chegam soltas na bandeja de "Achados", embaixo da tela.
// Escolhe-se uma pista (clique/toque, arrastar até a pergunta, ou teclado/controle) e depois a pergunta: sai
// ui:storyLink { clue, node }. Certa: o fio acende e a pista encaixa (story:board com `link`); errada: "não tem a
// ver", tremidinha (story:linkWrong). Depoimentos (retratinho de quem falou e a fala entre aspas, letra à mão) podem ser
// confrontados com uma pista: escolhe o depoimento, "Confrontar", escolhe a pista → ui:storyConfront { testimony,
// clue }; contradição achada: o clique de descoberta e a pergunta nova (story:insight); senão, tremidinha.
// Estado (story:board, inteiro a cada mudança): { root: { text }, nodes: [{ id, text, conclusion, state, options?, need,
// slots?, clues: [card] }], tray?: [card], found?: [card & { links }], contradicted?: [id], fresh?, link?, insight? }
// (card = { id, picto, text, type, name?, who?, quote? }). Resposta errada da conclusão: story:deduceWrong { node }.
// Navegação: arrastar e rodinha (mouse), arrastar e pinça (toque), analógico esquerdo e gatilhos/analógico direito
// (controle), +/− (teclado); ←/→ e o D-pad passam de pergunta em pergunta (ou de cartão em cartão na bandeja), ↓/↑
// trocam entre as perguntas e a bandeja; Enter/E/✕(A) escolhe, liga ou deduz; C/△(Y) confronta; Esc/○(B) volta.
// A parte pura (layout, HTML, câmera) fica exportada para os testes (test/historia-ui.test.mjs).
import { pictoSvg } from './pictos.js';

/** @typedef {{ id: string, picto?: string, text: string, type?: string, name?: string, who?: string, quote?: string, links?: string[] }} BoardClue */
/** @typedef {{ id: string, text: string, conclusion: string | null, state: 'aberta' | 'pronta' | 'resolvida', options?: string[], need: number, slots?: number, clues: BoardClue[] }} BoardNode */
/** @typedef {{ root: { text: string }, nodes: BoardNode[], tray?: BoardClue[], found?: BoardClue[], contradicted?: string[], fresh?: string, link?: { clue: string, node: string }, insight?: { kind: string, id: string } }} BoardState */

/** Medidas do quadro (px do "mundo"; a câmera escala). As pistas de cada pergunta ficam lado a lado embaixo dela e as
 * perguntas lado a lado na largura: o quadro é largo e baixo, como a tela deitada. */
export const BOARD = {
  pad: 40, top: 24, rootW: 520, rootH: 96,
  nodeW: 270, nodeH: 132, nodeTop: 178, colGap: 44,
  clueW: 210, clueH: 178, clueTop: 364, clueGap: 18,
};
/**
 * Zoom: o menor legível (PC: pergunta ≥ 15 px e pista ≥ 13 px na tela; no celular, os px CSS valem mais), o maior, o
 * maior ao abrir e o passo da rodinha/botões.
 */
export const ZOOM = { readable: 0.75, readableCompact: 0.62, max: 1.6, open: 1.1, step: 1.18 };
/** Tela baixa = celular deitado (o layout compacto do quadro e da bandeja). */
export const isCompact = (vh) => vh < 500;
/** O zoom mínimo legível para a altura da janela. */
export const readableFor = (vh) => (isCompact(vh) ? ZOOM.readableCompact : ZOOM.readable);
/** Altura da bandeja de Achados (px da tela; story.css usa as mesmas). */
export const TRAY_H = { full: 138, compact: 84 };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** "falta 1 pista" / "faltam 2 pistas" ('' quando não falta). */
export function missingLabel(n) {
  if (!(n > 0)) return '';
  return n === 1 ? 'falta 1 pista' : `faltam ${n} pistas`;
}
/** Os encaixes vazios de uma pergunta: os que o modelo manda (slots) ou o que falta para as necessárias. */
const slotsOf = (nd) => (nd.state === 'resolvida' ? 0 : Math.max(0, Number.isFinite(nd.slots) ? nd.slots : (nd.need || 0) - (nd.clues || []).length));

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
    const slots = slotsOf(nd);
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

/** O miolo de um cartão de pista (desenho e frase) ou de depoimento (retratinho, nome e a fala entre aspas). */
function cardInner(c, contra) {
  if (c.type === 'depoimento') {
    return `<span class="rr-board__who"><span class="rr-board__face">${pictoSvg(c.picto, c.id)}</span><b>${esc(c.name || '')}</b></span>`
      + `<p class="rr-board__quote">“${esc(c.quote || c.text)}”</p>${contra ? '<span class="rr-board__stamp">Contradição!</span>' : ''}`;
  }
  return `<span class="rr-board__pic">${pictoSvg(c.picto, c.id)}</span><p>${esc(c.text)}</p>`;
}

/**
 * O HTML do quadro inteiro (fios em SVG embaixo, cartões por cima), no sistema do mundo.
 * pick: a pista escolhida para ligar (as perguntas viram alvo); link: a ligação que acabou de acender.
 * @param {BoardState} state @param {ReturnType<typeof layoutBoard>} L
 * @param {{ sel?: string | null, fresh?: string | null, solved?: string | null, motion?: boolean, pick?: string | null,
 *   link?: { clue: string, node: string } | null }} [o]
 */
export function boardHtml(state, L, { sel = null, fresh = null, solved = null, motion = true, pick = null, link = null } = {}) {
  const list = state?.nodes || [];
  const idx = new Map(list.map((nd, i) => [nd.id, i]));
  const contra = new Set(state?.contradicted || []);
  const pos = (b) => `left:${b.x - b.w / 2}px;top:${b.y - b.h / 2}px;width:${b.w}px;height:${b.h}px`;
  const isNew = (clue, node) => (clue === fresh) || (!!link && link.clue === clue && link.node === node);
  // os fios: um halo largo e o núcleo fino; nos acesos, o pulso correndo e uma faísca
  let wires = '';
  let sparks = '';
  L.links.forEach((k, li) => {
    const i = idx.get(k.node) ?? 0;
    const j = k.clue ? (list[i]?.clues || []).findIndex((c) => c.id === k.clue) : 0;
    const delay = k.kind === 'tronco' ? cascade.tronco(i) : cascade.clue(i, Math.max(0, j)) - 0.08;
    const cls = `rr-board__wire is-${k.kind} is-${k.glow}${k.clue && isNew(k.clue, k.node) ? ' is-fresh' : ''}`;
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
    const miss = missingLabel(slotsOf(nd));
    const flags = `${ln.id === sel ? ' is-sel' : ''}${ln.id === solved ? ' is-solved' : ''}${pick ? ' is-target' : ''}${nd.id === fresh ? ' is-new' : ''}`;
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
      const dep = c.type === 'depoimento';
      const cls = `rr-board__clue${dep ? ' is-dep' : ''}${dep && contra.has(c.id) ? ' is-contra' : ''}${isNew(c.id, nd.id) ? ' is-fresh' : ''}${c.id === pick ? ' is-pick' : ''}`;
      cards += `<div class="${cls}" data-clue="${esc(c.id)}" data-under="${esc(nd.id)}" style="${pos(lc)};--d:${cascade.clue(i, j).toFixed(2)}s;--tilt:${tilt * 0.7}deg">`
        + `${cardInner(c, dep && contra.has(c.id))}</div>`;
    });
    ln.slots.forEach((ls, j) => {
      cards += `<div class="rr-board__slot${pick ? ' is-target' : ''}" style="${pos(ls)};--d:${cascade.clue(i, ln.clues.length + j).toFixed(2)}s" aria-hidden="true"><span>?</span></div>`;
    });
  });
  return svg + rootHtml + cards;
}

// ---------------------------------------------------------------------------------------------- a bandeja
/**
 * Os cartões da bandeja de Achados no modo da vez. Normal: as pistas soltas e todos os depoimentos (um depoimento já
 * ligado ainda pode ser confrontado). Confronto: todas as pistas achadas que não são depoimento (a que desmente pode
 * já estar ligada a uma pergunta).
 * @param {BoardState | null} state @param {'idle' | 'link' | 'confront'} mode @param {string | null} pick
 * @returns {(BoardClue & { linked?: boolean })[]}
 */
export function trayItems(state, mode = 'idle', pick = null) {
  const found = state?.found || [];
  if (mode === 'confront') return found.filter((c) => c.type !== 'depoimento' && c.id !== pick).map((c) => ({ ...c, linked: (c.links || []).length > 0 }));
  const loose = new Set((state?.tray || []).map((c) => c.id));
  const byId = new Map(found.map((c) => [c.id, c]));
  const out = (state?.tray || []).map((c) => ({ ...(byId.get(c.id) || c), linked: false }));
  for (const c of found) if (c.type === 'depoimento' && !loose.has(c.id)) out.push({ ...c, linked: true });
  // a ordem de chegada (a do `found`)
  const order = new Map(found.map((c, i) => [c.id, i]));
  return out.sort((a, b) => (order.get(a.id) ?? 1e3) - (order.get(b.id) ?? 1e3));
}

/**
 * O HTML dos cartões da bandeja.
 * @param {(BoardClue & { linked?: boolean })[]} items
 * @param {{ pick?: string | null, focus?: number, fresh?: string | null, contradicted?: string[], numbers?: boolean }} [o]
 */
export function trayHtml(items, { pick = null, focus = -1, fresh = null, contradicted = [], numbers = true } = {}) {
  if (!items.length) return '<p class="rr-board__empty">Nenhuma pista solta por enquanto.</p>';
  const contra = new Set(contradicted);
  return items.map((c, i) => {
    const dep = c.type === 'depoimento';
    const cls = `rr-board__tcard${dep ? ' is-dep' : ''}${c.id === pick ? ' is-pick' : ''}${i === focus ? ' is-focus' : ''}${c.id === fresh ? ' is-fresh' : ''}${c.linked ? ' is-linked' : ''}${dep && contra.has(c.id) ? ' is-contra' : ''}`;
    const body = dep
      ? `<span class="rr-board__ttext"><b>${esc(c.name || '')}</b><q>${esc(c.quote || c.text)}</q></span>`
      : `<span class="rr-board__ttext">${esc(c.text)}</span>`;
    const label = dep ? `Depoimento de ${c.name || ''}: ${c.quote || c.text}` : c.text;
    return `<button type="button" class="${cls}" data-tray="${esc(c.id)}" aria-pressed="${c.id === pick}" aria-label="${esc(label)}">`
      + `<span class="rr-board__tpic">${pictoSvg(c.picto, c.id)}</span>${body}`
      + `${numbers && i < 9 ? `<span class="rr-board__tnum" aria-hidden="true">${i + 1}</span>` : ''}</button>`;
  }).join('');
}

/** O que a bandeja diz no alto dela, conforme o modo. */
export function trayHint(mode, card, count) {
  if (mode === 'confront') return `Qual pista desmente ${card?.name || 'o depoimento'}?`;
  if (mode === 'link' && card) {
    return card.type === 'depoimento'
      ? `Ligue o depoimento de ${card.name || ''} a uma pergunta… ou confronte com uma pista`
      : 'Agora escolha a pergunta dessa pista';
  }
  return count ? 'Escolha uma pista e ligue à pergunta certa' : 'Nenhuma pista solta: o quadro está em dia';
}

// ---------------------------------------------------------------------------------------------- câmera
/** Folgas da tela (px) num PC: em cima a barra do título e do ✕, embaixo a bandeja de Achados; nos lados, um respiro. */
export const VIEW_PAD = { top: 64, side: 36, bottom: TRAY_H.full + 8 };
/** As folgas para a altura da janela (no celular deitado, a bandeja é mais baixa). */
export const padFor = (vh) => (isCompact(vh) ? { top: 64, side: 36, bottom: TRAY_H.compact + 8 } : VIEW_PAD);
/** O zoom que mostra o quadro inteiro na janela (vw × vh), sem ficar embaixo das barras. */
export const fitScale = (L, vw, vh) => {
  const P = padFor(vh);
  return Math.max(0.05, Math.min((vw - 2 * P.side) / L.width, (vh - P.top - P.bottom) / L.height));
};
/** Limites do zoom: de um pouco menos que o quadro inteiro até o máximo. */
export const zoomRange = (L, vw, vh) => ({ min: Math.min(fitScale(L, vw, vh) * 0.92, readableFor(vh)), max: ZOOM.max });

/**
 * Prende a câmera ({ x, y } = ponto do mundo no meio da tela, s = zoom) para o quadro não sumir da tela (com as
 * folgas de padFor); se o quadro couber, fica no meio do espaço livre.
 */
export function clampView(v, L, vw, vh) {
  const { min, max } = zoomRange(L, vw, vh);
  const P = padFor(vh);
  const s = clamp(v.s, min, max);
  /** lo: folga do começo (esquerda/cima), hi: do fim, em px da tela */
  const axis = (c, size, view, lo, hi) => {
    const half = view / 2 / s;
    if (size * s + lo + hi <= view) return size / 2 - (lo - hi) / 2 / s;
    return clamp(c, half - lo / s, size - half + hi / s);
  };
  return { x: axis(v.x, L.width, vw, P.side, P.side), y: axis(v.y, L.height, vh, P.top, P.bottom), s };
}

/**
 * Onde olhar para uma pergunta: da raiz até as pistas dela, se couber; senão a pergunta e as pistas; senão a pergunta
 * logo abaixo da barra de cima.
 */
export function focusOf(L, id, vh, s) {
  const ln = L.nodes.find((n) => n.id === id);
  if (!ln) return { x: L.width / 2, y: L.height / 2 };
  const P = padFor(vh);
  const last = [...ln.clues, ...ln.slots].pop();
  const bot = last ? last.y + last.h / 2 + 12 : ln.y + ln.h / 2 + 24;
  const avail = (vh - P.top - P.bottom) / s;
  const shift = (P.top - P.bottom) / 2 / s;
  for (const top of [L.root.y - L.root.h / 2 - 8, ln.y - ln.h / 2 - 12]) {
    if (bot - top <= avail) return { x: ln.x, y: (top + bot) / 2 - shift };
  }
  const top = ln.y - ln.h / 2 - 12;
  return { x: ln.x, y: top + vh / 2 / s - P.top / s };
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
    || (state?.fresh && list.find((n) => n.id === state.fresh || (n.clues || []).some((c) => c.id === state.fresh)))
    || list.find((n) => n.state === 'aberta')
    || list[0])?.id ?? null;
}

/** Quantas pistas foram achadas (sem repetir), quantas estão soltas na bandeja e se alguma pergunta está pronta. */
export function boardSummary(state) {
  const ids = new Set((state?.found || []).map((c) => c.id));
  let ready = 0;
  for (const n of state?.nodes || []) {
    for (const c of n.clues || []) ids.add(c.id);
    if (n.state === 'pronta') ready++;
  }
  for (const c of state?.tray || []) ids.add(c.id);
  return { clues: ids.size, ready, loose: (state?.tray || []).length };
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
      <div class="rr-board__help" aria-hidden="true">
        <span data-dev="keyboard"><b>←</b><b>→</b> escolher · <b>↑</b><b>↓</b> perguntas/achados · <b>Enter</b> ligar · <b>C</b> confrontar · <b>Esc</b> voltar · <b>Tab</b> fechar</span>
        <span data-dev="gamepad"><b>✥</b> escolher · <b><i class="k-ps">✕</i><i class="k-xb">A</i></b> ligar · <b><i class="k-ps">△</i><i class="k-xb">Y</i></b> confrontar · <b><i class="k-ps">○</i><i class="k-xb">B</i></b> voltar</span>
        <span data-dev="touch">toque na pista e depois na pergunta · dois dedos para aproximar</span>
      </div>
      <button type="button" class="rr-board__close" aria-label="Fechar o quadro">✕</button>
    </div>
    <div class="rr-board__tray" role="region" aria-label="Achados">
      <div class="rr-board__trayhead">
        <span class="rr-board__traytitle">Achados <b class="rr-board__traycount">0</b></span>
        <span class="rr-board__hint" aria-live="polite"></span>
        <button type="button" class="rr-board__act rr-board__confront" hidden>Confrontar<kbd data-dev="keyboard">C</kbd></button>
        <button type="button" class="rr-board__act rr-board__cancel" hidden>Cancelar</button>
      </div>
      <div class="rr-board__cards"></div>
    </div>
    <div class="rr-board__toast" aria-live="assertive"></div>
    <div class="rr-board__eureka" aria-hidden="true"><div class="rr-board__eurekacard"><span class="rr-board__eyebrow">Contradição!</span><strong></strong></div></div>
    <div class="rr-board__deduce" hidden><div class="rr-board__dcard" role="dialog" aria-label="Qual é a conclusão?">
      <span class="rr-board__eyebrow">Qual é a conclusão?</span><h3></h3><div class="rr-board__opts"></div>
      <button type="button" class="rr-board__back">Voltar ao quadro</button></div></div>`;
  host.appendChild(el);
  const $ = (s) => /** @type {HTMLElement} */ (el.querySelector(s));
  const view = $('.rr-board__view');
  const world = $('.rr-board__world');
  const cardsBox = $('.rr-board__cards');
  const hintEl = $('.rr-board__hint');
  const countEl = $('.rr-board__traycount');
  const confrontBtn = $('.rr-board__confront');
  const cancelBtn = $('.rr-board__cancel');
  const toast = $('.rr-board__toast');
  const eureka = $('.rr-board__eureka');
  const ded = $('.rr-board__deduce');
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
  /** @type {{ clue: string, node: string } | null} */
  let lastLink = null;
  /** ligar e confrontar: a pista escolhida, o modo, onde está o foco do teclado/controle e a resposta esperada */
  /** @type {string | null} */
  let pick = null;
  /** @type {'idle' | 'link' | 'confront'} */
  let mode = 'idle';
  /** @type {'nodes' | 'tray'} */
  let zone = 'nodes';
  let tf = 0;
  /** @type {null | { kind: 'link' | 'confront', clue: string, node?: string, testimony?: string, t: number }} */
  let waiting = null;
  let toastT = 0;
  let eurekaT = 0;

  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const vsize = () => ({ vw: view.clientWidth || innerWidth, vh: view.clientHeight || innerHeight });
  const items = () => trayItems(state, mode, pick);
  const cardOf = (id) => (state?.found || []).find((c) => c.id === id)
    || (state?.tray || []).find((c) => c.id === id)
    || (state?.nodes || []).flatMap((n) => n.clues || []).find((c) => c.id === id) || null;

  function render() {
    if (!state) { world.innerHTML = ''; cardsBox.innerHTML = ''; return; }
    L = layoutBoard(state);
    world.style.width = `${L.width}px`;
    world.style.height = `${L.height}px`;
    world.innerHTML = boardHtml(state, L, { sel: zone === 'nodes' ? sel : null, fresh: lastFresh, solved: solvedNow, motion: !reduce(), pick: mode === 'link' ? pick : null, link: lastLink });
    applied = '';
    renderTray();
  }
  function renderTray() {
    const list = items();
    tf = clamp(tf, 0, Math.max(0, list.length - 1));
    cardsBox.innerHTML = trayHtml(list, { pick, focus: zone === 'tray' ? tf : -1, fresh: lastFresh, contradicted: state?.contradicted || [] });
    countEl.textContent = String((state?.tray || []).length);
    const card = pick ? cardOf(pick) : null;
    hintEl.textContent = trayHint(mode, card, (state?.tray || []).length);
    confrontBtn.hidden = !(mode === 'link' && card?.type === 'depoimento');
    cancelBtn.hidden = mode === 'idle';
    el.classList.toggle('is-linking', mode === 'link');
    el.classList.toggle('is-confronting', mode === 'confront');
    // o cartão em foco à vista (só a rolagem de lado da bandeja; nada mais rola)
    const fc = zone === 'tray' ? /** @type {HTMLElement} */ (cardsBox.children[tf]) : null;
    if (fc && fc.offsetWidth) {
      const l = fc.offsetLeft, r = l + fc.offsetWidth;
      if (l < cardsBox.scrollLeft) cardsBox.scrollLeft = l - 8;
      else if (r > cardsBox.scrollLeft + cardsBox.clientWidth) cardsBox.scrollLeft = r - cardsBox.clientWidth + 8;
    }
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
    for (const b of world.querySelectorAll('.rr-board__node')) b.classList.toggle('is-sel', zone === 'nodes' && b.getAttribute('data-node') === id);
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
  function setZone(z) {
    if (z === zone) return;
    zone = z;
    if (zone === 'nodes' && !sel) sel = pickFocus(state);
    render();
    if (zone === 'nodes' && sel) select(sel);
  }

  // ---------------------------------------------------------------- avisos (não tem a ver; contradição)
  function say(text, kind = 'erro') {
    toast.textContent = text;
    toast.className = `rr-board__toast is-on is-${kind}`;
    toastT = 1.8;
  }
  function shake(elm) {
    if (!elm) return;
    elm.classList.remove('is-shake');
    void elm.offsetWidth;
    elm.classList.add('is-shake');
    setTimeout(() => elm.classList.remove('is-shake'), 600);
  }

  // ---------------------------------------------------------------- ligar e confrontar
  function setPick(id, { toNodes = true } = {}) {
    if (!state) return;
    if (!id || id === pick) { clearPick(); sfx('uiBack'); return; }
    pick = id;
    mode = 'link';
    sfx('uiMove');
    // escolheu: o foco vai para as perguntas (teclado e controle)
    if (toNodes) { zone = 'nodes'; if (!sel) sel = pickFocus(state); }
    render();
    if (toNodes && sel) select(sel);
  }
  function clearPick() {
    pick = null;
    mode = 'idle';
    waiting = null;
    render();
  }
  function startConfront() {
    const card = pick ? cardOf(pick) : null;
    if (card?.type !== 'depoimento') { sfx('uiDenied'); return; }
    mode = 'confront';
    zone = 'tray';
    tf = 0;
    sfx('pergunta', { volume: 0.5 });
    render();
  }
  function doLink(clue, node) {
    if (!clue || !node || waiting) return;
    waiting = { kind: 'link', clue, node, t: 1.5 };
    emit('ui:storyLink', { clue, node });
  }
  function doConfront(testimony, clue) {
    if (!testimony || !clue || waiting) return;
    waiting = { kind: 'confront', testimony, clue, t: 1.5 };
    emit('ui:storyConfront', { testimony, clue });
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
  /** Clique (ou Enter) numa pergunta: liga a pista escolhida; sem pista, abre a conclusão da pronta. */
  function activateNode(id) {
    select(id, { focus: false });
    if (mode === 'confront') { say('Para confrontar, escolha uma pista nos Achados.', 'dica'); sfx('uiDenied'); return; }
    if (mode === 'link' && pick) { doLink(pick, id); return; }
    if (openDeduce(id)) return;
    if ((state?.tray || []).length) say('Escolha primeiro uma pista nos Achados.', 'dica');
    sfx('uiDenied');
  }
  /** Clique (ou Enter) num cartão (da bandeja ou do quadro): escolhe a pista; no confronto, é a pista que desmente. */
  function activateCard(id) {
    if (mode === 'confront') {
      if (id === pick) { mode = 'link'; render(); return; }
      if (cardOf(id)?.type === 'depoimento') { setPick(id, { toNodes: false }); return; }
      doConfront(pick, id);
      return;
    }
    setPick(id);
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
    const t = /** @type {HTMLElement} */ (e.target);
    const b = t.closest?.('.rr-board__node');
    if (b) { zone = 'nodes'; activateNode(b.getAttribute('data-node')); return; }
    const c = t.closest?.('.rr-board__clue');
    if (c) activateCard(c.getAttribute('data-clue'));
  });

  // a bandeja: tocar escolhe; arrastar para cima leva o cartão até a pergunta (a rolagem de lado continua da bandeja).
  // O arrasto segue pela janela: o cartão de origem é redesenhado (e some) assim que vira a pista escolhida.
  /** @type {null | { id: string, src: HTMLElement, x: number, y: number, pid: number, ghost: HTMLElement | null }} */
  let drag = null;
  let dragged = false;
  cardsBox.addEventListener('pointerdown', (e) => {
    const c = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('.rr-board__tcard'));
    if (!c || !isOpen || mode === 'confront') return;
    drag = { id: c.getAttribute('data-tray'), src: c, x: e.clientX, y: e.clientY, pid: e.pointerId, ghost: null };
    dragged = false;
    addEventListener('pointermove', dragMove);
    addEventListener('pointerup', dragEnd);
    addEventListener('pointercancel', dragEnd);
  });
  function dragMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.ghost) {
      if (dy > -14 || Math.abs(dy) < Math.abs(dx)) return;
      const g = /** @type {HTMLElement} */ (drag.src.cloneNode(true));
      g.classList.add('is-ghost');
      g.classList.remove('is-focus');
      el.appendChild(g);
      drag.ghost = g;
      dragged = true;
      if (pick !== drag.id) { pick = drag.id; mode = 'link'; render(); }
    }
    const r = el.getBoundingClientRect();
    drag.ghost.style.transform = `translate(${(e.clientX - r.left).toFixed(0)}px, ${(e.clientY - r.top).toFixed(0)}px) translate(-50%, -60%) rotate(-4deg)`;
    const over = /** @type {HTMLElement} */ (document.elementFromPoint?.(e.clientX, e.clientY))?.closest?.('.rr-board__node');
    for (const n of world.querySelectorAll('.rr-board__node.is-over')) if (n !== over) n.classList.remove('is-over');
    over?.classList.add('is-over');
  }
  function stopDrag() {
    removeEventListener('pointermove', dragMove);
    removeEventListener('pointerup', dragEnd);
    removeEventListener('pointercancel', dragEnd);
    drag?.ghost?.remove();
    drag = null;
  }
  function dragEnd(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const had = !!drag.ghost;
    stopDrag();
    if (!had) return;
    const over = /** @type {HTMLElement} */ (document.elementFromPoint?.(e.clientX, e.clientY))?.closest?.('.rr-board__node');
    for (const n of world.querySelectorAll('.rr-board__node.is-over')) n.classList.remove('is-over');
    if (over && e.type === 'pointerup') { zone = 'nodes'; activateNode(over.getAttribute('data-node')); }
  }
  cardsBox.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    const c = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('.rr-board__tcard'));
    if (!c) return;
    const id = c.getAttribute('data-tray');
    tf = Math.max(0, items().findIndex((x) => x.id === id));
    activateCard(id);
  });
  confrontBtn.addEventListener('click', () => startConfront());
  cancelBtn.addEventListener('click', () => { if (mode === 'confront') { mode = 'link'; render(); } else { clearPick(); sfx('uiBack'); } });
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
    /** Para os testes de tela: o modo, a pista escolhida, a zona do foco e os cartões da bandeja. */
    get linking() { return { mode, pick, zone, tray: items().map((c) => c.id) }; },
    /** @param {BoardState} s */
    set(s) {
      const prev = prevStates;
      state = s && Array.isArray(s.nodes) ? s : null;
      prevStates = new Map((state?.nodes || []).map((n) => [n.id, n.state]));
      lastFresh = state?.fresh || null;
      lastLink = state?.link || null;
      solvedNow = null;
      for (const n of state?.nodes || []) {
        if (n.state === 'resolvida' && prev.has(n.id) && prev.get(n.id) !== 'resolvida') solvedNow = n.id;
      }
      if (solvedNow) tried.delete(solvedNow);
      if (sel && !state?.nodes.some((n) => n.id === sel)) sel = null;
      // a pista escolhida sumiu (recomeço): volta ao normal
      if (pick && !cardOf(pick)) { pick = null; mode = 'idle'; }
      // a resposta da ligação: certa (a ligação acendeu) → a pista encaixa, o modo volta ao normal
      if (waiting?.kind === 'link' && lastLink && lastLink.clue === waiting.clue && lastLink.node === waiting.node) {
        waiting = null;
        pick = null;
        mode = 'idle';
        sel = lastLink.node;
        if (isOpen) { sfx('pino'); sfx('neuronio', { volume: 0.7 }); }
        // a pergunta ficou pronta: o foco fica nela (Enter deduz); senão volta para a bandeja, para a próxima pista
        const ready = state?.nodes.find((n) => n.id === sel)?.state === 'pronta';
        zone = !ready && (state?.tray || []).length ? 'tray' : 'nodes';
      }
      // a resposta da dedução: acertou (a pergunta virou conclusão) → fecha o painel e comemora
      if (pending) {
        const nd = state?.nodes.find((n) => n.id === pending.node);
        if (nd?.state === 'resolvida') { closeDeduce(); if (isOpen) { select(nd.id, { focus: false }); sfx('deduz-certo'); } }
        else if (nd?.state !== 'pronta') closeDeduce();
      } else if (deduceNode && state?.nodes.find((n) => n.id === deduceNode)?.state !== 'pronta') closeDeduce();
      render();
      if (isOpen) {
        setCam(cam);
        if (lastFresh && !state?.insight && !lastLink) sfx('neuronio');
        if (lastLink && sel) select(sel);
      }
      if (deduceNode) paintOptions();
      // o fio que acabou de acender já foi desenhado: os próximos desenhos (trocar de zona, escolher) não o repetem
      lastLink = null;
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
      shake(dCard);
      shake(world.querySelector(`[data-node="${id}"]`));
    },
    /**
     * A ligação estava errada (story:linkWrong): "não tem a ver", a pergunta treme e a pista volta para a bandeja.
     * @param {{ clue?: string, node?: string, reason?: string }} [p]
     */
    linkWrong(p = {}) {
      waiting = null;
      if (!isOpen) return;
      sfx('erro');
      say(p.reason === 'invalida' ? 'Essa pista não serve aqui.' : 'Não tem a ver com essa pergunta.');
      shake(world.querySelector(`[data-node="${p.node}"]`));
      pick = null;
      mode = 'idle';
      render();
      shake(cardsBox.querySelector(`[data-tray="${p.clue}"]`));
    },
    /**
     * O confronto não achou contradição (story:confrontWrong): tremidinha, sem custo.
     * @param {{ testimony?: string, clue?: string, reason?: string }} [p]
     */
    confrontWrong(p = {}) {
      waiting = null;
      if (!isOpen) return;
      sfx('erro');
      say(p.reason === 'feito' ? 'Essa contradição você já achou.' : 'Isso não contradiz o que foi dito.');
      shake(cardsBox.querySelector(`[data-tray="${p.clue}"]`));
    },
    /**
     * Contradição achada (story:insight): o clique de descoberta e a pergunta (ou pista) nova em foco.
     * @param {{ kind?: string, id?: string, text?: string }} [p]
     */
    insight(p = {}) {
      waiting = null;
      pick = null;
      mode = 'idle';
      if (!isOpen) return;
      sfx('deduz-certo');
      sfx('neuronio', { volume: 0.8 });
      /** @type {HTMLElement} */ (eureka.querySelector('strong')).textContent = p.kind === 'question' ? `Nova pergunta: ${p.text || ''}` : `Nova pista: ${p.text || ''}`;
      eureka.classList.remove('is-on');
      void eureka.offsetWidth;
      eureka.classList.add('is-on');
      eurekaT = 2.2;
      if (p.kind === 'question' && p.id) { zone = 'nodes'; render(); select(p.id); }
      else { zone = 'tray'; tf = Math.max(0, items().findIndex((c) => c.id === p.id)); render(); }
    },
    open() {
      if (isOpen || !state) return false;
      isOpen = true;
      el.hidden = false;
      el.classList.remove('is-out');
      lastFresh = state.fresh || null;
      sel = sel && state.nodes.some((n) => n.id === sel) ? sel : pickFocus(state);
      // com pista solta e nada pronto, o foco começa na bandeja (na pista nova, se houver)
      const list = items();
      const ready = state.nodes.some((n) => n.state === 'pronta');
      zone = list.length && !ready && mode !== 'link' ? 'tray' : 'nodes';
      if (zone === 'tray') tf = Math.max(0, list.findIndex((c) => c.id === lastFresh));
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
      lastLink = null;
      closeDeduce();
      if (mode === 'confront') mode = 'link';
      waiting = null;
      stopDrag();
      pts.clear();
      el.hidden = true;
      world.classList.remove('is-intro');
      eureka.classList.remove('is-on');
      toast.classList.remove('is-on');
      sfx('quadro-fecha');
      emit('ui:storyBoard', { open: false });
      onClose();
      return true;
    },
    toggle() { return isOpen ? api.close() : api.open(); },
    /**
     * Um comando do teclado ou do controle com o quadro aberto: 'left' | 'right' | 'up' | 'down' | 'ok' | 'back' |
     * 'confront' | 'zoomIn' | 'zoomOut' | 'opt1'..'opt9'. Devolve true se usou.
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
      const list = items();
      if (c === 'zoomIn' || c === 'zoomOut') {
        const { vw, vh } = vsize();
        setCam(zoomAt(target || cam, c === 'zoomIn' ? ZOOM.step : 1 / ZOOM.step, vw / 2, vh / 2, vw, vh), true);
      } else if (c === 'confront') {
        if (mode === 'link') startConfront();
        else if (mode === 'confront') { mode = 'link'; render(); }
        else sfx('uiDenied');
      } else if (/^opt\d$/.test(c)) {
        const it = list[Number(c.slice(3)) - 1];
        if (it) { zone = 'tray'; tf = list.indexOf(it); activateCard(it.id); } else sfx('uiDenied');
      } else if (zone === 'tray') {
        if (c === 'left' || c === 'right') {
          if (list.length) { tf = (tf + (c === 'left' ? -1 : 1) + list.length) % list.length; renderTray(); sfx('uiMove'); }
        } else if (c === 'up') { if (mode !== 'confront') { setZone('nodes'); sfx('uiMove'); } }
        else if (c === 'down') { /* já na bandeja */ }
        else if (c === 'ok') { const it = list[tf]; if (it) activateCard(it.id); else sfx('uiDenied'); }
        else if (c === 'back') {
          if (mode === 'confront') { mode = 'link'; render(); } else if (pick) { clearPick(); sfx('uiBack'); } else api.close();
        } else return false;
      } else if (c === 'left') step(-1);
      else if (c === 'right') step(1);
      else if (c === 'down' && list.length) { setZone('tray'); sfx('uiMove'); }
      else if (c === 'up' || c === 'down') setCam({ x: cam.x, y: cam.y + (c === 'up' ? -1 : 1) * 160 / cam.s, s: cam.s }, true);
      else if (c === 'ok') { if (sel) activateNode(sel); else sfx('uiDenied'); }
      else if (c === 'back') { if (pick) { clearPick(); sfx('uiBack'); } else api.close(); }
      else return false;
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
      if (waiting && (waiting.t -= dt) <= 0) waiting = null;
      if (toastT > 0 && (toastT -= dt) <= 0) toast.classList.remove('is-on');
      if (eurekaT > 0 && (eurekaT -= dt) <= 0) eureka.classList.remove('is-on');
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
      pick = null;
      mode = 'idle';
      zone = 'nodes';
      waiting = null;
      tried.clear();
      prevStates = new Map();
      world.innerHTML = '';
      cardsBox.innerHTML = '';
    },
    dispose() { el.remove(); },
  };
  return api;
}
