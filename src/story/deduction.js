// A árvore de pistas do Modo História (pedido do usuário em 2026-11-10: "aperta um botão e aparece uma árvore com as
// pistas", no estilo dos jogos do Sherlock Holmes). É o estado do quadro de dedução; o desenho fica em src/story/ui.
//  - No topo, a pergunta-raiz do capítulo. Dela descem as perguntas (nós), que aparecem quando a história as faz
//    (ask). Cada pergunta tem as pistas que se ligam a ela (ids de src/story/clues.js).
//  - Com todas as pistas necessárias achadas, uma pergunta com opções fica "pronta": o jogador escolhe a conclusão no
//    quadro (ui:storyDeduce). A certa vira conclusão; a errada só treme e volta.
//  - Algumas perguntas se resolvem pela própria história (resolve), sem escolha.
// Avisa o desenho com `story:board` (o estado inteiro) a cada mudança, `story:question` quando aparece uma pergunta e
// `story:deduceWrong` no erro (os sons do certo e do errado são do quadro). Quem usa ouve onResolve para seguir a
// missão (a conclusão certa pode abrir uma cena).
import { CLUES } from './clues.js';
import { pictoOf } from './ui/pictos.js';

/**
 * @typedef {{ id: string, text: string, clues: string[], need?: number, options?: string[], answer?: number,
 *   conclusion: string }} QuestionDef
 */

/** A pergunta-raiz e as perguntas do capítulo 1, na ordem em que a história costuma fazê-las. */
export const CHAPTER1_BOARD = {
  root: 'O que aconteceu com a cenoura?',
  /** @type {QuestionDef[]} */
  questions: [
    {
      id: 'quem', text: 'Quem entrou no quarto de noite?', clues: ['trilha', 'pote', 'pena'], need: 3,
      options: ['Foram os pombos!', 'Foi o vento da garoa.', 'Foi um gato da rua.'], answer: 0,
      conclusion: 'Foram os pombos! Entraram pela janela.',
    },
    {
      id: 'onde', text: 'Para onde os pombos levaram a cenoura?', clues: ['pombos'],
      conclusion: 'Para o varal… e de lá, para a torre!',
    },
    {
      id: 'borracha', text: 'Por que os pombos pegam coisas de borracha?', clues: ['boia', 'ralo'], need: 2,
      options: ['Estão juntando borracha para alguma coisa.', 'Pombos comem borracha.', 'Querem brincar na piscina.'], answer: 0,
      conclusion: 'Estão juntando borracha… mas para quê?',
    },
    {
      id: 'senha', text: 'Como os pombos entram na torre?', clues: ['senha'], need: 1,
      options: ['Sino, osso, nota.', 'Osso, nota, sino.', 'Nota, sino, osso.'], answer: 0,
      conclusion: 'O Farelo sabe a senha: sino, osso, nota!',
    },
    {
      id: 'tempestade', text: 'O que a tempestade estragou?', clues: ['telhas'],
      conclusion: '',
    },
    {
      id: 'rua', text: 'Para onde os pombos voaram pela rua?', clues: [],
      conclusion: '',
    },
  ],
};

/**
 * @param {{ emit?: (name: string, payload?: object) => void, book: { has(id: string): boolean },
 *   board?: typeof CHAPTER1_BOARD, onResolve?: (id: string) => void }} opts
 */
export function createDeduction({ emit = () => {}, book, board = CHAPTER1_BOARD, onResolve = () => {} }) {
  const defs = new Map(board.questions.map((q) => [q.id, q]));
  /** As perguntas já feitas, na ordem, e as resolvidas. */
  let asked = [];
  let solved = new Set();

  const ready = (q) => !!q.options && !solved.has(q.id) && q.clues.filter((id) => book.has(id)).length >= (q.need ?? q.clues.length);
  const stateOf = (q) => (solved.has(q.id) ? 'resolvida' : ready(q) ? 'pronta' : 'aberta');

  /** O estado inteiro, como o desenho recebe. */
  function state(fresh = null) {
    return {
      root: { text: board.root },
      nodes: asked.map((id) => {
        const q = defs.get(id);
        const st = stateOf(q);
        return {
          id, text: q.text, state: st, conclusion: st === 'resolvida' ? q.conclusion || null : null,
          options: st === 'pronta' ? q.options.slice() : undefined,
          need: q.need ?? q.clues.length,
          clues: q.clues.filter((c) => book.has(c)).map((c) => ({ id: c, picto: pictoOf(c), text: CLUES[c]?.text ?? CLUES[c]?.name ?? c })),
        };
      }),
      ...(fresh ? { fresh } : {}),
    };
  }
  const send = (fresh = null) => emit('story:board', state(fresh));

  return {
    /** A história faz a pergunta (aparece no quadro e no letreiro). silent: sem letreiro (pular cena, etapas de teste). */
    ask(id, { silent = false } = {}) {
      const q = defs.get(id);
      if (!q || asked.includes(id)) return false;
      asked.push(id);
      if (!silent) emit('story:question', { id, text: q.text });
      send();
      return true;
    },
    /** A história responde (sem escolha no quadro). */
    resolve(id, { silent = false } = {}) {
      const q = defs.get(id);
      if (!q || solved.has(id)) return false;
      if (!asked.includes(id)) asked.push(id);
      solved.add(id);
      send();
      if (!silent) onResolve(id);
      return true;
    },
    /** O jogador escolheu a conclusão `option` para a pergunta `id`. Devolve true se acertou. */
    deduce(id, option) {
      const q = defs.get(id);
      if (!q || !asked.includes(id) || !ready(q)) return false;
      if (option !== q.answer) {
        emit('story:deduceWrong', { node: id });
        return false;
      }
      solved.add(id);
      send(id);
      onResolve(id);
      return true;
    },
    /** Uma pista nova entrou: refaz o quadro (fresh = a pista nova). */
    sync(fresh = null) { send(fresh); },
    isAsked: (id) => asked.includes(id),
    isSolved: (id) => solved.has(id),
    isReady: (id) => { const q = defs.get(id); return !!q && asked.includes(id) && ready(q); },
    /** A pergunta pronta para deduzir mais antiga (para a dica), ou null. */
    get pending() { return asked.find((id) => ready(defs.get(id))) ?? null; },
    state,
    reset() { asked = []; solved = new Set(); send(); },
    snapshot() { return { asked: asked.slice(), solved: [...solved] }; },
  };
}
