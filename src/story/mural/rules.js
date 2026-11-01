// Regras do mural de pistas (puras: sem DOM, sem three; testadas em Node, test/historia-regras.test.mjs).
// Roteiro em docs/HISTORIA.md ("Mural de pistas" e "Como se fecha um caso"):
//  - os casos 1 e 2 fecham ligando um cartão a cada pergunta (quem, como, por quê);
//  - o caso 3 fecha com a linha do tempo da noite da garoa: cinco cartões em ordem, da lua ao sol;
//  - uma ligação errada faz o cartão voltar (e conta um erro): só o caso fechado sem erro ganha o carimbo dourado;
//  - o caso só fecha com as pistas necessárias (um cartão que a jogadora ainda não achou deixa a casa vazia).
// O mural provisório do fim do capítulo 1 usa só o caso 3, com os cartões achados até ali: a casa do cartão que só
// chega num capítulo futuro fica com o "?", e o caso continua aberto.

/**
 * @typedef {{ id: string, kind: 'linha', slots: string[] }} TimelineCase  slots: o cartão certo de cada casa, em ordem
 * @typedef {{ id: string, kind: 'perguntas', questions: Record<string, string> }} QuestionCase  questions: pergunta → cartão certo
 * @typedef {TimelineCase | QuestionCase} CaseRule
 */

/** O caso 3: a linha do tempo da noite da garoa (a casa 2 é o cartão desenhado que só chega no cap. 8). */
/** @type {TimelineCase} */
export const CASE3_TIMELINE = { id: 'C3', kind: 'linha', slots: ['pombos', 'zzz', 'pote', 'trilha', 'abraco'] };

/**
 * Um caso do mural com os cartões que a jogadora tem. place() tenta ligar um cartão a uma casa (o índice da linha do
 * tempo ou o nome da pergunta) e devolve { ok, reason }: 'certo', 'errado' (o cartão volta e conta um erro), 'ocupada',
 * 'sem-cartao' (a jogadora não tem esse cartão), 'fechado' ou 'casa-invalida'.
 * @param {CaseRule} rule
 * @param {{ owned: Iterable<string> }} opts
 */
export function createCaseBoard(rule, { owned }) {
  const have = new Set(owned);
  const keys = rule.kind === 'linha' ? rule.slots.map((_, i) => String(i)) : Object.keys(rule.questions);
  const answer = (key) => (rule.kind === 'linha' ? rule.slots[Number(key)] : rule.questions[key]);
  /** @type {Record<string, string | null>} */
  const placed = Object.fromEntries(keys.map((k) => [k, null]));
  let errors = 0;
  let closedAt = null;

  const isPlaced = (card) => Object.values(placed).includes(card);
  /** As casas cujo cartão certo a jogadora ainda não tem (a casa do "?"). */
  const missing = () => keys.filter((k) => !have.has(answer(k)));
  /** Fechado: todas as casas com o cartão certo. */
  const complete = () => keys.every((k) => placed[k] === answer(k));

  return {
    keys,
    /** @param {string} card @param {string | number} slot */
    place(card, slot) {
      const key = String(slot);
      if (closedAt !== null) return { ok: false, reason: 'fechado' };
      if (!keys.includes(key)) return { ok: false, reason: 'casa-invalida' };
      if (!have.has(card) || isPlaced(card)) return { ok: false, reason: 'sem-cartao' };
      if (placed[key] !== null) return { ok: false, reason: 'ocupada' };
      if (answer(key) !== card) {
        errors++;
        return { ok: false, reason: 'errado' };
      }
      placed[key] = card;
      if (complete()) closedAt = errors;
      return { ok: true, reason: 'certo', closed: closedAt !== null };
    },
    /** Os cartões que ainda dá para pôr (os que ela tem, do caso, fora do mural). */
    loose() { return keys.map(answer).filter((c) => have.has(c) && !isPlaced(c)); },
    missing,
    get placed() { return { ...placed }; },
    get errors() { return errors; },
    /** O caso fecha só com todas as pistas necessárias, cada uma no lugar. */
    get closed() { return closedAt !== null; },
    /** Carimbo: null (aberto), 'dourado' (fechado sem erro) ou 'comum'. */
    get stamp() { return closedAt === null ? null : closedAt === 0 ? 'dourado' : 'comum'; },
    /** Tudo o que dá para pôr já está no lugar (no provisório: só falta o cartão que ela não tem). */
    get settled() { return this.loose().length === 0; },
  };
}
