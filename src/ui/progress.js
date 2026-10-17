// Progresso salvo no navegador. Sem storage, a partida segue sem persistir.
// Mantém formato/chave v1; uma versão declarada desconhecida nunca é sobrescrita.
import { storageKey } from '../game/storageKey.js';
export const PROG_KEY = storageKey('rr-progress-v1');

/** @typedef {{ done: boolean, best: number | null, treats: number, total: number | null, clears: number }} LevelProgress */
/** @typedef {{ v: 1, levels: Record<string, LevelProgress> }} Progress */

/** @returns {Progress} */
function emptyProgress() { return { v: 1, levels: {} }; }

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** @param {unknown} value @returns {value is number} */
function isCount(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }

/** @param {unknown} value @returns {value is number} */
function isTime(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }

/** @param {unknown} value @returns {LevelProgress | null} */
function normalizeLevel(value) {
  if (!isRecord(value)) return null;
  const treats = isCount(value.treats) ? value.treats : 0;
  return {
    done: value.done === true,
    best: isTime(value.best) ? value.best : null,
    treats,
    // Sem total conhecido, a UI usa o total da fase. Não apagar petiscos já obtidos.
    total: isCount(value.total) ? Math.max(value.total, treats) : null,
    clears: isCount(value.clears) ? value.clears : 0,
  };
}

/** @param {unknown} value @returns {Progress | null} */
function normalizeProgress(value) {
  if (!isRecord(value) || value.v !== 1 || !isRecord(value.levels)) return null;
  const entries = [];
  for (const [id, entry] of Object.entries(value.levels)) {
    const level = normalizeLevel(entry);
    if (id && level) entries.push([id, level]);
  }
  // Não filtrar pelo registro atual de fases: saves podem conter fases de outra versão.
  return { v: 1, levels: Object.fromEntries(entries) };
}

function readProgress() {
  try {
    const raw = localStorage.getItem(PROG_KEY);
    let value;
    try { value = JSON.parse(raw || 'null'); } catch (_) { /* JSON corrompido: pode começar um save novo. */ }
    const unsupported = isRecord(value) && Object.hasOwn(value, 'v') && value.v !== 1;
    return { prog: normalizeProgress(value) ?? emptyProgress(), writable: !unsupported };
  } catch (_) {
    // Uma leitura negada não prova que o save está vazio: não tentar gravar sobre ele.
    return { prog: emptyProgress(), writable: false };
  }
}

export function loadProgress() { return readProgress().prog; }

/** Valida antes de escrever; false indica storage indisponível ou versão não suportada. */
export function saveProgress(p) {
  try {
    const prog = normalizeProgress(p);
    // Relê a versão: outra aba pode ter escrito um formato mais novo desde loadProgress().
    if (!prog || !readProgress().writable) return false;
    localStorage.setItem(PROG_KEY, JSON.stringify(prog));
    return true;
  } catch (_) { return false; }
}

/**
 * Registra a vitória numa fase (relê o progresso antes: outra aba pode ter salvo) e salva.
 * → { prog, rec: { best, record, first, prevTreats }, saved }
 * Em versão desconhecida/storage indisponível, atualiza apenas a cópia em memória.
 */
export function recordLevelClear(id, d, fallbackTotal) {
  const { prog, writable } = readProgress();
  if (typeof id !== 'string' || !id) {
    return { prog, rec: { best: null, record: false, first: false, prevTreats: null }, saved: false };
  }
  const e = Object.hasOwn(prog.levels, id) ? prog.levels[id] : null;
  const data = isRecord(d) ? d : {};
  const t = isTime(data.timeSec) ? data.timeSec : null;
  const prevBest = e?.best ?? null;
  const better = t !== null && (prevBest === null || t < prevBest);
  const treats = Math.max(e?.treats ?? 0, isCount(data.collected) ? data.collected : 0);
  const total = isCount(data.total) ? data.total : (e?.total ?? (isCount(fallbackTotal) ? fallbackTotal : null));
  const level = {
    done: true,
    best: better ? t : prevBest,
    treats,
    total: total === null ? null : Math.max(total, treats),
    clears: Math.min(e?.clears ?? 0, Number.MAX_SAFE_INTEGER - 1) + 1,
  };
  // Chave calculada cria propriedade própria, inclusive para IDs como "__proto__".
  prog.levels = { ...prog.levels, [id]: level };
  const saved = writable && saveProgress(prog);
  return { prog, rec: { best: level.best, record: better && prevBest !== null, first: !e?.done, prevTreats: e?.treats ?? null }, saved };
}
