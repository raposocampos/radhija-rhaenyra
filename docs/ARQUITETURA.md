# Arquitetura — Radhija & Rhaenyra

Guia para quem mantém e evolui o jogo. Explica como as peças se encaixam, onde mexer para cada tipo de mudança
e como verificar que nada quebrou. Para o passo a passo de uma fase nova, veja [COMO-CRIAR-UMA-FASE.md](COMO-CRIAR-UMA-FASE.md).
Os tipos de todas as APIs citadas aqui estão em [`src/types.d.ts`](../src/types.d.ts).

## 1. Visão geral

Aventura 3D curta em fases, em Three.js r170 + Vite, JavaScript puro com ES modules. O jogador controla uma de
duas cachorrinhas (a Radhija, pequena e rápida, que dá arrancadas e solta o superbafo; a Rhaenyra, grande e forte,
que empurra, pula e limpa a irmã com o Lambe-Lambe) e troca entre elas; a outra vira
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
  puzzleKit.js             peças para puzzles: dicas, prompts, colecionáveis, item carregado, entrega
  mechanics/               mecânicas reutilizáveis (placa de pressão, portão, caixote, irrigador, gansa…)
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
  fase6/                   Expresso do Superbafo: track.js descreve o trilho uma vez só, para o
                           movimento do trem (puzzle.js) e para os trilhos visíveis (world/railway.js)
  fase7/                   Lambe-Lambe na Pracinha: túnel de lama, trinco por dentro, Lambe-Lambe e
                           escorregador (pose roteirizada com lock.drive); world/ separado por peça da pracinha
  dev.js                   fases de desenvolvimento (fora do menu: as arenas e os protótipos de fases novas),
                           abertas por ?level=<id> (devCatalog); só baixado quando o id não é de uma fase publicada
src/world/                 cenário da fase 1 + utilitários de modelagem (util.js, plants.js, sky.js…) e peças
                           compartilhadas: toys.js (patinho, ursinho, frisbee), treats.js (ossinhos), pigeon.js (pombo)
src/dogs/                  as cachorrinhas (ver §7)
  config.js                atributos globais das personagens; withStart cria a configuração de cada layout
src/characters/goose.js    a Dona Gansa
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
7. Posiciona as dogs, aplica `?stage=` (só no carregamento inicial) e emite `level:loaded` (a UI revela).

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
pode passar `build` direto, sem `load`.

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
| `GOAL` | objetivo: `{x, z, r}`, lugar da comemoração de cada dog e `entryPoints` (§4.5) |
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
| `lockFor(nome)` → `{ action, faceX, faceZ, drive?, slope? }` ou null | trava a entrada (puxando corda, girando registro); `drive` = pose roteirizada (a fase move a dog, como na subida do escorregador da fase 7) e `slope` inclina o corpo |
| `lookTarget(ctrl)` | para onde a dog ativa olha |
| `modifyIntent?`, `assist?` | empurrar caixotes; "funis" que ajudam a entrar em passagens |
| `navFlags()` → `{ flag: bool }` | libera arestas do grafo (`gateOpen`, `bridge`…) |
| `reset()`, `jumpToStage?(etapa, {who})` | reiniciar; `?stage=` e testes |
| `onBark?(ctrl)`, `endActions?()`, `info?()`, `dispose?()` | latido; fim da fase; depuração; descarte |
| `speedScale?(ctrl)`, `canDash?(ctrl)`, `onDashBlocked?(ctrl)` | estado da dog que a fase controla (lama: metade da velocidade e sem arrancada) |
| `onLick?(ctrl, lick)` → `{ stop }`, `onLickMiss?(ctrl, { blocked })` | efeito de cada lambida do Lambe-Lambe (declarar `onLick` também tira a dica genérica do botão) |
| `onStageChange` (setter) | o núcleo registra um callback para reemitir o objetivo |

Peças prontas:

- `src/game/puzzleKit.js`: `createHints` (dicas sem repetição e prompts "E Pegar…"), `createCollectibles`,
  `createCarryItem` (item na boca, com `returnHome` e `drop`), `deliveredAt` e `reach`.
- `src/game/mechanics/`: `createPressurePlate` (placa que exige peso: `requires 'large' | 'any'`), `createHingedGate`
  (portão com dobradiça que não esmaga ninguém ao fechar), `createPushCrate` (caixote em 2 eixos com `onLimit`),
  `createSprinkler` (jatos giratórios que molham e empurram), `createLockedInteractable` (alavanca, registro, corda),
  `createGooseNPC` (patrulha, alerta, investida, atração por latido), `createDogEffects` (empurrão, ações que travam a
  entrada, pelo molhado) e `createMud` (lama que enlameia numa área, deixa lenta e sem arrancada e sai em placas com
  o Lambe-Lambe; liga `speedScale`/`canDash`/`onLick` do puzzle).

