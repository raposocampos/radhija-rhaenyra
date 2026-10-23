// Utilidades da linha do tempo, usadas na página (desenho) e no Node (sons e lista de cenas). Sem DOM.

/** Compasso (1 em diante) e tempo (0..3, frações) → segundos, a 120 BPM. */
export const B = (bar, beat = 0) => (bar - 1) * 2 + beat * 0.5;

/** Tempo de uma marca da cena (index.json) ou null. */
export function markTime(index, clip, name) {
  const m = index?.[clip]?.marks?.find((k) => k.name === name);
  return m ? m.t : null;
}

/**
 * Resolve os trechos de cena: o ponto de entrada (in) pode vir de uma marca alinhada a um instante da linha do tempo
 * (sync: { mark, at } — a marca cai em `at`) e cada trecho fica visível até o fim da transição do seguinte.
 */
export function resolveSegments(clips, index) {
  const segs = clips.map((c, i) => {
    const speed = c.speed ?? 1;
    let inT = typeof c.in === 'number' ? c.in : 0;
    if (c.sync) {
      const m = markTime(index, c.clip, c.sync.mark);
      if (m !== null) inT = m - (c.sync.at - c.start) * speed + (c.sync.offset ?? 0);
      else inT = c.sync.fallback ?? inT;
    }
    const meta = index?.[c.clip];
    const len = meta ? meta.frames / (meta.fps || 30) : null;
    // não deixa o trecho passar do fim da cena gravada
    if (len !== null) {
      const need = (c.end - c.start) * speed;
      if (inT + need > len - 1 / 30) inT = Math.max(0, len - 1 / 30 - need);
      if (inT < 0) inT = 0;
    }
    return { ...c, i, speed, in: inT, drawEnd: c.end, missing: !meta };
  });
  const byTrack = new Map();
  for (const s of segs) {
    const k = s.track ?? 0;
    if (!byTrack.has(k)) byTrack.set(k, []);
    byTrack.get(k).push(s);
  }
  for (const list of byTrack.values()) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const tr = list[i].tr;
      if (tr?.dur) list[i - 1].drawEnd = Math.max(list[i - 1].drawEnd, list[i].start + tr.dur);
    }
  }
  return segs;
}

/** Tempo da cena gravada no instante t da linha do tempo. */
export function clipTime(seg, t) {
  return seg.in + (t - seg.start) * seg.speed;
}

/** Sons do jogo das cenas, levados para a linha do tempo (só no trecho visível de cada cena, sem os mudos). */
export function gameSoundsFor(segs, index) {
  const out = [];
  for (const s of segs) {
    if (s.mute || s.missing) continue;
    const meta = index[s.clip];
    for (const snd of meta.sounds || []) {
      if (snd.loop) continue;
      const t = s.start + (snd.t - s.in) / s.speed;
      if (t < s.start - 0.02 || t > s.end) continue;
      out.push({ ...snd, t, gain: s.gameGain ?? 1, pitch: (snd.pitch ?? 1) * (s.speed !== 1 ? Math.pow(s.speed, 0.15) : 1) });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Cenas usadas por um formato (para decodificar só o necessário). */
export function clipsUsed(tl) {
  const set = new Set(tl.clips.map((c) => c.clip));
  for (const o of tl.overlays) {
    for (const k of o.tiles || []) set.add(k.clip);
    for (const k of o.portraits || []) set.add(k.clip);
  }
  return [...set];
}
