// Pistas do Modo História: o catálogo (o que cada pista é, de que caso, de que tipo, que desenho vira no cartão) e a
// lupa (createClueBook), que guarda as achadas. Roteiro em docs/HISTORIA.md ("Pistas" e "Os três casos").
// Tipos, com os nomes do roteiro: 'obrigatoria' (no caminho principal), 'cena' (chega numa cena), 'escondida' (Faro,
// enigma ou observação; conta para o caso perfeito), 'falsa' (volta quando ligada à pergunta errada). "Necessária" é
// uma propriedade do caso (src/story/mural/rules.js), não do cartão.
// No quadro de dedução (src/story/deduction.js) entram mais dois: 'depoimento' (o que alguém disse: quem falou, a fala
// entre aspas e o retratinho; pode ser confrontado com uma pista que o contradiz) e 'conclusao' (o "insight" que sai de
// uma contradição). Os depoimentos ficam fora de CHAPTER1_CLUES (que é a lista dos cartões do mural).
// Nada aqui tem texto de segredo; os nomes e as anotações aparecem na árvore de pistas, no mural e nas falas.

/** @typedef {'C1' | 'C2' | 'C3'} CaseId */
/** @typedef {'obrigatoria' | 'cena' | 'escondida' | 'falsa' | 'depoimento' | 'conclusao'} ClueType */
/** @typedef {{ id: string, case: CaseId, type: ClueType, name: string, picto: string, chapter: number, support?: boolean, text?: string, who?: string, quote?: string }} ClueDef */
// text: a anotação da árvore de pistas (a frase que a dog conclui ao achar a pista).
// who/quote (depoimentos): quem falou (gansa, bichano, luiz, farelo…) e a fala, como foi dita.

/** Os casos do mural (nomes do roteiro). */
export const CASES = {
  C1: { id: 'C1', name: 'O caso da borracha sumida' },
  C2: { id: 'C2', name: 'O relógio parado' },
  C3: { id: 'C3', name: 'A noite da cenoura' },
};

