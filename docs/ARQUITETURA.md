# Arquitetura — Radhija & Rhaenyra

Guia para quem mantém e evolui o jogo. Explica como as peças se encaixam, onde mexer para cada tipo de mudança
e como verificar que nada quebrou. Para o passo a passo de uma fase nova, veja [COMO-CRIAR-UMA-FASE.md](COMO-CRIAR-UMA-FASE.md).
Os tipos de todas as APIs citadas aqui estão em [`src/types.d.ts`](../src/types.d.ts).

## 1. Visão geral

Aventura 3D curta em fases, em Three.js r170 + Vite, JavaScript puro com ES modules. O jogador controla uma de
duas cachorrinhas (a Radhija, pequena e rápida, que dá arrancadas e solta o superbafo; a Rhaenyra, grande e forte,
que empurra e pula; as duas lambem a irmã com o Lambe-Lambe) e troca entre elas; a outra vira
companheira e segue sozinha (ou espera, com o comando **Fica**). Cada fase é um puzzle cooperativo que termina
levando um item até um objetivo.

Princípios que valem para o projeto todo:

- **Tudo procedural.** Modelos, texturas, sons e música são gerados em código. Nenhum asset baixado.
- **Português do Brasil** em todos os textos visíveis e nos comentários.
- **Teclado e controle** (gamepad) com a mesma qualidade, inclusive nos menus; no celular, toque (joystick e botões
  virtuais) e um layout compacto. O PC não muda por causa do celular: perfil gráfico e interface continuam os mesmos.
- **Fases são dados + puzzle.** O núcleo (`src/game/`) não conhece nenhuma fase específica; tudo o que é de uma fase
  vem da definição dela em `src/levels/faseN/`.

## 2. Mapa das pastas

```
src/main.js                integração: monta motor, dogs, jogo, UI, áudio e efeitos; laço de quadros
src/types.d.ts             tipos das APIs públicas (checados pelo TypeScript, ver §11)
src/core/engine.js         renderer, céu, névoa, luz e pós-processamento; applyLighting(preset)
src/core/events.js         barramento de eventos (on/off/once/emit)
src/game/                  NÚCLEO genérico
  game.js                  estados, carregamento de fases, entrada → dogs, companheira, comemoração, depuração
  gameEvents.js            emissão, padrões de vibração e histórico de diagnóstico por instância
  input.js                 teclado + controle traduzidos para códigos lógicos (KeyE, KeyQ, Shift…)
  collision.js             colisão 2D (círculo da dog × caixas, círculos, segmentos), sem Three
  navigation.js            grafo de navegação da companheira (Dijkstra + linha de visão)
  companion.js             IA da companheira (seguir, esperar, ir até um ponto)
  dogController.js         movimento de uma dog (aceleração, giro, arrancada, pulo, colisão)
  cameraRig.js             câmera de seguimento, planos de foco, tela inicial e comemoração
  celebrateLoop.js         lado e tamanho da voltinha da comemoração que cabem no cenário
  idle.js                  parada por muito tempo: deitar, xixi raro e a volta depois dele (coçar, desligado)
  walkPath.js              caminhos andados de verdade (curvas suaves, curva-reta-curva) e o perfil de velocidade
  puzzleKit.js             peças para puzzles: dicas, prompts, colecionáveis, item carregado, entrega
  mechanics/               mecânicas reutilizáveis (placa de pressão, portão, caixote, irrigador, gansa, porcos…)
  debugDraw.js             ?debug: colisores e grafo desenhados na cena
src/levels/                as fases
  index.js                 registro das fases, em ordem (LEVELS: fase1…fase7) e publishedLevelIndex (?level= por
                           posição ou id, usado pelo main.js)
  faseN/index.js           definição (nome, textos, item, layout, iluminação, load do cenário, createPuzzle)
  faseN/layout.js          coordenadas e regras: limites, colisores, grafo, objetivo, câmera
  faseN/lighting.js        preset de iluminação (a fase 1 usa o padrão do motor)
  faseN/puzzle.js          a lógica da fase
  faseN/world/             cenário e props visuais, carregados sob demanda (a fase 1: fase1/world.js, que usa src/world/)
  _placeholder.js          cenário provisório em blocos, para testar uma fase antes da arte
  _modelo/                 modelo de fase completo e testado (não registrado): ponto de partida das fases novas
  _pulo/                   Arena do Pulo: fase de desenvolvimento para testar o pulo da Rhaenyra
  _bafo/                   Arena do Bafo: primeiro puzzle do superbafo ("o pombo e o portão"), cenário provisório
  _canil/                  Canil das Dogs: vitrine que compara o modelo atual das dogs com o novo (src/dogs/v2/),
                           com painel de poses e vistas (display.js, panel.js)
  _porcos/                 Arena dos Porquinhos (?level=porcos): o chiqueiro, os porcos e os legumes da fase 10
  fase6/                   Expresso do Superbafo: track.js descreve o trilho uma vez só, para o
                           movimento do trem (puzzle.js) e para os trilhos visíveis (world/railway.js)
  fase7/                   Lambe-Lambe na Pracinha: túnel de lama, trinco por dentro, Lambe-Lambe e
                           escorregador (pose roteirizada com lock.drive); world/ separado por peça da pracinha
  dev.js                   fases de desenvolvimento (fora do menu: as arenas e os protótipos de fases novas),
                           abertas por ?level=<id> (devCatalog); só baixado quando o id não é de uma fase publicada
src/world/                 cenário da fase 1 + utilitários de modelagem (util.js, plants.js, sky.js…) e peças
                           compartilhadas: toys.js (patinho, ursinho, frisbee), treats.js (ossinhos), pigeon.js (pombo),
                           veggies.js (milho, cenoura e aboborinha que os porcos comem), pigPen.js (o chiqueiro)
src/dogs/                  as cachorrinhas (ver §7)
  config.js                atributos globais das personagens; withStart cria a configuração de cada layout
  v2/                      modelo novo das dogs, o padrão (esqueleto de 38 ossos; ?dogs=atual volta ao anterior; ?level=canil)
src/characters/goose.js    a Dona Gansa
src/characters/pig.js      os porquinhos (fase 10)
src/ui/                    interface em DOM (ver §9)
src/fx/                    áudio sintetizado, partículas e feedback (ver §9)
test/                      testes rápidos em Node (npm test)
tools/                     partidas automatizadas no navegador, capturas e simulações
sandbox/                   páginas soltas para ver dogs, gansa, cenário e efeitos isolados
docs/                      esta documentação
```

## 3. Ciclo de vida

**Boot** (`src/main.js`): cria o motor, as duas dogs (elas vivem a partida inteira, entre fases), o jogo, o áudio,
as partículas, o feedback e a UI; carrega a fase inicial e começa o laço. A cada quadro, nesta ordem:
`game.update` → `updateSeeThrough` → `feedback.update` → `particles.update` → `ui.update` → `engine.render`.
O `dt` é limitado a 1/20 s (quedas de FPS deixam o jogo mais lento, não instável).

**Carregar uma fase** (`game.loadLevel(i, { mode })`):

1. Chama `def.load()` (se houver), que começa a baixar o cenário da fase (§4.1).
2. Emite `level:loading` (a UI cobre a tela com a cortina) e espera a cortina fechar e o `load()` terminar; o que ele
   trouxe (o `build`) entra no lugar dos campos da definição. Até aqui a fase anterior continua inteira.
3. Reseta o puzzle da fase anterior e esvazia as bocas das dogs (o item da fase velha não pode vir junto).
4. Descarta os recursos exclusivos da fase anterior e do debug (§3.1), preservando caches globais.
5. Aplica `def.lighting`, chama `def.build({ engine, root, layout, params })` e aplica o "ver através" aos objetos de `seeThrough`.
6. Cria o mundo de colisão e a navegação a partir de `def.layout`, depois o puzzle com `def.createPuzzle(ctx)`.
7. Posiciona as dogs e aplica `?stage=` (só no carregamento inicial).
8. Aquece a GPU com a fase inteira, ainda atrás da cortina (`engine.prepare()`, `src/core/engine.js`): compila os
   programas de toda a cena na variante em que o jogo desenha (no alvo do compositor, sem tone mapping; sem pós, com
   ele), desenha uma vez tudo o que existe — fora da câmera e escondido também — de uma vista geral da fase, num alvo
   de 256×144 (texturas, geometrias e os programas da sombra vão para a GPU; com quase tudo cobrindo algum pixel, também
   o que a GPU só prepara ao pintar, como no SwiftShader do CI) e um quadro normal, e espera a GPU terminar (fence: o WebGL só
   enfileira, e o resto cairia no primeiro quadro visível). Sem isso, cada área engasgava na primeira vez que entrava
   na câmera. Marcas `rr:gpu:compiled`, `rr:gpu:drawn` e `rr:gpu:idle` separam as etapas. Trocar o perfil de qualidade (tipo de sombra, compositor) recompila a fase em segundo
   plano. Coisas que só nascem num evento precisam existir escondidas desde a carga (a bolha `cheiro-aquecimento` do
   superbafo), e uma textura trocada no material depois precisa já estar em algum objeto da cena (os ícones e as
   pegadas de `feedback.js` começam com cada uma das texturas). Medido por `tools/scripts/measure-first-pass.mjs` (§10).
9. Emite `level:loaded` (a UI revela).

**Pacote inicial**: o `main` do build leva o motor, o núcleo, as dogs, a UI, os efeitos e, de cada fase, só a
definição, o layout, a iluminação e o puzzle (o menu e os testes em Node usam isso). O cenário de cada fase vira um
chunk próprio (`dist/assets/faseN-world-….js`, nome dado em `vite.config.js`), baixado só quando a fase carrega: a
tela inicial baixa o da fase 1, `?level=5` só o da fase 5. As fases de desenvolvimento ficam no chunk `dev`.
`test/carregamento.test.mjs` falha se algum `world/` voltar a ser importado estaticamente.

**Estados do jogo**: `loading`, `load-error` (recarga ou retorno à fase intacta), `title` (tela inicial sobre a fase), `intro` (cartão da fase), `playing`, `paused`,
`celebrating` (as duas comemoram no objetivo, ~3 s) e `victory` (painel de vitória). A UI espelha o estado.

**Um quadro em `playing`** (`game.js → updatePlaying`): lê a entrada relativa à câmera; trava a entrada se o
puzzle pedir (`lockFor`); deixa o puzzle ajustar a intenção (`modifyIntent`, ex.: empurrar); move a dog ativa;
move a companheira (IA, ou "Fica"); trata E/latido (`interact`, `onBark`); chama `puzzle.update`, que devolve
`'delivered'` quando o item chegou ao objetivo, o que inicia a comemoração.

### 3.1 Propriedade e descarte de recursos

`src/core/resources.js` cria o escopo da fase **antes** de `build()`. Na saída,
coleta a árvore atual (incluindo objetos acrescentados pelo puzzle) e libera
geometrias, materiais, texturas e recursos próprios de instâncias/skeletons.
O debug é uma raiz auxiliar. Recursos são deduplicados por identidade; o
escopo é idempotente e continua a limpeza se algum `dispose` falhar.

- Objetos exclusivos devem ficar sob o `root` da fase assim que são criados.
  Para recursos fora da árvore, como texturas capturadas por `onBeforeCompile`,
  use `ownResource(root, recurso)` imediatamente após criá-los. Assim uma
  exceção antes do retorno de `build()` ainda permite limpar a montagem parcial.
- Caches que vivem com a aplicação usam `shareResource(recurso)`. Materiais
  compartilhados também protegem suas texturas; um material exclusivo pode
  emprestá-las. A marca usa identidade e não passa para clones. Texturas em
  propriedades de material/uniforms e arrays são coletadas; dependências
  escondidas em closures precisam de registro explícito.
- `puzzle.reset()` devolve os itens da boca ao cenário antes da coleta. Hooks
  `puzzle.dispose`/`built.dispose` limpam estado e assinaturas; não devem liberar
  novamente recursos da árvore nem removê-los sem registrá-los como extras.
  Dogs, renderer, pós-processamento e geometria global de `Sprite` sobrevivem
  às trocas e não pertencem ao escopo da fase.
- `ScentField.reset()` limpa nuvens, mantendo ventos/dutos/narizes para reiniciar
  o puzzle. `dispose()` encerra também o visual e as referências. O subescopo
  visual remove seu grupo antes do escopo pai, sem dupla liberação; a esfera
  compartilhada entre nuvens da mesma fase é registrada mesmo fora da árvore.
- Atributos dinâmicos do debug reutilizam capacidade. Ao crescer, a geometria
  é liberada enquanto ainda contém o atributo anterior, antes de substituí-lo.
  Só remover objetos da cena ou trocar atributos não libera seus buffers GPU.

Os testes Node verificam ownership com objetos Three reais. A medição no E2E
manual compara contagens por fase após aquecimento, com render completo em
Chromium/SwiftShader; não é medição de MB, VRAM ou FPS. Caches legítimos podem
continuar alocados. Falha antes do descarte permite retorno; depois dele, a
montagem parcial é limpa e somente a recarga pode retomar a partida.

## 4. Fases

### 4.1 Definição (`src/levels/faseN/index.js`, tipo `LevelDef<P>`)

```js
/** @type {import('../../types').LevelDef<import('../../types').Fase2Props>} */
export default {
  id: 'fase2', number: 2, name: 'Operação Bolinha', subtitle: 'Crepúsculo na área de serviço',
  intro: 'texto do cartão de abertura',
  item: 'ball',                 // 'carrot' | 'ball' | 'slipper' | 'duck' | 'bear': ícone na UI e pose de boca
  ambience: 'dusk',             // 'day' | 'dusk' | 'night' | 'city' | 'rain': som ambiente (§9)
  texts: { celebrate, victoryTitle, victorySub },
  layout,                       // layout.js
  lighting,                     // lighting.js
  // cenário sob demanda: import dinâmico de world/, cujo buildWorld é o build (§4.4)
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,                 // puzzle.js: createPuzzle(ctx) → puzzle
};
```

O `id` é a chave do progresso salvo no navegador: não mude o `id` de uma fase publicada.

**Cenário sob demanda** (`load`): o cenário procedural é a parte pesada de uma fase e só serve quando ela é montada.
Por isso a definição não importa `world/` estaticamente: `load()` faz o `import()` e devolve `{ build }`, e o núcleo
usa o que vier no lugar dos campos da definição (§3). Assim o Vite põe cada cenário num chunk à parte e o jogo abre
sem baixar as outras fases. Metadados, `layout`, `lighting` e `createPuzzle` ficam estáticos, porque a UI (cartões
do menu, total de petiscos) e os testes em Node os usam sem montar cenário; o jogo headless troca o `build` por
dublês e descarta o `load`. Uma fase com cenário provisório e leve (o modelo e as arenas, com `_placeholder.js`)
pode passar `build` direto, sem `load`. O que o cenário baixa da rede também vem no `load()`, antes da montagem: a
foto do quadro da fase 10 (`preloadWorld()` → `preloadSecret()`, prazo de 5 s, nunca rejeita). Assim o material já
nasce com a textura e o aquecimento da GPU (§3, passo 8) a leva junto; chegando depois, o programa com mapa e a textura
subiam na primeira vez que a dog entrava ali.

