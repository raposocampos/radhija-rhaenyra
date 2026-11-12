// A árvore de pistas do Modo História (pedido do usuário em 2026-11-10: "aperta um botão e aparece uma árvore com as
// pistas", no estilo dos jogos do Sherlock Holmes; em 2026-11-11: "deixar ele mais de detetive ainda"). É o estado do
// quadro de dedução; o desenho fica em src/story/ui/board.js.
//  - No topo, a pergunta-raiz do capítulo. Dela descem as perguntas (nós), que aparecem quando a história as faz (ask).
//  - LIGAR AS PISTAS É DO JOGADOR: a pista achada cai na bandeja de "Achados" (tray), solta. O jogador escolhe a pista
//    e a pergunta a que ela pertence (ui:storyLink → link). Certa: o fio acende e a pista encaixa embaixo da pergunta.
//    Errada: "não tem a ver" (story:linkWrong), sem custo, e a pista continua na bandeja. Uma pista pode servir a mais
//    de uma pergunta: `clues` são as necessárias de cada pergunta e `extra` as que também servem (opcionais).
//  - DEPOIMENTOS (pistas do tipo 'depoimento', src/story/clues.js): o que alguém disse. Alguns podem ser confrontados
//    com uma pista que os contradiz (ui:storyConfront → confront). Se o par está em `contradictions`, sai um "insight":
//    uma pergunta nova ou uma pista nova (story:insight); se não, story:confrontWrong (tremidinha, sem custo).
//  - Com TODAS as pistas necessárias LIGADAS, uma pergunta com opções fica "pronta": o jogador escolhe a conclusão
//    (ui:storyDeduce → deduce). A certa vira conclusão; a errada só treme e volta (story:deduceWrong).
//  - Algumas perguntas se resolvem pela própria história (resolve): as pistas necessárias já achadas se ligam sozinhas.
// Avisa o desenho com `story:board` (o estado inteiro) a cada mudança e `story:question` quando aparece uma pergunta
// (os sons do certo e do errado são do quadro). Quem usa ouve onResolve para seguir a missão (a conclusão certa pode
// abrir uma cena) e onInsight para a pergunta/pista nova de uma contradição.
import { CLUES } from './clues.js';

/**
 * @typedef {{ id: string, text: string, clues: string[], extra?: string[], options?: string[], answer?: number,
 *   conclusion: string }} QuestionDef
 *   clues: as pistas necessárias (todas ligadas = pronta); extra: as que também servem (opcionais).
 * @typedef {{ kind: 'clue' | 'question', id: string }} Insight
 * @typedef {{ testimony: string, clue: string, insight: Insight }} Contradiction
 * @typedef {{ root: string, questions: QuestionDef[], contradictions?: Contradiction[] }} BoardDef
 * @typedef {{ id: string, picto: string, text: string, type: string, name: string, who?: string, quote?: string }} CardState
 */

/** A pergunta-raiz, as perguntas do capítulo 1 (na ordem em que a história costuma fazê-las) e as contradições. */
/** @type {BoardDef} */
export const CHAPTER1_BOARD = {
  root: 'O que aconteceu com a cenoura?',
  questions: [
    {
      id: 'quem', text: 'Quem entrou no quarto de noite?', clues: ['trilha', 'pote', 'pena'], extra: ['pombos', 'abraco'],
      options: ['Foram os pombos!', 'Foi o vento da garoa.', 'Foi um gato da rua.'], answer: 0,
      conclusion: 'Foram os pombos! Entraram pela janela.',
    },
    {
      id: 'onde', text: 'Para onde os pombos levaram a cenoura?', clues: [], extra: ['dep-gansa'],
      conclusion: 'Para o varal… e de lá, para a torre!',
    },
    {
      id: 'borracha', text: 'Por que os pombos pegam coisas de borracha?', clues: ['boia', 'dep-bichano'], extra: ['ralo', 'tampa', 'rabiola'],
      options: ['Para tapar uma goteira!', 'Pombos comem borracha.', 'Querem brincar na piscina.'], answer: 0,
      conclusion: 'Para tapar uma goteira… mas onde?',
    },
    {
      id: 'senha', text: 'Qual é a senha do interfone da torre?', clues: ['senha', 'dep-gansa'],
      options: ['Sino, osso, nota.', 'Sino, osso, peixe.', 'Osso, sino, nota.'], answer: 0,
      conclusion: 'A senha é sino, osso, nota!',
    },
    { id: 'rua', text: 'Para onde os pombos voaram pela rua?', clues: [], conclusion: '' },
    { id: 'tempestade', text: 'O que a tempestade estragou?', clues: ['telhas'], conclusion: '' },
    // a pergunta que sai da contradição do porteiro (aberta: gancho para depois)
    { id: 'luiz', text: 'O Sr. Luiz viu os pombos saindo?', clues: [], extra: ['dep-luiz', 'grelha'], conclusion: '' },
  ],
  contradictions: [
    { testimony: 'dep-luiz', clue: 'grelha', insight: { kind: 'question', id: 'luiz' } },
  ],
};

