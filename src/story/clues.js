// Pistas do Modo História: o catálogo (o que cada pista é, de que caso, de que tipo, que desenho vira no cartão) e a
// lupa (createClueBook), que guarda as achadas. Roteiro em docs/HISTORIA.md ("Pistas" e "Os três casos").
// Tipos, com os nomes do roteiro: 'obrigatoria' (no caminho principal), 'cena' (chega numa cena), 'escondida' (Faro,
// enigma ou observação; conta para o caso perfeito), 'falsa' (volta quando ligada à pergunta errada). "Necessária" é
// uma propriedade do caso (src/story/mural/rules.js), não do cartão.
// Nada aqui tem texto de segredo; os nomes curtos aparecem só na lupa e no mural, nunca em cena.

/** @typedef {'C1' | 'C2' | 'C3'} CaseId */
/** @typedef {'obrigatoria' | 'cena' | 'escondida' | 'falsa'} ClueType */
/** @typedef {{ id: string, case: CaseId, type: ClueType, name: string, picto: string, chapter: number, support?: boolean }} ClueDef */

/** Os casos do mural (nomes do roteiro). */
export const CASES = {
  C1: { id: 'C1', name: 'O caso da borracha sumida' },
  C2: { id: 'C2', name: 'O relógio parado' },
  C3: { id: 'C3', name: 'A noite da cenoura' },
};

/** @type {Record<string, ClueDef>} */
export const CLUES = {
  // caso 3, a noite da cenoura (abertura)
  pombos: { id: 'pombos', case: 'C3', type: 'cena', name: 'Pombos encharcados no parapeito', picto: 'pombos', chapter: 1 },
  abraco: { id: 'abraco', case: 'C3', type: 'cena', name: 'O abraço da manhã', picto: 'abraco', chapter: 1 },
  pote: { id: 'pote', case: 'C3', type: 'obrigatoria', name: 'O pote virado', picto: 'pote', chapter: 1 },
  trilha: { id: 'trilha', case: 'C3', type: 'obrigatoria', name: 'A trilha laranja da cama até a janela', picto: 'trilha', chapter: 1 },
  pena: { id: 'pena', case: 'C3', type: 'obrigatoria', name: 'A pena molhada no parapeito', picto: 'pena', chapter: 1, support: true },
  baba: { id: 'baba', case: 'C3', type: 'escondida', name: 'Baba no parapeito, do lado de dentro', picto: 'baba', chapter: 1, support: true },
  // caso 2, o relógio parado
  telhas: { id: 'telhas', case: 'C2', type: 'obrigatoria', name: 'Galhos e telhas da tempestade', picto: 'telhas', chapter: 1 },
  // caso 1, a borracha sumida
  boia: { id: 'boia', case: 'C1', type: 'obrigatoria', name: 'Um pombo levando a boia de patinho murcha', picto: 'boia', chapter: 1 },
  ralo: { id: 'ralo', case: 'C1', type: 'escondida', name: 'O ralo do tanque sem a rolha', picto: 'ralo', chapter: 1 },
};

/** As pistas do capítulo 1, na ordem em que costumam aparecer. */
export const CHAPTER1_CLUES = ['pombos', 'abraco', 'pote', 'trilha', 'pena', 'baba', 'telhas', 'boia', 'ralo'];

/**
 * A lupa: guarda as pistas achadas (por id, na ordem em que chegaram). add(id) devolve true só na primeira vez e
 * avisa (`story:clue`), com o tipo e o caso, para o HUD mostrar o cartão voando para a lupa.
 * @param {{ emit?: (name: string, payload?: object) => void }} [opts]
 */
export function createClueBook({ emit = () => {} } = {}) {
  /** @type {string[]} */
  let found = [];
  const has = (id) => found.includes(id);
  return {
    /** @param {string} id @param {{ x?: number, y?: number, z?: number, silent?: boolean }} [at] */
    add(id, at = {}) {
      const def = CLUES[id];
      if (!def || has(id)) return false;
      found.push(id);
      if (!at.silent) emit('story:clue', { id, case: def.case, type: def.type, name: def.name, picto: def.picto, count: found.length, x: at.x, y: at.y, z: at.z });
      return true;
    },
    has,
    /** As achadas, na ordem. */
    get found() { return found.slice(); },
    get count() { return found.length; },
    /** Quantas escondidas deste capítulo já foram achadas (o caso perfeito, sem texto de segredo). */
    hidden(chapter = 1) {
      const all = Object.values(CLUES).filter((c) => c.chapter === chapter && c.type === 'escondida');
      return { found: all.filter((c) => has(c.id)).length, total: all.length };
    },
    /** As achadas de um caso. @param {CaseId} caseId */
    ofCase(caseId) { return found.filter((id) => CLUES[id].case === caseId); },
    reset() { found = []; },
    /** Para o estado da partida (testes e depuração). */
    snapshot() { return found.slice(); },
  };
}