**Comemoração**: ao entregar, as duas dogs vão para `GOAL.celebrate`. Uma dog longe e fora do quadro reaparece
num dos `GOAL.entryPoints` (fora da câmera) e chega andando; se não chegar a tempo, termina o trajeto durante a
vitória e só então comemora. Nunca comemora parada no meio do caminho.

## 5. Colisão e navegação

**Colisão** (`src/game/collision.js`): o corpo de cada dog é um círculo no plano XZ. Formatos de colisor:
`box {x, z, hx, hz}` (alinhada aos eixos), `circle {x, z, r}` e `segment {ax, az, bx, bz, t}` (cápsula com
meia-espessura `t`). Opções:

- `blocks`: `'all'` (padrão), `'large'` (só a Rhaenyra: aberturas onde só a Radhija passa) ou `'small'`;
- `except {minX, maxX, minZ, maxZ}`: ignorado quando o centro da dog está dentro (água sob uma ponte);
- `companionOnly`: só a IA da companheira desvia (o disco do irrigador ligado);
- `kind`: informativo (`'water'`, `'gate'`…), aparece nos contatos;
- `jumpable`: obstáculo baixo (tronco, mureta baixa) que não bloqueia quem está no ar, ou seja, a Rhaenyra pulando.
  Sem essa marca, nada é pulável: as paredes, cercas e portões das fases continuam bloqueando no ar.

Colisores dinâmicos são registrados pelo puzzle com `world.addDynamic({...})`, que devolve o próprio objeto: mova
`x/z/ax…` e ligue/desligue com `enabled`. O movimento usa sub-passos de no máximo 0,45 × raio, então nem a arrancada
atravessa paredes finas (há teste de regressão para isso em todas as fases).

**Navegação** (`src/game/navigation.js`, `companion.js`): a companheira anda em linha reta quando enxerga a líder;
senão segue o grafo `NAV_NODES`/`NAV_EDGES` (Dijkstra com várias origens). Cada aresta pode exigir
`{ requires: 'small' | 'large' | flag }`, e as flags vêm de `puzzle.navFlags()`. Sem caminho, ela espera no nó
alcançável mais próximo da líder e senta. Os testes de navegação conferem, para toda fase registrada, que os nós
estão livres, que as arestas não atravessam colisores e que o grafo é conexo com todas as flags ligadas.

### 5.1 Cheiro (superbafo)

`src/game/mechanics/scent.js` cria, por fase, o campo de cheiro que o núcleo entrega ao puzzle como `ctx.scent`
(desenho em `src/fx/scentView.js`). Regras, todas determinísticas:

- **Nuvem**: nasce com um empurrão, desacelera e se espalha devagar (o raio cresce) até sumir (~5 s). Não atravessa
  paredes: colide como um círculo pequeno e passa onde a Radhija passa.
- **Vento** (`scent.addWind({ x, z, dirX, dirZ, length, halfWidth, strength })`): faixa a partir de uma origem; dentro
  dela a nuvem é levada pela corrente e fica compacta. O objeto devolvido é mutável: mova a origem junto com o
  ventilador ou desligue com `enabled`.
- **Duto** (`scent.addDuct({ inlet: {x, z, r}, outlet: {x, z, dirX, dirZ}, travel, active() })`): com `active()`
  verdadeiro, a nuvem que chega à boca some e sai pela outra ponta `travel` segundos depois.
- **Nariz** (`scent.addNose({ id, x, z, r, onSmell(nuvem) })`): alvo que reage uma vez por nuvem. É aqui que entram
  os tipos de alvo: animais que fogem (os pombos da fase 4 e da Arena do Bafo), mecanismos que espirram, plantas que recolhem.
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
| Superbafo (Radhija): segurar mira, soltar sopra | R | L2 · LT | Bafo · Lamber | `bafo()` |
| Arrancada (Radhija) / empurrar (Rhaenyra), segurar | Shift | R1 ou R2 · RB ou RT | Arrancada · Empurrar | `shift()` |
| Trocar de cachorrinha | Q | L1 · LB | Trocar | `KeyQ` |
| Pausar | Esc | Options · Start | botão do canto | `Escape` |
| Menus | setas, Tab, Enter confirma, Esc volta | D-pad/analógico, ✕ confirma, ○ volta | tocar nos botões (Voltar no canto) | |

A UI desenha os botões nos dois estilos (`PAD_BTN` em `src/ui/markup.js`) e mostra o do controle conectado:
Xbox se o id do controle tiver "xbox"/"xinput", PlayStation nos demais casos (padrão).