Fases registradas (`src/levels/index.js`):

| Fase | Cenário · ambiente | Item | Mecânicas |
|---|---|---|---|
| 1 Operação Cenoura | jardim, fim de tarde (`src/world/`) · `day` | cenoura | portão com corda (puxar), carrinho, vão da cerca só para a Radhija |
| 2 Operação Bolinha | área de serviço, crepúsculo · `dusk` | bolinha | tábua de pressão + Fica, calço com arrancada, irrigador, caixote que vira ponte |
| 3 Operação Pantufa | jardim do lago, noite · `night` | pantufa | duas pedras de pressão com lanternas, cantinho estreito, Dona Gansa atraída por latido |
| 4 Operação Patinho | terraço do prédio, manhã · `city` | patinho | superbafo: pombo na passagem (nariz), ventilador no trilho (caixote + vento), corredor estreito, duto, pombo do portão com placa |
| 5 Operação Ursinho | dentro de casa em corte de maquete, chuva · `rain` | ursinho | pulo: portãozinho pulável com a trava do outro lado, barricada (caixa fixa + caixote que desmonta), mesa onde só a Radhija cabe, cercadinho |

### 4.2 Layout (`layout.js`, tipo `LevelLayout`)

Fonte única de coordenadas da fase: o cenário, a colisão, a IA e a câmera leem daqui. Convenções: metros,
Y para cima, chão no plano XZ, **Norte = −Z**, câmera ao sul; `yaw = atan2(dir.x, dir.z)` (yaw 0 olha para +Z).

Campos que o núcleo usa (cada fase acrescenta os seus, como portões e placas):

| Campo | Para quê |
|---|---|
| `WORLD.bounds` | retângulo andável (os centros das dogs ficam em `[min + r, max − r]`) |
| `DOGS.{radhija,rhaenyra}` | atributos globais de `src/dogs/config.js` (raio, velocidades, arrancada, pulo, superbafo…) e `start {x, z, yaw}` local; `withStart` cria cópias independentes para cada layout |
| `STATIC_COLLIDERS` | colisores fixos (§5) |
| `NAV_NODES`, `NAV_EDGES` | grafo da companheira (§5) |
| `COLLECTIBLES`, `COLLECTIBLE_PICKUP_R` | petiscos opcionais (contam na vitória) |
| `GOAL` | objetivo: `{x, z, r}`, lugar da comemoração de cada dog, `entryPoints` (§4.5) e `celebrateRim` (borda alta de caminha que a voltinha não cruza) |
| `CAMERA` | `offset` (também define a base do WASD), `fov`, `limits`, plano da tela inicial (`title`), plano da comemoração e da vitória |

### 4.3 Iluminação (`lighting.js`, tipo `LightingPreset`)

Mesmo formato de `LIGHTING_DEFAULT` em `src/core/engine.js` (o fim de tarde da fase 1); a fase passa só o que muda:
sol, hemisférica, névoa, exposição, céu (com estrelas e nuvens), mapa de ambiente, *color grading* e *bloom*.
Cores em string hex são sRGB; arrays `[r, g, b]` são lineares. Luzes extras (lanternas, arandelas) são
`PointLight`/`SpotLight` dentro do `root`; use no máximo cerca de 6 sem sombra.

### 4.4 Cenário e props (`build`, tipo `LevelBuild`)

`build` (o `buildWorld` de `world/index.js`, trazido pelo `load` da §4.1) monta tudo dentro de `root` e devolve:

- `props`: objetos que o puzzle anima (portão, item, placas…). O formato de cada fase está em `src/types.d.ts`
  (`Fase1Props` a `Fase5Props`) e liga `LevelDef<P>`, `LevelBuild<P>` e `PuzzleContext<P>`.
  Props visuais realmente opcionais são declarados com `?`, como placa/portão no placeholder.
  O uso de `?.` no puzzle não substitui o contrato: os dublês precisam oferecer os métodos declarados,
  sem fabricar membros desconhecidos. O reset do conjunto de props deve restaurar seu estado;
  o item carregável volta à origem pelo ciclo de reset do puzzle.
- `seeThrough`: objetos que podem ficar entre a câmera e as dogs (cerca, sebe, portão, a toalha da mesa) e recebem o
  recorte pontilhado.

Peças de cenário compartilhadas (fases 4 em diante): `createRubberDuck` e `createTeddyBear` em `src/world/toys.js`
(itens carregáveis: eixo longo em X; o nome e `userData.carryKind` dizem a pose da boca; o ursinho tem `sit()`/`lie()`),
`buildTreats(root, COLLECTIBLES)` em `src/world/treats.js` (ossinhos com a animação de coleta), `createPigeon()` em
`src/world/pigeon.js` (pombo com `setPose({ x, y, z, yaw, flying, asleep })` e `peek()`) e `stripeTexture()` em
`src/world/util.js` (lona listrada). Ao usar o patinho ou o ursinho só como enfeite, renomeie o objeto e apague
`userData.carryKind` (a fase 6 faz isso na estante, no baú e no laguinho da maquete).

Mecanismo que anda num caminho (fase 6): o caminho é descrito **uma vez** no layout (`TRACK`: retas e arcos com
tangente contínua) e `src/levels/fase6/track.js` o transforma em rotas com `at(s)` e `consist(rota, s)`. O puzzle só
avança a distância `s` (com aceleração e freada) e o cenário desenha os trilhos com as mesmas peças; assim o trem nunca
sai do trilho visível. O teste `test/fase6.test.mjs` varre as rotas com o corpo inteiro (`TRAIN_BODY`) contra a cerca
e os enfeites (`YARD_DECOR`) e confere a viagem real quadro a quadro.
- `update(dt, t)`: animações do cenário (água, vagalumes, luzes).

### 4.5 Puzzle (`puzzle.js`, tipos `PuzzleContext` e `Puzzle`)

`createPuzzle(ctx)` recebe do núcleo: `layout`, `props`, `world` (colisão), `nav`, `dogs` (modelos), `ctrls`
(posição, velocidade e raio de cada dog), `emit(nome, dados)`, `cam.focusShot(x, z, {hold})`, `root`, `place(nome, x, z, yaw)`,
`activeDog`, `isStaying(nome)` e `setStay(nome, on)`.

E devolve um objeto com:

| Membro | Quando o núcleo chama |
|---|---|
| `stages`, `stage`, `carrier`, `collected`, `total` | leitura (UI, depuração, vitória) |
| `carries?(nome)` → bool | com mais de um item, se a dog leva algo na boca (passo e pose); sem ele vale `carrier === nome` |
| `objective(ativa)` → `{ text, target, stage }` | sempre que a etapa ou a dog ativa muda (texto do HUD + marcador) |
| `update(dt, { active, comp, ctrls, stay })` | todo quadro em `playing`; devolva `'delivered'` para comemorar |
| `updateAlways?(dt)` | todo quadro em `playing` e `celebrating` (animações) |
| `interact(ctrl)` → bool | E / A; `false` faz a dog latir |
| `lockFor(nome)` → `{ action, faceX, faceZ, drive?, slope?, move?, pull?, letGo?, press?, bite?, reach? }` ou null | trava a entrada (puxando corda, girando registro); `drive` = pose roteirizada (a fase move a dog, como na subida do escorregador da fase 7) e `slope` inclina o corpo; `move` = um passo que o núcleo anda com o controle e a colisão de sempre (indo até a corda ou o botão; `back`, de ré); `pull` = segurando uma corda com a boca, o direcional para longe dela puxa de ré (o eixo `ax/az` e a velocidade); `letGo` = o E ainda chega à fase (soltar); `press` = botão apertado com a pata (o alto dele no mundo e o progresso `k`); `bite` = a boca fechada numa corda; `reach` = ela vai de propósito até a coisa (a cabeça não desvia dela) |
| `lookTarget(ctrl)` | para onde a dog ativa olha |
| `modifyIntent?`, `assist?` | empurrar caixotes; "funis" que ajudam a entrar em passagens |
| `navFlags()` → `{ flag: bool }` | libera arestas do grafo (`gateOpen`, `bridge`…) |
| `reset()`, `jumpToStage?(etapa, {who})` | reiniciar; `?stage=` e testes |
| `onBark?(ctrl)`, `endActions?()`, `info?()`, `dispose?()` | latido; fim da fase; depuração; descarte |
| `speedScale?(ctrl)`, `canDash?(ctrl)`, `onDashBlocked?(ctrl)` | estado da dog que a fase controla (lama: metade da velocidade e sem arrancada) |
| `canJump?(ctrl)`, `onJumpBlocked?(ctrl)` | a fase tira o pulo por um tempo (fase 10: a Rhaenyra enlameada não pula); o núcleo emite `dog:jumpBlocked` |
| `onLick?(ctrl, lick)` → `{ stop }`, `onLickMiss?(ctrl, { blocked })` | efeito de cada lambida do Lambe-Lambe (as duas lambem: `ctrl` é quem lambeu, `lick.target` quem foi lambida; declarar `onLick` também tira a dica genérica de alcance) |
| `onStageChange` (setter) | o núcleo registra um callback para reemitir o objetivo |

Peças prontas:

- `src/game/puzzleKit.js`: `createHints` (dicas sem repetição e prompts "E Pegar…"), `createCollectibles`,
  `createCarryItem` (item na boca, com `returnHome` e `drop`), `deliveredAt` e `reach`.
- **Largar e pegar de volta** (todas as fases): com o item na boca, E larga quando não há outra ação ali (então,
  carregando, o E não late mais; no controle, o □/X continua latindo) e E perto pega de volta. `createCarryItem({ …, emit, world })` ganha `dropBy(ctrl, { avoid })`
  (ponto de `dropSpot` e a queda da boca até o chão), `putDown(x, z, opts)` (a queda até um ponto dado; `originY` para
  um encaixe, como a bandeja da fase 6), `floor`, `nearFloor(ctrl)` (alcance `FLOOR_REACH`, 0,55 m) e `update(dt)`
  (todo quadro: anima a queda e, no chão, tira o item de baixo de um caixote ou portão que passe por cima). O item pousa
  deitado do jeito dele (`REST_TILT`: laço, óculos, vela, estrela e livro de costas; a meia de lado), apoiado pelo
  ponto mais baixo da malha. `dropSpot(world, ctrl, { r, avoid })` escolhe o ponto: à frente do focinho, fora de
  colisores e do mapa, sem nada entre a dog e ele (nunca do outro lado de uma cerca ou porta) e ao alcance dela; os
  bichos que andam (`kind: 'npc'`) não contam. `inZones(lista, folga)` monta o `avoid` da fase (a entrega, placas,
  pedal, o vão de uma porta). Largado de frente para a entrega (`mouthPoint` dentro de `GOAL.r`), o item é entregue.
  Eventos: `item:drop` ao soltar e `item:land` ao pousar (o livro da fase 9 usa `book:drop`).
- `src/game/mechanics/`: `createPressurePlate` (placa que exige peso: `requires 'large' | 'any'`), `createHingedGate`
  (portão com dobradiça que não esmaga ninguém ao fechar; ao abrir, `sweepExit(ctrl)` diz se a folha vai passar
  pela dog e para onde ela sai: a fase a afasta antes, senão a colisão a arrasta e o lugar onde ela termina depende
  do fps — fase 7: pulinho assustado com `effects.pushTo`), `createPushCrate` (caixote em 2 eixos com `onLimit`; a
  Radhija nele faz força, `contact: 'strain'`, e o núcleo mostra o aviso de que só a Rhaenyra empurra enquanto ela
  insiste, `HEAVY_HINT` no `game.js`),
  `createSprinkler` (jatos giratórios que molham e empurram), `createLockedInteractable` (alavanca, registro, corda),
  `createMouthTug` (`mouthTug.js`: no E, ela anda até a corda (`lock.move`), morde e segura; o jogador puxa de ré com o
  direcional (`lock.pull`, `pulled()`), o E solta (`release`); a fase decide o que o puxão faz: os portões das fases 1
  e 10 vêm junto e terminam de abrir no embalo, o gerador da fase 10 pega no segundo puxão, os caixotes da despensa
  vêm atrás dela até a marca (`start({ yaw, speed })`: chegando pelo leste, de ré a 0,6 m/s); soltando, a trava já
  sai; o prop recebe `setGrip(tug.grip)` e desenha o ponto mordido na boca, sem esticar além de `len`) com
  `planStep`/`driveStep` (o
  passo até a coisa, andando com o controle de sempre; a fase 9 usa para chegar à frente do botão do ventilador),
  `createGooseNPC` (patrulha, alerta, investida, atração por latido), `createDogEffects` (empurrão, ações que travam a
  entrada, pelo molhado), `createMud` (lama que enlameia numa área, deixa lenta e sem arrancada e sai em placas com
  o Lambe-Lambe; liga `speedScale`/`canDash`/`onLick` do puzzle) e `createPigHerd` + `pigPenLayout` (porquinhos num
  chiqueiro com porteira: soltos, atrapalham as dogs; comida no chão distrai por um tempo; ver §7, "Porquinhos").

**Comemoração**: ao entregar, as duas dogs vão para `GOAL.celebrate`. Uma dog longe e fora do quadro reaparece
num dos `GOAL.entryPoints` (fora da câmera) e chega andando; se não chegar a tempo, termina o trajeto durante a
vitória e só então comemora. Nunca comemora parada no meio do caminho. A comemoração (pulinhos, voltinha andando,
reverência) anda a voltinha só no visual, com o controle parado; ao chegar, `celebrateLoop.js` escolhe o lado (longe
da irmã) e o tamanho que cabem sem encostar em colisor nem na irmã e sem passar por cima da borda de uma caminha
(`GOAL.celebrateRim`). Sem espaço (as duas dentro da caminha da fase 5), ela fica nos pulinhos.

### 4.6 O mapa das fases (Pandorópolis, `src/levels/mapa/`)

Jogar → Fases abre o mapa: uma fase especial fora de `LEVELS` (`createGame({ hub })`, índice `HUB = −1`), com o
mesmo núcleo (dogs, companheira, câmera isométrica, colisão, navegação) e um puzzle que nunca termina. Cada fase do
catálogo tem uma bandeirinha em `FLAGS` (mesma ordem; `test/mapa.test.mjs` cobra), na frente do lugar onde acontece.
O puzzle recebe `ctx.hub` (`HubContext`: o catálogo, o progresso salvo — `game.setProgressSource`, ligado ao da UI
—, de qual fase as dogs voltaram, `enter(index)` e `preload(index)`) e cuida dos estados das
bandeirinhas, das nuvens e da ponte (bloqueios dinâmicos por área), do atalho (`puzzle.travel`: R/L, L2/R2, 1–0,
[ ], ◀ ▶ no HUD) e da plaquinha (`map:sign`). Entrar abre o cartão de abertura da fase; o Voltar dele, a pausa e a
vitória (`ui:openMap`) voltam na frente da bandeirinha; do menu, na da próxima fase.

**Pré-carga** (`src/game/levelPreload.js`): perto de uma bandeirinha liberada o código da fase é importado (só o
import, que roda fora do quadro); a montagem do cenário fica para a entrada, atrás da cortina de carregamento.
Montar e compilar ali mesmo, com as dogs andando, travava o mapa (0,05 a 1 s por fase no PC). A barrinha da plaquinha
mostra o andamento (`map:preload`) e `loadLevel` usa o módulo já importado (`preload.take`).

