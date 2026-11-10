// Camada de HQ do Modo História: as cenas viram páginas de quadrinho (mangá / Scott Pilgrim), dentro do jogo.
// A matemática pura (layouts, viewOffset, encaixe dos balões, tempos) mora em comicMath.js; aqui ficam o DOM e os eventos.
//
// Eventos que ela ouve (o diretor das cenas emite):
//  story:comic { on, style?: 'cor'|'manga', instant? }  liga/desliga a página (desligar = story:comicEnd)
//  story:panel { layout, slot, tilt?, enter?, hold? }    quadro novo: o anterior congela (foto) e este é o 3D ao vivo.
//    Página nova (a velha vira por cima) quando muda o layout ou o quadro já foi usado nesta página; hold: true reabre
//    um quadro já usado na mesma página. O 1º quadro de cada HQ sempre sai da tela cheia (shrink: o plano de cinema
//    encolhe até o quadro); enter vale do 2º em diante (sem enter: slide em página nova, pop na mesma). O quadro mostra o
//    recorte central ("cover") do plano: componha como em tela cheia (frações dos quadros em comicMath.slotPoly).
//  story:say { id, who, name, text, dur, mode, mood?, anchor? } (mode 'cena') balão; who null = caixa de narração.
//    Emita o story:panel ANTES das falas do quadro (as que vierem no mesmo instante passam para o quadro novo).
//  story:sayMove { id, x, y, z } · story:sayClear
//  story:caption { text, sub?, pos?, dur?, anchor?, who? }   legenda estilo Scott Pilgrim (nome + descrição + selo)
//  story:onomato { text, anchor?, sx?, sy?, size?, color?, rot?, style?, dur? }  onomatopeia gigante
//  story:fx { kind, anchor?, dur?, dir? }               efeitos de mangá sobre o quadro ao vivo
// A voz de sílabas sai do próprio story:say (storyHud, na mesma conta de digitação: comicMath.typeTimes = charTimes de
// subtitles.js); a camada só emite story:voiceStop quando uma página vira com um balão ainda digitando.
//
// Como o quadro ao vivo funciona: o canvas WebGL continua do tamanho da tela, recortado no quadro por clip-path, e a
// câmera ganha um viewOffset que centra o plano no quadro (comicMath.viewOffsetFor). Os quadros congelados são
// <canvas> 2D com a foto do 3D, atrás do canvas WebGL (só o quadro ao vivo custa um desenho 3D).
// A foto: o canvas WebGL só guarda a imagem até o navegador mostrá-la, então, no story:panel (que chega no update, antes
// do desenho, com a câmera ainda no plano do quadro anterior), a camada desenha a cena uma vez a mais, na hora, e copia
// o recorte. O recorte acompanha cada desenho pelo gancho engine.onAfterRender.
// Sem nenhum evento, nada muda: o canvas fica sem clip-path e a câmera sem viewOffset.
import './comic.css';
import * as THREE from 'three';
import {
  MOODS, OUT_DUR, balloonShape, bboxOf, bubblesPath, burstPath, centroid, clamp, clipCss, cloudPath, createLiveDriver,
  createOnomatoQueue, createStage, ease, frameMetrics, inkPath, needsNewPage, normLayout, normSlot, offsetPoly, ovalPath,
  placeBalloon, placeCorner, rectPoly, sayTiming, seeded, slotPoly, tailPath, typedCount, viewOffsetFor,
} from './comicMath.js';

/** Cor de destaque de quem fala (etiqueta do nome, legenda). */
const CAST = {
  radhija: { name: 'Radhija', color: '#E39B2E' },
  rhaenyra: { name: 'Rhaenyra', color: '#EE6FA4' },
  porteiro: { name: 'Seu Porteiro', color: '#4E8F6A' },
  migalha: { name: 'Capitão Migalha', color: '#5E79B5' },
  capitao: { name: 'Capitão Migalha', color: '#5E79B5' },
  farelo: { name: 'Farelo', color: '#7C8FBF' },
  soneca: { name: 'Soneca', color: '#8F7FC4' },
};
const INK = '#17111a';
const TAU = Math.PI * 2;
const ENTERS = ['slide', 'pop', 'wipe', 'zoom', 'shrink', 'none'];
const FX_DUR = { speed: 0.9, impact: 0.5, focus: 1.2, shake: 0.45, flash: 0.35, sparkle: 1.2, sweat: 1.3, anger: 1.2, heart: 1.6 };
const POS = ['tl', 'tr', 'bl', 'br', 'center'];
const CAP_COLORS = ['#F08A3C', '#41C7E6', '#FF5D8F', '#8BD346'];
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Estrela de 5 pontas (selo da legenda), no quadrado -12..12. */
const STAR = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.8 : 11.2;
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  }
  return `${d}Z`;
})();

/**
 * @param {{ root: HTMLElement, engine: ReturnType<typeof import('../../core/engine.js').createEngine>,
 *   events: typeof import('../../core/events.js').events }} opts
 */