`src/game/input.js` traduz o controle para os mesmos códigos lógicos do teclado, então o jogo não sabe de onde veio
o comando. Ao voltar de um menu para o jogo, os botões segurados ficam travados até serem soltos (`latchPad`):
o ✕ que confirma "Começar" não vira pulo, o ○ que volta da pausa não vira latido e o L2 não vira bafo. Os menus da UI leem o controle à parte (`src/ui/menuNav.js`).

**Toque** (`src/ui/touchControls.js` → `input.touch`): joystick à esquerda (flutuante: tocando fora do aro, ele vem
para baixo do dedo; `touchStick` usa a mesma zona morta e curva do analógico) e botões à direita (`TOUCH_BUTTONS`):
Agir, Pular, Bafo/Lamber (segurar), Arrancada/Empurrar (toque = arrancada, segurar = empurrar), Trocar e Fica/Vem,
mais a pausa no canto. Os rótulos acompanham a dog ativa (`.rr[data-dog]`) e o Fica vira Vem. Multitoque por Pointer
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

**Superbafo** (`game.js` + `src/game/mechanics/scent.js`): só quem tem `bafoSpeed` nas estatísticas (a Radhija).
Segurando R/L2 ela para e mira (gira com o analógico) e uma prévia no chão mostra o caminho provável da nuvem;
soltando, "HÁÁÁ!": nasce uma nuvem na frente dela (`dog:bafo`). Depois ela fica toda orgulhosa; a Rhaenyra perto
de uma nuvem vira a cara (`dog:yuck`). Mirar é cancelado ao pausar ou trocar de dog. Ver §5.1.

**Lambe-Lambe** (`game.js`): o mesmo botão (R/L2) com a Rhaenyra, que tem `lickStroke`/`lickReach` nas estatísticas.
Pertinho da irmã (até `lickReach`), ela escolhe o ponto do corpo da irmã mais perto (garupa, flanco, bochecha ou
focinho), encosta (`lick:start`), vira para ele e lambe em ritmo enquanto o botão estiver seguro: cada lambida dura
`lickStroke` s e chega à irmã no meio do ciclo (`dog:lick {target, x, y, z, stroke}` e `puzzle.onLick`). A irmã fica
parada, vira a cabeça e reage a cada lambida (`action 'licked'`, no mesmo `lickPhase`). Soltar termina a lambida em
curso (`lick:end`); trocar de dog, reiniciar ou sair encerram; pausar congela. Longe da irmã é só uma lambidinha no
focinho (`dog:lick` sem alvo); com a boca cheia, não lambe. Numa fase que não declara `onLick`, a dica explica que o
superbafo é da Radhija e que o R da Rhaenyra é o Lambe-Lambe. A lama da fase 7 é `createMud` (§4.5): o visual fica no
modelo (`dog.setMud(k, pontosLimpos)`, `dog.setShine(k)`).

**Fica / Vem**: F alterna a companheira entre seguir e ficar sentada onde está. Quem vira ativa perde o "Fica";
depois de trocar (Q), a nova companheira espera 0,6 s antes de seguir, para dar tempo de apertar F.

**Extras** (escondidos de propósito; não remover): pedido do responsável pelo projeto, que conta o segredo a quem
quiser. Nada no jogo os anuncia: nenhuma dica, menu, tela de controles, conquista ou texto, e nada no README
(`test/extras.test.mjs` confere a UI e o README). `src/game/extras.js` cuida de duas coisas.
- **Cocô**: código lógico `KeyC` (tecla C; R3 = `PAD.RS` no controle; o toque não tem). Só funciona com os ossinhos
  todos da fase pegos, uma vez por tentativa (reiniciar libera de novo) e com a dog ativa parada no chão, sem nada na
  boca. Três partes, com as poses em `dogAnimation.js`:
  - voltinha (`poopPre`): ela fareja e anda um círculo pequeno de verdade (0,5 × o comprimento dela, de 0,8 a 1,3
    volta, terminando de perfil para a câmera), com o passo igual ao deslocamento e os apoios girando com o corpo na
    curva. `planCircle` só aceita um caminho sem colisor (`overlaps` do mundo), sem a irmã e com o chão livre onde o
    cocô cai; sem espaço, o raio diminui, a volta vira meia volta ou um quarto, ou ela só fareja parada. Nunca gira
    sem andar;
  - agachada (`poopK`, `POOP_TIME` s): agacha, faz força, solta o cocozinho de `src/world/poop.js` e cava com as
    traseiras; a irmã por perto vira a cara;
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
- Uma fase nova precisa de três ossinhos e de pelo menos um ponto em `extras` (`test/extras.test.mjs`). A suíte E2E
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
`carryKind` e `setWet(0..1)`. `anim` = `{ speed, turn, action, lookAt, carrying, jump, airK }` (`jump` = altura do pulo,
`airK` = progresso 0..1 no ar ou −1 no chão); ações: `none`, `sit`, `push`, `strain`, `tug`, `celebrate`, `sniff`,
`dash`, `turn`, `shake`, `startled`, `jump`, `bafoAim`, `bafo`, `proud`, `yuck`. A pose de boca é detectada pelo nome
(ou `userData.carryKind`) do objeto no `mouthSocket` ou pela forma dele.