**Câmera livre** (`src/game/mapLook.js`): no mapa dá para olhar em volta sem andar: arrastar o dedo ou o mouse na
tela, o analógico direito, a rodinha ou a pinça (aproximar e afastar, `cameraRig.setZoom`). O deslocamento soma ao
alvo da câmera (até 45 m) e volta para as dogs quando elas andam ou com o atalho.

**Cenário**: cada lugar de fase é a fase em miniatura, com as peças que a fazem (`world/casa.js`: fases 1, 5 e 8;
`world/condominio.js`: 2, 3, 4, 6 e 7; `world/chacara.js`: 9 e 10). As casas das fases que acontecem dentro de casa
ficam em corte de maquete (`pecas.openHouse`: as paredes do lado da câmera baixas e o telhado aberto como tampa, com o
mobiliário da fase dentro). `world/kit.js` junta as peças fixas (cores por vértice, com índice e a base um pouco mais
escura) por material e por região de 20 m (poucas malhas para a cidade inteira, com recorte da câmera por região);
caixas arredondadas saem de um molde por número de segmentos; as plantinhas de vaso e floreira são moitas leves
(`pecas.flowerBush`) e as coisas repetidas que se mexem (gotas de chuva, jatos do chafariz) são instâncias.
A sombra do sol cobre só a vizinhança do que a câmera olha (`engine.focusShadow`). Tudo o que fica em pé colide
(`STATIC_COLLIDERS`), e o mapa liga a grade de colisão (`COLLISION_GRID`, §5).

## 5. Colisão e navegação

**Colisão** (`src/game/collision.js`): o corpo de cada dog é um círculo no plano XZ. Formatos de colisor:
`box {x, z, hx, hz}` (alinhada aos eixos), `circle {x, z, r}` e `segment {ax, az, bx, bz, t}` (cápsula com
meia-espessura `t`). Opções:

- `blocks`: `'all'` (padrão), `'large'` (só a Rhaenyra: aberturas onde só a Radhija passa) ou `'small'`;
- `except {minX, maxX, minZ, maxZ}`: ignorado quando o centro da dog está dentro (água sob uma ponte);
- `companionOnly`: só a IA da companheira desvia (o disco do irrigador ligado);
- `kind`: informativo (`'water'`, `'gate'`…), aparece nos contatos;
- `jumpable`: obstáculo baixo (tronco, mureta baixa) que não bloqueia quem está no ar, ou seja, a Rhaenyra pulando.
  Sem essa marca, nada é pulável: as paredes, cercas e portões das fases continuam bloqueando no ar. Com `height`
  (o alto dele), descendo do pulo abaixo desse alto (`opts.lowY`), ele só deixa passar quem já o tem embaixo do corpo
  (`opts.over`): chegando baixa demais, a dog bate na lateral. `world.jumpableTop(x, z, yaw, body, r, size, depth)` é
  o alto do mais alto deles em que o corpo entra (o pulo e o desenho usam).

Colisores dinâmicos são registrados pelo puzzle com `world.addDynamic({...})`, que devolve o próprio objeto: mova
`x/z/ax…` e ligue/desligue com `enabled`. O movimento usa sub-passos de no máximo 0,45 × raio, então nem a arrancada
atravessa paredes finas (há teste de regressão para isso em todas as fases).

O corpo é mais comprido que o círculo: o peito e a garupa vão em dois círculos menores presos ao rumo da dog
(`DOG_CONFIG[nome].body = { front, back, r }`: até onde o peito vai à frente do centro, até onde a garupa vai atrás e
o raio dos dois; `world.resolveBody`, chamado pelo `integrate` do controle). Eles empurram o centro para fora do que
invadem e o círculo do meio manda: os vãos continuam os mesmos (os dois são mais estreitos que ele) e, onde os três
não cabem (girando num corredor justo), fica o do meio. De frente para uma parede a dog para uns 3 cm antes (o peito
encosta); os contatos do peito e da garupa entram em `c.hits` e na batida. Quem desloca a dog por fora do `integrate`
chama `resolveDogBody` (do controle) para o corpo também ficar fora: os empurrões das mecânicas (`createDogEffects`:
irrigador, gansa, porcos, portão da fase 7) e a irmã cedendo espaço (`separate`/`softBlock` do `game.js`); as poses
roteirizadas (`lock.drive`, impulso na parede, empurrão em pé) não. A cabeça, que vai além do peito, desvia no
desenho do modelo novo (`src/dogs/v2/head.js`, §7), sem mudar o jogo.

**Chão de pisar** (`src/game/ground.js`): coisas baixas marcadas no desenho com `userData.walkable` (placas, pedais e
botões do chão, as caminhas e a almofada do gato) viram chão: `heightAt(x, z)` é o alto delas embaixo do ponto, por um
raio para baixo no desenho de agora (até 30 cm, ou o alto que `walkable` der em metros; só malhas, porque um sprite sem
câmera quebra o raycast do three.js). O corpo apoia no que está embaixo das patas da frente e das de trás
(`bodyGround`, suave no `game.js`) e o modelo novo pisa pata por pata (`gait.js`: a pata no balanço passa por cima do
que vem à frente; a apoiada que gira para cima de algo sobe nele). **Bordas** (`userData.rim`, a borda alta e fofa das
caminhas grandes: fases 5 e 8 e a Arena dos Porquinhos): andando para ela, para entrar ou sair, a dog dá um pulinho
por cima (`ground.planRimHop` decide, `game.js` `hopOverRim` chama `startHop` do controle: o caminho do pulo, com um
arco de topo largo; as duas pulam, sem `dog:jump`; o pouso sai em `dog:land` com `hop`, baixinho e sem poeira). Indo
para um lugar antes da borda (a comemoração perto dela), não pula. Com o anel da borda (`rim: { r, t }`), do lado de
fora ela segura o corpo de quem está no chão (`ground.pushOffRims`, `game.js` `keepOffRims` depois de cada movimento):
ninguém fica parado em cima dela; dentro, livre. O que muda de lugar (`userData.moving`: a caixa de almofadas da fase
5, que é empurrada, e as almofadas que saem dela desmontada) leva o círculo junto a cada consulta. O chão mede cada
desenho com a posição dos pais (`updateWorldMatrix`):
o jogo o monta antes do primeiro quadro. As caminhas pequenas para as duas (fase 2 e Arena do Empurrão) são sólidas
(colisor `caminha`). Empurrando de pé, as patas da frente apoiam no desenho do objeto, medido
por raios horizontais na largura do peito (`src/game/pushRest.js`: cinco raios; a face, a beirada e a altura das
patas, pulando frestas), não na caixa de colisão; um pé fino (o cano do ventilador) só vale sem face larga ao alcance,
e aí as patas o abraçam (`round`, centradas nele por `lat`); sem nada ao alcance, o eixo do meio do desenho. Na pose, a
medida nova chega suave (sem a pata pular entre o cano e a grade) e, de pé, o joelho de trás aponta para a frente no
chão (com o tronco inclinado, o "para a frente" da garupa ficava na direção da perna e o joelho abria para o lado).
Desempenho (retorno do usuário: o fps caía segurando o R1 para empurrar): uma medida são ~110 raios; cada raio só testa
os triângulos das malhas cuja caixa ele cruza, da mais perto para a mais longe, até o primeiro acerto (`nearestHit`,
o mesmo resultado do Raycaster: de 30–38 ms para 3–4 ms no carrinho e no caixote, metade no ventilador, cuja grade
de aros finos ainda é testada), e `game.js` (`pushFace`) guarda a medida por objeto e por lugar da dog (lado, posição
na face de 4 em 4 cm e rumo de 0,1 em 0,1 rad: o desenho só anda, não gira), medindo um lugar novo no máximo a cada
0,25 s; entre uma medida e outra, a distância até a face acompanha a colisão e o pé fino acompanha a dog
(`debug.pushMeasures` conta as medidas; testes em `test/chao.test.mjs`).

**Navegação** (`src/game/navigation.js`, `companion.js`): a companheira anda em linha reta quando enxerga a líder;
senão segue o grafo `NAV_NODES`/`NAV_EDGES` (Dijkstra com várias origens). Cada aresta pode exigir
`{ requires: 'small' | 'large' | flag }`, e as flags vêm de `puzzle.navFlags()`. Sem caminho, ela espera no nó
alcançável mais próximo da líder e senta. Os testes de navegação conferem, para toda fase registrada, que os nós
estão livres, que as arestas não atravessam colisores e que o grafo é conexo com todas as flags ligadas.

**Grade de colisão** (mapas grandes): com `layout.COLLISION_GRID` (lado da célula, em m), os estáticos ficam numa grade
e cada consulta (`contacts`, `resolve`, `resolveBody`, `overlaps`, `jumpableTop` e a cabeça do modelo novo, por
`world.staticsNear`) só olha os das células em volta. As fases não ligam a grade e continuam com a lista inteira; o
mapa das fases (206 colisores) liga, e `test/mapa.test.mjs` confere que o resultado é o mesmo da lista inteira.

### 5.1 Cheiro (superbafo)

`src/game/mechanics/scent.js` cria, por fase, o campo de cheiro que o núcleo entrega ao puzzle como `ctx.scent`
(desenho em `src/fx/scentView.js`). Regras, todas determinísticas:

- **Nuvem**: nasce com um empurrão, desacelera e se espalha devagar (o raio cresce) até sumir (~5 s). Não atravessa
  paredes: colide como um círculo pequeno e passa onde a Radhija passa. O sopro leva a origem (`fromX`, `fromZ`, o
  centro dela): a nuvem vai dali até a boca, 0,36 m à frente, sem atravessar nada. Com o focinho encostado numa parede
  ou num duto, a boca fica dentro dele, e antes a colisão podia empurrar a nuvem para o outro lado (o furo do duto da
  fase 4, `test/duto-sem-atalho.test.mjs`).
- **Vento** (`scent.addWind({ x, z, dirX, dirZ, length, halfWidth, strength })`): faixa a partir de uma origem; dentro
  dela a nuvem é levada pela corrente e fica compacta. O objeto devolvido é mutável: mova a origem junto com o
  ventilador ou desligue com `enabled`.
- **Duto** (`scent.addDuct({ inlet: {x, z, r}, outlet: {x, z, dirX, dirZ}, travel, active() })`): com `active()`
  verdadeiro, a nuvem que chega à boca some e sai pela outra ponta `travel` segundos depois. A boca virada para um
  lado (`inlet.dirX`, `inlet.dirZ`, como as caixas da fase 4 e da Arena do Bafo) só engole a nuvem que está na frente
  dela; sem direção, de qualquer lado (o funil da fase 10). Saída no alto
  (`outlet.y`, a altura da boca, como o cano da fase 10 e o duto da fase 4): a nuvem sai e fica nessa altura (o
  desenho e a poeirinha da saída também); lá em cima ela passa por cima dos colisores, do vento e das bocas do chão, e
  quem está no chão não a alcança (`near`).
- **Nariz** (`scent.addNose({ id, x, z, r, onSmell(nuvem) })`): alvo que reage uma vez por nuvem. É aqui que entram
  os tipos de alvo: animais que fogem (os pombos da fase 4 e da Arena do Bafo), mecanismos que espirram, plantas que recolhem.
  O nariz mede só a distância no chão: um alvo que só deve reagir ao cheiro de um duto confere `nuvem.duct` no
  `onSmell` (o pombo do portão da fase 4 e o da Arena do Bafo, o pombo da fase 10, o Bichano da fase 9).
- **Prévia**: `scent.preview(tiro)` roda a mesma simulação sem efeitos; é o que a mira desenha.

Eventos: `scent:spawn`, `scent:duct`, `scent:exit`, `scent:smell`, `scent:fade`. Fases que não registram vento,
duto nem nariz (as fases 1–3 e 5) têm nuvens que só se espalham e somem.

## 6. Entrada

| Ação | Teclado | Controle (PlayStation · Xbox, por posição) | Toque (celular) | Código lógico |
|---|---|---|---|---|
| Mover | WASD / setas | analógico esquerdo (velocidade proporcional) / D-pad | joystick virtual (proporcional) | `axis()` |
| Pular · impulso na parede (Rhaenyra) | Espaço | ✕ · A | Pular | `Jump` |
| Interagir / latir | E | ○ · B | Agir | `KeyE` |
| Latir | — | □ · X | (Agir, sem nada perto) | `Bark` |
| Fica / Vem (companheira) | F | △ · Y | Fica · Vem | `KeyF` |
| Superbafo (Radhija): segurar mira, soltar sopra | R | R2 · RT | Superbafo | `bafo()` |
| Lambe-Lambe (as duas, perto da irmã): segurar | L | L2 · LT | Lamber | `lick()` |
| Arrancada (Radhija) / empurrar (Rhaenyra), segurar | Shift | R1 · RB | Arrancada · Empurrar | `shift()` |
| Empurrão em pé (Rhaenyra, de frente para algo empurrável no alto), segurar | Shift | R1 · RB | Empurrar (segurar) | `shift()` |
| Trocar de cachorrinha | Q | L1 · LB | Trocar | `KeyQ` |
| Pausar | Esc | Options · Start | botão do canto | `Escape` |
| Menus | setas, Tab, Enter confirma, Esc volta | D-pad/analógico, ✕ confirma, ○ volta | tocar nos botões (Voltar no canto) | |

A UI desenha os botões nos dois estilos (`PAD_BTN` em `src/ui/markup.js`) e mostra o do controle conectado:
Xbox se o id do controle tiver "xbox"/"xinput", PlayStation nos demais casos (padrão).

`src/game/input.js` traduz o controle para os mesmos códigos lógicos do teclado, então o jogo não sabe de onde veio
o comando. Ao voltar de um menu para o jogo, os botões segurados ficam travados até serem soltos (`latchPad`):
o ✕ que confirma "Começar" não vira pulo, o ○ que volta da pausa não vira latido e o R2 não vira bafo. Os menus da UI leem o controle à parte (`src/ui/menuNav.js`).

**Toque** (`src/ui/touchControls.js` → `input.touch`): joystick à esquerda (flutuante: tocando fora do aro, ele vem
para baixo do dedo; `touchStick` usa a mesma zona morta e curva do analógico) e botões à direita (`TOUCH_BUTTONS`):
Agir no canto e, em volta, Pular, Arrancada/Empurrar (toque = arrancada, segurar = empurrar), Lamber (segurar) e
Superbafo (segurar e soltar); acima, Trocar e Fica/Vem; a pausa no canto de cima. Os rótulos acompanham a dog ativa
(`.rr[data-dog]`): Arrancada vira Empurrar, o Superbafo fica apagado com a Rhaenyra (apertar dá a dica) e o Fica vira
Vem. O teste `toque` confere que nenhuma caixa de botão encosta em outra nem no HUD. Multitoque por Pointer
Events: um dedo no joystick e outro nos botões; arrastar o dedo de um botão para outro troca. O dispositivo atual
(`input.device`, evento `input:device`) é `keyboard`, `gamepad` ou `touch`: um dedo na tela (pointerType touch/pen)
liga os controles de toque e as dicas passam a mostrar os ícones dos botões (`.k-touch` em `glyph()`); uma tecla ou o
controle os escondem. Os controles só aparecem durante a partida, fora da cortina e das telas de menu.

