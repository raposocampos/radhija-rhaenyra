// Página de montagem: carrega a linha do tempo do formato (?formato=16x9 | 9x16), o índice das cenas e as fontes, e
// expõe window.__seek(t, quadro) → JPEG do quadro e window.__audio() → trilha em WAV (base64).
import { createComposer } from './compose.js';
import { renderSoundtrack } from './soundtrack.js';
import { gameSoundsFor } from './timeline-util.js';
import tl16 from './timeline-16x9.js';
import tl9 from './timeline-9x16.js';

const params = new URLSearchParams(location.search);
const timeline = params.get('formato') === '9x16' ? tl9 : tl16;
const FRAMES = '../../shots/trailer/frames';

async function boot() {
  const index = await (await fetch(`${FRAMES}/index.json`)).json();
  await Promise.all([
    'Fredoka:500', 'Fredoka:600', 'Fredoka:700', 'Nunito:700', 'Nunito:800', 'Nunito:900',
  ].map((f) => {
    const [fam, w] = f.split(':');
    return document.fonts.load(`${w} 40px "${fam}"`, 'Ãç&áéíóú');
  }));
  const canvas = document.getElementById('c');
  const comp = createComposer({ canvas, timeline, index, base: FRAMES });
  window.__seek = async (t, frame, quality = 0.96) => {
    await comp.seek(t, frame);
    return canvas.toDataURL('image/jpeg', quality);
  };
  window.__plan = () => ({
    id: timeline.id, width: timeline.width, height: timeline.height, duration: timeline.duration,
    segs: comp.segs.map((s) => ({ clip: s.clip, start: s.start, end: s.end, in: +s.in.toFixed(3), speed: s.speed, tr: s.tr?.type ?? null, missing: s.missing })),
    overlays: timeline.overlays.map((o) => ({ type: o.type, start: o.start, end: o.end, text: o.text ?? o.name ?? o.sub ?? null })),
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`),
  });
  window.__audio = async () => {
    const segs = comp.segs;
    const cues = [...(timeline.cues || [])];
    // sopro em cada transição com movimento; pop quando um texto entra
    for (const s of segs) {
      if (!s.tr || s.tr.type === 'cut' || s.tr.type === 'fade') continue;
      const len = Math.max(0.3, (s.tr.dur || 0.3) + 0.15);
      cues.push({ type: 'whoosh', t: Math.max(0, s.start - len * 0.45), len, vel: s.tr.type === 'whip' ? 0.3 : 0.22, dir: s.tr.dir ?? 1 });
    }
    for (const o of timeline.overlays) {
      if (['skill', 'phaseTag', 'nameCard'].includes(o.type)) cues.push({ type: 'pop', t: o.start + 0.02, vel: 0.2, pitch: o.type === 'phaseTag' ? 1.25 : 1 });
      if (o.type === 'mosaic') for (let i = 0; i < (o.tiles?.length || 0); i++) cues.push({ type: 'pop', t: o.start + 0.12 + i * (o.step ?? 0.11), vel: 0.16, pitch: 0.8 + i * 0.06 });
    }
    const gameSounds = gameSoundsFor(segs, index);
    return renderSoundtrack({ duration: timeline.duration + 0.5, form: timeline.form, cues, gameSounds });
  };
  window.__ready = true;
}
boot().catch((e) => { console.error(e); window.__failed = String(e.stack || e); });