export function createComicLayer({ root, engine, events }) {
  const camera = engine.camera;
  const gl = /** @type {HTMLCanvasElement} */ (engine.renderer.domElement);
  const target = { style: gl.style, camera };
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let reduced = !!mq?.matches;
  const onMotion = () => { reduced = !!mq?.matches; };
  mq?.addEventListener?.('change', onMotion);
  const clock = () => performance.now() / 1000;

  // ------------------------------------------------ a frente (balões, legendas, onomatopeias, efeitos), dentro de .rr
  const host = document.createElement('div');
  host.className = 'rr-comic';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = `
    <div class="rr-comic__live"><canvas class="rr-comic__fx"></canvas><svg class="rr-comic__frame" preserveAspectRatio="none"><path/></svg></div>
    <div class="rr-comic__turn"></div>
    <div class="rr-comic__talk"></div>
    <div class="rr-comic__caps"></div>
    <div class="rr-comic__sfx"></div>
    <div class="rr-comic__probe"></div>`;
  root.appendChild(host);
  const q = (s) => /** @type {HTMLElement} */ (host.querySelector(s));
  const liveG = q('.rr-comic__live');
  const fxCanvas = /** @type {HTMLCanvasElement} */ (host.querySelector('.rr-comic__fx'));
  const fxCtx = fxCanvas.getContext('2d');
  const frameSvg = /** @type {SVGSVGElement} */ (/** @type {unknown} */ (host.querySelector('.rr-comic__frame')));
  const frameInk = /** @type {SVGPathElement} */ (/** @type {unknown} */ (host.querySelector('.rr-comic__frame path')));
  const turnBox = q('.rr-comic__turn');
  const talk = q('.rr-comic__talk');
  const capsBox = q('.rr-comic__caps');
  const sfxBox = q('.rr-comic__sfx');
  const probe = q('.rr-comic__probe');
  // leitor de tela: a fala inteira, de uma vez (o balão digita letra a letra)
  const sr = document.createElement('div');
  sr.className = 'rr-comic__sr';
  sr.setAttribute('aria-live', 'polite');
  root.appendChild(sr);

  // ------------------------------------------------ o fundo (papel e quadros congelados), atrás do canvas WebGL
  const back = document.createElement('div');
  back.className = 'rr-comic-back';
  gl.parentElement?.insertBefore(back, gl);

  // ------------------------------------------------ estado
  const stage = createStage({ reduced });
  const driver = createLiveDriver(stage);
  /** @type {{ W: number, H: number, insets: { t: number, r: number, b: number, l: number } }} */
  let geom = measure();
  let geomDirty = false;
  let on = false;
  let closing = false;
  let style = 'cor';
  let wantDefault = false;
  let snapping = false;
  let filterSet = false;
  let lastNow = clock();
  let seq = 0;
  let inkKey = '';
  /** @type {any} */
  let page = null;
  /** @type {Map<number, any>} */
  const balloons = new Map();
  /** @type {Set<any>} */
  const caps = new Set();
  const sfxQ = createOnomatoQueue();
  /** @type {Map<number, any>} */
  const sfxEls = new Map();
  /** @type {any[]} */
  let fxs = [];
  /** @type {null | { t0: number, dur: number, amp: number }} */
  let shake = null;
  let fxDrawn = false;

  function measure() {
    const cs = getComputedStyle(probe);
    const px = (v) => parseFloat(v) || 0;
    return {
      W: window.innerWidth || 1, H: window.innerHeight || 1,
      insets: { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) },
    };
  }
  const onResize = () => { geomDirty = true; };
  window.addEventListener('resize', onResize);
  function relayout() {
    geomDirty = false;
    geom = measure();
    stage.setGeom(geom);
    sizeSvgs();
    if (page) {
      for (const f of page.frozen) {
        f.poly = slotPoly(f.layout, f.slot, geom, f.tilt).poly;
        placeBox(f.box, f.poly);
      }
      drawPageInk(page);
    }
    inkKey = '';
  }
  function sizeSvgs() {
    const vb = `0 0 ${geom.W} ${geom.H}`;
    frameSvg.setAttribute('viewBox', vb);
    if (page) for (const s of page.el.querySelectorAll('svg')) s.setAttribute('viewBox', vb);
  }
  /** A área do quadro quando não há HQ (cena de cinema): a tela menos as faixas. */
  function screenPoly() {
    const bar = root.dataset.cinema && !root.dataset.comic ? geom.H * 0.11 : 0;
    return rectPoly({ x: 0, y: bar, w: geom.W, h: geom.H - 2 * bar });
  }
  const panelPolyNow = () => stage.live?.poly ?? screenPoly();

  // ------------------------------------------------ projeção (com o viewOffset do quadro ao vivo)
  const V = new THREE.Vector3();
  /** @param {{ x: number, y: number, z: number }} a */
  function project(a) {
    V.set(+a.x || 0, +a.y || 0, +a.z || 0).applyMatrix4(camera.matrixWorldInverse);
    if (V.z > -camera.near) return { x: (V.x >= 0 ? 1 : -1) * 1e4, y: geom.H * 2, front: false };
    V.applyMatrix4(camera.projectionMatrix);
    return { x: ((V.x + 1) / 2) * geom.W, y: ((1 - V.y) / 2) * geom.H, front: true };
  }

  // ------------------------------------------------ páginas
  function makePage(layout) {
    const el = document.createElement('div');
    el.className = 'rr-comic-page';
    el.dataset.style = style;
    el.innerHTML = `<svg class="rr-comic-page__shade" preserveAspectRatio="none"><path class="still"/><path class="live"/></svg>
      <div class="rr-comic-page__panels"></div><svg class="rr-comic-page__ink" preserveAspectRatio="none"><path/></svg><div class="rr-comic-page__talk"></div>`;
    back.appendChild(el);
    const p = {
      id: ++seq, el, layout, used: new Set(), frozen: [],
      panels: /** @type {HTMLElement} */ (el.querySelector('.rr-comic-page__panels')),
      talk: /** @type {HTMLElement} */ (el.querySelector('.rr-comic-page__talk')),
      shadeStill: el.querySelector('.rr-comic-page__shade .still'),
      shadeLive: el.querySelector('.rr-comic-page__shade .live'),
      ink: el.querySelector('.rr-comic-page__ink path'),
    };
    const vb = `0 0 ${geom.W} ${geom.H}`;
    for (const s of el.querySelectorAll('svg')) s.setAttribute('viewBox', vb);
    return p;
  }
  function drawPageInk(p) {
    const { ink } = frameMetrics(geom.W, geom.H);
    p.ink.setAttribute('d', p.frozen.map((f) => inkPath(f.poly, f.seed, ink * 0.3)).join(''));
    p.ink.setAttribute('stroke-width', ink.toFixed(1));
    p.shadeStill.setAttribute('d', p.frozen.map((f) => inkPath(offsetPoly(f.poly, ink * 1.4, ink * 1.8), 1, 0)).join(''));
  }
  function placeBox(box, poly) {
    const b = bboxOf(poly);
    box.style.left = `${b.x}px`;
    box.style.top = `${b.y}px`;
    box.style.width = `${b.w}px`;
    box.style.height = `${b.h}px`;
    box.style.clipPath = clipCss(poly.map((p) => [p[0] - b.x, p[1] - b.y]));
  }
  /** A página sai virando por cima da nova (com os balões congelados dela). */
  function turnPage() {
    if (!page) return;
    const old = page;
    page = null;
    let cut = false;
    for (const b of [...balloons.values()]) {
      if (!b.frozen || b.page !== old.id) continue;
      if (!b.leaving && b.n < b.text.length) cut = true;
      // mover reinicia as animações de CSS: o balão vai parado
      b.el.classList.add('is-still');
      old.talk.appendChild(b.el);
      balloons.delete(b.key);
    }
    if (cut) events.emit('story:voiceStop', {});
    old.shadeLive.setAttribute('d', '');
    turnBox.appendChild(old.el);
    void old.el.offsetWidth;
    old.el.classList.add('is-turning');
    setTimeout(() => old.el.remove(), reduced ? 360 : 820);
  }
  function discardPage() {
    page?.el.remove();
    page = null;
  }
  /** hold: o quadro reabre ao vivo na mesma página (sai a foto dele e os balões congelados nele). */
  function dropFrozen(p, slot) {
    const keep = [];
    for (const f of p.frozen) { if (f.slot === slot) f.box.remove(); else keep.push(f); }
    p.frozen = keep;
    for (const b of [...balloons.values()]) if (b.frozen && b.page === p.id && b.slot === slot) removeBalloon(b);
    drawPageInk(p);
  }

  // ------------------------------------------------ a foto do quadro que congela
  function snapshot(poly) {
    const b = bboxOf(poly);
    if (b.w < 4 || b.h < 4 || !gl.width) return null;
    // desenha de novo agora, com o plano parado do quadro: a câmera ainda está nele (o diretor troca o plano no update e
    // o rig só aplica depois), e o canvas WebGL não guarda a imagem do quadro já mostrado
    const v = viewOffsetFor(b, geom.W, geom.H, camera.aspect || geom.W / geom.H);
    camera.setViewOffset(v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height);
    snapping = true;
    try {
      engine.render(0);
    } catch (error) {
      console.warn('[comic] foto do quadro', error);
      return null;
    } finally {
      snapping = false;
    }
    const r = gl.width / Math.max(1, geom.W);
    const rs = Math.min(r, 2);
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(b.w * rs));
    c.height = Math.max(2, Math.round(b.h * rs));
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    try {
      ctx.drawImage(gl, b.x * r, b.y * r, b.w * r, b.h * r, 0, 0, c.width, c.height);
    } catch (error) {
      console.warn('[comic] cópia do quadro', error);
      return null;
    }
    return c;
  }
  function freezeLive(prev) {
    const shot = page ? snapshot(prev.poly) : null;
    if (page && shot) {
      const box = document.createElement('div');
      box.className = 'rr-comic-page__panel';
      placeBox(box, prev.poly);
      box.appendChild(shot);
      page.panels.appendChild(box);
      page.frozen.push({ layout: prev.layout, slot: prev.slot, tilt: prev.tilt, poly: prev.poly, seed: prev.id * 7 + 3, box });
      drawPageInk(page);
    }
    // os balões do quadro ficam nele, parados (e terminam de digitar junto com a voz); sem página, somem. Os que nem
    // apareceram ainda (a fala veio no mesmo instante do quadro novo) passam para o quadro novo.
    for (const b of balloons.values()) {
      if (b.frozen || (b.x == null && !b.leaving)) continue;
      if (!page || b.leaving) { leave(b, true); continue; }
      b.frozen = true;
      b.page = page.id;
      b.slot = prev.slot;
      b.el.classList.add('is-frozen');
    }
    for (const s of sfxEls.values()) s.frozen = true;
  }

  // ------------------------------------------------ liga / desliga / quadro novo
  function begin(st) {
    style = st === 'manga' ? 'manga' : 'cor';
    root.dataset.comic = style;
    host.dataset.style = style;
    back.dataset.style = style;
    if (!on) {
      on = true;
      geom = measure();
      geomDirty = false;
      stage.setGeom(geom);
      sizeSvgs();
    }
    closing = false;
    host.classList.add('is-on');
    host.classList.remove('is-closing');
    back.classList.add('is-on');
    back.classList.remove('is-closing');
    if (style === 'manga') { gl.style.filter = 'grayscale(1) contrast(1.12)'; filterSet = true; }
    else if (filterSet) { gl.style.filter = ''; filterSet = false; }
  }
  /** @param {any} p */
  function comicOn(p) {
    begin(p.style ?? style);
    // sem story:panel logo em seguida, a tela inteira encolhe até um quadro 'full'
    if (!stage.live) wantDefault = true;
  }
  /** @param {any} [p] */
  function comicOff(p = {}) {
    if (!on && !stage.busy) return;
    if (p.instant) { hardReset(); return; }
    on = false;
    wantDefault = false;
    delete root.dataset.comic;
    closing = true;
    stage.close(clock());
    host.classList.add('is-closing');
    back.classList.add('is-closing');
    for (const b of balloons.values()) leave(b, true);
    for (const c of caps) leaveCap(c, clock());
    for (const s of sfxEls.values()) fadeSfx(s, clock());
    fxs = [];
  }
  /** O fim da saída: o canvas já cobre a tela inteira de novo. */
  function finish() {
    closing = false;
    discardPage();
    turnBox.textContent = '';
    host.classList.remove('is-on', 'is-closing');
    back.classList.remove('is-on', 'is-closing');
    frameInk.setAttribute('d', '');
    inkKey = '';
    if (filterSet) { gl.style.filter = ''; filterSet = false; }
  }
  /** @param {any} [p] */
  function panel(p = {}) {
    const layout = normLayout(p.layout);
    const slot = normSlot(layout, p.slot);
    const now = clock();
    if (!on) begin(p.style ?? style);
    if (geomDirty) relayout();
    wantDefault = false;
    const ev = { layout, slot, tilt: clamp(Number(p.tilt) || 0, -12, 12), hold: !!p.hold };
    let prev = stage.live;
    let t0 = now;
    // o quadro automático do começo, trocado logo em seguida: sem foto e sem virar a página (a entrada continua)
    if (prev?.auto && now - prev.t0 < 0.4) { t0 = prev.t0; prev = null; discardPage(); }
    const newPage = needsNewPage(page, ev);
    // hold no próprio quadro ao vivo: ele só recomeça (sem foto)
    const reopen = !!prev && !newPage && prev.slot === slot;
    if (prev && !reopen) freezeLive(prev);
    fxs = [];
    if (newPage) { turnPage(); page = makePage(layout); }
    if (ev.hold) dropFrozen(page, slot);
    page.used.add(slot);
    // o 1º quadro de cada HQ sempre sai da tela cheia (o plano de cinema vira o quadro, sem corte); depois, o pedido
    const asked = ENTERS.includes(p.enter) ? p.enter : null;
    const enter = !prev ? (asked === 'none' ? 'none' : 'shrink') : asked || (newPage ? 'slide' : 'pop');
    stage.open(now, { ...ev, enter, auto: !!p.auto, t0: enter === 'shrink' ? t0 : now });
    inkKey = '';
    // o desenho deste quadro já sai com o plano do quadro novo
    driver.prime(now, target, geom);
  }

  // ------------------------------------------------ balões
  /** @param {any} [p] */
  function say(p = {}) {
    if (p.mode && p.mode !== 'cena') return;
    const text = String(p.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (geomDirty) relayout();
    const now = clock();
    const narr = p.who == null;
    const mood = narr ? 'nar' : MOODS.includes(p.mood) ? p.mood : 'normal';
    const id = p.id != null ? String(p.id) : `fala${seq + 1}`;
    for (const b of balloons.values()) {
      if (b.leaving) continue;
      if (b.frozen) { if (b.id === id) removeBalloon(b); continue; }
      // a mesma fala, a mesma personagem ou outra narração: a anterior sai
      if (b.id === id || (narr ? b.narr : b.who === p.who)) leave(b, true);
    }
    const cast = CAST[p.who] || null;
    const el = document.createElement('div');
    el.className = `rr-comic__bal is-${mood}`;
    el.innerHTML = `<div class="rr-comic__bin">${narr ? '' : `<svg class="rr-comic__bsvg"><g class="s"><path class="b"/><path class="t"/></g><g class="o"><path class="b"/><path class="t"/></g><g class="f"><path class="b"/><path class="t"/></g></svg>`}<div class="rr-comic__txt"><span class="a"></span><span class="z"></span></div>${narr ? '' : '<span class="rr-comic__tag"></span>'}${mood === 'sono' ? '<i class="rr-comic__zzz">z<b>z</b><b>z</b></i>' : ''}</div>`;
    el.style.setProperty('--tc', cast?.color || '#6B4D3A');
    // invisível até o primeiro encaixe no quadro
    el.style.visibility = 'hidden';
    talk.appendChild(el);
    const bin = /** @type {HTMLElement} */ (el.firstElementChild);
    const txt = /** @type {HTMLElement} */ (el.querySelector('.rr-comic__txt'));
    const a = /** @type {HTMLElement} */ (el.querySelector('.a'));
    const z = /** @type {HTMLElement} */ (el.querySelector('.z'));
    const tag = el.querySelector('.rr-comic__tag');
    if (tag) tag.textContent = p.name || cast?.name || String(p.who);
    // mede o texto inteiro (invisível) para o balão já nascer do tamanho final: nada pula enquanto digita
    z.textContent = text;
    const fs = parseFloat(getComputedStyle(txt).fontSize) || 15;
    const pb = bboxOf(panelPolyNow());
    const maxW = clamp(Math.sqrt(text.length) * fs * 1.95, fs * 6, Math.max(fs * 6, pb.w * (narr ? 0.5 : 0.46)));
    txt.style.maxWidth = `${maxW}px`;
    const tw = Math.ceil(z.offsetWidth) + 2;
    txt.style.width = `${tw}px`;
    const th = Math.ceil(txt.offsetHeight);
    const u = fs / 15;
    const sh = narr
      ? { w: Math.ceil(tw + fs * 1.3), h: Math.ceil(th + fs * 0.9), rx: 0, ry: 0 }
      : balloonShape(tw, th, mood, u);
    bin.style.width = `${sh.w}px`;
    bin.style.height = `${sh.h}px`;
    txt.style.left = `${(sh.w - tw) / 2}px`;
    txt.style.top = `${(sh.h - th) / 2}px`;
    txt.classList.add('is-set');
    const cx = sh.w / 2, cy = sh.h / 2;
    const bw = clamp(fs * 0.17, 2.2, 4.4);
    const b = {
      key: ++seq, id, who: p.who ?? null, narr, mood, el, bin, a, z, text,
      ...sayTiming(text, Number(p.dur)), n: 0, t0: now,
      w: sh.w, h: sh.h, cx, cy, rx: sh.rx, ry: sh.ry, fs, bw,
      anchor: p.anchor ? { x: +p.anchor.x || 0, y: +p.anchor.y || 0, z: +p.anchor.z || 0 } : null,
      x: null, y: null, side: null, out: null, tipKey: '', tails: [], frozen: false, leaving: false, goneAt2: 0, page: null, slot: null,
    };
    if (!narr) {
      const svg = el.querySelector('svg');
      svg.setAttribute('width', String(sh.w));
      svg.setAttribute('height', String(sh.h));
      const seed = b.key * 31 + 7;
      const body = mood === 'grito' ? burstPath(cx, cy, sh.rx, sh.ry, seed) : mood === 'pensa' ? cloudPath(cx, cy, sh.rx, sh.ry) : ovalPath(cx, cy, sh.rx, sh.ry, seed);
      for (const pth of svg.querySelectorAll('.b')) pth.setAttribute('d', body);
      for (const g of svg.querySelectorAll('.s, .o')) g.setAttribute('stroke-width', (bw * 2).toFixed(1));
      svg.querySelector('.s').setAttribute('transform', `translate(${(bw * 0.9).toFixed(1)} ${(bw * 1.25).toFixed(1)})`);
      b.tails = [...svg.querySelectorAll('.t')];
    }
    a.textContent = '';
    balloons.set(b.key, b);
    el.classList.add('is-in');
    sr.textContent = `${p.name ? `${p.name}: ` : ''}${text}`;
  }
  function leave(b, fast = false) {
    if (b.leaving) return;
    b.leaving = true;
    b.goneAt2 = clock() + (fast ? 0.16 : OUT_DUR);
    b.el.classList.add('is-out');
    if (fast) b.el.classList.add('is-fast');
  }
  function removeBalloon(b) {
    b.el.remove();
    balloons.delete(b.key);
  }
  /** @param {any} [p] */
  function sayMove(p = {}) {
    const id = String(p.id);
    for (const b of balloons.values()) {
      if (b.id !== id || b.frozen || b.leaving) continue;
      if (!b.anchor) b.anchor = { x: 0, y: 0, z: 0 };
      b.anchor.x = +p.x || 0;
      b.anchor.y = +p.y || 0;
      b.anchor.z = +p.z || 0;
    }
  }
  function clearTalk() {
    for (const b of balloons.values()) leave(b, true);
  }
  /** A cada desenho: digita, toca as sílabas, encaixa os balões no quadro e aponta os rabichos. */
  function updateTalk(now, dt, poly) {
    const placed = [];
    for (const c of caps) if (c.x != null && !c.leaving) placed.push({ x: c.x, y: c.y, w: c.w, h: c.h });
    const corners = new Set([...caps].map((c) => c.pos));
    const order = [...balloons.values()].sort((x, y) => Number(y.narr) - Number(x.narr));
    const pad = Math.max(8, frameMetrics(geom.W, geom.H).ink * 2.2);
    for (const b of order) {
      if (b.leaving) { if (now >= b.goneAt2) removeBalloon(b); continue; }
      const t = now - b.t0;
      const n = typedCount(b.times, t);
      if (n !== b.n) {
        b.n = n;
        b.a.textContent = b.text.slice(0, n);
        b.z.textContent = b.text.slice(n);
      }
      // no quadro congelado, o balão fica até a página virar
      if (b.frozen) continue;
      if (t >= b.hideAt) { leave(b); continue; }
      let x, y, tip = null, out = false, side = null;
      if (b.narr) {
        const corner = ['tl', 'tr', 'bl', 'br'].find((c) => !corners.has(c)) || 'tl';
        ({ x, y } = placeCorner(poly, b.w, b.h, corner, pad));
      } else {
        const anc = b.anchor ? project(b.anchor) : null;
        const pl = placeBalloon({ anchor: anc, w: b.w, h: b.h, poly, others: placed, prev: b.side, pad, gap: clamp(b.h * 0.42, 14, 36) });
        ({ x, y, tip, out, side } = pl);
      }
      // anda macio atrás de quem fala (o primeiro quadro já nasce no lugar)
      const k = b.x == null ? 1 : 1 - Math.exp(-dt * 14);
      const nx = b.x == null ? x : b.x + (x - b.x) * k;
      const ny = b.y == null ? y : b.y + (y - b.y) * k;
      if (b.x == null || Math.abs(nx - b.x) > 0.05 || Math.abs(ny - b.y) > 0.05) {
        b.el.style.transform = `translate3d(${nx.toFixed(1)}px, ${ny.toFixed(1)}px, 0)`;
      }
      if (b.x == null) b.el.style.visibility = '';
      b.x = nx;
      b.y = ny;
      b.side = side;
      if (out !== b.out) { b.out = out; b.el.classList.toggle('is-off', out); }
      if (!b.narr) {
        const tx = tip ? tip.x - nx : b.cx, ty = tip ? tip.y - ny : b.cy;
        const key = `${Math.round(tx)},${Math.round(ty)}`;
        if (key !== b.tipKey) {
          b.tipKey = key;
          const d = !tip ? '' : b.mood === 'pensa'
            ? bubblesPath(b.cx, b.cy, tx, ty, Math.min(b.rx, b.ry) * 1.05, clamp(b.fs * 0.42, 4, 9))
            : tailPath(b.cx, b.cy, tx, ty, clamp(Math.min(b.rx, b.ry) * 0.62, 9, 26), Math.min(b.rx, b.ry) * 0.5);
          for (const pth of b.tails) pth.setAttribute('d', d);
        }
      }
      placed.push({ x: nx, y: ny, w: b.w, h: b.h });
    }
  }

  // ------------------------------------------------ legendas (Scott Pilgrim)
  const letters = (text) => [...String(text)].map((ch, i) => (ch === ' '
    ? `<i class="sp" style="--i:${i}">&nbsp;</i>`
    : `<i style="--i:${i}">${esc(ch)}</i>`)).join('');
  /** @param {any} [p] */
  function caption(p = {}) {
    const text = String(p.text ?? '').trim();
    if (!text) return;
    if (geomDirty) relayout();
    const now = clock();
    const pos = POS.includes(p.pos) ? p.pos : 'bl';
    for (const c of caps) if (c.pos === pos) leaveCap(c, now);
    const el = document.createElement('div');
    el.className = `rr-comic__cap is-${pos}`;
    const cast = CAST[p.who] || null;
    el.style.setProperty('--cc', cast?.color || CAP_COLORS[seq % CAP_COLORS.length]);
    el.innerHTML = `<div class="rr-comic__capin"><b class="rr-comic__capname">${letters(text)}</b>${p.sub ? `<span class="rr-comic__capsub">${esc(p.sub)}</span>` : ''}<svg class="rr-comic__star" viewBox="-13 -13 26 26"><path d="${STAR}"/></svg></div>`;
    capsBox.appendChild(el);
    let arrow = null;
    if (p.anchor) {
      arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.setAttribute('class', 'rr-comic__arrow');
      arrow.setAttribute('viewBox', `0 0 ${geom.W} ${geom.H}`);
      arrow.innerHTML = '<path class="w"/><path class="k"/>';
      capsBox.insertBefore(arrow, el);
    }
    const c = {
      el, arrow, pos, w: el.offsetWidth, h: el.offsetHeight, t0: now, seq: ++seq,
      t1: now + (Number(p.dur) > 0 ? Number(p.dur) : 2.8), leaving: false, gone: 0, x: null, y: null,
      anchor: p.anchor ? { x: +p.anchor.x || 0, y: +p.anchor.y || 0, z: +p.anchor.z || 0 } : null,
    };
    caps.add(c);
  }
  function leaveCap(c, now) {
    if (c.leaving) return;
    c.leaving = true;
    c.gone = now + 0.32;
    c.el.classList.add('is-out');
    c.arrow?.classList.add('is-out');
  }
  function updateCaps(now, poly) {
    const pad = Math.max(10, frameMetrics(geom.W, geom.H).ink * 3);
    for (const c of caps) {
      if (c.leaving && now >= c.gone) { c.el.remove(); c.arrow?.remove(); caps.delete(c); continue; }
      if (!c.leaving && now >= c.t1) leaveCap(c, now);
      const { x, y } = placeCorner(poly, c.w, c.h, c.pos, pad);
      if (c.x == null || Math.abs(x - c.x) > 0.3 || Math.abs(y - c.y) > 0.3) {
        c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        c.x = x;
        c.y = y;
      }
      if (c.arrow && c.anchor) {
        const a = project(c.anchor);
        const pw = c.arrow.querySelector('.w'), pk = c.arrow.querySelector('.k');
        if (!a.front || now - c.t0 < 0.35) { pw.setAttribute('d', ''); pk.setAttribute('d', ''); continue; }
        // da borda da caixa até perto da personagem, numa curva de caneta, com a ponta de seta
        const bx = clamp(a.x, c.x, c.x + c.w), by = clamp(a.y, c.y, c.y + c.h);
        const dx = a.x - bx, dy = a.y - by;
        const len = Math.hypot(dx, dy);
        if (len < 24) { pw.setAttribute('d', ''); pk.setAttribute('d', ''); continue; }
        const ux = dx / len, uy = dy / len;
        const sx = bx + ux * 6, sy = by + uy * 6;
        const ex = a.x - ux * 14, ey = a.y - uy * 14;
        const bend = Math.min(40, len * 0.25);
        const mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
        const hx = ex - mx, hy = ey - my, hl = Math.hypot(hx, hy) || 1;
        const hux = hx / hl, huy = hy / hl, hs = clamp(geom.H * 0.025, 7, 14);
        const d = `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`
          + `M${(ex - hux * hs - huy * hs * 0.7).toFixed(1)} ${(ey - huy * hs + hux * hs * 0.7).toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`
          + `L${(ex - hux * hs + huy * hs * 0.7).toFixed(1)} ${(ey - huy * hs - hux * hs * 0.7).toFixed(1)}`;
        pw.setAttribute('d', d);
        pk.setAttribute('d', d);
      }
    }
  }

  // ------------------------------------------------ onomatopeias
  /** @param {any} [p] */
  function onomato(p = {}) {
    const text = String(p.text ?? '').trim();
    if (!text) return;
    const now = clock();
    const { item, evicted } = sfxQ.push(now, { ...p, text });
    for (const ev of evicted) { const s = sfxEls.get(ev.id); if (s) fadeSfx(s, now); }
    const el = document.createElement('div');
    el.className = `rr-comic__sfxw is-${item.style}`;
    const o = document.createElement('div');
    o.className = 'rr-comic__sfxo';
    const t = document.createElement('div');
    t.className = 'rr-comic__sfxt';
    const color = SAFE_COLOR.test(String(p.color || '')) ? String(p.color) : style === 'manga' ? '#ffffff' : item.color;
    t.style.setProperty('--c', color);
    t.style.setProperty('--rot', `${clamp(Number(item.rot) || 0, -40, 40)}deg`);
    t.style.fontSize = `calc(var(--sfx) * ${clamp(item.size, 0.3, 3)})`;
    const rnd = seeded(item.id * 131);
    t.innerHTML = [...text].map((ch, i) => (ch === ' '
      ? '<i class="sp">&nbsp;</i>'
      : `<i style="--i:${i};--r:${((rnd() - 0.5) * 16).toFixed(1)}deg;--y:${((rnd() - 0.5) * 0.14).toFixed(2)}em">${esc(ch)}</i>`)).join('');
    o.appendChild(t);
    el.appendChild(o);
    sfxBox.appendChild(el);
    sfxEls.set(item.id, { el, item, end: item.t1, out: false, frozen: false, x: null, y: null });
  }
  function fadeSfx(s, now) {
    if (s.out) { s.end = Math.min(s.end, now + 0.2); return; }
    s.out = true;
    s.end = Math.min(s.end, now + 0.2);
    s.el.classList.add('is-out');
  }
  function updateSfx(now) {
    const m = Math.min(geom.W, geom.H);
    for (const [id, s] of sfxEls) {
      if (now >= s.end) { s.el.remove(); sfxEls.delete(id); continue; }
      if (!s.out && now >= s.end - 0.24) { s.out = true; s.el.classList.add('is-out'); }
      let x = s.x, y = s.y;
      if (s.item.anchor && !s.frozen) {
        const a = project(s.item.anchor);
        if (a.front) { x = a.x; y = a.y; }
      }
      if (x == null) { x = s.item.sx * geom.W; y = s.item.sy * geom.H; }
      const fx = clamp(x + s.item.dx * m, m * 0.14, geom.W - m * 0.14);
      const fy = clamp(y + s.item.dy * m, m * 0.12, geom.H - m * 0.12);
      if (s.fx == null || Math.abs(fx - s.fx) > 0.2 || Math.abs(fy - s.fy) > 0.2) {
        s.el.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0)`;
        s.fx = fx;
        s.fy = fy;
      }
      s.x = x;
      s.y = y;
    }
  }

  // ------------------------------------------------ efeitos de mangá
  /** @param {any} [p] */
  function fx(p = {}) {
    const kind = FX_DUR[p.kind] ? p.kind : null;
    if (!kind) return;
    const now = clock();
    const dur = Number(p.dur) > 0 ? Number(p.dur) : FX_DUR[kind];
    if (kind === 'shake' || (kind === 'impact' && !shake)) {
      shake = { t0: now, dur: kind === 'shake' ? dur : 0.3, amp: kind === 'shake' ? (Number(p.amp) > 0 ? Number(p.amp) : 1) : 0.8 };
      if (kind === 'shake') return;
    }
    fxs.push({
      kind, t0: now, dur, seed: (++seq * 977) >>> 0, dir: Number(p.dir) > 0 ? 1 : -1,
      anchor: p.anchor ? { x: +p.anchor.x || 0, y: +p.anchor.y || 0, z: +p.anchor.z || 0 } : null,
    });
  }
  function clearFxCanvas() {
    if (!fxDrawn) return;
    fxCtx?.setTransform(1, 0, 0, 1, 0, 0);
    fxCtx?.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    fxCanvas.style.display = 'none';
    fxDrawn = false;
  }
  function drawFx(now, poly) {
    fxs = fxs.filter((f) => now < f.t0 + f.dur);
    if (!fxs.length || !fxCtx) { clearFxCanvas(); return; }
    // meia resolução de sobra no celular: linhas e brilhos não pedem mais que 1,5× (o 3D é que precisa de nitidez)
    const r = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = Math.round(geom.W * r), ch = Math.round(geom.H * r);
    if (fxCanvas.width !== cw || fxCanvas.height !== ch) { fxCanvas.width = cw; fxCanvas.height = ch; }
    const ctx = fxCtx;
    fxCanvas.style.display = 'block';
    fxDrawn = true;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, geom.W, geom.H);
    ctx.save();
    ctx.beginPath();
    poly.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
    ctx.closePath();
    ctx.clip();
    const box = bboxOf(poly);
    for (const f of fxs) {
      const t = now - f.t0;
      const k = clamp(t / f.dur, 0, 1);
      let C = centroid(poly), hasA = false;
      if (f.anchor) {
        const a = project(f.anchor);
        if (a.front) { C = [a.x, a.y]; hasA = true; }
      }
      ctx.globalAlpha = 1;
      DRAW[f.kind]?.(ctx, f, k, t, box, C, hasA, reduced);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function updateShake(now) {
    if (!shake) return;
    const k = (now - shake.t0) / shake.dur;
    if (k >= 1 || reduced) {
      shake = null;
      gl.style.transform = '';
      liveG.style.transform = '';
      return;
    }
    const amp = Math.min(geom.W, geom.H) * 0.014 * shake.amp * (1 - ease.outCubic(k));
    const w = now * 60;
    const dx = Math.sin(w * 1.7) * amp, dy = Math.cos(w * 2.3) * amp * 0.8;
    // sem quadro (cena de cinema), um tiquinho maior: as bordas da tela não aparecem
    const zoom = stage.live ? '' : ' scale(1.04)';
    const tr = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)${zoom}`;
    gl.style.transform = tr;
    liveG.style.transform = stage.live ? tr : '';
  }

  // ------------------------------------------------ a cada desenho (engine.onAfterRender)
  function busy() {
    return on || closing || driver.applied || !!driver.pending || balloons.size > 0 || caps.size > 0 || sfxEls.size > 0 || fxs.length > 0 || !!shake || fxDrawn;
  }
  function tick() {
    if (snapping) return;
    const now = clock();
    const dt = Math.min(0.1, Math.max(0, now - lastNow));
    lastNow = now;
    if (!busy()) return;
    if (geomDirty) relayout();
    if (on && wantDefault && !stage.live) { wantDefault = false; panel({ layout: 'full', slot: 0, enter: 'shrink', auto: true }); }
    // o recorte que acompanha o desenho que acabou de sair (e o plano do próximo)
    const shown = driver.step(now, target, geom);
    if (shown) {
      const id = stage.live?.id ?? 0;
      const key = shown.live && shown.k >= 1 ? `${id}:${geom.W}x${geom.H}` : '';
      if (!key || key !== inkKey) {
        inkKey = key;
        const { ink } = frameMetrics(geom.W, geom.H);
        frameInk.setAttribute('d', inkPath(shown.clip, id * 7 + 3, ink * 0.3));
        frameInk.setAttribute('stroke-width', ink.toFixed(1));
        page?.shadeLive.setAttribute('d', shown.clip.length > 2 ? inkPath(offsetPoly(shown.clip, ink * 1.4, ink * 1.8), 1, 0) : '');
      }
    } else if (inkKey !== 'none') {
      inkKey = 'none';
      frameInk.setAttribute('d', '');
    }
    const poly = shown?.final || shown?.clip || screenPoly();
    const area = poly.length > 2 ? poly : screenPoly();
    updateCaps(now, area);
    updateTalk(now, dt, area);
    updateSfx(now);
    updateShake(now);
    drawFx(now, area);
    if (closing && !stage.busy && !driver.applied && !driver.pending) finish();
  }
  const offRender = typeof engine.onAfterRender === 'function'
    ? engine.onAfterRender(tick)
    : (() => {
      // sem o gancho: um laço próprio (a foto continua certa: ela desenha na hora)
      let raf = 0;
      const loop = () => { tick(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    })();

  /** Corta tudo na hora, sem animação (troca de fase, recomeço). */
  function hardReset() {
    on = false;
    closing = false;
    wantDefault = false;
    delete root.dataset.comic;
    stage.clear();
    driver.reset(target);
    if (filterSet) { gl.style.filter = ''; filterSet = false; }
    if (shake) { gl.style.transform = ''; shake = null; }
    liveG.style.transform = '';
    for (const b of balloons.values()) b.el.remove();
    balloons.clear();
    for (const c of caps) { c.el.remove(); c.arrow?.remove(); }
    caps.clear();
    for (const s of sfxEls.values()) s.el.remove();
    sfxEls.clear();
    sfxQ.clear();
    fxs = [];
    clearFxCanvas();
    discardPage();
    turnBox.textContent = '';
    frameInk.setAttribute('d', '');
    inkKey = '';
    host.classList.remove('is-on', 'is-closing');
    back.classList.remove('is-on', 'is-closing');
  }

  const offs = [
    events.on('story:comic', (/** @type {any} */ p = {}) => (p.on ? comicOn(p) : comicOff(p))),
    events.on('story:comicEnd', (/** @type {any} */ p = {}) => comicOff(p)),
    events.on('story:panel', (/** @type {any} */ p = {}) => panel(p)),
    events.on('story:say', (/** @type {any} */ p = {}) => say(p)),
    events.on('story:sayMove', (/** @type {any} */ p = {}) => sayMove(p)),
    events.on('story:sayClear', () => clearTalk()),
    events.on('story:caption', (/** @type {any} */ p = {}) => caption(p)),
    events.on('story:onomato', (/** @type {any} */ p = {}) => onomato(p)),
    events.on('story:fx', (/** @type {any} */ p = {}) => fx(p)),
    // a cena acabou (ou foi pulada): a HQ fecha e o que estava na tela some
    events.on('story:cinema', (/** @type {any} */ p = {}) => {
      if (p.on) return;
      if (on) comicOff({});
      clearTalk();
      const now = clock();
      for (const c of caps) leaveCap(c, now);
      for (const s of sfxEls.values()) fadeSfx(s, now);
      fxs = [];
    }),
    events.on('story:reset', () => hardReset()),
    events.on('level:loading', () => hardReset()),
  ];

  return {
    /** Para os testes de tela e a depuração: o que está na página agora. */
    state() {
      return {
        on, closing, style, layout: page?.layout ?? null,
        live: stage.live ? { layout: stage.live.layout, slot: stage.live.slot, id: stage.live.id } : null,
        frozen: page?.frozen.length ?? 0,
        balloons: [...balloons.values()].filter((b) => !b.leaving).map((b) => ({ id: b.id, who: b.who, frozen: b.frozen, typed: b.n, out: !!b.out })),
        captions: caps.size, sfx: sfxEls.size, fx: fxs.length, clip: gl.style.clipPath || '',
      };
    },
    dispose() {
      for (const off of offs) off();
      offRender?.();
      hardReset();
      window.removeEventListener('resize', onResize);
      mq?.removeEventListener?.('change', onMotion);
      host.remove();
      back.remove();
      sr.remove();
    },
  };
}

// ------------------------------------------------------------------ desenhos dos efeitos (canvas 2D, recortado no quadro)
const env = (k, a, b) => clamp(Math.min(k / a, (1 - k) / b, 1), 0, 1);
const unit = (box) => clamp(Math.min(box.w, box.h) * 0.22, 22, 110);

/** Linhas de velocidade laterais (dir -1: correm para a esquerda, como quem dispara para a direita). */
function fxSpeed(ctx, f, k, t, box, C, hasA) {
  const rnd = seeded(f.seed);
  const e = env(k, 0.1, 0.3);
  const light = new Path2D(), dark = new Path2D();
  for (let i = 0; i < 32; i++) {
    const y = hasA ? C[1] + (rnd() - 0.5) * box.h * 0.95 : box.y + rnd() * box.h;
    const len = box.w * (0.16 + rnd() * 0.42);
    const th = 0.8 + rnd() * 3.4;
    const v = box.w * (1.8 + rnd() * 1.8);
    const span = box.w + len;
    const p = ((rnd() * span + t * v) % span) - len;
    const x1 = f.dir > 0 ? box.x + p : box.x + box.w - p - len;
    const x2 = x1 + len, xm = (x1 + x2) / 2;
    const path = i % 6 === 0 ? dark : light;
    path.moveTo(x1, y);
    path.quadraticCurveTo(xm, y - th / 2, x2, y);
    path.quadraticCurveTo(xm, y + th / 2, x1, y);
  }
  ctx.globalAlpha = 0.85 * e;
  ctx.fillStyle = '#ffffff';
  ctx.fill(light);
  ctx.globalAlpha = 0.6 * e;
  ctx.fillStyle = INK;
  ctx.fill(dark);
}
/** Linhas de foco: cunhas pretas das bordas para o ponto, piscando (redesenhadas a cada 70 ms). */
function fxFocus(ctx, f, k, t, box, C, hasA, reduced) {
  const e = env(k, 0.08, 0.25);
  const rnd = seeded(f.seed + (reduced ? 0 : Math.floor(t / 0.07)) * 7919);
  const R = Math.hypot(box.w, box.h) * 1.2;
  const r0 = Math.min(box.w, box.h) * 0.3;
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU + (rnd() - 0.5) * 0.06;
    const w = 0.006 + rnd() * 0.016;
    const rin = r0 * (0.8 + rnd() * 0.9);
    ctx.moveTo(C[0] + Math.cos(a - w) * R, C[1] + Math.sin(a - w) * R);
    ctx.lineTo(C[0] + Math.cos(a) * rin, C[1] + Math.sin(a) * rin);
    ctx.lineTo(C[0] + Math.cos(a + w) * R, C[1] + Math.sin(a + w) * R);
    ctx.closePath();
  }
  ctx.globalAlpha = 0.88 * e;
  ctx.fillStyle = INK;
  ctx.fill();
}
/** Quadro de impacto: o branco estoura com raios pretos e uma estrela no meio, e vai sumindo. */
function fxImpact(ctx, f, k, t, box, C, hasA, reduced) {
  const e = k < 0.16 ? 1 : 1 - (k - 0.16) / 0.84;
  ctx.globalAlpha = (reduced ? 0.5 : 0.9) * e;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const rnd = seeded(f.seed);
  const R = Math.hypot(box.w, box.h) * 1.2;
  const r0 = Math.min(box.w, box.h) * (0.05 + ease.outCubic(k) * 0.12);
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + (rnd() - 0.5) * 0.1;
    const w = 0.01 + rnd() * 0.03;
    ctx.moveTo(C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0);
    ctx.lineTo(C[0] + Math.cos(a - w) * R, C[1] + Math.sin(a - w) * R);
    ctx.lineTo(C[0] + Math.cos(a + w) * R, C[1] + Math.sin(a + w) * R);
    ctx.closePath();
  }
  ctx.globalAlpha = 0.85 * e;
  ctx.fillStyle = INK;
  ctx.fill();
  const s = unit(box) * (0.7 + ease.outBack(Math.min(1, k * 4)) * 0.5);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU, r = i % 2 ? s * 0.45 : s * (0.85 + rnd() * 0.3);
    if (i) ctx.lineTo(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r);
    else ctx.moveTo(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.globalAlpha = e;
  ctx.fillStyle = '#FFE14D';
  ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}
function fxFlash(ctx, f, k, t, box) {
  ctx.globalAlpha = 0.9 * (1 - k) ** 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x, box.y, box.w, box.h);
}
function star4(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2, b = a + Math.PI / 2, m = a + Math.PI / 4;
    if (!i) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.quadraticCurveTo(x + Math.cos(m) * r * 0.16, y + Math.sin(m) * r * 0.16, x + Math.cos(b) * r, y + Math.sin(b) * r);
  }
  ctx.closePath();
}
/** Brilhinhos de quatro pontas piscando em volta do ponto. */
function fxSparkle(ctx, f, k, t, box, C) {
  const rnd = seeded(f.seed);
  const s = unit(box);
  const e = env(k, 0.12, 0.3);
  ctx.fillStyle = '#FFF6B8';
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  for (let i = 0; i < 7; i++) {
    const ang = rnd() * TAU, dist = s * (0.45 + rnd() * 0.85), ph = rnd() * TAU, sz = s * (0.1 + rnd() * 0.12);
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 6 + ph));
    const r = sz * tw * e;
    if (r < 0.8) continue;
    star4(ctx, C[0] + Math.cos(ang) * dist, C[1] + Math.sin(ang) * dist * 0.75, r, t * 1.5 + ph);
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    ctx.fill();
    ctx.stroke();
  }
}
function drop(ctx, x, y, r) {
  if (r < 0.6) return;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.9);
  ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.5, x + r, y + r * 0.15);
  ctx.arc(x, y + r * 0.15, r, 0, Math.PI, false);
  ctx.quadraticCurveTo(x - r * 1.1, y - r * 0.5, x, y - r * 1.9);
  ctx.closePath();
  ctx.fillStyle = '#9AD9FF';
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.strokeStyle = INK;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.05, r * 0.2, r * 0.32, -0.4, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}
/** Gota de suor escorrendo ao lado da cabeça (e uma menor depois). */
function fxSweat(ctx, f, k, t, box, C) {
  const s = unit(box);
  ctx.globalAlpha = 1;
  drop(ctx, C[0] + s * 0.42, C[1] - s * 0.32 + ease.outCubic(k) * s * 0.28, s * 0.11 * env(k, 0.1, 0.25));
  if (k > 0.25) drop(ctx, C[0] + s * 0.58, C[1] - s * 0.12 + ease.outCubic((k - 0.25) / 0.75) * s * 0.2, s * 0.075 * env((k - 0.25) / 0.75, 0.15, 0.3));
}
/** A veia de raiva (as quatro curvas em cruz), pulsando. */
function fxAnger(ctx, f, k, t, box, C, hasA, reduced) {
  const s = unit(box);
  const pulse = reduced ? 1 : 1 + 0.16 * Math.abs(Math.sin(t * 9));
  const x = C[0] + s * 0.4, y = C[1] - s * 0.42, d = s * 0.2 * pulse * env(k, 0.1, 0.25);
  if (d < 1) return;
  ctx.beginPath();
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    ctx.moveTo(x + sx * d * 0.22, y + sy * d);
    ctx.quadraticCurveTo(x + sx * d * 0.28, y + sy * d * 0.28, x + sx * d, y + sy * d * 0.22);
  }
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK;
  ctx.lineWidth = d * 0.5;
  ctx.stroke();
  ctx.strokeStyle = '#E8303A';
  ctx.lineWidth = d * 0.28;
  ctx.stroke();
}
function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.95);
  ctx.bezierCurveTo(x - r * 1.35, y + r * 0.05, x - r * 0.95, y - r * 1.05, x, y - r * 0.38);
  ctx.bezierCurveTo(x + r * 0.95, y - r * 1.05, x + r * 1.35, y + r * 0.05, x, y + r * 0.95);
  ctx.closePath();
}
/** Coraçõezinhos subindo e balançando. */
function fxHeart(ctx, f, k, t, box, C) {
  const rnd = seeded(f.seed);
  const s = unit(box);
  ctx.lineJoin = 'round';
  for (let i = 0; i < 5; i++) {
    const delay = i * 0.14 + rnd() * 0.05, ox = (rnd() - 0.5) * s * 0.9, rr = s * (0.1 + rnd() * 0.06);
    const p = (t - delay) / Math.max(0.3, (f.dur - delay) * 0.95);
    if (p <= 0 || p >= 1) continue;
    const x = C[0] + ox + Math.sin(p * 7 + i) * s * 0.12;
    const y = C[1] - s * 0.25 - p * s * 1.1;
    const r = rr * Math.min(1, p * 5);
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
    heart(ctx, x, y, r);
    ctx.fillStyle = '#FF6FA8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, r * 0.18);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.42, y - r * 0.3, r * 0.17, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}
/** @type {Record<string, Function>} */
const DRAW = { speed: fxSpeed, focus: fxFocus, impact: fxImpact, flash: fxFlash, sparkle: fxSparkle, sweat: fxSweat, anger: fxAnger, heart: fxHeart };
