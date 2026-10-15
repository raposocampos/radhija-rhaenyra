// Progresso salvo no navegador (localStorage, sempre com try/catch: sem storage o jogo segue sem salvar).
// Formato: { v: 1, levels: { [id da fase]: { done, best (s), treats, total, clears } } }.
export const PROG_KEY = 'rr-progress-v1';

export function loadProgress() {
  try {
    const o = JSON.parse(localStorage.getItem(PROG_KEY) || 'null');
    if (o && typeof o === 'object' && o.levels && typeof o.levels === 'object') return o;
  } catch (_) { /* sem storage ou JSON inválido */ }
  return { v: 1, levels: {} };
}
export function saveProgress(p) {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (_) { /* sem storage */ }
}

/**
 * Registra a vitória numa fase (relê o progresso antes: outra aba pode ter salvo) e salva.
 * → { prog (progresso atualizado), rec: { best, record, first, prevTreats } }
 */
export function recordLevelClear(id, d, fallbackTotal) {
  const prog = loadProgress();
  const e = prog.levels[id] || {};
  const t = Number(d.timeSec);
  const prevBest = Number.isFinite(e.best) ? e.best : null;
  const better = Number.isFinite(t) && (prevBest === null || t < prevBest);
  prog.levels[id] = {
    done: true,
    best: better ? t : prevBest,
    treats: Math.max(e.treats ?? 0, d.collected ?? 0),
    total: d.total ?? e.total ?? fallbackTotal,
    clears: (e.clears || 0) + 1,
  };
  saveProgress(prog);
  return { prog, rec: { best: prog.levels[id].best, record: better && prevBest !== null, first: !e.done, prevTreats: e.treats ?? null } };
}
