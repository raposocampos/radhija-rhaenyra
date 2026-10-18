# Como criar uma fase

Passo a passo para acrescentar uma fase ao jogo, do papel até o teste automático. O ponto de partida é o
**modelo de fase** em [`src/levels/_modelo/`](../src/levels/_modelo/): uma fase pequena e completa ("a Rhaenyra
segura o portão aberto na placa; a Radhija busca a bolinha"), com cenário provisório em blocos. Ele não aparece no
jogo, mas é coberto por `test/modelo-fase.test.mjs` no CI.

Leia antes [AGENTS.md](../AGENTS.md) e [ENTREGA.md](ENTREGA.md). Testes, tipos, build e partidas
automatizadas rodam no GitHub Actions; não executar essas baterias no PC como etapa automática.
Use branch por tarefa e worktree exclusivo quando houver outros agentes. Confirme Git, PRs e
[CONTEXTO.md](CONTEXTO.md) antes de escolher o número/ID da fase; não sobrescreva um protótipo em andamento.

Para entender as peças em detalhe, consulte [ARQUITETURA.md](ARQUITETURA.md) (§4 Fases, §5 Colisão e navegação).
Fases prontas que servem de referência: a **fase 4** (`src/levels/fase4/`, terraço) para puzzles de superbafo e a
**fase 5** (`src/levels/fase5/`, dentro de casa) para puzzles de pulo e para cenários internos em corte de maquete.
Os formatos exatos estão em [`src/types.d.ts`](../src/types.d.ts) e o editor avisa quando algo não bate.

## 1. Desenhe o puzzle no papel

Antes do código, escreva em poucas linhas:

- **O item e o objetivo**: o que as dogs vão buscar e para onde levam (por exemplo, "a bolinha até a caminha").
- **Os beats**, em ordem: cada um deve exigir as duas cachorrinhas de um jeito diferente. As ferramentas que o
  jogador já conhece: a Radhija passa por aberturas, dá arrancada e solta o **superbafo** (cheiro que o vento e os
  dutos levam até um alvo); a Rhaenyra pesa (placas), empurra (caixotes, ventiladores), pula obstáculos baixos e
  carrega coisas pesadas; o **Fica** segura uma dog num lugar; o latido atrai a gansa.
- **As etapas** (`stages`): normalmente uma por beat, terminando em `'carrying'` e `'done'`.
- **Sem becos sem saída**: em qualquer momento deve dar para desfazer o erro (o portão reabre, o caixote não
  trava num canto, a dog molhada é empurrada para um lugar válido). Com caixotes, prefira limites que façam sentido
  na tela a deixar empurrar para onde ele empaca: a caixa de almofadas da fase 5 só anda para o corredor ("encalha na
  soleira" do outro lado) e desmonta ao chegar lá, então nunca fica presa na porta.

## 2. Copie o modelo

```bash
cp -r src/levels/_modelo src/levels/fase7
```

O comando é um exemplo para uma pasta que ainda não existe. Na cópia, troque `id: 'modelo'` pelo ID escolhido
em `index.js` (o `id` é a chave do progresso salvo; não mude
depois de publicar) e ajuste `number`, `name`, `subtitle`, `intro`, `item`, `ambience` e os `texts`. Todos os textos
visíveis em português do Brasil.

## 3. Layout: coordenadas e regras (`layout.js`)

O layout é a fonte única de coordenadas da fase. Convenções: metros, Y para cima, chão no plano XZ,
**Norte = −Z** (a câmera fica ao sul, olhando para o norte), Leste = +X.

1. **`WORLD.bounds`**: o retângulo andável.
2. **`DOGS`**: importe `withStart` de `../../dogs/config.js` e defina só as posições iniciais no layout.
   A função copia os atributos comuns e os objetos `visual`/`start`, sem compartilhar mutações entre
   fases. Não importe estatísticas de outra fase nem altere habilidades por layout: os controladores
   conservam a configuração da primeira fase carregada durante toda a sessão.
3. **`STATIC_COLLIDERS`**: paredes, móveis, vasos. Formatos `box`, `circle` e `segment`; `blocks: 'large'` cria uma
   abertura onde só a Radhija passa; `except` desliga o colisor numa área (ponte sobre água); `jumpable: true` cria um
   obstáculo baixo que só a Rhaenyra passa, pulando (com `height` para o cenário provisório desenhar a tora).
   A companheira não pula: ligue os dois lados de um obstáculo pulável com uma aresta `{ requires: 'jump' }`
   (flag que nunca liga) para ela esperar do lado de cá, como na Arena do Pulo (`src/levels/_pulo/`), ou com a flag
   da etapa que abre a passagem para ela, como no portãozinho da fase 5 (`petGate`).
4. **Os elementos do puzzle**: portões (`hinge`, `latchPost`, `length`, `openYaw`), placas (`x`, `z`, `r`,
   `requires`), o item (`x`, `z`, `pickupR`). Coloque aqui tudo o que tiver coordenada.
5. **`NAV_NODES` e `NAV_EDGES`**: o caminho da companheira. Um nó em cada "sala" e de cada lado de cada passagem;
   arestas que dependem do puzzle levam `{ requires: 'nomeDaFlag' }` (a flag vem de `puzzle.navFlags()`), e as que só
   uma dog atravessa levam `{ requires: 'small' }` ou `'large'`. Todo nó precisa estar livre para as duas dogs
   (o teste confere): não ponha um nó dentro de uma área `blocks: 'large'` (debaixo da mesa da fase 5, por exemplo).
6. **`GOAL`**: centro e raio da entrega, lugar da comemoração de cada dog e `entryPoints` (pontos fora do quadro da
   câmera de onde uma dog distante reaparece para comemorar).
7. **`CAMERA`**: comece com o `offset` da fase 1 (`[1.4, 4.3, 4.7]`); ajuste `limits` para a câmera não mostrar o vazio
   além do cenário, e os planos `title` e `celebrate`.
8. **`COLLECTIBLES`**: os petiscos opcionais (em geral três, em cantos que valem a exploração).

Ao enviar a branch, o CI roda os testes de navegação e colisão; eles já cobrem a fase nova quando registrada
em `DEV_LEVELS` ou `LEVELS` (passo 6).
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
  const ball = createCarryItem({ obj: props.ball?.object || props.item?.object, dogs, scene: root, name: 'ball' });
  // 2. estado (S.stage) e setStage(), que avisa o núcleo (onStageChange) para atualizar o objetivo
  // 3. objective(nomeAtiva) → { text, target, stage }: o texto do HUD e onde fica o marcador
  // 4. update(dt, { active, ctrls }): avança as mecânicas e as etapas; devolve 'delivered' no fim
  // 5. interact(ctrl): E / A; devolva true se tratou (senão a dog late)
  // 6. reset() e jumpToStage(etapa): voltar ao começo; pular etapas (testes e ?stage=)
  return { stages: STAGES, objective, update, interact, reset, jumpToStage, navFlags, lockFor, lookTarget, ... };
}
```

Regras que evitam dor de cabeça:

- Declare os props realmente opcionais com `?` e acesse-os com `?.` (`props.gate?.setOpen?.(t)`).
  O placeholder entrega `item`, sem fabricar portão/placa/`ball`; o dublê deve preservar essas ausências.
  Métodos inexistentes devem ser detectados pelos contratos, não criados automaticamente pelo teste.
- Mostre o próximo passo no `objective` e use `hints.cond`/`hints.now` para dicas quando o jogador erra (ex.: "Leve
  demais! Precisa de alguém mais pesado…"). Dicas condicionais não se repetem enquanto a condição durar.
- Emita eventos para o que deve ter som/partícula (`emit('gate:open', { x, z })`); o feedback (`src/fx/feedback.js`)
  já trata os eventos existentes (lista em ARQUITETURA.md §8). Um evento novo precisa de tratamento lá.
- Exponha `S: hints.S` no objeto devolvido: o `info().prompt` usado pelos testes lê o prompt atual daí.
- Use `cam.focusShot(x, z)` uma vez quando algo importante acontece longe da câmera (o portão abrindo).
- Timers do puzzle avançam por `dt` em `update`, nunca por `setTimeout` de gameplay: pausa deve congelar
  ações, animações e entrega. Teste pausa em cada transição, inclusive retomada sem disparar ação duplicada.
- `reset()` precisa funcionar de qualquer etapa: devolva o item carregado ao cenário antes de reposicionar
  objetos, limpe nuvens/flags/contadores e restaure poses e prompts. Troca de personagem não pode perder um
  estado já conquistado. `jumpToStage` prepara o estado coerente, mas não substitui uma partida completa.
- Ações fora de ordem, repetidas ou durante animações não podem bloquear o puzzle nem duplicar eventos.
  Para superbafo, teste a nuvem real chegando ao nariz, nuvem antiga, direção errada e rearme; chamar o callback
  diretamente não prova o caminho completo. Para pulo, teste a aterrissagem, não apenas a tecla pressionada.

**Cheiro**: o puzzle recebe `ctx.scent` e registra vento (`addWind`), dutos (`addDuct`) e narizes (`addNose`), que
reagem quando uma nuvem do superbafo chega (ARQUITETURA.md §5.1). A Arena do Bafo (`src/levels/_bafo/`) é o exemplo
completo: ventilador num trilho (um `createPushCrate` com `minX = maxX`) que move o vento, duto ativo só com o
ventilador no encaixe e um pombo que foge para uma placa. A fase 4 usa a mesma cadeia e acrescenta um nariz sem
vento (o pombo cochilando na passagem: um sopro direto resolve) e uma reação ao latido (`onBark`) que só dá a dica.

Para uma mecânica que pode servir a outras fases, escreva-a em `src/game/mechanics/` (genérica, configurada pelo
layout) e exporte em `mechanics/index.js`.

## 6. Registre primeiro o protótipo, depois a fase publicada

Durante o protótipo, importe a definição somente em `src/levels/dev.js` e acrescente-a a `DEV_LEVELS`.
Abra a **prévia do PR** com `?level=<id>&play`; menu e progressão normais continuam com o catálogo publicado.
Os testes gerais de navegação, colisão e cenário também descobrem `DEV_LEVELS`.

`DEV_LEVELS` não é um isolamento de armazenamento: a definição é acrescentada à lista quando aberta pela URL.
Teste pelo subcaminho da prévia, que usa chave de save por PR; não use o link principal para experimentar saves.
Conferir também o smoke do build com o ID de desenvolvimento quando a suíte de protótipo o suportar.

Depois de puzzle, arte, contratos e prévia aprovados, faça a integração ao catálogo como entrega explícita.
Retire a entrada de `DEV_LEVELS` ao promover a mesma definição, evitando IDs duplicados.

Em `src/levels/index.js`:

```js
import novaFase from './fase7/index.js';
// Na declaração existente de LEVELS, acrescente novaFase ao fim.
// Preserve todas as entradas atuais e sua ordem; não promova outro protótipo junto.
```

A tela inicial ganha o cartão da fase (liberado quando a fase anterior for concluída), a vitória da fase anterior passa a oferecer
"Próxima fase" (atualize o `hasNext` esperado nos testes headless e na suíte de navegador dessa fase) e o som
ambiente vem de `ambience` (`'day'`, `'dusk'`, `'night'`, `'city'` ou `'rain'`). O ícone do item vem de `item`
(`'carrot'`, `'ball'`, `'slipper'`, `'duck'` ou `'bear'`). Um item de tipo novo precisa de:

- tipo em `ItemKind` (`src/types.d.ts`) e nome em `createCarryItem` (`src/game/puzzleKit.js`);
- ícone em `src/ui/icons.js` (`itemIcon`) e artigo + nome em `ITEM_NOUN` (`src/ui/markup.js`);
- pose de boca em `src/dogs/carryPose.js` (`CARRY` e o nome em `detectKind`);
- som e cor de pegar em `pickupFx` (`src/fx/feedback.js`);
- o modelo: veja `src/world/toys.js` (eixo mais longo em X, `name` e `userData.carryKind` com o tipo).

Preserve IDs existentes e acrescente a nova fase ao fim. `src/ui/progress.js` normaliza saves v1 e conserva
registros desconhecidos; acrescentar uma fase não exige limpar o save nem mudar a versão. Teste carregar um save
válido anterior, manter medalhas/conclusões, liberar a fase nova após a anterior e concluí-la sem apagar outros
registros. Só introduza migração se o formato realmente mudar. Confira `hasNext` tanto na antiga última fase
quanto na nova última, incluindo as suítes headless e de navegador. O smoke descobre `LEVELS` automaticamente.

## 7. Teste a lógica

1. **Na prévia do PR**: abra a URL publicada com `?level=<id>&play` no protótipo; após registro, use
   `?level=<posição-na-lista>&play` (posição começa em 1 e pode diferir do número no nome da pasta).
   Use `&debug` para ver colisores e o
   grafo, `&stage=gateOpen` para pular etapas e `&dog=rhaenyra` para começar com a Rhaenyra. Enquanto a fase não
   estiver registrada, acrescente-a a `DEV_LEVELS` em `src/levels/dev.js` e abra com `?level=<id>&play`.
2. **Testes rápidos no CI**: copie `test/modelo-fase.test.mjs` (ou `test/fase5.test.mjs`) para o arquivo da fase e troque as rotas. O jogo
   headless joga a fase de verdade com teclas simuladas:

   ```js
   // No protótipo, importe a definição e passe a lista explicitamente, como no teste do modelo.
   const levels = [...LEVELS, novaFase];
   const h = await createHeadlessGame({ level: levels.length, levels });
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
   Para pular: `h.hold([1, 0]); h.tap('Space')`; para o superbafo: `h.keyDown('KeyR'); h.run(0.4); h.keyUp('KeyR')`.
   Cubra reset com item na boca, pausa/retomada, troca de dog no meio da ação e estados inválidos recuperáveis.
   Para uma regressão, registre prova negativa na nuvem contra o comportamento defeituoso e a aprovação após
   corrigir a causa. Não enviar uma mutação defeituosa à produção nem usar resultado de outro SHA como validação.
3. **Partida de navegador na nuvem**: copie `tools/scripts/playthrough-fase5.mjs` (teclas reais nas ações,
   teletransporte só para preparar trechos). Registre a suíte em **dois lugares**: `SUITES` de
   `tools/scripts/run-e2e.mjs` e `inputs.suite.options`/matriz de `todas` em `.github/workflows/e2e.yml`.
   Confira condições dos jobs de smoke/recursos se a suíte precisar incluir a fase de desenvolvimento.
   Sem essas entradas a suíte pode existir sem jamais ser executada. Erros inesperados de navegador continuam
   reprovando; não acrescente permissões genéricas para ignorá-los.

Após enviar a branch, dispare `gh workflow run e2e.yml --ref codex/minha-fase -f suite=minha-suite`.
Para a entrega importante, use `-f suite=todas`, confira o SHA e o resultado de cada job no GitHub.
O workflow obrigatório do PR não espera o E2E manual automaticamente. Não rodar `npm run verify`, `npm test`,
`npm run typecheck`, `npm run build` ou E2E localmente sem pedido explícito do usuário.

## 8. Cenário e luz de verdade

Troque o `build` provisório por um `world/index.js` com `buildWorld({ engine, root, layout, params })`, como nas
fases 2 a 5. Ele monta tudo dentro de `root` e devolve:

```js
return {
  props: { gate, plate, ball, collectibles, update(dt, t) {...}, reset() {...} },  // o que o puzzle anima
  seeThrough: [muretas, portao.object],      // o que pode ficar entre a câmera e as dogs
  update(dt, t) {...},                       // água, vagalumes, luzes
};
```

No `index.js`, o cenário entra **sob demanda**, sem `import` estático de `world/` (assim ele fica num chunk à parte e
quem abre o jogo não baixa a fase 7 antes de jogá-la; ARQUITETURA.md §4.1):

```js
// tire `build: …` e o import do _placeholder.js, e ponha:
load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
```

O CI confere isso (`test/carregamento.test.mjs`). No build gerado pelo GitHub Actions, o chunk aparece como
`dist/assets/fase7-world-….js`.

- Cada prop que o puzzle usa precisa existir com o mesmo nome e os métodos esperados; escreva o formato em
  `src/types.d.ts` (como `Fase2Props`). Use esse tipo em `LevelDef<Fase7Props>`,
  `LevelBuild<Fase7Props>` e `PuzzleContext<Fase7Props>` para ligar definição, cenário e puzzle.
  Acrescente a fábrica explícita em `test/helpers/props.mjs` e registre seu ID no mapa estrito de factories:
  os testes gerais de colisão/navegação também carregam `DEV_LEVELS`, mesmo antes da promoção ao catálogo.
  Uma factory específica usada só na suíte da fase não cobre esses chamadores. Cubra os contratos importantes
  também com objetos reais do cenário; confira a fixture de tipos em `test/types/contratos.ts`.
- `reset()` de cada prop volta tudo ao início, inclusive o item à posição `home`.
- Monte recursos da fase sob `root`; recursos fora da árvore/retidos em closures precisam ser declarados ao
  escopo, conforme [ARQUITETURA.md §3.1](ARQUITETURA.md#31-propriedade-e-descarte-de-recursos).
  Não descarte geometrias, materiais ou texturas compartilhados. Reset e descarte têm responsabilidades
  diferentes: repetir fase preserva o cenário válido; trocar fase libera suas instâncias e referências.
- Reaproveite `src/world/util.js` (materiais, texturas em canvas, sombras de contato, folhagem, lona listrada),
  `src/world/plants.js`, `src/world/treats.js` (os ossinhos prontos: `buildTreats(root, COLLECTIBLES)`),
  `src/world/toys.js` e `src/world/pigeon.js`.
- Cenário interno: a fase 5 mostra o corte de maquete (sem teto, parede do fundo inteira e as outras cortadas a meia
  altura com a faixa escura no topo). Com a câmera padrão, uma parede de fundo de 2,7 m esconde o céu.
- Nada de assets baixados: geometria, texturas e sons em código.
- Nunca deixe duas peças com faces no mesmo plano (a terra na altura exata da borda do vaso, uma tábua rente ao
  pilarete, um batente rente à ponta da parede): a superfície fica "tremendo" na tela. Afaste 2–4 mm ou faça uma peça
  terminar dentro da outra. O `test/cenario.test.mjs` confere isso em todas as fases e diz onde está o problema.
- Crie `lighting.js` a partir de um preset existente (ARQUITETURA.md §4.3). No máximo cerca de 6 PointLights sem sombra.
- Preserve a direção artística existente: maquete procedural, escala das personagens, materiais, luz e câmera
  das fases prontas. Uma imagem de conceito comunica a ideia; não autoriza trocar o estilo do jogo.
- Para olhar o cenário parado na prévia: `?level=<id>&play&cam=x,y,z&look=x,y,z`. Capturas automáticas e
  medições ficam nos artefatos dos workflows. Recursos gráficos medem contagens; desempenho mede cadência
  com render normal, em fluxo separado: [DESEMPENHO.md](DESEMPENHO.md). E2E de gameplay reduz render e não mede FPS.

## 9. Lista final

- [ ] CI do head atual passou tipos, testes rápidos e build; contratos verificam produtor/consumidor real e
      rejeitam props/métodos inválidos em `test/types/`, sem `any` ou dublês que inventam métodos.
- [ ] Navegação, colisão e cenário sem z-fighting passaram, incluindo a nova fase de desenvolvimento.
- [ ] Partida completa no teclado e no controle, ações fora de ordem, pausa, reinício e troca de dog cobertos;
      todos os textos em português e arte consistente com o jogo.
- [ ] E2E da suíte e `todas` passaram no SHA entregue; runner e workflow incluem a suíte, capturas revisadas.
- [ ] Build em subcaminho funciona com import sob demanda; contagens após trocas estabilizam, sem descarte global.
- [ ] Para promoção ao catálogo: saves anteriores preservados, `hasNext` atualizado e README com a fase nova.
- [ ] PR registra head/base, CI/E2E, prévia atual, limitações e o que testar; CONTEXTO registra próximo passo.
- [ ] Usuário testou e aprovou **essa versão** antes do merge. Só depois: squash com SHA esperado, CI main,
      liberação do deployment correspondente e confirmação do `version.json` em produção, conforme ENTREGA.

Novos commits ou atualização da base exigem nova validação e aprovação. Protótipo aprovado para implementação
não equivale a aprovação para publicar no jogo principal.