**Pulo** (`dogController.js`): só quem tem `jumpHeight` nas estatísticas (a Rhaenyra). Arco de altura fixa
(`jumpHeight`, ~0,5 m) e duração `jumpTime` (~0,42 s), com impulso horizontal mínimo `jumpSpeed` na direção da
entrada (parada, pula no lugar) e pouco controle no ar. No ar, ela ignora colisores `jumpable` e não pisa em placas de
pressão; não pula na postura de empurrar. A companheira não pula: arestas do grafo que cruzam obstáculos puláveis
exigem uma flag que nunca liga, e ela espera do lado de cá. Colisores dinâmicos também podem ser puláveis: a fase 5
marca o portãozinho e a caixa de almofadas com `col.jumpable = true`. Quem não pula (a Radhija) ganha a dica
"Só a Rhaenyra pula! (Q)". Eventos: `dog:jump` e `dog:land`.

Na descida (a segunda metade do arco), o que ela pula é sólido de lado abaixo do alto dele, menos o que ela já tem
embaixo do corpo (collision.js). O arco não acaba dentro de uma coisa: com o corpo em cima dela, se seguindo em frente
(com as paredes, `clearsAhead`) sai de cima em até `JUMP_CLEAR` (0,3 s) depois do fim do arco, ela segue no ar até lá
(`c.clearT`); senão escorrega de cima pelo lado mais perto, até um ponto decidido quando começa, com folga para as
dianteiras esticadas (`c.slideOff`, `c.slideX/Z`). Antes, a colisão a jogava para fora de uma vez (até meio metro num
quadro). No desenho (`game.js`, `jumpableUnder`), o corpo fica acima do alto da coisa em que o
tronco entra e, passada ela, cai com a gravidade do pulo; o pouso (`dog:land`, a pose) espera o desenho chegar ao
chão. A pose é de quadrúpede (`dogAnimation.js`): decolando, gira sobre o quadril (a frente sobe primeiro, as
traseiras empurram); descendo, sobre os ombros (as dianteiras pousam primeiro, a garupa desce depois). Uma pata de cada
par vai na frente (`JUMP_LAG`, troca a cada pulo) e o corpo desenhado acelera para cima no empurrão (`TAKEOFF`, no
`game.js`; o arco da colisão sai na hora).

Logo depois de `startJump`, `fitJump` olha o caminho do pulo: havendo o que ela pula pela frente, o arco estica (até
`FIT.time` do tempo, a coisa no meio dele) e sobe (até `FIT.height` da altura) o quanto o tronco precisa para passar por
cima, numa parábola só (`c.jumpH`, a altura deste pulo).

**Impulso na parede** (`dogController.js` + `src/game/mechanics/wallButton.js`): o mesmo pulo, de frente para uma
parede marcada com patinhas pintadas. A fase oferece os pontos em `puzzle.wallSpots()` (`WallSpot`: pé da parede,
normal, altura do que a pata toca e as medidas do desenho); com a Rhaenyra a até `wallReach` (0,8 m) do ponto de
impulso, do lado de cá e de frente (analógico ou, parada, o corpo), Espaço/✕ começa um movimento roteirizado de
`wallJumpTime` (1,05 s): ela avança até a parede, fica de pé, as traseiras pegam impulso nas patinhas, uma dianteira
alcança o alto em `WALL_TOUCH` (52%) e ela volta ao chão `wallBack` m afastada. A posição anda com colisão
(`integrateWall`), nunca atravessa nada; a pose (corpo girando no quadril, IK com alvos na própria parede) fica em
`dogAnimation.js` (`wallK`, quadros-chave `WALL_*`). No meio do impulso não há outro pulo, arrancada nem lambida; a
placa de pressão não conta quem está nele; trocar de dog deixa a Rhaenyra terminar como companheira; pausa congela;
reiniciar cancela sem toque. O toque emite `wall:touch` e chama `puzzle.onWallTouch(ctrl, spot)` uma vez por impulso.
Fora de um ponto marcado, ou de costas, é o pulo comum. Eventos: `dog:wallJump {id, top}`, `wall:touch {id, y}`.
`createWallButton` dá o botão (com tempo e anel de luzes), a alavanca (liga/desliga) e o modo "uma vez"
(`wall:button {kind, on}`, `wall:tick {left}`, `wall:timeout`); o desenho é `buildWallButton` (`src/world/wallButton.js`).
Demonstração: a parede de treino da Arena do Pulo (`?level=pulo&play`).

**Empurrão em pé** (`dogController.js` + `src/game/shove.js` + `src/game/mechanics/shoveTarget.js`): a mania da
Rhaenyra de empurrar ficando de pé. O mesmo empurrar (Shift · R1/RB · Empurrar segurado), de frente para algo empurrável
no alto que a fase oferece em `puzzle.shoveSpots()` (`ShoveSpot`: pé da superfície, normal, altura das patas `y`, meia
largura `w` e `over` quando as patas apoiam em cima de uma beirada), vira um movimento roteirizado (só dogs `large`):
com ela a até `SHOVE_REACH` (0,4 m) de onde fica encostada, do lado de cá e de frente (analógico ou corpo) e nada no
caminho, ela se ergue e chega ao ponto já de pé (`SHOVE_UP`, 0,46 s), empurra em ciclos de `SHOVE_CYCLE` (0,66 s)
enquanto o botão estiver seguro (cada empurrão conta em `SHOVE_HIT` do ciclo, só encostada: `shoveHit` →
`dog:shove {id, kind, n}` e `puzzle.onShove(ctrl, spot, ctrls)`) e volta às quatro patas recuando `SHOVE_BACK` (0,16 m,
para o focinho não ficar na coisa) em `SHOVE_DOWN`. Um toque dá um empurrão; soltar termina o ciclo em curso. A posição
anda com colisão (`integrateScripted`, a mesma do impulso), nunca atravessa o que ela empurra; no meio não há pulo,
arrancada, lambida nem E; trocar de dog deixa a Rhaenyra terminar o empurrão como companheira; fora da partida ela
desce; pausa congela; reiniciar cancela. A irmã não é empurrada (pedido do usuário). A pose fica em
`src/dogs/shovePose.js` (funções puras: `shoveStand` dá o ângulo do corpo pela altura do apoio, ≈ 50° num tronco, 60°
numa mesinha e 70° num tampo alto, o quadril e o alvo das patas; `shoveBeat` dá o ciclo de cada empurrão pelos quadros
`SHOVE_COCK`, `SHOVE_JOLT`, `SHOVE_PRESS` e `SHOVE_GROWL`) e é aplicada em `dogAnimation.js` (`shoveK`, `shoveCycle`,
`shoveN`, `shoveGap`, `shoveY`, `shoveOver`): o empurrão sai das patas da frente e dos ombros (as patas armam e batem
esticando, o peito dá um tranco curto para a frente), o quadril e as traseiras ficam parados, e a cada empurrão ela
solta uma rosnadinha (som `shoveGrowl` e boquinha franzida). `createShoveTarget` dá o empurrável: uma mola de balanço por
tipo (`SHOVE_SWAY`: a árvore balança pelo pé com a copa atrasada; a mesinha e a estante tombam pela aresta de trás e
voltam aos pés) e o item lá em cima, que no `pushes`-ésimo empurrão (3) cai do outro lado: escorrega até a beirada ou
se solta dos galhos, cai com gravidade, quica e rola até o primeiro ponto livre de `item.land` (sem colisor nem dog),
sem passar do chão em nenhum giro (`fallPath`). Eventos `shove:hit`, `shove:drop`, `shove:bounce`, `shove:settle` e
`shove:land`. Os visuais estão em `src/world/shoveProps.js` (arvorezinha, mesinha, estante baixa). A Radhija não fica
de pé (o Shift dela é a arrancada). Demonstração: a Arena do Empurrão (`?level=empurra&play`).

**Superbafo** (`game.js` + `src/game/mechanics/scent.js`): só quem tem `bafoSpeed` nas estatísticas (a Radhija).
Segurando R/R2 ela para e mira (gira com o analógico) e uma prévia no chão mostra o caminho provável da nuvem;
soltando, "HÁÁÁ!": nasce uma nuvem na frente dela (`dog:bafo`). Depois ela fica toda orgulhosa; a Rhaenyra perto
de uma nuvem vira a cara (`dog:yuck`). Mirar é cancelado ao pausar ou trocar de dog. Ver §5.1.

**Lambe-Lambe** (`game.js`): L/L2 com qualquer das duas (as duas têm `lickStroke`/`lickReach` nas estatísticas; a
Radhija lambe mais rapidinho). Pertinho da irmã (até `lickReach`), a dog ativa escolhe o ponto do corpo da irmã mais
perto (garupa, flanco, bochecha ou focinho, nas medidas da irmã), encosta (`lick:start`; quem é menor para mais perto,
`lickDist`), vira para ele e lambe em ritmo enquanto o botão estiver seguro: cada lambida dura `lickStroke` s e chega
à irmã no meio do ciclo (`dog:lick {name, target, x, y, z, stroke}` e `puzzle.onLick(quemLambeu, lick)`). A irmã fica
parada, vira a cabeça e reage a cada lambida (`action 'licked'`, no mesmo `lickPhase`); lambida pela irmã menor, a
Rhaenyra abaixa a cabeça para ela. Com o ponto acima da boca (a Radhija na bochecha da Rhaenyra, `anim.lickY`), quem
lambe ergue o peito e estica o pescoço para cima em vez de baixar a cabeça. Soltar termina a lambida em curso
(`lick:end`); trocar de dog, reiniciar ou sair encerram; pausar congela. Lambendo não há pulo, arrancada nem
superbafo, e mirando ou soprando não começa lambida. Longe da irmã é só uma lambidinha no focinho (`dog:lick` sem
alvo; numa fase que não declara `onLick`, a dica ensina o alcance); com a boca cheia, não lambe. A lama da fase 7 é
`createMud` (§4.5): só a lambida da Rhaenyra limpa a Radhija (a da Radhija na irmã é carinho, com dica para trocar).
O visual fica no modelo (`dog.setMud(k, pontosLimpos)`, `dog.setShine(k)`).

**Fica / Vem**: F alterna a companheira entre seguir e ficar sentada onde está. Quem vira ativa perde o "Fica";
depois de trocar (Q), a nova companheira espera 0,6 s antes de seguir, para dar tempo de apertar F.

**Extras** (escondidos de propósito; não remover): pedido do responsável pelo projeto, que conta o segredo a quem
quiser. Nada no jogo os anuncia: nenhuma dica, menu, tela de controles, conquista ou texto, e nada no README
(`test/extras.test.mjs` confere a UI e o README). `src/game/extras.js` cuida de duas coisas (os caminhos andados, a
voltinha e os zoomies, ficam em `walkPath.js`, junto com os da parada por muito tempo).
- **Cocô**: código lógico `KeyC` (tecla C; R3 = `PAD.RS` no controle; o toque não tem). Só funciona com os ossinhos
  todos da fase pegos, uma vez por tentativa (reiniciar libera de novo) e com a dog ativa parada no chão, sem nada na
  boca. Três partes, com as poses em `dogAnimation.js`:
  - voltinha (`poopPre`): ela fareja e anda um círculo pequeno de verdade (0,5 × o comprimento dela, de 0,8 a 1,3
    volta, terminando de perfil para a câmera), com o passo igual ao deslocamento e os apoios girando com o corpo na
    curva. `planCircle` só aceita um caminho sem colisor (`overlaps` do mundo), sem a irmã e com o chão livre onde o
    cocô cai; sem espaço, o raio diminui, a volta vira meia volta ou um quarto, ou ela só fareja parada (sem chão
    livre por perto para o cocô, o C não começa). Nunca gira sem andar;
  - agachada (`poopK`, `POOP_TIME` s): corcunda, com a garupa a meia altura (baixa demais parece xixi); faz força,
    solta o cocozinho de `src/world/poop.js` e cava com as traseiras. A irmã no automático dá espaço o tempo todo (se
    afasta andando até 1,45 m, com colisão, e espera; com o Fica, não sai do lugar) e vira a cara na hora;
  - comemoração (`party`): o cocô brilha dourado (`poop.shine()`, com feixe de luz e estrelinha), toca o jingle
    `extraSecret` e a câmera chega perto. Ela sai em zoomies (`planZoom`: dispara, faz a curva e freia de frente para
    o cocô, só se couber) ou dá um pulinho virando meia volta; depois a reverência de brincadeira, dois pulinhos e
    orgulhosa. A irmã até 6 m se espanta e manda coraçõezinhos (`cheer`).
  Se algo que se mexe entrar no caminho, ela para ali. Eventos em `extras.js` (`extra:secret`, `extra:zoom`...).
- **Animações do cenário**: `extras` na definição da fase (`src/levels/faseN/extras.js`, tipo `ExtraSpot`). Com o E
  perto e de frente para o ponto, quando a fase não usou o E, a dog bebe, come, cava, cheira e espirra, focinha a
  bola, rola, balança ou leva um esguicho. Valem sempre, com a boca vazia (com um objeto na boca não dá para comer,
  beber ou cheirar) e fora do superbafo e do Lambe-Lambe; o cocô também pede a dog parada. Ganchos do cenário em `LevelBuild.extras`: o balanço da fase
  7 e a bolinha da fase 6. Ao rolar, a altura do corpo vem do contato com o chão (`lowestY` em `dogAnimation.js`:
  as formas do desenho do modelo presas aos ossos, com a pose do quadro), então nada passa do chão em nenhum ângulo.