/** @type {Record<string, ClueDef>} */
export const CLUES = {
  // caso 3, a noite da cenoura (abertura)
  pombos: { id: 'pombos', case: 'C3', type: 'cena', name: 'Pombos encharcados no parapeito', picto: 'pombos', chapter: 1, text: 'Três pombos encharcados no parapeito, de olho na cenoura.' },
  abraco: { id: 'abraco', case: 'C3', type: 'cena', name: 'O abraço da manhã', picto: 'abraco', chapter: 1, text: 'Dormimos abraçadas à cenoura. De manhã, ela tinha sumido.' },
  pote: { id: 'pote', case: 'C3', type: 'obrigatoria', name: 'O pote virado', picto: 'pote', chapter: 1, text: 'O pote de água virado: alguém passou com pressa.' },
  trilha: { id: 'trilha', case: 'C3', type: 'obrigatoria', name: 'A trilha laranja da cama até a janela', picto: 'trilha', chapter: 1, text: 'Farelinhos laranja da caminha até a janela.' },
  pena: { id: 'pena', case: 'C3', type: 'obrigatoria', name: 'A pena molhada no parapeito', picto: 'pena', chapter: 1, support: true, text: 'Uma pena molhada no parapeito. Pena de pombo!' },
  baba: { id: 'baba', case: 'C3', type: 'escondida', name: 'Baba no parapeito, do lado de dentro', picto: 'baba', chapter: 1, support: true, text: 'Baba no parapeito, do lado de dentro… de quem será?' },
  // caso 2, o relógio parado
  telhas: { id: 'telhas', case: 'C2', type: 'obrigatoria', name: 'Galhos e telhas da tempestade', picto: 'telhas', chapter: 1, text: 'Telhas quebradas embaixo do galho: a tempestade estragou algum telhado.' },
  // a casa (4ª rodada): a goteira na despensa, com a luz acesa (casaPuzzles.js)
  goteira: { id: 'goteira', case: 'C2', type: 'escondida', name: 'A goteira na despensa', picto: 'goteira', chapter: 1, text: 'Uma goteira na despensa: a chuva de ontem pinga do forro.' },
  // caso 1, a borracha sumida
  boia: { id: 'boia', case: 'C1', type: 'obrigatoria', name: 'Um pombo levando a boia de patinho murcha', picto: 'boia', chapter: 1, text: 'Um pombo levou a boia de patinho da piscina. Também é de borracha!' },
  senha: { id: 'senha', case: 'C1', type: 'obrigatoria', name: 'O Farelo sobe pela escada: a senha do interfone', picto: 'senha', chapter: 1, text: 'O Farelo apertou o sino e o osso… e o Soneca espirrou antes do terceiro.' },
  // o alto da caixa d'água do terraço da torre (a fuga dos pombos): eles levaram a tampa de borracha do alçapão
  tampa: { id: 'tampa', case: 'C1', type: 'obrigatoria', name: 'A tampa de borracha da caixa d’água', picto: 'tampa', chapter: 1, text: 'A tampa de borracha da caixa d’água sumiu… mais borracha!' },
  ralo: { id: 'ralo', case: 'C1', type: 'escondida', name: 'O ralo do tanque sem a rolha', picto: 'ralo', chapter: 1, text: 'A rolha de borracha do tanque sumiu.' },
  // a casa (4ª rodada): a etiqueta da cenoura, que estava na lata de biscoito da sala de jantar (casaPuzzles.js)
  etiqueta: { id: 'etiqueta', case: 'C1', type: 'escondida', name: 'A etiqueta da cenoura', picto: 'etiqueta', chapter: 1, text: 'Etiqueta da cenoura: borracha e formato de cone. Tipo uma rolha!' },
  // a portaria
  grelha: { id: 'grelha', case: 'C3', type: 'obrigatoria', name: 'A grelha da guarita', picto: 'grelha', chapter: 1, text: 'A grelha da guarita deixa entrar ar… e cheiro.' },
  // depoimentos (o quadro de dedução: retratinho, a fala entre aspas e a anotação)
  'dep-bichano': {
    id: 'dep-bichano', case: 'C1', type: 'depoimento', who: 'bichano', name: 'Bichano', picto: 'gato', chapter: 1,
    quote: 'Pombo não come borracha, não. Estão tapando alguma coisa… ouvi falar em goteira.',
    text: 'O Bichano diz que os pombos estão tapando alguma coisa.',
  },
  'dep-gansa': {
    id: 'dep-gansa', case: 'C1', type: 'depoimento', who: 'gansa', name: 'Dona Gansa', picto: 'gansa', chapter: 1,
    quote: 'Ouvi o gordinho cantarolando a noite toda: “plim-plim, a nota é o fim!”',
    text: 'A Dona Gansa ouviu o Farelo cantar: a nota vem no fim.',
  },
  'dep-luiz': {
    id: 'dep-luiz', case: 'C3', type: 'depoimento', who: 'luiz', name: 'Sr. Luiz', picto: 'porteiro', chapter: 1,
    quote: 'Ninguém entra na guarita: está tudo trancado!',
    text: 'O Sr. Luiz jura que a guarita está toda trancada.',
  },
};

/** As pistas do capítulo 1, na ordem em que costumam aparecer (os cartões do mural; os depoimentos ficam à parte). */
export const CHAPTER1_CLUES = ['pombos', 'abraco', 'pote', 'trilha', 'pena', 'baba', 'goteira', 'etiqueta', 'telhas', 'boia', 'senha', 'tampa', 'ralo', 'grelha'];
/** Os depoimentos do capítulo 1 (quadro de dedução). */
export const CHAPTER1_TESTIMONIES = ['dep-bichano', 'dep-gansa', 'dep-luiz'];

/**
 * A lupa: guarda as pistas achadas (por id, na ordem em que chegaram). add(id) devolve true só na primeira vez e
 * avisa (`story:clue`), com o tipo e o caso, para o HUD mostrar o cartão voando para a lupa.
 * @param {{ emit?: (name: string, payload?: object) => void, onAdd?: (id: string, silent: boolean) => void }} [opts]
 */
export function createClueBook({ emit = () => {}, onAdd = () => {} } = {}) {
  /** @type {string[]} */
  let found = [];
  const has = (id) => found.includes(id);
  return {
    /** @param {string} id @param {{ x?: number, y?: number, z?: number, silent?: boolean }} [at] */
    add(id, at = {}) {
      const def = CLUES[id];
      if (!def || has(id)) return false;
      found.push(id);
      if (!at.silent) {
        emit('story:clue', {
          id, case: def.case, type: def.type, name: def.name, text: def.text ?? def.name, picto: def.picto, count: found.length, x: at.x, y: at.y, z: at.z,
          ...(def.type === 'depoimento' ? { who: def.who, quote: def.quote } : {}),
        });
      }
      onAdd(id, !!at.silent);
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