Por dentro: `dogModel.js` e `sdf.js` geram a malha (SDF → Surface Nets → SkinnedMesh) e `furMaterial.js` o pelo;
`dogRig.js` monta o esqueleto e a IK das pernas; `dogFace.js`, o rosto; `carryPose.js`, o item na boca;
`dogAnimation.js` resolve a pose a cada quadro (é o arquivo para mexer em animações; o pulo está lá).

**Dona Gansa** (`createGoose()` em `src/characters/goose.js`, tipo `GooseModel`): modelo e animação; o comportamento
está em `src/game/mechanics/gooseNpc.js`.

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
  `companion:stay`, `bafo:aim`, `dog:bafo`, `dog:yuck`, `dog:dashBlocked` (arrancada recusada pela fase),
  `lick:start`/`lick:end`, `dog:lick {target, x, y, z, stroke}` (target null = lambidinha no focinho).
- **Cheiro**: `scent:spawn`, `scent:duct`, `scent:exit`, `scent:smell`, `scent:fade`; fase 4 e Arena do Bafo:
  `fan:aligned`, `pigeon:flee {y?}` (y = altura de onde ele sai; do chão, um voo curto), `pigeon:land` e `pigeon:shrug`
  (o pombo ignorou o latido).
- **Itens**: `item:pickup`, `item:revealed`, `collectible:pickup {count, total}`, `celebrate:start`.
- **Mecânicas** (sempre com `x, z`): `plate:press`/`plate:release`, `gate:open`/`gate:close`/`gate:locked`, `wedge:kick`,
  `sprinkler:hit`/`sprinkler:off`, `valve:turn`, `crate:move`/`crate:sink`, `lantern:on`/`lantern:off`,
  `wall:touch {id, y}`, `wall:button {id, kind, on, y}`, `wall:tick {id, left}`, `wall:timeout {id}` (impulso na parede),
  `hatch:open`/`hatch:close` (portinhola da parede de treino),
  `goose:alert`/`goose:honk`/`goose:charge`/`goose:hit`/`goose:lured`/`goose:return`; fase 1: `rope:tug`, `cart:move`,
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

**Celular** (`.rr[data-mobile="phone"|"tablet"]`, vindo de `engine.quality.device`): layout compacto do HUD, da tela
inicial, do cartão da fase, da pausa (duas colunas, sem a tabela de teclas) e da vitória; áreas seguras do entalhe
(`env(safe-area-inset-*)`, `viewport-fit=cover`); sem desfoque de fundo sobre o 3D (custa caro na GPU do celular);
transições mais curtas. Celular de pé: aviso "Gire o celular" (`.rr-rotate`) e a partida pausa. No Android, o
primeiro toque num botão do menu pede tela cheia, e a pausa tem o botão Tela cheia. O Safari do iPhone não deixa uma
página ocupar a tela inteira (`requestFullscreen` só vale para vídeo): lá a tela cheia é o app da tela inicial
(`public/manifest.webmanifest` com `display: standalone` e `display_override: [fullscreen, standalone]`, metas
`apple-mobile-web-app-*` e `viewport-fit=cover` no `index.html`). Fora dele, `src/ui/installHint.js` (só quando
`needsInstallTip`: iPhone/iPad sem a API e fora do modo aplicativo) mostra uma vez um cartão sob o Jogar
(Compartilhar → "Adicionar à Tela de Início"), uma linha no aviso de girar e uma nota com o passo a passo na pausa
(só texto: nada focável que o teclado ou o controle ativariam sem efeito). O app da tela inicial guarda o progresso à parte do Safari (o iOS separa os dados).
`index.html` impede zoom e rolagem por gesto (`touch-action`, `overscroll-behavior`).
Nada disso existe no PC: sem `data-mobile` e com teclado ou controle, a interface é a de sempre.

**Qualidade gráfica por aparelho** (`src/core/quality.js`, aplicada pelo engine): `detectDevice` (dedo como ponteiro
principal, `pointer: coarse` sem `hover`; celular se o lado menor da tela tem até 600 px) escolhe o perfil inicial; no
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
desenhariam o dobro e esquentariam o aparelho.

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
`src/levels/dev.js`), `?play` (pula a tela inicial), `?dog=rhaenyra`, `?stage=<etapa>`
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