- **Parada por muito tempo** (`src/game/idle.js`, pedido do usuário na etapa 5): sentar já vem da animação (parada de
  4 a 8,5 s, sorteado a cada parada e para cada dog); o módulo conta, por dog, quanto ela está parada e livre (a ativa
  sem o jogador mexer nela, sem trava, extra nem cocô, no chão) e manda `anim.idle`. Os tempos são sorteados a cada
  parada, e uma irmã não começa o que a outra acabou de começar (`IDLE.apart`; retorno do usuário: "as duas fazem a
  mesma ação ao mesmo tempo"):
  - deita entre 20 e 34 s e fica (a cabeça descansa nas patas depois de 9 s, de olhinho fechado);
  - xixi agachada, raro (12% das paradas, entre 1,5 e 3,5 s; no máximo um a cada 4 min por dog e nunca até 90 s
    depois do da irmã), em pé, no chão de verdade, sem nada na boca, sem o Fica, a companheira só seguindo a irmã de
    perto (esperando por uma irmã que ela não alcança, nunca: a IA a levaria de volta) e só com espaço para sair dali
    (`dog:pee`: a poça discreta que seca, `feedback.js`). Depois (retorno do usuário: "não deixe ela sentar no mijo, faz ela levantar,
    dar uma cheirada no mijo e então ela senta em outro lugar, tudo andando naturalmente"), ela anda até a poça
    (curva-reta-curva, `walkPath.dubinsPaths`: nada de girar parada), fica de frente com o focinho em cima dela e
    cheira (`dog:sniff`), sai andando por um caminho que não passa por cima da poça e senta perto da irmã, de frente
    para ela, a até `IDLE.after.near` m (ou num lugar livre em volta), longe da poça (`anim.idle.kind` 'sit'). Os caminhos não encostam em
    colisores, bordas de caminha nem na irmã (`IDLE.after.pass` entre os centros); a trava `lockFor` pede `drive` (o
    núcleo não a desloca; `idle.step` a anda antes de pôr o corpo no lugar, com a velocidade e o giro de verdade para
    as patas). Algo entrou no caminho: ela para ali (perto da poça, fica em pé: 'stand');
  - coçar está desligado (`IDLE.scratch.on`): o usuário pediu para deixar de fora por enquanto; a pose (sentada, a
    traseira no pescoço) continua em `dogAnimation.js` e no sandbox (`idle=scratch`).
  Qualquer movimento ou comando a levanta (a ativa solta a trava no mesmo quadro). O xixi é sorteado e tira a dog do
  lugar: o jogo headless dos testes (`createHeadlessGame`, a não ser com `pee: true`) e as partidas E2E (o `load` do
  harness) o desligam com `game.debug.idle.setPee(false)`. As poses ficam em `dogAnimation.js`
  (os dois modelos; no novo, a locomoção sai no xixi: `w.pee`). Testes em `test/parada.test.mjs` (a agenda, a sequência
  depois do xixi com e sem o jogo, as irmãs fora de compasso) e nos casos de `test/dogV2.test.mjs`; sandbox
  `idle=scratch|lie|pee` e capturas 60–63.
- Uma fase nova precisa de três ossinhos (a fase 10, a última, tem cinco) e de pelo menos um ponto em `extras`
  (`test/extras.test.mjs`). A suíte E2E
  `extras` e `tools/scripts/capture-extras.mjs` mostram tudo na nuvem.

## 7. Personagens

**Configuração** (`src/dogs/config.js`): `DOG_CONFIG` contém os atributos comuns, sem coordenadas,
e é protegido contra mutações, incluindo `visual`. `withStart(nome, start)` cria uma configuração
independente, copiando também `visual` e a posição recebida. Os layouts mantêm seus próprios pontos
de entrada; o modelo visual lê a configuração comum, sem importar uma fase. Os controladores são
criados uma vez e conservam a configuração da primeira fase carregada: variar atributos por fase
não faz parte deste contrato; só a posição é reaplicada ao trocar ou reiniciar.

**Dogs** (`createDog(nome)` em `src/dogs/dog.js`, tipo `DogModel`): `object`, `mouthSocket` (pendure o item aqui,
com posição zerada), `markerAnchor`, `onFootstep(i)`, `update(dt, anim)`, `triggerBark()`, `setCarryPose(tipo|null)`,
`carryKind` e `setWet(0..1)`. `anim` = `{ speed, turn, turnTo, action, lookAt, carrying, jump, airK }` (`jump` = altura
do pulo, `airK` = progresso 0..1 no ar ou −1 no chão, `turnTo` = quanto falta virar até o rumo pedido, `c.wantYaw` do
controle: a cabeça vai na frente na curva e o tronco vem atrás com mola; `pressAt`/`pressK`, a pata apertando um botão;
`reach`, indo de propósito até a coisa); ações: `none`, `sit`, `push`, `strain`, `tug`, `press`, `celebrate`, `sniff`,
`dash`, `turn`, `shake`, `startled`, `jump`, `bafoAim`, `bafo`, `proud`, `yuck`, `shove` (empurrão em pé: os campos
`shove*` estão em `DogAnim`, `src/types.d.ts`). Empurrando um caixote ou carrinho (`push`, ou `strain` fazendo força
nele), o núcleo manda `pushGap`/`pushTop` (distância do centro à face e altura dele, de `kind` `'crate'` ou `'cart'`
na frente da dog; a altura vem do `height` do colisor): ela fica de pé nas traseiras, com as patas da frente na face
(ou em cima da beirada, se ele é baixo), a pose do empurrão em pé, e anda nas traseiras em passinhos curtos; fazendo
força, elas patinam no lugar. Sem caixote ou carrinho na frente (puxando a corda, no escorregador), a pose de sempre.
A pose de boca é detectada pelo nome
(ou `userData.carryKind`) do objeto no `mouthSocket` ou pela forma dele.

Por dentro: `dogModel.js` e `sdf.js` geram a malha (SDF → Surface Nets → SkinnedMesh) e `furMaterial.js` o pelo;
`dogRig.js` monta o esqueleto e a IK das pernas; `dogFace.js`, o rosto; `carryPose.js`, o item na boca;
`dogAnimation.js` resolve a pose a cada quadro (é o arquivo para mexer em animações; o pulo está lá: decolando, as
traseiras para trás e as dianteiras já dobrando; no meio, encolhida, com as patas dobradas e as costas arredondadas;
descendo, as dianteiras desdobram e pousam primeiro, as traseiras dobradas até o fim; o pouso afunda e volta com mola,
mais forte quanto mais alto o pulo. Na curva, o corpo tem inércia (`st.dev`, movida pelas mudanças do giro): o tronco
fica um tiquinho para trás e, ao parar de virar, passa e volta, com a cabeça na frente; a inclinação e o "molejo" de
arrancar e frear também são molas. De ré (`anim.back`, puxando uma corda), as patas andam ao contrário).

**Modelo novo (o padrão desde a etapa 5)** (`src/dogs/v2/`, `createDogV2(nome)` com a mesma API de `createDog`):
esqueleto de 38 ossos (`skeleton.js`: coluna e pescoço em dois gomos, escápulas, pulso separado da pata, mandíbula,
orelhas em três gomos e rabo em cinco; os nomes antigos continuam valendo), desenho revisto pelas fotos (`design.js`:
focinho mais comprido, orelhas mais longas na Rhaenyra e mais grossas nas duas, cabeça da Rhaenyra quase do
tamanho da da Radhija, barriga recolhida; as orelhas são desenhadas dos dois lados) e a mesma malha procedural
(`buildGeometryFromDesign` em `dogModel.js`, com o índice de ossos do esqueleto novo). Na etapa 1 a pose ainda vem da
animação atual: um esqueleto atual invisível é animado por `dogAnimation.js` e cada osso novo copia a pose do osso
correspondente (`retarget.js`; os gomos novos dividem a curva entre as pontas). `contacts.js` calcula o ponto mais
baixo do corpo com as formas do desenho; se a pose afundaria no chão (`GROUND_TOLERANCE`), o corpo gira sobre as
patas apoiadas do outro lado (sentada, as da frente continuam no chão e a garupa sobe) e, se ainda faltar, sobe.
Por cima da pose do guia, o modelo novo já tem: a locomoção própria (`gait.js`, etapa 2: andando, trotando,
galopando ou girando, a pata apoiada fica plantada no chão do mundo (mede o quanto o corpo andou e girou; parada no
mundo com velocidade, como no sandbox, vale a velocidade da animação), o balanço pousa onde a pata vai estar no meio
do próximo apoio, as dobras do pulso, do jarrete e dos dedos são as do modelo atual (a pata não estica), a escápula
acompanha um pouco a pata, o tronco desce até 1 cm quando a passada pede alcance e, ao parar, cada pata fora do lugar
dá um passinho; o ritmo é o do guia (numa curva fechada acelera até 1,35× e, além disso, a pata gira com o corpo,
como num pivô), e as poses com as patas (sentar, pular, empurrar, extras, a comemoração inteira e a voltinha antes do
cocô) ficam com ele: `locomotionGate`; na troca, os alvos das juntas são misturados, não as rotações), a pata que
não atravessa o chão (`dog.js`, gira no tornozelo; a correção do chão do corpo muda no máximo 0,5° e 2 mm por
quadro), a rolagem própria (`roll.js`, enquanto o extra `roll` roda: tomba
pelo ombro, de costas em "C" com as patas dobradas, se esfrega e volta; o corpo fica apoiado no chão) e orelhas com
física (`physics.js`: correntinhas com mola, inércia, gravidade e chão; a pose do guia é o descanso), e o rabo também,
bem mais firme (cinco gomos presos na garupa; só atrasa um pouco nas curvas, no pulo e ao parar). Na arrancada
(etapa 4), o compasso das patas já é o da velocidade de agora (o ritmo do guia demora uns décimos de segundo para
acompanhar), as patas no tempo do balanço saem logo e a de trás dá um passo de conforto antes de a perna ficar reta.
Saindo de uma pose do guia já andando (pousou do pulo, soltou o empurrar segurando o direcional), a pose sai 2,6×
mais depressa (`dogAnimation.js`, `offK`) e a locomoção assume com ela quase fora (peso 0,9 em vez de 0,98): seguindo
o guia com atraso, a perna de trás ficava apoiada e reta. Correndo ou arrancando, a traseira dá o passo extra mesmo
com as outras três no ar, e a pata que ficou embaixo de um degrau (o corpo subiu numa placa) também.
As duas patas de cada par se alternam (no passo e no trote, meio ciclo uma da outra): as fases do passo, do trote e do
galope (as mesmas no guia) estão escritas para que, na mistura, os pares nunca se encontrem e nenhuma pata atrase do
passo ao trote (as traseiras ficam, as dianteiras adiantam um quarto de ciclo; o passo ficou meio ciclo adiante, o
mesmo passo, e o balanço de lado do corpo do guia vai junto); a fase de cada pata só atrasa no balanço (no apoio,
atrasar alongava o apoio além do alcance da traseira, que saía num passo de conforto fora do ritmo e nunca voltava ao
lugar dela); um passo fora do ritmo pousa de volta no lugar dela no ritmo, contado da outra do par (nunca em cima
dela); saindo de parada, o ritmo começa com uma traseira já saindo, e a pata no tempo do balanço sai mesmo no fim
dele; e o corpo do guia (sobe e desce, balanço) segue a fase das patas, em vez de as patas voltarem ao compasso dele
depois de uma arrancada ou de uma curva fechada (o que as atrasava).
A cabeça que desvia (`head.js`, etapa 4) usa o mundo de colisão da fase (`d.setWorld(world)`, chamado pelo
`game.js`): chegando de frente numa parede ou móvel, o desenho inteiro freia antes do centro do jogo (prevê onde o
peito vai parar e freia aos poucos, chegando parado com o focinho encostado; até 24 cm na escala) e a cabeça vira um
pouco farejando; raspando de lado, a cabeça gira para fora; indo embora, tudo volta devagar. Contam os colisores que
seguram a dog, mais altos que a cabeça (água, áreas da IA e a coisa em que ela está de propósito, não); desligada
nas poses que vão de propósito até a coisa (empurrão em pé, parede, empurrando de pé, extras, Lambe-Lambe). Em
`dog.js`, as camadas ficam numa lista em ordem (`LAYERS`: cabeça, locomoção e rolagem, cada uma devolve o peso do
quadro em `d.layers`), por cima da base (as poses do modelo atual) e antes do contato com o chão e da física. Para ver:
o jogo usa o modelo novo (`main.js`); `?dogs=atual` volta ao anterior em qualquer fase (para comparar ou reverter; o
`?dogs=novo` dos links antigos continua dando o novo) e a fase de desenvolvimento
`?level=canil` mostra o atual e o novo lado a lado em todas as poses. Testes: `test/dogV2.test.mjs` (esqueleto, pesos,
guia, chão e orçamento), `test/locomocao.test.mjs` (pata plantada, parada, esteira, pata que rola, arrancada),
`test/patas-alternadas.test.mjs` (nos dois modelos, as duas de cada par não saem juntas: saindo de parada, virando,
com o analógico pela metade e depois da arrancada; e as fases do ritmo),
`test/cabeca.test.mjs` (a cabeça não entra na parede, o desenho freia aos poucos), suíte E2E `canil` e capturas
`tools/scripts/capture-modelos.mjs` (sandbox `dogs.html?model=both`; `wall=<m>` anda com o controle e a colisão do
jogo até uma parede, `crate=<altura>` empurra de pé um caixote).

**Dona Gansa** (`createGoose()` em `src/characters/goose.js`, tipo `GooseModel`): modelo e animação; o comportamento
está em `src/game/mechanics/gooseNpc.js`.

**Porquinhos** (personagem da fase 10; arena de teste `?level=porcos&play`, em `src/levels/_porcos/`).

- Modelo: `createPig({ variant })` em `src/characters/pig.js` (tipo `PigModel`). Pipeline da gansa e das dogs (SDF →
  Surface Nets → SkinnedMesh): tronco, cabeça com bochechas e as quatro patas com cascos numa malha com 10 ossos;
  orelhas caídas (com mola), focinho com narinas, rabinho em saca-rolha e olhos são peças rígidas. Dois materiais
  para todos (pele com cor por vértice; olhos), sete malhas por porco; a malha é gerada uma vez e as variantes 0, 1
  e 2 só trocam as manchinhas (atributo de cor). `update(dt, { speed, turn, action, lookAt })`: a marcha passa de
  passo a trote pela velocidade; girando parado ele dá passinhos; `action` `idle`, `walk`, `sniff` (fuça o chão),
  `eat`, `alert`, `lie` (de bruços) e `sleep` (tomba de lado, olhos fechados, "Zzz"). Gestos de uma vez: `oink()`
  (o corpo dá dois trancos), `bump()` (esbarrão de cabeça) e `shake()` (sacudida). Pés por IK de duas partes; uma
  trava de chão levanta o focinho (em pé) e ergue o corpo (deitado) se algum ponto encostar abaixo do chão:
  `lowestY()` informa o ponto mais baixo do último quadro (testado em todas as poses).
- Comportamento: `createPigHerd({ id, cfg, world, root, emit, effects, createPig, gateProp })` em
  `src/game/mechanics/pigHerd.js` (padrões em `PIG_DEFAULTS`). Presos no cercado até `setOpen(true)`; soltos, saem um
  atrás do outro e ficam na `cfg.area` (a horta). Atrapalham a dog que chega perto (a ativa primeiro): andando, se
  põem à frente dela, lado a lado; parada, chegam encostados, cheiram e dão um esbarrão de leve (`effects.knock`,
  0,32 m, com recarga por dog). Cada porco é um colisor dinâmico (círculo) que bloqueia as duas dogs; eles nunca
  atravessam as dogs nem uns aos outros. A porteira passa um de cada vez (saindo ou voltando): a vez é de quem está
  mais perto do vão e os outros esperam antes dele (abrindo caminho quando ele passa); a folha aberta é contornada
  pela ponta, e quem empaca dá um passo de lado só para onde há lugar. Cansam depois de `boredAfter` s e fuçam um pouco. Quem leva algo na boca
  (`update(dt, { active, ctrls, carries })`, `carries(nome)`) é o alvo preferido: vão atrás dela de mais longe, mais
  rápido, sem cansar, esbarram mais e o esbarrão derruba o objeto: a fase passa `knockItem(nome, { pig, dirX, dirZ,
  x, z })` → true se derrubou (ela faz o objeto voar e cair; `cfg.knockChance`, e `cfg.knockGrace` s sem derrubar logo
  depois de pegar). Evento `pig:knock`.
  Comida: `addFood({ x, z, kind, time?, eat?, onProgress?(k), onDone?() })`: o porco livre mais perto trota até ela,
  come (`eat` s; `onProgress` vai de 0 a 1 para a fase encolher o legume), deita e cochila ao lado até completar
  `time` s de distração (contados da 1ª mordida), acorda se sacudindo e volta a atrapalhar (`pig:done`). Padrões
  por legume em `cfg.foods` (milho 32/18 s, cenoura 26/14 s, abóbora 40/24 s; outros tipos: `distractTime` 30 e
  `eatTime` 16); `time: Infinity` distrai de vez. `removeFood(f)` (a dog pegou de volta) devolve o porco às dogs.
  Comida fora da área é ignorada. `recall()` leva todos para casa (a porteira fecha quando o último entra; com uma
  dog dentro do chiqueiro, espera ela sair) e `reset()` volta ao começo; `onBark(c)` faz os de perto pararem e
  olharem (latido não resolve). `info()`: `open`, `gateT`, `released`, `pigs[i] { state, action, x, z, dog, food,
  distracted, left (s que faltam) }`, `distracted`, `pestering`, `free`, `inPen`, `nextBack` (o menor tempo até um
  voltar), `foods` e `errors`. Rede de segurança: cada porco roda num passo protegido; um erro sai no console (uma
  vez por porco), o porco volta a passear e o jogo segue (`errors` conta; deve ser 0). Para testes e capturas:
  `place(i, x, z, yaw, state)` e `releaseNow()`.
- Chiqueiro: `pigPenLayout(PEN)` (puro JS) devolve `{ pen, door, gate, colliders }` para o layout: as quatro cercas
  fora do miolo (a da porteira com o vão), o cfg da porteira (`createHingedGate`, abre para fora) e os pontos logo
  dentro e logo fora dela. `PEN = { x0, x1, z0, z1, t?, h?, door: { side: 'n' | 's' | 'e' | 'w', a, b }, swing?,
  trough?, mud? }`. O cenário é `buildPigPen(PEN, pigPenLayout(PEN))` em `src/world/pigPen.js`
  (`{ group, gate, update }`).
- Legumes: `createVeggie('corn' | 'carrot' | 'pumpkin')` em `src/world/veggies.js` (tipo `VeggieProp`, um material
  para todos): `object` (eixo comprido em X; `userData.carryKind` dá a pose da boca: milho e cenoura atravessados,
  abóbora como a bolinha), `groundY`, `setEaten(k)` (a ponta some aos poucos; em 1, some) e `reset()`.
- Integração numa fase (receita):
  1. Layout: `const PEN_LAYOUT = pigPenLayout(PEN)`; `PIGS` = `pen`, `door` e `gate` de `PEN_LAYOUT` + `area` (e,
     se quiser, `homes`, `foods`…); `STATIC_COLLIDERS` recebe `...PEN_LAYOUT.colliders`.
  2. Cenário: `buildPigPen` (a `gate` vai nos props, como `penGate`) e os legumes com `createVeggie`.
  3. Puzzle: `effects = createDogEffects({ world, dogs })`; `pigs = createPigHerd({ id: 'porco', cfg: PIGS, world,
     root, emit, effects, createPig, gateProp: props.penGate, knockItem })`. No `update`: `effects.update(dt, ctrls)`
     e `pigs.update(dt, { active, ctrls, carries })`; `lockFor: (n) => effects.lockFor(n)`; `onBark: (c) => pigs.onBark(c)`;
     na comemoração, `pigs.animate(dt)` (em `updateAlways`); `reset` chama `pigs.reset()`.
  4. A fase decide quando abrir (`pigs.setOpen(true)` num botão, numa alavanca…) e transforma o legume largado em
     comida (`pigs.addFood(...)` com `onProgress: (k) => veg.setEaten(k)`); pegar de volta é `pigs.removeFood(f)`.
     O `knockItem` da fase larga o que a dog levava com um arco (legume derrubado na horta vira comida; a bolinha fica
     no chão até a dog pegar de novo). O ponto de queda precisa ser alcançável: a arena usa `landingFor` (sem
     atravessar nada alto no caminho, fora dos colisores, com lugar para a dog chegar; senão, aos pés dela). A arena (`src/levels/_porcos/puzzle.js`) mostra tudo isso: pegar e largar com
     E, o arco do legume caindo, a bolinha derrubada e a volta do legume comido.
  5. Sons e efeitos: o feedback já trata os eventos `pig:*` (§8); a fase emite `item:land {kind}` quando o que a dog
     levava cai no chão.

## 8. Eventos

Barramento em `src/core/events.js`. O emissor do jogo vem de `createGameEvents`
em `src/game/gameEvents.js`, com dispatch, relógio e callback de vibração
injetados. A ordem é registrar → emitir no barramento → decidir/calcular a
vibração. O núcleo verifica input e estado depois dos listeners; o módulo
extraído não acessa DOM, cena, puzzle ou carregamento. O histórico conserva
os últimos 500 registros, é limpo no mesmo array e mantém referências dos
payloads. Consultas devolvem uma lista independente. `camera:shot` apenas
registra coordenadas arredondadas, sem emitir no barramento nem vibrar.

Quem emite e quem ouve:

- **UI → jogo**: `ui:play`, `ui:pause`, `ui:resume`, `ui:restart`, `ui:nextLevel`, `ui:selectLevel {index}`, `ui:menu`, `ui:cancelLoad`.
- **Fase e estado**: `game:state {state, prev, level}`, `game:reset`, `level:loading {...}`, `level:loaded {...}`,
  `level:error {index, id?, name?, initial, canReturn, message}` (retorno só antes de alterar a fase anterior),
  `victory {timeSec, collected, total, level, levelId, hasNext, texts}`.
- **Interface do jogo**: `objective {text, target, stage}`, `interact:prompt {text, key}` (key é a tecla lógica, a UI
  desenha o botão do controle ou de toque), `hint {text, duration}`, `input:device {type}` (`keyboard`, `gamepad` ou
  `touch`), `quality:change {device, mode, level, reason, fps}` (perfil gráfico, §9), `settings:change {noHints}`
  (opções salvas, §9).
- **Dogs**: `dog:switch`, `dog:step`, `dog:dash`, `dog:jump`, `dog:wallJump {id, top}`, `dog:land`, `dog:bump`, `dog:bark`, `dog:pushStart`, `dog:pushEnd`,
  `companion:stay`, `bafo:aim`, `dog:bafo`, `dog:yuck`, `dog:dashBlocked` (arrancada recusada pela fase), `dog:jumpBlocked` (pulo recusado pela fase),
  `lick:start`/`lick:end`, `dog:lick {target, x, y, z, stroke}` (target null = lambidinha no focinho), `dog:scratch {name}` e
  `dog:pee {name, x, z}` e `dog:sniff {name, x, z}` (parada por muito tempo, `idle.js`).
- **Cheiro**: `scent:spawn`, `scent:duct`, `scent:exit`, `scent:smell`, `scent:fade`; fase 4 e Arena do Bafo:
  `fan:aligned`, `pigeon:flee {y?}` (y = altura de onde ele sai; do chão, um voo curto), `pigeon:land` e `pigeon:shrug`
  (o pombo ignorou o latido).
- **Itens**: `item:pickup`, `item:revealed`, `collectible:pickup {count, total}`, `celebrate:start`.
- **Mecânicas** (sempre com `x, z`): `plate:press`/`plate:release`, `gate:open`/`gate:close`/`gate:locked`, `wedge:kick`,
  `sprinkler:hit`/`sprinkler:off`, `valve:turn`, `crate:move`/`crate:sink`, `lantern:on`/`lantern:off`,
  `wall:touch {id, y}`, `wall:button {id, kind, on, y}`, `wall:tick {id, left}`, `wall:timeout {id}` (impulso na parede),
  `hatch:open`/`hatch:close` (portinhola da parede de treino),
  `goose:alert`/`goose:honk`/`goose:charge`/`goose:hit`/`goose:lured`/`goose:return`; porquinhos (`createPigHerd`):
  `pig:gate {open}`, `pig:release {count}`, `pig:oink {pig, kind}` (`idle`, `pester`, `grumpy`, `alert`, `happy`),
  `pig:bump {pig, name}`, `pig:smell {pig, food}`, `pig:eat {pig, food, kind, time}`, `pig:munch`, `pig:full`,
  `pig:sleep`, `pig:wake`, `pig:shake`, `pig:snort`/`pig:snore` (só som), `pig:done {pig, food, reason}` (`time`,
  `taken` ou `recall`: voltou a atrapalhar), `pig:knock {pig, name}` (derrubou o que a dog levava) e `pig:home`;
  `item:land {kind}` (o que a dog levava caiu no chão; a fase emite); Arena dos
  Porquinhos: `bell:ring`; fase 1: `rope:tug`, `cart:move`,
  `carrot:revealed`, `carrot:pickup`; fase 5: `latch:start` (trava do portãozinho), `box:collapse` (caixa desmontando);
  fase 6: `expresso:route {route, signX, signZ}` (pulo no pedal virou a agulha), `expresso:sneeze` (o nariz sentiu o
  cheiro: "ah... ah..."), `expresso:atchim {x, y, z, dirX, dirZ}` (o espirro e o tranco de ré; vibra),
  `expresso:chuff {x, y, z}` (vapor da chaminé a cada `TRAIN.chuffEvery` m), `expresso:unload` (caçamba basculando),
  `expresso:delivery {cargo}` (carga na bandeja), `expresso:return` (o trem chegou à estação; apito),
  `expresso:blocked` (cancela fechada segurou o trem), `expresso:barrier {open}` (cancela subindo/descendo),
  `expresso:fetch` (a portinhola do pórtico abriu), `expresso:loaded` (a lua caiu no vagão), `expresso:dock {cargo}`
  (encaixou no foguete) e `expresso:launch` (as duas cargas: o foguete decola); lama (`createMud`): `mud:soak`
  (entrou na lama), `mud:splash` (pisando nela), `mud:lick {x, y, z, k}` (uma placa saiu) e `mud:clean` (limpinha:
  sacode e brilha); fase 7: `slide:climb`/`slide:top`/`slide:down`/`slide:land` (escorregador), `slide:slip
  {reason}`/`slide:slipBack`/`slide:slipEnd` (escorregou de volta), `puddle:splash` e `picnic:deliver {item}`.
- **Pegadas**: o feedback desenha pegadas de barro em cada `dog:step` de uma dog com `dog.mud` > 0,15.

O feedback (`src/fx/feedback.js`) ouve os eventos de jogo e toca sons, partículas e vibração; para um efeito novo,
emita um evento no puzzle e trate-o lá.

Os eventos declarados em `LifecycleEvents` têm payload verificado quando emitidos
com nome literal. Eventos específicos ainda não modelados e nomes recebidos
como `string` continuam abertos; isso não constitui validação de dados em runtime.
Ao ampliar o mapa, inclua uma prova negativa na fixture de tipos para impedir
que um payload inválido seja aceito por uma assinatura genérica permissiva.

## 9. Interface, áudio e efeitos

**UI** (`src/ui/`, DOM sobre o canvas): `ui.js` orquestra as camadas (tela inicial com o menu, cartão da
fase, HUD, pausa, comemoração, vitória); `markup.js` tem o template e o HTML gerado (teclas, botões do controle e de
toque desenhados); `hud.js`, o HUD; `curtain.js`, a transição entre fases; `menuNav.js`, o foco por teclado e controle;
`touchControls.js`, o joystick e os botões de toque (§6); `progress.js`,
o progresso salvo (`localStorage` `rr-progress-v1`: melhor tempo, petiscos e conclusões por fase e, opcional,
`last`, a última fase escolhida; uma fase é liberada quando a anterior foi concluída). Os cartões das fases vão no
máximo cinco por linha; com mais fases, `renderCards` reparte em linhas equilibradas (`--per-row`; sete fases =
4 + 3). Estilos em `ui.css`, ícones SVG em `icons.js`.

**Menu inicial** (`data-screen` da camada `.rr-title`): `main` (Jogar e Opções) → `modes` (Modo História, que só
mostra "Em breve" e tem a visão registrada em [MODO-HISTORIA.md](MODO-HISTORIA.md), e Fases; nomes e textos em
`MODES`) → `levels` (Continuar e os cartões) e `options` (o mesmo `settingsBlock()` da pausa: volume, qualidade,
dicas e tela cheia). Voltar sobe uma tela (Esc, ○ · B ou o botão do canto) e devolve o foco ao botão que a abriu; no
cartão de abertura, volta à tela das fases. Continuar usa `continueTarget` (`progress.js`): a última fase escolhida
se ainda não foi concluída e está liberada, senão a primeira liberada pendente (com tudo concluído, a última
escolhida); escolher uma fase (Continuar, cartão ou Próxima fase) grava `last`. Escolher na tela inicial a fase que já
está montada abre o cartão dela sem recarregar (`ui:selectLevel` no núcleo).

**Opções salvas** (`src/core/settings.js`, `localStorage` `rr-settings-v1`, chave por PR nas prévias): `noHints`, o
modo sem dicas. A raiz ganha `data-hints="off"` e o CSS esconde o objetivo escrito e as dicas em balão (o HUD também
ignora `hint` e um selo "sem dicas" aparece); `fx/feedback.js` esconde o marcador do objetivo. Os puzzles não mudam
e a tabela de controles segue na pausa.

**Layout compacto** (`.rr[data-compact]`, `src/ui/screenFit.js`): liga pelo TAMANHO da janela (altura até 500 px ou
largura até 700 px; o celular reconhecido sempre), não por o navegador entregar o aparelho como celular, então um
Android que não se diz celular ou uma janela pequena no PC também o recebem. HUD, tela inicial, cartão da fase, pausa
(duas colunas, sem a tabela de teclas) e vitória compactos, com as medidas em `N × var(--u)`: `--u` (`@property`
<length>) vale 1 px na tela deitada de 390 px de altura (iPhone 13, onde o layout foi desenhado) e acompanha a tela,
`clamp(.82px, min(vmin/390, vw/720), 1.12px)` (0,89 em 640×360, 0,82 em 568×320, 1,01 no Infinix); os textos pequenos
têm piso de 9 px e os botões de toque usam a mesma escala (`--s`, piso de 0,82). Fora do compacto, `--u` = 1 px e
o PC fica como sempre. `test/responsivo.test.mjs` trava os limites, a escala por aparelho e a regra "nada de px
fixo no compacto"; as suítes `menu` e `toque` conferem cada tela em 11 tamanhos (`tools/scripts/lib/screens.mjs`).

**Celular** (`.rr[data-mobile="phone"|"tablet"]`, vindo de `engine.quality.device`): áreas seguras do entalhe
(`env(safe-area-inset-*)`, `viewport-fit=cover`); sem desfoque de fundo sobre o 3D (custa caro na GPU do celular);
transições mais curtas. Celular de pé: aviso "Gire o celular" (`.rr-rotate`) e a partida pausa (também, de reserva,
num celular não reconhecido já jogando com o dedo). No Android, o
primeiro toque num botão do menu pede tela cheia, e a pausa tem o botão Tela cheia. O Safari do iPhone não deixa uma
página ocupar a tela inteira (`requestFullscreen` só vale para vídeo): lá a tela cheia é o app da tela inicial
(`public/manifest.webmanifest` com `display: standalone` e `display_override: [fullscreen, standalone]`, metas
`apple-mobile-web-app-*` e `viewport-fit=cover` no `index.html`). Fora dele, `src/ui/installHint.js` (só quando
`needsInstallTip`: iPhone/iPad sem a API e fora do modo aplicativo) mostra uma vez um cartão sob o Jogar
(Compartilhar → "Adicionar à Tela de Início"), uma linha no aviso de girar e uma nota com o passo a passo na pausa
(só texto: nada focável que o teclado ou o controle ativariam sem efeito). O app da tela inicial guarda o progresso à parte do Safari (o iOS separa os dados).
`index.html` impede zoom e rolagem por gesto (`touch-action`, `overscroll-behavior`).
Nada disso existe no PC de tamanho normal: sem `data-mobile` nem `data-compact` e com teclado ou controle, a interface
é a de sempre.

**Qualidade gráfica por aparelho** (`src/core/quality.js`, aplicada pelo engine): `detectDevice` (dedo como ponteiro
principal, `pointer: coarse`, ou um ponteiro de toque qualquer num navegador de celular, `isMobileUA`; celular se o
lado menor da tela tem até 600 px, mesmo que o navegador diga ter hover, como alguns Android; tela grande com hover e
sem navegador de celular é o notebook com tela de toque, PC) escolhe o perfil inicial; no
celular/tablet o nome da GPU (`readGpuName`) também conta: GPU de entrada (`isLowEndGpu`: Mali-G57/G52/G68…,
Adreno 5xx/60x–61x, PowerVR; ex.: Infinix Note 30 5G) começa no `baixa`. O iPhone informa "Apple GPU" e começa no
`media`. No PC a GPU nem é consultada.

| Perfil | Pixel ratio (teto) | Sombras | MSAA | Bloom | Compositor | Céu | Quem usa |
|---|---|---|---|---|---|---|---|
| `alta` | 1,5 (sem orçamento) | PCFSoft 2048, todo quadro | 4 | sim | sim | primeiro | PC (sempre o mesmo de antes) |
| `media` | 1, até 0,6 Mpx | PCF 1024, todo quadro | 0 | não | sim | por último | celular e tablet no começo |
| `baixa` | 0,85, até 0,42 Mpx | PCF 1024, a cada 2 quadros | 0 | não | sim | por último | GPU de entrada, menu ou automático |
| `minima` | 0,7, até 0,3 Mpx | desligadas | 0 | não | não (direto na tela) | por último | só o automático (último recurso) |

Por que esses cortes: cada fase tem ~800 a ~2.200 chamadas de desenho por quadro (a passada de sombra repete o
cenário), e o céu calcula nuvens por ruído em cada pixel; desenhado por último, só roda nos pixels de céu que sobram.
O celular/tablet também tem teto de 60 quadros por segundo (`createFrameCap` no laço de `main.js`): telas de 90/120 Hz
desenhariam o dobro e esquentariam o aparelho. E o pelo das dogs (modelo novo) tem menos cascas (`furShellsFor`: 10 no
PC, 6 no celular e no tablet; o mesmo comprimento em menos camadas transparentes, 40% menos malha de pelo), escolhidas
na criação das dogs.

No modo automático do celular/tablet, o governador de FPS (`createFpsGovernor`, alimentado por `engine.quality.frame`
a cada quadro desenhado da partida) mede a mediana dos intervalos em janelas de 1,5 s, depois de 2 s de aquecimento:
desce um degrau depois de duas janelas seguidas abaixo de 45 fps, ou de uma só abaixo de 30. Aparelho preso a 30 Hz
(economia de bateria, quadros em ~33 ms) só desce abaixo de 27. Se descer não melhorar ao menos 5%, para onde está.
Pausa, menus e travadas longas não contam; ele nunca sobe sozinho. No PC o governador não existe. O menu de pausa
tem Auto · Alta · Média · Baixa (`engine.quality.setMode`, salvo em `localStorage` `rr-quality`, por prévia como o
volume; `forceLevel` é só diagnóstico). Cada troca emite `quality:change {device, mode, level, reason, fps}` e
`applyQualityProfile` mexe só no que mudou (pixel ratio, sombra, MSAA dos alvos do compositor, bloom e ordem do céu).

**Áudio** (`src/fx/audio.js` + `src/fx/audio/`): tudo sintetizado em WebAudio. `createAudio().play(nome, opts)`;
sons novos entram em `soundsV1.js`, `soundsV2.js`, `soundsBafo.js` ou `soundsV3.js` (ou num arquivo novo) e na
biblioteca `sounds.js`. O ambiente por fase vem de `def.ambience` (`src/fx/audio/ambience.js`): `day` (passarinhos),
`dusk` (grilos começando e vento), `night` (grilos, sapinhos e sino de vento), `city` (passarinhos e o trânsito lá
embaixo) e `rain` (chuva, gotas no vidro, relógio da sala e trovão longe). Vagalumes automáticos só em `dusk` e `night`.

**Partículas** (`src/fx/particles.js`) e **feedback** (`src/fx/feedback.js`): poeira, gotas, estrelas, confete,
ícones sobre as cabeças, marcador do objetivo, vibração.

## 10. Testes e ferramentas

| Comando | O que faz | Tempo |
|---|---|---|
| `npm test` | testes em Node (`test/*.test.mjs`): as 7 fases jogadas inteiras no jogo headless, navegação e colisão de todas as fases, cenário sem z-fighting, cenário fora do pacote inicial, irrigador, dogs e regressões | ~30 s |
| `npm run typecheck` | TypeScript sobre o JavaScript (JSDoc) | ~2 s |
| `npm run test:e2e` | partidas com teclas reais no Chrome (Playwright): fases 1–7, controle, regressões, pulo, bafo e menu; sobe e derruba sozinho um Vite sem HMR numa porta livre | ~13 min |
| `npm run build` | roda typecheck + `npm test` antes (`prebuild`) e gera `dist/` | ~15 s |
| `npm run verify` | build + e2e | ~14 min |

**Cenário sem z-fighting** (`test/cenario.test.mjs`): monta o cenário DE VERDADE de cada fase no Node
(`test/helpers/worldBuild.mjs`, com os dublês de canvas do headless) e procura faces de peças diferentes no mesmo
plano que se sobrepõem (`test/helpers/coplanar.mjs`): a placa de vídeo alterna entre as duas e a superfície fica
listrada ou "tremendo" (foi o caso da terra das floreiras da fase 4, no plano da tampa da caixa). O relatório diz as
duas peças (caminho de nomes, cor, centro e tamanho), o plano e onde. Para corrigir, afaste uma das faces 2–4 mm ou faça
uma peça terminar dentro da outra. Ficam de fora faces viradas para baixo ou para o norte (a câmera nunca as vê),
materiais iguais, decalques (`polygonOffset`, transparente sem `depthWrite`) e o que está fora da área de jogo.

**Jogo headless** (`test/helpers/headless.mjs`): roda o `game.js` de verdade no Node, com dublês de motor, dogs e
props (o cenário nem é importado: o `load` das fases é descartado), e teclado/controle simulados. `createHeadlessGame({ level, query })` devolve `walkTo(x, z)`, `tap('KeyE')`,
`hold([dx, dz], ['ShiftLeft'])`, `run(segundos, { until })`, `teleport`, `info()` e `log(evento)`. É a forma mais
rápida de testar a lógica de um puzzle ou de uma mecânica nova.

**Partidas no navegador** (`tools/scripts/playthrough*.mjs`, `test-gamepad.mjs`, `test-regressoes.mjs`, `test-pulo.mjs`, `test-bafo.mjs`): usam
`tools/scripts/lib/harness.mjs` (Chrome do sistema, teclas reais, leitura do estado por `window.__game`). As das fases
1–3 andam o caminho inteiro com WASD; as das fases 4 e 5 usam teclas reais nas ações (R, Espaço, E, Shift, Q e o ✕ do
controle) e teletransportam entre os trechos, porque os testes headless já cobrem os caminhos.
Capturas vão para `shots/` (fora do git).

*Robustas à carga*: com a máquina ocupada (outra sessão tirando capturas, por exemplo) há dois efeitos. (1) O Chrome
cai abaixo de 20 fps, o quadro limita `dt` a 1/20 s e o jogo anda MAIS DEVAGAR que o relógio: `waitFor(pred,
{ timeout })`, `walkTo` e `gsleep(ms)` contam o prazo em tempo de JOGO (`info().simSec`, com teto de 8× em tempo real).
(2) O próprio processo de teste fica sem CPU e cada ida e volta ao navegador (ler o estado, apertar ou soltar uma
tecla) pode levar segundos: o que se mede num instante ou se solta "na hora certa" sai errado. Por isso: `holdUntil(teclas,
pred)` aperta as teclas reais e a PÁGINA as solta no quadro em que `pred(info())` vale (ou depois de `timeout` ms de
jogo); `hold(teclas, ms)` é um `holdUntil` só com o prazo; `walkTo` instala na página uma trava que solta WASD ao
entrar a 0,6 m do alvo ou ao começar a se afastar dele, e faz a aproximação final com `holdUntil`; eventos curtos se
conferem por registro, não pelo instante: planos de câmera no log (`camera:shot`) e animações, velocidade e trajetória
quadro a quadro com `record(game => amostra)`, que roda na página a cada `requestAnimationFrame`. No fim de cada
suíte sai o diagnóstico `ritmo do jogo` (jogo/relógio) e a latência das leituras do estado. Para conferir: rodar uma
suíte com carga artificial ou uma segunda instância do e2e em paralelo (cada uma sobe o próprio Vite).

*Tetos de relógio* (`DEFAULT_LIMITS` no harness): o tempo de jogo só vale enquanto o jogo anda. Se o `simSec` ficar
60 s sem mudar, contados entre as leituras de todas as esperas (`waitFor`, `gsleep`, `walkTo`, `hold`/`holdUntil`),
a suíte reprova com `HarnessAbort`: o jogo parou. Cada ida ao navegador (`info()`, `page.evaluate`, teclado, mouse,
comandos das sessões CDP da página, como os dedos da suíte `toque`) tem 60 s; com a aba travada, a página fica marcada e as idas seguintes falham na hora, para o `catch` da suíte e o
`close()` terminarem logo. As etapas do `load()` dizem qual delas venceu. A mensagem traz a espera, a linha da suíte,
o motivo e a última leitura do estado (`estado`, `fase`, `timeSec`, `simSec`, posição); um aborto engolido pela
suíte ainda reprova no `close()`. Já o jogo que anda devagar demais NÃO reprova: em max(10 s, 8 × o prazo) de
relógio a espera termina, como sempre terminou, e sai um aviso `[harness] aviso: ... terminou pelo teto de relógio`
(depois de `ui:restart`, o SwiftShader recompila a cena e o jogo chega a andar 0,03 s em 10 s; a partida segue).
Se o Playwright avisar que a aba caiu (`crash`) ou que o navegador desconectou, toda operação em curso falha na hora
com esse motivo. Mas, no CI, uma aba derrubada no meio do `load()` não gerou esse aviso: o `waitForFunction` ficou
pendente sem vencer os próprios 120 s, como nos travamentos reais da lavanderia e do `expresso`. Por isso as duas
redes finais: uma operação em curso (etapa do `load()`, captura) que passa de 150 s encerra o processo da suíte com
diagnóstico, dizendo se a página ainda responde (o log já ganha "ainda aguardando ..." a cada minuto); e
o runner (`tools/scripts/lib/suite-runner.mjs`) encerra, de fora, uma suíte que fica 5 min sem escrever nada (o
maior silêncio normal no CI é de 91 s), com o navegador. Pelo canal IPC, o harness manda a cada 2 s o que está em
curso e a última leitura do estado; no diagnóstico, o runner diz se esse sinal parou (event loop bloqueado ou sem
CPU) e mostra carga, memória e os processos por CPU. Isso cobre o E2E `39166156986`: a suíte `expresso` travou
30 min no primeiro `load()` sem que nenhum prazo interno chegasse a imprimir nada. Ajustes: `E2E_WALL_FACTOR`,
`E2E_WALL_MIN_MS`, `E2E_STALL_MS`, `E2E_EVAL_MS`, `E2E_CLOSE_MS`, `E2E_OP_MAX_MS` ou `createHarness({ limits })`
e, no runner, `E2E_SILENCE_MS`. As provas (jogo a 0,4× mantém o prazo de jogo; a 0,05× segue com aviso; parado em
esperas curtas seguidas, aba travada, aba que cai, navegação sem resposta e processo da suíte bloqueado reprovam
em segundos)
estão em `tools/scripts/test-e2e-infra.mjs`, no job de infraestrutura do E2E manual.

*As mesmas redes em qualquer página* (`tools/scripts/lib/page-guard.mjs`): o teto de relógio, a escuta de queda e o
vigia das operações em curso saíram do harness para `guardPage(page)`, que o harness usa na página dele. Valem também
para as páginas extras das suítes, abertas com `H.newPage(opções, nome)` (o PC e os iPhones da suíte `toque`), e para
os scripts de captura (`capture-*.mjs`), que rodam sem harness e sem runner: `openPage(browser, opções, { name })`
devolve a página protegida, `guard.note('captura …')` marca o último passo e `closeBrowser(browser)` fecha com prazo.
Na página protegida, `evaluate`, teclado, mouse, toque, `setViewportSize`, `addInitScript` e os comandos CDP têm 60 s;
`goto`, `reload`, `waitForFunction`, `waitForSelector`, `screenshot`, `click` e `close` ficam sob o vigia: em curso por
150 s, encerram o processo dizendo a operação, a linha do script, o último passo e o estado do jogo (antes, o
`capture-lambe.mjs` travou até o timeout de 30 min do job no E2E `39173570454`). Um prazo do Playwright que vence
(`waitForFunction` etc.) também leva a linha e o estado do jogo na mensagem, e as "condições não alcançadas" das
capturas trazem o estado. Os prazos das capturas e das páginas extras passaram de 180 s para 120 s, abaixo do vigia.
Provas `extra` (página extra que cai no meio da espera, com um erro de console nela) e `capture` (script de captura
com a aba caída) em `test-e2e-infra.mjs`.

*Travamento no carregamento (causa achada e corrigida)*: em cerca de 1% das páginas novas, o boot não termina: o
`goto` volta, `window.__game` nunca aparece e a thread principal da aba para de responder (lavanderia no E2E
`39160265826`, fase3 no `39164306879`, expresso no `39166156986` e no `39169122476`, `capture-lambe.mjs` no
`39173570454`, lambe com a fase 1 no `39183733885`, as capturas do celular no tablet e no iPhone em `39355249740` e
`39358151432`; nunca num segundo `load()` da mesma aba). Não é só o primeiro navegador: qualquer página nova, como as
extras da suíte `toque` e as de cada aparelho das capturas. Causa, pelas pilhas nativas (gdb) de três travamentos nos
E2E `39365366605` e `39366431425`: um impasse DENTRO da aba, com todos os processos sem CPU. O Vite serve os módulos
um a um e o Chromium os compila em segundo plano (`blink::BackgroundResourceScriptStreamer`, o streaming de scripts)
no pool de threads da aba, que tem 3 vagas no runner de 4 núcleos; as três compilações pedem uma coleta de lixo
(`CollectionBarrier::AwaitCollectionBackground`) e esperam a thread principal; a thread principal, no layout do
primeiro texto (o logotipo em SVG, com a fonte web ainda carregando; marco seguinte a `rr:boot:ui`), pergunta ao
serviço de fontes (`FontServiceThread::MatchFamilyName`/`FontRenderStyleForStrike`) e espera uma tarefa que vai para
esse MESMO pool, sem vaga. O processo do navegador fica ocioso (o pedido nem sai) e o da GPU também. Correção:
`--disable-features=ScriptStreaming` em `tools/scripts/lib/browser.mjs` (vale para suítes, capturas e medições):
os scripts compilam na thread principal e nada no pool espera por ela. O Chromium só lê o ÚLTIMO
`--disable-features` e o Playwright 1.49 acrescenta os nossos argumentos depois dos dele, então a lista dele sai
(`ignoreDefaultArgs`) e entra uma só, com as duas (`disabledFeaturesOptions`; teste em `test/e2e-runner.test.mjs`).
O jogo publicado não muda: é uma otimização de carregamento do navegador dos testes. O histórico abaixo fica como
registro do que já foi descartado. Em quatro casos o
`waitForFunction` nem venceu os próprios 120 s: no Playwright 1.49, ao vencer o prazo ele espera a limpeza
`handle.evaluate(h => h.abort())` NA PÁGINA antes de rejeitar (`ProgressController.run` e
`_waitForFunctionExpression`), e com a aba parada nem o erro de prazo chega. No caso da fase 1 o prazo venceu e só a
leitura seguinte ficou sem resposta, o padrão de quando o contexto da página foi destruído (recarga ou navegação) e a
página nova travou, como na prova `crash`. Uma hipótese testada e não confirmada: o otimizador de dependências de um
Vite frio (o cache `node_modules/.vite-test` é novo em cada job) mandaria `full-reload` no meio do boot mesmo com
`hmr: false` (o WebSocket continua ativo). Para medir, `run-e2e.mjs` grava `shots/diagnostico/vite.log` e repete no
log do job, com `[vite]`, as linhas do otimizador e os erros, e o harness avisa `[boot] ... a página RECARREGOU N×`
quando a página navega mais de uma vez durante o `load()`: nenhuma recarga nos primeiros boots frios do `todas`, nos
100 boots do estresse com o cache apagado a cada rodada nem nos logs antigos.

Para achar a causa, a sonda `tools/scripts/lib/hang-probe.mjs` faz um retrato quando uma operação em curso passa de
60 s (uma etapa do `load()`, um `goto`/`waitForFunction` de captura), no `opMaxMs`, no teto de uma ida ao navegador e
na queda da aba, em toda página protegida pelo `page-guard.mjs` (a do harness, as extras e as das capturas: `openPage`
liga a sonda sozinho; o `closeBrowser` espera o diagnóstico terminar): (1) a thread principal responde? Se não, um
`Debugger.pause` numa sessão CDP própria, com o Debugger ligado desde a criação da página, devolve a PILHA se ela
estiver rodando JavaScript; sem pausa, ela está presa fora do JavaScript (chamada nativa, como a GPU) ou morta;
(2) cada processo do Chromium pelo `/proc` (tipo, estado, CPU em 1,5 s, memória e as threads que gastaram CPU, com o
`wchan` onde esperam); (3) o que o navegador vê pelo CDP dele (processos, abas, estado do WebGL e da GPU); (4) CPU do
runner, roubo do hipervisor, memória e `dmesg` (OOM); (5) o console da página com os marcos do boot e as navegações;
(6) o fim do registro do próprio Chromium (`--enable-logging=stderr`, desviado por
`tools/scripts/lib/browser-log.mjs` para `shots/diagnostico/navegador-*.log`, que vai no artefato do job);
(7) se a thread principal responde, se o navegador ainda ENTREGA QUADROS à aba (`requestAnimationFrame` em até 3 s,
com o original guardado antes de qualquer troca, visibilidade e `simSec`), e o mesmo para cada outra aba protegida
aberta no processo: todas sem quadros apontam o processo da GPU, compartilhado; só uma, a própria aba; (8) com `gdb`
na máquina (no CI pelo `sudo` sem senha; os jobs normais não instalam: basta um passo
`sudo apt-get install -y --no-install-recommends gdb` no job), as pilhas nativas das abas, do navegador e da GPU:
um resumo por thread no log (os quadros do topo, threads iguais juntas, a biblioteca de cada quadro: SwiftShader,
ANGLE, libc) e as inteiras em `shots/diagnostico/pilhas-*.txt`. O Chromium do Playwright traz nomes de função, então
dá para ler quem espera quem; foi assim que saiu a causa do travamento acima. Um prazo do Playwright que vence numa
página protegida (`waitForFunction` etc.) também imprime o diagnóstico antes do erro. Os marcos
`rr:boot:*` (`src/main.js`) e `rr:level:*` (`loadLevel`) são `performance.mark` (sem efeito no jogo); o harness
imprime em cada `load()` uma linha `[boot]` com o tempo de cada etapa (html+módulos, motor, cachorras, interface,
código da fase, cenário, puzzle, shaders, pronto) e, num travamento, o último marco no console diz onde parou. Cada
suíte também imprime `[e2e] CPU do runner` (modelo, núcleos, AVX): os runners variam de hardware (AMD EPYC 9V45,
Intel Xeon Platinum 8573C e AMD EPYC 7763; o mesmo lote de estresse leva de 410 a 720 s). A suíte `carregamento` do
E2E manual (fora de `todas`; `tools/scripts/stress-boot.mjs`) abre as fases da campanha em rodízio, cada rodada com
Vite e navegador novos, um boot frio e um quente: lotes 0–3 com 25 rodadas, uma por vez, apagando o cache de dependências
do Vite a cada rodada (`--cold-deps`: otimizador frio, como na primeira suíte de cada job), e lotes 4–7 com 36, três
ao mesmo tempo (disputa de CPU). Serve para reproduzir o travamento com a sonda e, depois, para confirmar uma
correção. Como várias rodadas rodam no mesmo processo, o vigia do `page-guard.mjs` só para (`stopWatch`) quando não
resta página protegida aberta, e uma página nova o religa.

*SwiftShader sem recompilar por ordem de desenho* (`angleArgs()` em `tools/scripts/lib/browser.mjs`): no CI, o
Chromium de todas as suítes, capturas e medições sobe com `--use-angle=swiftshader` e
`--disable-angle-features=supportsVertexInputDynamicState`. O SwiftShader compila (JIT Subzero) uma rotina de vértices
para cada combinação de formatos dos 16 locais de atributo. O `vkCmdSetVertexInputEXT` dele só escreve os locais da
lista nova; os outros guardam o formato do desenho anterior. Com o estado dinâmico de entrada de vértices do ANGLE (o
padrão), a mesma malha pedia uma rotina nova conforme o que tinha sido desenhado antes dela, e o three ordena os
desenhos pela câmera. Isso custava de 150 a 500 ms num quadro qualquer, sem nada novo no WebGL. O PR #68 achou a causa
com trace do Chromium e `perf` no runner: `sw::VertexProcessor::routine`. Sem esse estado, o ANGLE põe os atributos no
pipeline e a rotina deixa de depender da ordem. O estado que o WebGL pede é o mesmo e a imagem não muda. Numa GPU de
verdade nada disso existe, e fora do CI (Chrome do sistema) a chave não entra. `E2E_VERTEX_INPUT_DYNAMIC=1` volta ao
padrão do Chromium, para comparar.

**Primeira passagem pelas áreas** (suíte `primeira-passagem` do E2E manual, também em `todas`;
`tools/scripts/measure-first-pass.mjs`, um job por fase e aparelho): cada fase abre com `?play` num navegador novo
(nada compilado antes, sem o cache de shaders em disco), no PC (`alta`, 480×270) ou num celular-alvo emulado (toque e
tela de celular, pelo do celular: iPhone 13 em `media`, 844×390; Infinix Note 30 em `baixa`, 893×393; a entrada
`qualidades` do workflow escolhe), e a dog ativa vai de nó em nó da navegação
(`NAV_NODES`, do mais perto ao mais longe) com a câmera seguindo, duas vezes pelo mesmo caminho; depois, um superbafo.
A página de medição fica 3 s parada depois da carga (no runner, o navegador ainda trabalha em segundo plano: os
quadros saíam ~30% mais caros por alguns segundos, sem nada novo no renderer) e depois dá os quadros (passo fixo de
1/30 s); cada um espera a GPU lendo um pixel da tela (o
`gl.finish()` do Chromium não espera: os quadros se enfileiravam e o tempo saía em degraus de 5 e 600 ms), então a 1ª e a
2ª passagem se comparam quadro a quadro. Reprova se, depois da carga, o renderer compilar um programa ou receber uma
textura ou geometria (o relatório diz em que nó e de qual material) ou com picos: quadros da 1ª passagem 150 ms e 35%
mais caros que o mesmo da 2ª, com a mesma cena (desenhos a 2%); tolera até 3 isolados, nenhum acima de 2,5×; o
relatório lista o que acabou de entrar na câmera em cada pico. Sem o aquecimento, o 1º quadro custava de 5 a 30× o
normal. Os ms são do SwiftShader (comparação entre as passagens, não o FPS de um aparelho); as contagens são exatas.
Como todo o E2E, a medição roda sem o estado dinâmico de entrada de vértices do ANGLE (*SwiftShader sem recompilar por
ordem de desenho*, acima). Com esse estado, que é o padrão, a mesma malha recompilava nas duas passagens. Daí vinham os
picos fixos da fase 10, a cerca do fundo e as folhinhas da mangueira, com +40 a +120% num quadro, em toda medição. Daí
vinha também boa parte dos picos isolados (PR #68).

**Celular no E2E** (suíte `toque`, `tools/scripts/test-toque.mjs`): o harness aceita opções de aparelho
(`createHarness({ device: { isMobile, hasTouch, deviceScaleFactor, screen } })`) e a suíte usa dedos reais pelo
protocolo do navegador (`Input.dispatchTouchEvent`, com multitoque): perfil do celular, controles que aparecem com o
toque e somem com o teclado, layout sem sobreposição, um trecho da fase 1 só com joystick e botões, menu de qualidade,
aviso de girar e, no fim, uma página de PC confirmando o perfil `alta` de sempre. O joystick anda em malha fechada
com uma trava na página (`ui.touch.releaseStick()`), como a do `walkTo`. Depois da partida, `capture-celular.mjs`
grava celular, celular pequeno, tablet e PC, cada um com a sua qualidade gráfica (`shots/celular-revisao/`),
inclusive as telas do menu inicial.

**Menu no E2E** (suíte `menu`, `tools/scripts/test-menu.mjs`): teclas reais e o controle simulado percorrem Jogar,
os modos (Modo História "em breve"), Fases, Opções e Voltar; o Continuar segue um save preparado; o modo sem dicas
fica salvo depois de recarregar, esconde objetivo, marcador e dicas na partida e volta pela pausa. O toque fica na
suíte `toque`. Em Node, `test/menu.test.mjs` cobre `continueTarget`, `last`, as opções salvas, o template e o atalho
do núcleo.
No CI sem GPU, a redução gráfica do harness é reaplicada a cada `quality:change`.

**Outras ferramentas**: `tools/scripts/gen-icons.mjs` (ícones de "Adicionar à tela inicial"), `tools/shot.mjs` (captura com roteiro de teclas, ver o cabeçalho),
`tools/scripts/sim-sprinkler.mjs` (equilíbrio do irrigador), `sandbox/*.html` (dogs, gansa, cenário e efeitos isolados).

**Parâmetros de URL**: `?level=2` ou `?level=fase2` (fase inicial, pela posição ou pelo id; os links por id das
fases 6 e 7, do tempo de protótipo, continuam valendo), `?level=pulo` (fase de desenvolvimento pelo id, ver
`src/levels/dev.js`), `?play` (pula a tela inicial), `?dog=rhaenyra`, `?dogs=atual` (o modelo anterior das dogs; o novo é o padrão, §7),
`?stage=<etapa>`
(se o puzzle suportar), `?debug` (colisores e grafo), `?cam=x,y,z&look=x,y,z` (câmera fixa), `?nopost`
(sem pós-processamento).

**Ganchos de depuração**: `window.__game` = `{ engine, dogs, game, audio, particles, feedback, ui, events, levels,
THREE, env, props, layout }`; `game.debug` = `{ teleport(nome, x, z), setStage, info(), events(nome), log, world,
nav, ctrls, puzzle, cam }`. Só para testes: `info().simSec` é o tempo simulado desde o carregamento (soma dos `dt` de
todos os quadros, em qualquer estado; o `timeSec` só corre jogando), e cada `cam.focusShot` (plano de foco, ~2 s) entra
no log de depuração como `camera:shot {x, z}` (não passa pelo barramento de eventos).

## 11. Tipos

`jsconfig.json` liga a checagem de tipos (`checkJs`) em todo o `src/`, o que equivale a `// @ts-check` em cada
arquivo, inclusive nos novos. Os tipos das APIs públicas estão em `src/types.d.ts` e entram nos `.js` por JSDoc:

```js
/** @import { PuzzleContext, Puzzle, Fase2Props } from '../../types' */

/**
 * @param {PuzzleContext<Fase2Props>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) { … }
```

A checagem é tolerante (`strict: false`): ela pega nomes errados, campos que não existem e formatos trocados nas
APIs, sem exigir tipo em tudo. O editor (VS Code) usa o mesmo `jsconfig.json`.

Para cada fase, use o mesmo tipo de props na definição (`LevelDef<P>`), no retorno
do cenário (`LevelBuild<P>`) e no contexto do puzzle (`PuzzleContext<P>`). O `load`
só traz o `build` correspondente. O catálogo reúne fases de formatos diferentes;
essa fronteira dinâmica não deve virar um cast de props dentro de cada puzzle.

Os testes de contratos combinam objetos reais do cenário com fábricas explícitas
de dublês em `test/helpers/props.mjs`. A fixture `test/types/contratos.ts` entra
explicitamente na checagem: casos inválidos com `@ts-expect-error` devem continuar
reprovando; se um contrato voltar a aceitar tudo, o TypeScript acusa a diretiva
sem erro correspondente. Os testes runtime conferem também comportamento, como
a altura da placa da fase 4 e sua relação com o pombo, que uma anotação não prova.
Essas verificações rodam no CI, junto de tipos/testes/build; partidas ficam no E2E
manual. Layouts, navegação e IA ainda têm fronteiras abertas para trabalho futuro.

## 12. Convenções

- Código, nomes e comentários seguem o estilo do arquivo em volta; comentários em português.
- Tudo de uma fase mora no `root` dela; nada de estado global entre fases (exceto as dogs).
- Puzzles chamam props sempre com `?.` e nunca dependem de detalhes visuais para a lógica.
- Mudanças de jogabilidade vêm com teste (`test/faseN.test.mjs` ou `test/regressoes.test.mjs`).
- `referencias/fotos/` (fotos das cachorrinhas) e `shots/` ficam fora do git; ver o `.gitignore`.

## 13. Licenças

Tudo procedural e próprio. Dependências: Three.js (MIT), Vite (MIT), Fredoka e Nunito via @fontsource (SIL OFL 1.1).
Ferramentas de desenvolvimento: TypeScript (Apache-2.0), Playwright (Apache-2.0).
