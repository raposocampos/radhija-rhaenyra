// Compositor do trailer: desenha o quadro do instante t (cenas do jogo, transições, textos e grafismos animados).
// seek(t) é puro em t: cada quadro sai igual em qualquer ordem (vários desenhistas em paralelo).
import {
  C, FONT_BODY, FONT_TITLE, arrowUp, bolt, bone, font, gamepadIcon, grain, heart, keyboardIcon, measure, particles, paw,
  phoneIcon, pill, pushIcon, roundRect, shade, softText, sparkle, star, titleText, vignette, wind,
} from './draw.js';
import { clamp, ease, lerp, noise1, prog, spring } from './motion.js';
import { clipTime, resolveSegments } from './timeline-util.js';

const ICONS = { wind, bolt, arrowUp, push: pushIcon, paw: (c, x, y, r, col) => paw(c, x, y, r, col), heart: (c, x, y, r, col) => heart(c, x, y, r, col), star: (c, x, y, r, col) => star(c, x, y, r, col), bone: (c, x, y, r, col) => bone(c, x, y, r, col), sparkle: (c, x, y, r, col) => sparkle(c, x, y, r, col) };
const WHO = {
  radhija: { color: C.honey, deep: C.honeyDeep },
  rhaenyra: { color: C.teal, deep: C.tealDeep },
};

