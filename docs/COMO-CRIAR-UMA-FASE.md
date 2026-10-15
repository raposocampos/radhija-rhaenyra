# Como criar uma fase

Passo a passo para acrescentar uma fase ao jogo, do papel até o teste automático. O ponto de partida é o
**modelo de fase** em [`src/levels/_modelo/`](../src/levels/_modelo/): uma fase pequena e completa ("a Rhaenyra
segura o portão aberto na placa; a Radhija busca a bolinha"), com cenário provisório em blocos. Ele não aparece no
jogo, mas é testado pelo `npm test` (`test/modelo-fase.test.mjs`), então está sempre funcionando.

Para entender as peças em detalhe, consulte [ARQUITETURA.md](ARQUITETURA.md) (§4 Fases, §5 Colisão e navegação).
Os formatos exatos estão em [`src/types.d.ts`](../src/types.d.ts) e o editor avisa quando algo não bate.

## 1. Desenhe o puzzle no papel

Antes do código, escreva em poucas linhas:

- **O item e o objetivo**: o que as dogs vão buscar e para onde levam (por exemplo, "a bolinha até a caminha").
- **Os beats**, em ordem: cada um deve exigir as duas cachorrinhas de um jeito diferente. As ferramentas que o
  jogador já conhece: a Radhija passa por aberturas e dá arrancada; a Rhaenyra pesa (placas), empurra (caixotes)
  e carrega coisas pesadas; o **Fica** segura uma dog num lugar; o latido atrai a gansa.
- **As etapas** (`stages`): normalmente uma por beat, terminando em `'carrying'` e `'done'`.
- **Sem becos sem saída**: em qualquer momento deve dar para desfazer o erro (o portão reabre, o caixote não
  trava num canto, a dog molhada é empurrada para um lugar válido).

## 2. Copie o modelo

```bash
cp -r src/levels/_modelo src/levels/fase4
```

Na cópia, troque `id: 'modelo'` por `id: 'fase4'` em `index.js` (o `id` é a chave do progresso salvo; não mude
depois de publicar) e ajuste `number`, `name`, `subtitle`, `intro`, `item`, `ambience` e os `texts`. Todos os textos
visíveis em português do Brasil.

## 3. Layout: coordenadas e regras (`layout.js`)

O layout é a fonte única de coordenadas da fase. Convenções: metros, Y para cima, chão no plano XZ,
**Norte = −Z** (a câmera fica ao sul, olhando para o norte), Leste = +X.

1. **`WORLD.bounds`**: o retângulo andável.
2. **`DOGS`**: reaproveite as estatísticas da fase 1 e mude só a posição inicial (`withStart`).
3. **`STATIC_COLLIDERS`**: paredes, móveis, vasos. Formatos `box`, `circle` e `segment`; `blocks: 'large'` cria uma
   abertura onde só a Radhija passa; `except` desliga o colisor numa área (ponte sobre água); `jumpable: true` cria um
   obstáculo baixo que só a Rhaenyra passa, pulando (com `height` para o cenário provisório desenhar a tora).
   A companheira não pula: ligue os dois lados de um obstáculo pulável com uma aresta `{ requires: 'jump' }`
   (flag que nunca liga) para ela esperar do lado de cá, como na Arena do Pulo (`src/levels/_pulo/`).
4. **Os elementos do puzzle**: portões (`hinge`, `latchPost`, `length`, `openYaw`), placas (`x`, `z`, `r`,
   `requires`), o item (`x`, `z`, `pickupR`). Coloque aqui tudo o que tiver coordenada.
5. **`NAV_NODES` e `NAV_EDGES`**: o caminho da companheira. Um nó em cada "sala" e de cada lado de cada passagem;
   arestas que dependem do puzzle levam `{ requires: 'nomeDaFlag' }` (a flag vem de `puzzle.navFlags()`), e as que só
   uma dog atravessa levam `{ requires: 'small' }` ou `'large'`.
6. **`GOAL`**: centro e raio da entrega, lugar da comemoração de cada dog e `entryPoints` (pontos fora do quadro da
   câmera de onde uma dog distante reaparece para comemorar).
7. **`CAMERA`**: comece com o `offset` da fase 1 (`[1.4, 4.3, 4.7]`); ajuste `limits` para a câmera não mostrar o vazio
   além do cenário, e os planos `title` e `celebrate`.
8. **`COLLECTIBLES`**: os petiscos opcionais (em geral três, em cantos que valem a exploração).

Rode `npm test`: os testes de navegação e colisão já cobrem a fase nova assim que ela for registrada (passo 6).
Eles conferem que os nós estão livres, que as arestas não atravessam colisores, que o grafo é conexo e que
nenhuma parede fina deixa a arrancada passar.

## 4. Cenário provisório primeiro

O modelo usa `buildPlaceholderWorld` (`src/levels/_placeholder.js`): chão, um bloco em cada colisor e a bolinha em
`layout.BALL`. Isso basta para jogar e testar o puzzle antes de qualquer arte. O cenário de verdade vem no passo 8.

## 5. A lógica (`puzzle.js`)

O modelo mostra a estrutura que todas as fases seguem:

```js
export const STAGES = ['start', 'gateOpen', 'carrying', 'done'];
export const TEXT = { objective: {...}, hint: {...}, prompt: {...} };   // todos os textos da fase

export function createPuzzle(ctx) {
  // 1. peças prontas (src/game/puzzleKit.js e src/game/mechanics/)
  const hints = createHints(emit, TEXT);
  const plate = createPressurePlate({ id: 'plate', ..., requires: 'large', emit, prop: props.plate });
  const gate = createHingedGate({ id: 'gate', cfg: GATE, world, prop: props.gate });
  const ball = createCarryItem({ obj: props.ball?.object, dogs, scene: root, name: 'ball' });
  // 2. estado (S.stage) e setStage(), que avisa o núcleo (onStageChange) para atualizar o objetivo
  // 3. objective(nomeAtiva) → { text, target, stage }: o texto do HUD e onde fica o marcador
  // 4. update(dt, { active, ctrls }): avança as mecânicas e as etapas; devolve 'delivered' no fim
  // 5. interact(ctrl): E / A; devolva true se tratou (senão a dog late)
  // 6. reset() e jumpToStage(etapa): voltar ao começo; pular etapas (testes e ?stage=)
  return { stages: STAGES, objective, update, interact, reset, jumpToStage, navFlags, lockFor, lookTarget, ... };
}
```

Regras que evitam dor de cabeça:

- Chame os props sempre com `?.` (`props.gate?.setOpen?.(t)`): a lógica precisa rodar sem o cenário (testes em Node).
- Mostre o próximo passo no `objective` e use `hints.cond`/`hints.now` para dicas quando o jogador erra (ex.: "Leve
  demais! Precisa de alguém mais pesado…"). Dicas condicionais não se repetem enquanto a condição durar.
- Emita eventos para o que deve ter som/partícula (`emit('gate:open', { x, z })`); o feedback (`src/fx/feedback.js`)
  já trata os eventos existentes (lista em ARQUITETURA.md §8). Um evento novo precisa de tratamento lá.
- Exponha `S: hints.S` no objeto devolvido: o `info().prompt` usado pelos testes lê o prompt atual daí.
- Use `cam.focusShot(x, z)` uma vez quando algo importante acontece longe da câmera (o portão abrindo).

Para uma mecânica que pode servir a outras fases, escreva-a em `src/game/mechanics/` (genérica, configurada pelo
layout) e exporte em `mechanics/index.js`.

## 6. Registre a fase

Em `src/levels/index.js`:

```js
import fase4 from './fase4/index.js';
export const LEVELS = [fase1, fase2, fase3, fase4];
```

A tela inicial ganha o cartão da fase (liberado quando a fase 3 for concluída), a vitória da fase 3 passa a oferecer
"Próxima fase" e o som ambiente vem de `ambience`. O ícone do item vem de `item` (`'carrot'`, `'ball'` ou `'slipper'`);
um item de tipo novo precisa de ícone em `src/ui/icons.js` (`itemIcon`) e de pose de boca em `src/dogs/carryPose.js`
(`CARRY`).

## 7. Teste a lógica

1. **No navegador**: `npm run dev` e abra `http://127.0.0.1:5173/?level=4&play`. Use `&debug` para ver colisores e o
   grafo, `&stage=gateOpen` para pular etapas e `&dog=rhaenyra` para começar com a Rhaenyra. Enquanto a fase não
   estiver registrada, acrescente-a a `DEV_LEVELS` em `src/levels/dev.js` e abra com `?level=<id>&play`.
2. **No Node, em segundos**: copie `test/modelo-fase.test.mjs` para `test/fase4.test.mjs` e troque as rotas. O jogo
   headless joga a fase de verdade com teclas simuladas:

   ```js
   const h = await createHeadlessGame({ level: 4 });
   h.tap('KeyQ');                                   // troca para a Rhaenyra
   h.walkPath([[-1.6, 0.2], [-1.6, 2.6]]);          // anda até a placa
   h.run(1.0);                                      // deixa o portão abrir
   assert.equal(h.info().stage, 'gateOpen');
   h.tap('KeyQ');                                   // volta para a Radhija…
   h.tap('KeyF');                                   // …e pede para a Rhaenyra ficar (Fica)
   h.hold([1, 0], ['ShiftLeft']);                   // segura → (leste) com Shift (arrancada)
   h.run(0.5);
   h.hold(null);
   assert.equal(h.log('gate:open').length, 1);      // eventos emitidos ficam no log
   ```

   Cubra a partida completa e cada caso de borda que o puzzle prevê (a dog errada na placa, sair sem o Fica…).
3. **Partida no navegador (opcional)**: copie `tools/scripts/playthrough-fase3.mjs` para a fase nova e acrescente-a à
   lista `SUITES` em `tools/scripts/run-e2e.mjs`.

## 8. Cenário e luz de verdade

Troque o `build` provisório por um `world/index.js` com `buildWorld({ engine, root, layout, params })`, como nas
fases 2 e 3. Ele monta tudo dentro de `root` e devolve:

```js
return {
  props: { gate, plate, ball, collectibles, update(dt, t) {...}, reset() {...} },  // o que o puzzle anima
  seeThrough: [muretas, portao.object],      // o que pode ficar entre a câmera e as dogs
  update(dt, t) {...},                       // água, vagalumes, luzes
};
```

- Cada prop que o puzzle usa precisa existir com o mesmo nome e os métodos esperados; escreva o formato em
  `src/types.d.ts` (como `Fase2Props`) para o TypeScript conferir.
- `reset()` de cada prop volta tudo ao início, inclusive o item à posição `home`.
- Reaproveite `src/world/util.js` (materiais, texturas em canvas, sombras de contato, folhagem) e `src/world/plants.js`.
- Nada de assets baixados: geometria, texturas e sons em código.
- Crie `lighting.js` a partir de um preset existente (ARQUITETURA.md §4.3). No máximo cerca de 6 PointLights sem sombra.
- Para olhar o cenário parado: `?level=4&play&cam=x,y,z&look=x,y,z` e `node tools/shot.mjs --url "…" --out shots/f4.png`.

## 9. Lista final

- [ ] `npm run typecheck` sem erros.
- [ ] `npm test` verde (inclui navegação e colisão da fase nova, e o `test/fase4.test.mjs`).
- [ ] Jogada inteira no teclado e no controle, sem becos sem saída; todos os textos em português.
- [ ] `npm run test:e2e` verde (as fases antigas continuam passando).
- [ ] `npm run build` sem erros.
- [ ] README atualizado (lista de fases).