/** O cartão de uma pista como o quadro recebe (depoimento: quem falou, o nome e a fala). @returns {CardState} */
export function clueCard(id) {
  const c = CLUES[id];
  const card = { id, picto: c?.picto || id, text: c?.text ?? c?.name ?? id, type: c?.type || 'pista', name: c?.name ?? id };
  return c?.type === 'depoimento' ? { ...card, who: c.who, quote: c.quote } : card;
}

/**
 * @param {{ emit?: (name: string, payload?: object) => void, book: { has(id: string): boolean, found?: string[],
 *   add?: (id: string, at?: object) => boolean }, board?: BoardDef, onResolve?: (id: string) => void,
 *   onInsight?: (insight: Insight & { text: string }) => void }} opts
 */
export function createDeduction({ emit = () => {}, book, board = CHAPTER1_BOARD, onResolve = () => {}, onInsight = () => {} }) {
  const defs = new Map(board.questions.map((q) => [q.id, q]));
  const contradictions = board.contradictions || [];
  /** As perguntas já feitas (na ordem), as resolvidas, as ligações (pergunta → pistas, na ordem) e os depoimentos já
   * confrontados (com a pista certa). */
  let asked = [];
  let solved = new Set();
  /** @type {Map<string, string[]>} */
  let links = new Map();
  /** @type {Set<string>} chave `depoimento|pista` */
  let contradicted = new Set();

  const linkedTo = (node) => links.get(node) || [];
  const isLinked = (clue, node) => linkedTo(node).includes(clue);
  const fits = (q, clue) => q.clues.includes(clue) || !!q.extra?.includes(clue);
  /** Quantas das necessárias já estão ligadas. */
  const haveNeeded = (q) => q.clues.filter((c) => isLinked(c, q.id)).length;
  const ready = (q) => !!q.options && !solved.has(q.id) && haveNeeded(q) >= q.clues.length;
  const stateOf = (q) => (solved.has(q.id) ? 'resolvida' : ready(q) ? 'pronta' : 'aberta');
  /** As achadas, na ordem em que chegaram (a lupa guarda a ordem; sem ela, a ordem do catálogo). */
  const foundIds = () => (Array.isArray(book.found) ? book.found : Object.keys(CLUES).filter((id) => book.has(id)));
  const linksOf = (clue) => asked.filter((n) => isLinked(clue, n));
  const addLink = (clue, node) => {
    const l = linkedTo(node);
    if (!l.includes(clue)) links.set(node, [...l, clue]);
  };

  /**
   * O estado inteiro, como o desenho recebe:
   * { root, nodes: [{ id, text, state, conclusion, options?, need, slots, clues }], tray, found, contradicted, fresh?,
   *   link?, insight? }. tray: as achadas sem nenhuma ligação; found: todas as achadas, com as perguntas a que estão
   * ligadas (para escolher a pista de um confronto); contradicted: os depoimentos já desmentidos.
   */
  /** @param {string | null | { fresh?: string | null, link?: { clue: string, node: string }, insight?: { kind: string, id: string } }} [extra] */
  function state(extra = {}) {
    const fresh = typeof extra === 'string' ? extra : extra?.fresh ?? null;
    /** @type {{ fresh?: string | null, link?: { clue: string, node: string }, insight?: { kind: string, id: string } }} */
    const more = typeof extra === 'object' && extra ? extra : {};
    const ids = foundIds();
    return {
      root: { text: board.root },
      nodes: asked.map((id) => {
        const q = defs.get(id);
        const st = stateOf(q);
        const need = q.clues.length;
        return {
          id, text: q.text, state: st, conclusion: st === 'resolvida' ? q.conclusion || null : null,
          options: st === 'pronta' ? q.options.slice() : undefined,
          need, slots: st === 'resolvida' ? 0 : Math.max(0, need - haveNeeded(q)),
          clues: linkedTo(id).filter((c) => book.has(c)).map(clueCard),
        };
      }),
      tray: ids.filter((c) => linksOf(c).length === 0).map(clueCard),
      found: ids.map((c) => ({ ...clueCard(c), links: linksOf(c) })),
      contradicted: [...new Set([...contradicted].map((k) => k.split('|')[0]))],
      ...(fresh ? { fresh } : {}),
      ...(more.link ? { link: more.link } : {}),
      ...(more.insight ? { insight: more.insight } : {}),
    };
  }
  /** @param {Parameters<typeof state>[0]} [extra] */
  const send = (extra = {}) => emit('story:board', state(extra));

  /** A pergunta nova de uma contradição, ou a pista nova (que entra na bandeja). */
  function applyInsight(c) {
    const ins = c.insight;
    let text = '';
    if (ins.kind === 'question') {
      const q = defs.get(ins.id);
      if (!q) return null;
      if (!asked.includes(ins.id)) asked.push(ins.id);
      // o depoimento e a pista que o desmentem ficam ligados à pergunta nova (quando servem a ela)
      for (const id of [c.testimony, c.clue]) if (fits(q, id)) addLink(id, ins.id);
      text = q.text;
    } else {
      book.add?.(ins.id, { silent: true });
      text = CLUES[ins.id]?.text ?? CLUES[ins.id]?.name ?? ins.id;
    }
    return { kind: ins.kind, id: ins.id, text };
  }

  const api = {
    /** A história faz a pergunta (aparece no quadro e no letreiro). silent: sem letreiro (pular cena, etapas de teste). */
    ask(id, { silent = false } = {}) {
      const q = defs.get(id);
      if (!q || asked.includes(id)) return false;
      asked.push(id);
      if (!silent) emit('story:question', { id, text: q.text });
      send();
      return true;
    },
    /** A história responde (sem escolha no quadro): as pistas necessárias já achadas se ligam sozinhas. */
    resolve(id, { silent = false } = {}) {
      const q = defs.get(id);
      if (!q || solved.has(id)) return false;
      if (!asked.includes(id)) asked.push(id);
      for (const c of q.clues) if (book.has(c)) addLink(c, id);
      solved.add(id);
      send();
      if (!silent) onResolve(id);
      return true;
    },
    /**
     * O jogador ligou a pista `clue` à pergunta `node`. Certa (necessária ou extra): liga, o quadro redesenha com
     * `link` e devolve true. Errada (ou pista não achada, pergunta que não apareceu): story:linkWrong { clue, node,
     * reason: 'errada' | 'invalida' } e false. Ligar de novo o que já está ligado devolve true sem mudar nada.
     */
    link(clue, node) {
      const q = defs.get(node);
      if (!q || !asked.includes(node) || !book.has(clue)) {
        emit('story:linkWrong', { clue, node, reason: 'invalida' });
        return false;
      }
      // já ligada: nada muda, mas o quadro responde (a pista escolhida volta ao lugar)
      if (isLinked(clue, node)) { send({ link: { clue, node } }); return true; }
      if (!fits(q, clue)) {
        emit('story:linkWrong', { clue, node, reason: 'errada' });
        return false;
      }
      addLink(clue, node);
      send({ link: { clue, node } });
      return true;
    },
    /**
     * O jogador confrontou o depoimento `testimony` com a pista `clue`. Se o par está nas contradições do capítulo,
     * devolve o insight ({ kind, id, text }: a pergunta nova aparece no quadro, ou a pista nova cai na bandeja) e avisa
     * story:insight; se não (ou se já foi confrontado), story:confrontWrong { testimony, clue, reason } e null.
     */
    confront(testimony, clue) {
      const t = CLUES[testimony];
      if (!t || t.type !== 'depoimento' || !book.has(testimony) || !book.has(clue) || testimony === clue) {
        emit('story:confrontWrong', { testimony, clue, reason: 'invalida' });
        return null;
      }
      const key = `${testimony}|${clue}`;
      if (contradicted.has(key)) {
        emit('story:confrontWrong', { testimony, clue, reason: 'feito' });
        return null;
      }
      const c = contradictions.find((k) => k.testimony === testimony && k.clue === clue);
      if (!c) {
        emit('story:confrontWrong', { testimony, clue, reason: 'errada' });
        return null;
      }
      contradicted.add(key);
      const ins = applyInsight(c);
      if (!ins) return null;
      const insight = { ...ins, testimony, clue };
      // primeiro o quadro com a novidade, depois o aviso (o desenho já acha a pergunta nova para pôr em foco)
      send({ fresh: ins.id, insight: { kind: ins.kind, id: ins.id } });
      emit('story:insight', insight);
      onInsight(insight);
      return insight;
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
    /** Uma pista nova entrou: refaz o quadro (fresh = a pista nova, que chega na bandeja). */
    sync(fresh = null) { send(fresh ? { fresh } : {}); },
    isAsked: (id) => asked.includes(id),
    isSolved: (id) => solved.has(id),
    /** Pronta para deduzir: todas as pistas necessárias ligadas. */
    isReady: (id) => { const q = defs.get(id); return !!q && asked.includes(id) && ready(q); },
    /** Todas as pistas necessárias achadas (ligadas ou ainda na bandeja): a hora de mandar abrir o quadro. */
    hasClues: (id) => { const q = defs.get(id); return !!q && asked.includes(id) && q.clues.every((c) => book.has(c)); },
    isLinked,
    /** A pergunta pronta para deduzir mais antiga (para a dica), ou null. */
    get pending() { return asked.find((id) => ready(defs.get(id))) ?? null; },
    /**
     * Para a dica: a primeira pista achada e ainda não ligada que é necessária a uma pergunta aberta ({ clue, node }),
     * ou null. Não aparece para o jogador (ele descobre ligando).
     */
    get nextLink() {
      for (const node of asked) {
        const q = defs.get(node);
        if (solved.has(node)) continue;
        const clue = q.clues.find((c) => book.has(c) && !isLinked(c, node));
        if (clue) return { clue, node };
      }
      return null;
    },
    state,
    reset() { asked = []; solved = new Set(); links = new Map(); contradicted = new Set(); send(); },
    snapshot() {
      return {
        asked: asked.slice(), solved: [...solved],
        links: Object.fromEntries(asked.filter((n) => linkedTo(n).length).map((n) => [n, linkedTo(n).slice()])),
        contradicted: [...contradicted],
      };
    },
  };
  return api;
}