export function createComposer({ canvas, timeline, index, base }) {
  const W = timeline.width;
  const H = timeline.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const segs = resolveSegments(timeline.clips, index);
  const overlays = timeline.overlays;
  const portrait = H > W;

  // ------------------------------------------------------------------------------------------ quadros das cenas
  const cache = new Map();
  const frameOf = (clip, ct) => {
    const m = index[clip];
    if (!m) return -1;
    return clamp(Math.floor(ct * (m.fps || 30) + 1e-4), 0, m.frames - 1);
  };
  const urlOf = (clip, f) => `${base}/${clip}/${String(f + 1).padStart(5, '0')}.jpg`;
  const want = (set, clip, ct) => {
    const f = frameOf(clip, ct);
    if (f >= 0) set.add(urlOf(clip, f));
  };
  const imgOf = (clip, ct) => {
    const f = frameOf(clip, ct);
    if (f < 0) return null;
    const e = cache.get(urlOf(clip, f));
    return e && e.ok ? e.img : null;
  };
  async function load(urls) {
    await Promise.all([...urls].map((u) => {
      let e = cache.get(u);
      if (!e) {
        const img = new Image();
        e = { img, ok: false, used: 0 };
        e.p = new Promise((res) => {
          img.onload = () => img.decode().then(() => { e.ok = true; res(); }, () => { e.ok = true; res(); });
          img.onerror = () => res();
        });
        img.src = u;
        cache.set(u, e);
      }
      e.used = performance.now();
      return e.p;
    }));
    if (cache.size > 160) {
      const old = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, cache.size - 120);
      for (const [k] of old) cache.delete(k);
    }
  }

  const visible = (s, t) => t >= s.start && t < s.drawEnd;
  function needs(t) {
    const set = new Set();
    for (const s of segs) if (visible(s, t)) want(set, s.clip, clipTime(s, t));
    for (const o of overlays) {
      if (t < o.start || t >= o.end) continue;
      for (const k of o.tiles || []) want(set, k.clip, (k.in ?? 0) + (t - o.start) * (k.speed ?? 1));
      for (const k of o.portraits || []) want(set, k.clip, (k.in ?? 0) + (t - o.start) * (k.speed ?? 1));
    }
    return set;
  }

  // ------------------------------------------------------------------------------------------ cenas e transições
  function drawImageCover(img, { scale = 1, ox = 0, oy = 0, focus = [0.5, 0.5], alpha = 1, filter = 'none' } = {}) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const s = Math.max(W / iw, H / ih) * scale;
    const dw = iw * s;
    const dh = ih * s;
    const dx = (W - dw) * focus[0] + ox;
    const dy = (H - dh) * focus[1] + oy;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (filter !== 'none') ctx.filter = filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function pawPath(cx, cy, r) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.28, r * 0.55, r * 0.46, 0, 0, Math.PI * 2);
    for (const [tx, ty, tr] of [[-0.62, -0.18, 0.21], [-0.24, -0.58, 0.23], [0.24, -0.58, 0.23], [0.62, -0.18, 0.21]]) {
      ctx.moveTo(cx + tx * r + tr * r, cy + ty * r);
      ctx.ellipse(cx + tx * r, cy + ty * r, tr * r, tr * r * 1.22, tx * 0.5, 0, Math.PI * 2);
    }
  }

  function segParams(s, t) {
    const k = prog(t, s.start, s.drawEnd);
    const kb = s.kb || {};
    const e = (kb.ease && ease[kb.ease]) || ease.linear;
    const kk = e(k);
    const scale = kb.s ? lerp(kb.s[0], kb.s[1], kk) : 1;
    const ox = kb.x ? lerp(kb.x[0], kb.x[1], kk) * W : 0;
    const oy = kb.y ? lerp(kb.y[0], kb.y[1], kk) * H : 0;
    let blur = typeof s.blur === 'number' ? s.blur : Array.isArray(s.blur) ? lerp(s.blur[0], s.blur[1], ease.inOutCubic(k)) : 0;
    let dark = typeof s.dark === 'number' ? s.dark : Array.isArray(s.dark) ? lerp(s.dark[0], s.dark[1], ease.inOutCubic(k)) : 0;
    // impacto: tremidinha curta depois do instante
    let sx = 0;
    let sy = 0;
    for (const at of s.shakes || []) {
      const d = t - at;
      if (d >= 0 && d < 0.35) {
        const a = (1 - d / 0.35) * 14;
        sx += noise1(d * 40, 3) * a;
        sy += noise1(d * 40, 7) * a;
      }
    }
    return { scale, ox: ox + sx, oy: oy + sy, blur, dark, focus: s.focus || [0.5, 0.5] };
  }

  function drawSeg(s, t, nxt) {
    const img = imgOf(s.clip, clipTime(s, t));
    if (!img) {
      ctx.fillStyle = '#20140c';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const p = segParams(s, t);
    let { scale, ox, oy } = p;
    let alpha = 1;
    let extraBlur = 0;
    // saída (a transição do próximo empurra esta)
    if (nxt && t >= nxt.start && nxt.tr) {
      const q = prog(t, nxt.start, nxt.start + nxt.tr.dur);
      const dir = nxt.tr.dir ?? 1;
      if (nxt.tr.type === 'slide' || nxt.tr.type === 'whip') {
        ox -= ease.inOutCubic(q) * W * dir;
        extraBlur += Math.sin(Math.PI * q) * (nxt.tr.type === 'whip' ? 26 : 10);
      } else if (nxt.tr.type === 'zoom') {
        scale *= 1 + ease.inCubic(q) * 0.35;
        extraBlur += ease.inCubic(q) * 14;
      }
    }
    // entrada
    let clip = null;
    if (s.tr && t < s.start + s.tr.dur) {
      const q = prog(t, s.start, s.start + s.tr.dur);
      const dir = s.tr.dir ?? 1;
      const type = s.tr.type;
      if (type === 'fade') alpha = ease.smooth(q);
      else if (type === 'slide' || type === 'whip') {
        ox += (1 - ease.inOutCubic(q)) * W * dir;
        extraBlur += Math.sin(Math.PI * q) * (type === 'whip' ? 26 : 10);
      } else if (type === 'zoom') {
        scale *= lerp(1.3, 1, ease.outExpo(q));
        alpha = ease.outCubic(prog(q, 0, 0.45));
        extraBlur += (1 - ease.outCubic(q)) * 10;
      } else if (type === 'paw' || type === 'circle') {
        clip = { type, q, at: s.tr.at || [0.5, 0.5], color: s.tr.color || C.orange };
      }
    }
    const filters = [];
    const b = p.blur + extraBlur;
    if (b > 0.3) filters.push(`blur(${b.toFixed(1)}px)`);
    if (s.sat !== undefined) filters.push(`saturate(${s.sat})`);
    const filter = filters.length ? filters.join(' ') : 'none';
    const draw = () => {
      // com desfoque, a imagem cresce um pouco para a borda não ficar transparente
      drawImageCover(img, { scale: b > 0.3 ? scale * (1 + b / 400) : scale, ox, oy, focus: p.focus, alpha, filter });
      if (p.dark > 0) {
        ctx.fillStyle = `rgba(14,8,4,${p.dark})`;
        ctx.fillRect(0, 0, W, H);
      }
    };
    if (clip) {
      const cx = clip.at[0] * W;
      const cy = clip.at[1] * H;
      const big = Math.hypot(W, H);
      const e1 = ease.inOutCubic(clip.q);
      const shape = (grow) => {
        if (clip.type === 'paw') {
          pawPath(cx, cy, (e1 * big * 0.75 + 4) * grow);
          const rc = Math.max(0, ease.inCubic(prog(clip.q, 0.35, 1))) * big * grow;
          ctx.moveTo(cx + rc, cy);
          ctx.arc(cx, cy, rc, 0, Math.PI * 2);
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, e1 * big * 0.6 * grow + 2, 0, Math.PI * 2);
        }
      };
      ctx.save();
      shape(1.06);
      ctx.fillStyle = clip.color;
      ctx.fill('nonzero');
      ctx.restore();
      ctx.save();
      shape(1);
      ctx.clip('nonzero');
      draw();
      ctx.restore();
    } else draw();
  }

  // ------------------------------------------------------------------------------------------ textos e grafismos
  const lettersPop = (t0, { stagger = 0.03, freq = 2.1, damp = 0.5, rise = 46, spin = 0.25 } = {}) => (i, n) => {
    const s = spring(t0 - i * stagger, { freq, damp });
    return { s: Math.max(0, s), y: (1 - s) * rise, r: (1 - s) * spin * (i % 2 ? 1 : -1), a: clamp(s * 3) };
  };
  const exitK = (t, end, dur = 0.3) => 1 - ease.inCubic(prog(t, end - dur, end));

  function drawCaption(o, t) {
    const lt = t - o.start;
    const out = exitK(t, o.end, 0.35);
    const size = o.size ?? 74;
    const lines = Array.isArray(o.text) ? o.text : [o.text];
    lines.forEach((line, li) => {
      const y = (o.y ?? 0.8) * H + li * size * 1.15;
      titleText(ctx, line, W / 2, y - (1 - out) * 20, {
        size, weight: o.weight ?? 600, strokeW: size * 0.09, shadowY: size * 0.05, alpha: out,
        letterFx: (i) => {
          const a = ease.outCubic(prog(lt - li * 0.25, i * 0.028, i * 0.028 + 0.4));
          return { a, y: (1 - a) * 26, s: lerp(0.9, 1, a) };
        },
      });
    });
  }

  function drawLogo(o, t) {
    const lt = t - o.start;
    const out = o.end - t < 0.4 ? ease.inCubic(prog(t, o.end - 0.4, o.end)) : 0;
    const size = o.size ?? 150;
    const lines = o.lines || ['Radhija & Rhaenyra'];
    const cy = (o.y ?? 0.42) * H;
    ctx.save();
    ctx.translate(W / 2, cy);
    const sc = 1 + out * 0.08;
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -cy);
    ctx.globalAlpha = 1 - out;
    if (lt >= 0 && lt < 1.6 && !o.noBurst) particles(ctx, lt, { kind: 'sparkles', mode: 'burst', seed: 31, n: 26, x: W / 2, y: cy - size * 0.3, speed: 1100, gravity: 600, size: 22, life: 1.3, colors: [C.cream, '#FFE2A8', C.orange] });
    let idx0 = 0;
    lines.forEach((line, li) => {
      const y = cy + (li - (lines.length - 1) / 2) * size * 1.05 + size * 0.32;
      const colors = [...line].map((ch) => (ch === '&' ? C.orange : C.cream));
      const base = idx0;
      titleText(ctx, line, W / 2, y, {
        size, colors, strokeW: size * 0.13, shadowY: size * 0.08,
        letterFx: (i) => {
          const k = base + i;
          const s = spring(lt - k * 0.032, { freq: 2.0, damp: 0.48 });
          const amp = line[i] === '&';
          return { s: Math.max(0, amp ? s * (1 + 0.15 * Math.sin(lt * 3)) : s), y: (1 - s) * -60, r: amp ? (1 - s) * Math.PI * 1.2 : (1 - s) * 0.3 * (k % 2 ? 1 : -1), a: clamp(s * 2.5) };
        },
      });
      idx0 += line.length;
    });
    // brilho passando pelas letras
    const sh = prog(lt, 0.9, 1.5);
    if (sh > 0 && sh < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * Math.sin(Math.PI * sh) * (1 - out);
      const x = lerp(W * 0.15, W * 0.85, ease.inOutCubic(sh));
      const g = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,240,210,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      lines.forEach((line, li) => {
        const y = cy + (li - (lines.length - 1) / 2) * size * 1.05 + size * 0.32;
        ctx.font = font(700, size);
        ctx.textAlign = 'center';
        ctx.fillStyle = g;
        ctx.fillText(line, W / 2, y);
      });
      ctx.restore();
    }
    // patinhas carimbando nas pontas
    const half = (() => { ctx.font = font(700, size); return Math.max(...lines.map((l) => ctx.measureText(l).width)) / 2; })();
    [[-1, 0.45], [1, 0.55]].forEach(([sd, d], k) => {
      const s = spring(lt - d, { freq: 2.4, damp: 0.42 });
      if (s <= 0) return;
      paw(ctx, W / 2 + sd * (half + size * 0.55), cy - size * 0.15 + k * size * 0.25, size * 0.3 * s, k ? C.teal : C.honey, sd * 0.35, clamp(s));
    });
    if (o.sub) {
      const s = spring(lt - (o.subAt ?? 0.85), { freq: 1.8, damp: 0.6 });
      if (s > 0) {
        const y = cy + (lines.length / 2) * size * 1.05 + size * 0.38;
        pill(ctx, o.sub.toUpperCase(), W / 2, y + (1 - s) * 30, { size: o.subSize ?? 34, weight: 900, tracking: 3, bg: C.orange, fg: C.cream, alpha: clamp(s * 2), scale: lerp(0.7, 1, s) });
      }
    }
    ctx.restore();
  }

  function drawNameCard(o, t) {
    const lt = t - o.start;
    const who = WHO[o.who] || WHO.radhija;
    const out = prog(t, o.end - 0.4, o.end);
    const k = 1 - ease.inCubic(out);
    const slide = -ease.inCubic(out) * 160;
    if (!portrait) shade(ctx, W, H, o.side === 'right' ? 'right' : 'left', 0.62 * clamp(lt / 0.4) * k, 0.62);
    else shade(ctx, W, H, 'top', 0.62 * clamp(lt / 0.4) * k, 0.45);
    const x0 = portrait ? W / 2 : o.side === 'right' ? W - 120 : 120;
    const align = portrait ? 'center' : o.side === 'right' ? 'right' : 'left';
    const yName = portrait ? H * 0.2 : H * (o.y ?? 0.5);
    ctx.save();
    ctx.translate(slide, 0);
    // selo
    const sTag = spring(lt - 0.05, { freq: 1.9, damp: 0.6 });
    if (sTag > 0) pill(ctx, o.tag, x0 + (1 - sTag) * -50 * (align === 'right' ? -1 : 1), yName - 175, { size: 30, weight: 900, tracking: 4, bg: who.color, fg: C.cream, align, alpha: clamp(sTag * 2) * k, icon: (c, x, y, r, col) => paw(c, x, y, r, col), iconColor: C.cream });
    // nome
    titleText(ctx, o.name, x0, yName, { size: o.size ?? 170, align, strokeW: 20, shadowY: 12, alpha: k, letterFx: lettersPop(lt - 0.12, { stagger: 0.04 }) });
    // linha
    const sl = ease.outCubic(prog(lt, 0.45, 0.85));
    softText(ctx, o.line, x0 + (align === 'left' ? 6 : 0), yName + 78 + (1 - sl) * 18, { size: 44, weight: 800, align, alpha: sl * k });
    // trilha de patinhas
    for (let i = 0; i < 4; i++) {
      const sp = spring(lt - 0.7 - i * 0.12, { freq: 2.4, damp: 0.5 });
      if (sp <= 0) continue;
      const px = align === 'left' ? x0 + 20 + i * 52 : align === 'right' ? x0 - 20 - i * 52 : x0 - 78 + i * 52;
      paw(ctx, px, yName + 140 + (i % 2 ? -12 : 12), 15 * sp, who.color, (align === 'right' ? -1 : 1) * Math.PI / 2, clamp(sp) * k * 0.95);
    }
    ctx.restore();
  }

  function drawSkill(o, t) {
    const lt = t - o.start;
    const who = o.who ? WHO[o.who] : null;
    const col = o.color || who?.color || C.orange;
    const out = prog(t, o.end - 0.3, o.end);
    const pos = o.pos || (portrait ? 'bc' : 'bl');
    const size = o.size ?? (portrait ? 78 : 58);
    const h = size * 1.7;
    let x = pos === 'bl' || pos === 'tl' ? 110 : pos === 'br' ? W - 110 : W / 2;
    const y = pos.startsWith('t') ? (portrait ? H * 0.16 : 150) : portrait ? H - 360 : H - 140;
    ctx.save();
    ctx.font = font(700, size);
    const tw = measure(ctx, o.text);
    const fullW = tw + h * 0.6 + h * 0.95;
    if (pos === 'bc' || pos === 'tc') x -= fullW / 2;
    if (pos === 'br') x -= fullW;
    const sBadge = spring(lt, { freq: 2.2, damp: 0.45 }) * (1 - ease.inBack(out));
    const open = ease.outExpo(prog(lt, 0.12, 0.5)) * (1 - ease.inCubic(out));
    if (sBadge <= 0.001) { ctx.restore(); return; }
    // corpo da pílula (abre a partir do selo)
    const bodyW = h + (fullW - h) * open;
    ctx.save();
    ctx.shadowColor = 'rgba(30,14,4,0.4)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y - h / 2, bodyW, h, h / 2);
    ctx.fillStyle = C.cream;
    ctx.globalAlpha = clamp(sBadge * 2);
    ctx.fill();
    ctx.restore();
    if (open > 0.02) {
      ctx.save();
      roundRect(ctx, x, y - h / 2, bodyW, h, h / 2);
      ctx.clip();
      ctx.fillStyle = C.ink;
      ctx.font = font(700, size);
      ctx.textBaseline = 'middle';
      ctx.fillText(o.text, x + h + h * 0.18 + (1 - open) * -40, y + size * 0.05);
      ctx.restore();
    }
    // selo redondo com o ícone
    ctx.save();
    ctx.translate(x + h / 2, y);
    ctx.scale(sBadge, sBadge);
    ctx.beginPath();
    ctx.arc(0, 0, h / 2 + 6, 0, Math.PI * 2);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, h / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    (ICONS[o.icon] || ICONS.paw)(ctx, 0, 0, h * 0.27, C.cream);
    ctx.restore();
    // risquinhos de velocidade na entrada
    const sl = prog(lt, 0.05, 0.45);
    if (sl > 0 && sl < 1) {
      ctx.strokeStyle = col;
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      ctx.globalAlpha = Math.sin(Math.PI * sl);
      for (let i = 0; i < 3; i++) {
        const yy = y - h * 0.3 + i * h * 0.3;
        const xx = x - 24 - i * 8;
        ctx.beginPath();
        ctx.moveTo(xx - 50 * ease.outCubic(sl), yy);
        ctx.lineTo(xx - 10, yy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPhaseTag(o, t) {
    const lt = t - o.start;
    const s = spring(lt, { freq: 1.9, damp: 0.62 });
    const out = ease.inCubic(prog(t, o.end - 0.28, o.end));
    if (s <= 0) return;
    const size = portrait ? 48 : 40;
    const h = size * 1.9;
    const x = portrait ? W / 2 : 90;
    const y = portrait ? H * 0.12 : 100;
    ctx.save();
    ctx.font = font(900, size * 0.62, FONT_BODY);
    const labW = measure(ctx, `FASE ${o.n}`, 2);
    ctx.font = font(600, size);
    const nameW = measure(ctx, o.name);
    const w = h * 0.9 + labW + 22 + nameW + h * 0.55;
    const x0 = portrait ? x - w / 2 : x;
    ctx.globalAlpha = clamp(s * 2) * (1 - out);
    ctx.translate((1 - s) * -80 * (portrait ? 0 : 1), (1 - s) * (portrait ? -30 : 0) - out * 30);
    ctx.save();
    ctx.shadowColor = 'rgba(30,14,4,0.38)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 7;
    roundRect(ctx, x0, y - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,246,233,0.96)';
    ctx.fill();
    ctx.restore();
    // bolinha com o número
    ctx.beginPath();
    ctx.arc(x0 + h / 2, y, h / 2 - 7, 0, Math.PI * 2);
    ctx.fillStyle = C.orange;
    ctx.fill();
    paw(ctx, x0 + h / 2, y + 1, h * 0.27, C.cream);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(900, size * 0.62, FONT_BODY);
    ctx.fillStyle = C.orangeDeep;
    let cx = x0 + h * 0.9;
    for (const ch of `FASE ${o.n}`) { ctx.fillText(ch, cx, y + 2); cx += ctx.measureText(ch).width + 2; }
    ctx.fillStyle = C.ink;
    ctx.font = font(600, size);
    ctx.fillText(o.name, x0 + h * 0.9 + labW + 22, y + size * 0.06);
    ctx.restore();
  }

  function drawBigTitle(o, t) {
    const lt = t - o.start;
    const out = exitK(t, o.end, 0.3);
    const size = o.size ?? 130;
    const y = (o.y ?? 0.22) * H;
    const colors = o.color ? [...o.text].map(() => o.color) : null;
    titleText(ctx, o.text, W / 2, y, { size, colors, strokeW: size * 0.12, shadowY: size * 0.07, alpha: out, letterFx: lettersPop(lt, { stagger: 0.035, rise: 60 }) });
    if (o.sub) {
      const s = ease.outCubic(prog(lt, 0.4, 0.8));
      softText(ctx, o.sub, W / 2, y + size * 0.62 + (1 - s) * 16, { size: o.subSize ?? 46, weight: 800, alpha: s * out });
    }
    if (o.deco === 'hearts') particles(ctx, lt - 0.2, { kind: 'hearts', mode: 'burst', seed: 5, n: 14, x: W / 2, y: y - size * 0.4, speed: 700, gravity: 300, size: 26, life: 1.8, colors: [C.pink, '#FF8FA8', C.cream] });
  }

  function drawMosaic(o, t) {
    const lt = t - o.start;
    // fundo
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#3A2416');
    g.addColorStop(1, '#1E2240');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // padrão de patinhas ao fundo, andando devagar
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let yy = -1; yy < 8; yy++) for (let xx = -1; xx < 13; xx++) {
      paw(ctx, xx * 170 + ((yy % 2) * 85) + (lt * 30) % 170, yy * 160 + 40, 26, C.cream, 0.4);
    }
    ctx.restore();
    const n = o.tiles.length;
    const cols = o.cols ?? (portrait ? 2 : 5);
    const rows = Math.ceil(n / cols);
    const gap = portrait ? 26 : 26;
    const tw = portrait ? (W - 120 - gap) / cols : (W - 260 - gap * (cols - 1)) / cols;
    const th = tw * 9 / 16;
    const gw = cols * tw + (cols - 1) * gap;
    const gh = rows * th + (rows - 1) * gap;
    const gx = (W - gw) / 2;
    const gy = (o.gridY ?? (portrait ? 0.56 : 0.58)) * H - gh / 2;
    const zt = o.zoomAt !== undefined ? ease.inOutCubic(prog(t, o.zoomAt, o.end)) : 0;
    const shown = o.tiles.map((_, i) => spring(lt - 0.12 - i * (o.step ?? 0.11), { freq: 2.0, damp: 0.55 }));
    const count = shown.filter((s) => s > 0.5).length;
    // título com contador
    const fade = 1 - zt;
    if (fade > 0.01) {
      const ty = (o.titleY ?? (portrait ? 0.2 : 0.2)) * H;
      const pulse = count ? spring(lt - 0.12 - (count - 1) * (o.step ?? 0.11), { freq: 3, damp: 0.4 }) : 0;
      ctx.save();
      ctx.globalAlpha = fade;
      const num = String(Math.max(1, count));
      ctx.font = font(700, 190);
      const nw = ctx.measureText('10').width;
      ctx.font = font(700, 120);
      const fw = ctx.measureText('FASES').width;
      const gap = 34;
      const left = W / 2 - (nw + gap + fw) / 2;
      titleText(ctx, num, left + nw / 2, ty + 22, { size: 190 * (0.9 + 0.1 * pulse), fill: C.orange, strokeW: 22, alpha: clamp(lt * 4) });
      titleText(ctx, 'FASES', left + nw + gap, ty, { size: 120, strokeW: 16, align: 'left', alpha: clamp(lt * 4), letterFx: lettersPop(lt - 0.1, { stagger: 0.05 }) });
      if (o.sub) {
        const s = ease.outCubic(prog(lt, 0.6, 1.0));
        softText(ctx, o.sub, W / 2, gy + gh + 95, { size: 46, weight: 800, alpha: s });
      }
      ctx.restore();
    }
    o.tiles.forEach((tile, i) => {
      const s = shown[i];
      if (s <= 0.001) return;
      const r = Math.floor(i / cols);
      const c = i % cols;
      let x = gx + c * (tw + gap);
      let y = gy + r * (th + gap);
      let w = tw;
      let h = th;
      let alpha = clamp(s * 2);
      const isZ = o.zoomTo === i;
      if (zt > 0) {
        if (isZ) { x = lerp(x, 0, zt); y = lerp(y, 0, zt); w = lerp(w, W, zt); h = lerp(h, H, zt); }
        else alpha *= 1 - zt;
      }
      const img = imgOf(tile.clip, (tile.in ?? 0) + lt * (tile.speed ?? 1));
      ctx.save();
      ctx.globalAlpha = alpha;
      const sc = isZ && zt > 0 ? 1 : lerp(0.6, 1, s);
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(isZ && zt > 0 ? 0 : (1 - s) * (i % 2 ? 0.12 : -0.12));
      ctx.scale(sc, sc);
      const rad = lerp(18, 0, isZ ? zt : 0);
      const bw = lerp(7, 0, isZ ? zt : 0);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 10;
      roundRect(ctx, -w / 2 - bw, -h / 2 - bw, w + bw * 2, h + bw * 2, rad + bw);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      roundRect(ctx, -w / 2, -h / 2, w, h, rad);
      ctx.clip();
      if (img) {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const k = Math.max(w / iw, h / ih);
        ctx.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
      } else {
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
      // número da fase
      if (!(isZ && zt > 0.3)) {
        ctx.save();
        ctx.globalAlpha = alpha * (isZ ? 1 - zt * 3 : 1);
        const bx = x + (w / 2) - (w / 2) * sc + 4;
        const by = y + (h / 2) - (h / 2) * sc + 4;
        ctx.beginPath();
        ctx.arc(bx + 22, by + 22, 26 * s, 0, Math.PI * 2);
        ctx.fillStyle = C.orange;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.cream;
        ctx.stroke();
        ctx.fillStyle = C.cream;
        ctx.font = font(700, 28);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(tile.label ?? i + 1), bx + 22, by + 24);
        ctx.restore();
      }
    });
  }

  function drawEndCard(o, t) {
    const lt = t - o.start;
    particles(ctx, lt, { kind: 'paws', mode: 'rain', seed: 21, n: 26, w: W, y: -40, speed: 260, size: 18, life: o.end - o.start, colors: [C.cream], alpha: 0.12 });
    // retratos nas laterais (no 9:16, em cima)
    (o.portraits || []).forEach((p, i) => {
      const s = spring(lt - 0.45 - i * 0.12, { freq: 1.7, damp: 0.6 });
      if (s <= 0) return;
      const who = WHO[p.who] || WHO.radhija;
      const r = 150;
      const x = portrait ? W / 2 + (i ? 190 : -190) : i ? W - 300 : 300;
      const y = portrait ? H * 0.2 : H * 0.62;
      const xx = x + (1 - s) * (i ? 1 : -1) * 260;
      const img = imgOf(p.clip, (p.in ?? 0) + lt * (p.speed ?? 1));
      ctx.save();
      ctx.globalAlpha = clamp(s * 2);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(xx, y, r + 12, 0, Math.PI * 2);
      ctx.fillStyle = who.color;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      ctx.arc(xx, y, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(xx, y, r - 2, 0, Math.PI * 2);
      ctx.clip();
      if (img) {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const k = ((r * 2) / Math.min(iw, ih)) * (p.zoom ?? 1.6);
        const f = p.focus || [0.5, 0.4];
        ctx.drawImage(img, xx - iw * k * f[0], y - ih * k * f[1], iw * k, ih * k);
      }
      ctx.restore();
      softText(ctx, p.name, xx, y + r + 62, { size: 40, weight: 900, alpha: clamp(s * 2), color: C.cream });
    });
    const S = portrait ? 1 : 1;
    const yLogo = portrait ? H * 0.42 : H * 0.27;
    drawLogo({ start: o.start, end: o.end + 10, size: portrait ? 140 : 118, y: yLogo / H, lines: portrait ? ['Radhija &', 'Rhaenyra'] : null, noBurst: false }, t);
    const yDemo = portrait ? H * 0.555 : H * 0.45;
    const sDemo = spring(lt - 0.9, { freq: 1.9, damp: 0.55 });
    if (sDemo > 0) pill(ctx, 'DEMO · 10 FASES', W / 2, yDemo, { size: 40 * S, weight: 900, tracking: 4, bg: C.orange, fg: C.cream, scale: lerp(0.6, 1, sDemo), alpha: clamp(sDemo * 2), icon: (c, x, y, r, col) => bone(c, x, y, r * 0.85, col, -0.4), iconColor: C.cream });
    const sPlay = ease.outCubic(prog(lt, 1.35, 1.75));
    softText(ctx, 'Jogue grátis no navegador', W / 2, (portrait ? H * 0.635 : H * 0.585) + (1 - sPlay) * 16, { size: portrait ? 50 : 50, weight: 900, alpha: sPlay });
    const sUrl = spring(lt - 1.7, { freq: 1.8, damp: 0.6 });
    if (sUrl > 0) {
      pill(ctx, o.url || 'raposocampos.github.io/radhija-rhaenyra', W / 2, portrait ? H * 0.69 : H * 0.675, {
        size: portrait ? 34 : 40, weight: 800, bg: C.cream, fg: C.ink, border: C.orange, borderW: 5, scale: lerp(0.7, 1, sUrl), alpha: clamp(sUrl * 2),
      });
    }
    // teclado · controle · celular
    const items = [['Teclado', keyboardIcon], ['Controle', gamepadIcon], ['Celular', phoneIcon]];
    const yI = portrait ? H * 0.79 : H * 0.855;
    const gapI = portrait ? 300 : 280;
    items.forEach(([label, icon], i) => {
      const s = spring(lt - 2.1 - i * 0.12, { freq: 2, damp: 0.55 });
      if (s <= 0) return;
      const x = W / 2 + (i - 1) * gapI;
      ctx.save();
      ctx.globalAlpha = clamp(s * 2);
      ctx.translate(x, yI);
      ctx.scale(s, s);
      icon(ctx, -70, 0, 30, C.cream);
      ctx.restore();
      softText(ctx, label, x - 28, yI + 13, { size: 36, weight: 900, align: 'left', alpha: clamp(s * 2) });
    });
  }

  function drawOverlay(o, t) {
    switch (o.type) {
      case 'caption': return drawCaption(o, t);
      case 'logo': return drawLogo(o, t);
      case 'nameCard': return drawNameCard(o, t);
      case 'skill': return drawSkill(o, t);
      case 'phaseTag': return drawPhaseTag(o, t);
      case 'bigTitle': return drawBigTitle(o, t);
      case 'mosaic': return drawMosaic(o, t);
      case 'endCard': return drawEndCard(o, t);
      case 'particles': return particles(ctx, t - o.start, { ...o, w: W, x: (o.x ?? 0.5) * W, y: (o.y ?? 0.5) * H });
      case 'shade': return shade(ctx, W, H, o.side, (o.k ?? 0.5) * clamp((t - o.start) / 0.3) * exitK(t, o.end, 0.3), o.size ?? 0.5);
      case 'flash': {
        const k = prog(t, o.start, o.end);
        ctx.fillStyle = o.color || '#FFF8EC';
        ctx.globalAlpha = Math.pow(1 - k, 2) * (o.k ?? 0.5);
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        return null;
      }
      case 'fade': {
        const k = o.mode === 'out' ? ease.inOutCubic(prog(t, o.start, o.end)) : 1 - ease.inOutCubic(prog(t, o.start, o.end));
        ctx.fillStyle = o.color || '#000';
        ctx.globalAlpha = k;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        return null;
      }
      default: return null;
    }
  }

  async function seek(t, frame = 0) {
    await load(needs(t));
    ctx.save();
    ctx.fillStyle = '#120a06';
    ctx.fillRect(0, 0, W, H);
    // cenas por trilha (0 embaixo), mais antigas primeiro
    const vis = segs.filter((s) => visible(s, t)).sort((a, b) => (a.track ?? 0) - (b.track ?? 0) || a.start - b.start);
    for (const s of vis) {
      const nxt = segs.filter((q) => (q.track ?? 0) === (s.track ?? 0) && q.start > s.start).sort((a, b) => a.start - b.start)[0];
      drawSeg(s, t, nxt);
    }
    const layers = overlays.filter((o) => (o.layer ?? 0) === 0);
    for (const o of layers) if (t >= o.start && t < o.end) { ctx.save(); drawOverlay(o, t); ctx.restore(); }
    vignette(ctx, W, H, timeline.vignette ?? 0.28);
    for (const o of overlays.filter((q) => (q.layer ?? 0) === 1)) if (t >= o.start && t < o.end) { ctx.save(); drawOverlay(o, t); ctx.restore(); }
    grain(ctx, W, H, frame, timeline.grain ?? 0.014);
    ctx.restore();
  }

  return { seek, segs, W, H };
}
