# Arquitetura — Radhija & Rhaenyra

Guia para quem mantém e evolui o jogo. Explica como as peças se encaixam, onde mexer para cada tipo de mudança
e como verificar que nada quebrou. Para o passo a passo de uma fase nova, veja [COMO-CRIAR-UMA-FASE.md](COMO-CRIAR-UMA-FASE.md).
Os tipos de todas as APIs citadas aqui estão em [`src/types.d.ts`](../src/types.d.ts).

## 1. Visão geral

Aventura 3D curta em fases, em Three.js r170 + Vite, JavaScript puro com ES modules. O jogador controla uma de
duas cachorrinhas (a Radhija, pequena e rápida, que dá arrancadas e solta o superbafo; a Rhaenyra, grande e forte,
que empurra e pula) e troca entre elas; a outra vira
companheira e segue sozinha (ou espera, com o comando **Fica**). Cada fase é um puzzle cooperativo que termina
levando um item até um objetivo.

Princípios que valem para o projeto todo:

- **Tudo procedural.** Modelos, texturas, sons e música são gerados em código. Nenhum asset baixado.
- **Português do Brasil** em todos os textos visíveis e nos comentários.
- **Teclado e controle** (gamepad) com a mesma qualidade, inclusive nos menus.
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
  index.js                 registro das fases, em ordem
  faseN/index.js           definição (nome, textos, item, layout, iluminação, load do cenário, createPuzzle)
  faseN/layout.js          coordenadas e regras: limites, colisores, grafo, objetivo, câmera
  faseN/lighting.js        preset de iluminação (a fase 1 usa o padrão do motor)
  faseN/puzzle.js          a lógica da fase
  faseN/world/             cenário e props visuais, carregados sob demanda (a fase 1: fase1/world.js, que usa src/world/)
  _placeholder.js          cenário provisório em blocos, para testar uma fase antes da arte
  _modelo/                 modelo de fase completo e testado (não registrado): ponto de partida das fases novas
  _pulo/                   Arena do Pulo: fase de desenvolvimento para testar o pulo da Rhaenyra
  _bafo/                   Arena do Bafo: primeiro puzzle do superbafo ("o pombo e o portão"), cenário provisório
  dev.js                   fases de desenvolvimento (fora do menu), abertas por ?level=<id>
src/world/                 cenário da fase 1 + utilitários de modelagem (util.js, plants.js, sky.js…) e peças
                           compartilhadas: toys.js (patinho, ursinho), treats.js (ossinhos), pigeon.js (pombo)
src/dogs/                  as cachorrinhas (ver §7)
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
4. Descarta tudo da fase anterior: tudo mora num `root` (Group) que sai da cena.
5. Aplica `def.lighting`, chama `def.build({ engine, root, layout, params })` e aplica o "ver através" aos objetos de `seeThrough`.
6. Cria o mundo de colisão e a navegação a partir de `def.layout`, depois o puzzle com `def.createPuzzle(ctx)`.
7. Posiciona as dogs, aplica `?stage=` (só no carregamento inicial) e emite `level:loaded` (a UI revela).

**Pacote inicial**: o `main` do build leva o motor, o núcleo, as dogs, a UI, os efeitos e, de cada fase, só a
definição, o layout, a iluminação e o puzzle (o menu e os testes em Node usam isso). O cenário de cada fase vira um
chunk próprio (`dist/assets/faseN-world-….js`, nome dado em `vite.config.js`), baixado só quando a fase carrega: a
tela inicial baixa o da fase 1, `?level=5` só o da fase 5. As fases de desenvolvimento ficam no chunk `dev`.
`test/carregamento.test.mjs` falha se algum `world/` voltar a ser importado estaticamente.

**Estados do jogo**: `loading`, `title` (tela inicial sobre a fase), `intro` (cartão da fase), `playing`, `paused`,
`celebrating` (as duas comemoram no objetivo, ~3 s) e `victory` (painel de vitória). A UI espelha o estado.

**Um quadro em `playing`** (`game.js → updatePlaying`): lê a entrada relativa à câmera; trava a entrada se o
puzzle pedir (`lockFor`); deixa o puzzle ajustar a intenção (`modifyIntent`, ex.: empurrar); move a dog ativa;
move a companheira (IA, ou "Fica"); trata E/latido (`interact`, `onBark`); chama `puzzle.update`, que devolve
`'delivered'` quando o item chegou ao objetivo, o que inicia a comemoração.

## 4. Fases

### 4.1 Definição (`src/levels/faseN/index.js`, tipo `LevelDef`)

```js
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
| `DOGS.{radhija,rhaenyra}` | estatísticas (raio, velocidades, arrancada, pulo, superbafo…) e `start {x, z, yaw}`; as fases 2 a 5 reaproveitam as da fase 1 com `withStart` |
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
  (`Fase1Props` a `Fase5Props`). O puzzle sempre usa `?.` ao chamar um prop
  (`props.gate?.setOpen?.(t)`), então a lógica roda mesmo sem o cenário (é assim que os testes em Node funcionam).
  Todo prop com estado precisa de `reset()` que volte ao início, inclusive o item à posição `home`.
- `seeThrough`: objetos que podem ficar entre a câmera e as dogs (cerca, sebe, portão, a toalha da mesa) e recebem o
  recorte pontilhado.

Peças de cenário compartilhadas (fases 4 em diante): `createRubberDuck` e `createTeddyBear` em `src/world/toys.js`
(itens carregáveis: eixo longo em X; o nome e `userData.carryKind` dizem a pose da boca; o ursinho tem `sit()`/`lie()`),
`buildTreats(root, COLLECTIBLES)` em `src/world/treats.js` (ossinhos com a animação de coleta), `createPigeon()` em
`src/world/pigeon.js` (pombo com `setPose({ x, y, z, yaw, flying, asleep })` e `peek()`) e `stripeTexture()` em
`src/world/util.js` (lona listrada).
- `update(dt, t)`: animações do cenário (água, vagalumes, luzes).

### 4.5 Puzzle (`puzzle.js`, tipos `PuzzleContext` e `Puzzle`)

`createPuzzle(ctx)` recebe do núcleo: `layout`, `props`, `world` (colisão), `nav`, `dogs` (modelos), `ctrls`
(posição, velocidade e raio de cada dog), `emit(nome, dados)`, `cam.focusShot(x, z, {hold})`, `root`, `place(nome, x, z, yaw)`,
`activeDog`, `isStaying(nome)` e `setStay(nome, on)`.

E devolve um objeto com:

| Membro | Quando o núcleo chama |
|---|---|
| `stages`, `stage`, `carrier`, `collected`, `total` | leitura (UI, depuração, vitória) |
| `objective(ativa)` → `{ text, target, stage }` | sempre que a etapa ou a dog ativa muda (texto do HUD + marcador) |
| `update(dt, { active, comp, ctrls, stay })` | todo quadro em `playing`; devolva `'delivered'` para comemorar |
| `updateAlways?(dt)` | todo quadro em `playing` e `celebrating` (animações) |
| `interact(ctrl)` → bool | E / A; `false` faz a dog latir |
| `lockFor(nome)` → `{ action, faceX, faceZ }` ou null | trava a entrada (puxando corda, girando registro) |
| `lookTarget(ctrl)` | para onde a dog ativa olha |
| `modifyIntent?`, `assist?` | empurrar caixotes; "funis" que ajudam a entrar em passagens |
| `navFlags()` → `{ flag: bool }` | libera arestas do grafo (`gateOpen`, `bridge`…) |
| `reset()`, `jumpToStage?(etapa, {who})` | reiniciar; `?stage=` e testes |
| `onBark?(ctrl)`, `endActions?()`, `info?()`, `dispose?()` | latido; fim da fase; depuração; descarte |
| `onStageChange` (setter) | o núcleo registra um callback para reemitir o objetivo |

Peças prontas:

- `src/game/puzzleKit.js`: `createHints` (dicas sem repetição e prompts "E Pegar…"), `createCollectibles`,
  `createCarryItem` (item na boca, com `returnHome` e `drop`), `deliveredAt` e `reach`.
- `src/game/mechanics/`: `createPressurePlate` (placa que exige peso: `requires 'large' | 'any'`), `createHingedGate`
  (portão com dobradiça que não esmaga ninguém ao fechar), `createPushCrate` (caixote em 2 eixos com `onLimit`),
  `createSprinkler` (jatos giratórios que molham e empurram), `createLockedInteractable` (alavanca, registro, corda),
  `createGooseNPC` (patrulha, alerta, investida, atração por latido) e `createDogEffects` (empurrão, ações que travam a
  entrada, pelo molhado).

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

| Ação | Teclado | Controle (PlayStation · Xbox, por posição) | Código lógico |
|---|---|---|---|
| Mover | WASD / setas | analógico esquerdo (velocidade proporcional) / D-pad | `axis()` |
| Pular (Rhaenyra) | Espaço | ✕ · A | `Jump` |
| Interagir / latir | E | ○ · B | `KeyE` |
| Latir | — | □ · X | `Bark` |
| Fica / Vem (companheira) | F | △ · Y | `KeyF` |
| Superbafo (Radhija): segurar mira, soltar sopra | R | L2 · LT | `bafo()` |
| Arrancada (Radhija) / empurrar (Rhaenyra), segurar | Shift | R1 ou R2 · RB ou RT | `shift()` |
| Trocar de cachorrinha | Q | L1 · LB | `KeyQ` |
| Pausar | Esc | Options · Start | `Escape` |
| Menus | setas, Tab, Enter, Esc | D-pad/analógico, ✕ confirma, ○ volta | |

A UI desenha os botões nos dois estilos (`PAD_BTN` em `src/ui/markup.js`) e mostra o do controle conectado:
Xbox se o id do controle tiver "xbox"/"xinput", PlayStation nos demais casos (padrão).

`src/game/input.js` traduz o controle para os mesmos códigos lógicos do teclado, então o jogo não sabe de onde veio
o comando. Ao voltar de um menu para o jogo, os botões segurados ficam travados até serem soltos (`latchPad`):
o ✕ que confirma "Começar" não vira pulo, o ○ que volta da pausa não vira latido e o L2 não vira bafo. Os menus da UI leem o controle à parte (`src/ui/menuNav.js`).

**Pulo** (`dogController.js`): só quem tem `jumpHeight` nas estatísticas (a Rhaenyra). Arco de altura fixa
(`jumpHeight`, ~0,5 m) e duração `jumpTime` (~0,42 s), com impulso horizontal mínimo `jumpSpeed` na direção da
entrada (parada, pula no lugar) e pouco controle no ar. No ar, ela ignora colisores `jumpable` e não pisa em placas de
pressão; não pula na postura de empurrar. A companheira não pula: arestas do grafo que cruzam obstáculos puláveis
exigem uma flag que nunca liga, e ela espera do lado de cá. Colisores dinâmicos também podem ser puláveis: a fase 5
marca o portãozinho e a caixa de almofadas com `col.jumpable = true`. Quem não pula (a Radhija) ganha a dica
"Só a Rhaenyra pula! (Q)". Eventos: `dog:jump` e `dog:land`.

**Superbafo** (`game.js` + `src/game/mechanics/scent.js`): só quem tem `bafoSpeed` nas estatísticas (a Radhija).
Segurando R/L2 ela para e mira (gira com o analógico) e uma prévia no chão mostra o caminho provável da nuvem;
soltando, "HÁÁÁ!": nasce uma nuvem na frente dela (`dog:bafo`). Depois ela fica toda orgulhosa; a Rhaenyra perto
de uma nuvem vira a cara (`dog:yuck`). Mirar é cancelado ao pausar ou trocar de dog. Ver §5.1.

**Fica / Vem**: F alterna a companheira entre seguir e ficar sentada onde está. Quem vira ativa perde o "Fica";
depois de trocar (Q), a nova companheira espera 0,6 s antes de seguir, para dar tempo de apertar F.

## 7. Personagens

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

Barramento em `src/core/events.js`. Quem emite e quem ouve:

- **UI → jogo**: `ui:play`, `ui:pause`, `ui:resume`, `ui:restart`, `ui:nextLevel`, `ui:selectLevel {index}`, `ui:menu`.
- **Fase e estado**: `game:state {state, prev, level}`, `game:reset`, `level:loading {...}`, `level:loaded {...}`,
  `victory {timeSec, collected, total, level, levelId, hasNext, texts}`.
- **Interface do jogo**: `objective {text, target, stage}`, `interact:prompt {text, key}` (key é a tecla lógica, a UI
  desenha o botão do controle), `hint {text, duration}`, `input:device {type}`.
- **Dogs**: `dog:switch`, `dog:step`, `dog:dash`, `dog:jump`, `dog:land`, `dog:bump`, `dog:bark`, `dog:pushStart`, `dog:pushEnd`,
  `companion:stay`, `bafo:aim`, `dog:bafo`, `dog:yuck`.
- **Cheiro**: `scent:spawn`, `scent:duct`, `scent:exit`, `scent:smell`, `scent:fade`; fase 4 e Arena do Bafo:
  `fan:aligned`, `pigeon:flee {y?}` (y = altura de onde ele sai; do chão, um voo curto), `pigeon:land` e `pigeon:shrug`
  (o pombo ignorou o latido).
- **Itens**: `item:pickup`, `item:revealed`, `collectible:pickup {count, total}`, `celebrate:start`.
- **Mecânicas** (sempre com `x, z`): `plate:press`/`plate:release`, `gate:open`/`gate:close`/`gate:locked`, `wedge:kick`,
  `sprinkler:hit`/`sprinkler:off`, `valve:turn`, `crate:move`/`crate:sink`, `lantern:on`/`lantern:off`,
  `goose:alert`/`goose:honk`/`goose:charge`/`goose:hit`/`goose:lured`/`goose:return`; fase 1: `rope:tug`, `cart:move`,
  `carrot:revealed`, `carrot:pickup`; fase 5: `latch:start` (trava do portãozinho), `box:collapse` (caixa desmontando).

O feedback (`src/fx/feedback.js`) ouve os eventos de jogo e toca sons, partículas e vibração; para um efeito novo,
emita um evento no puzzle e trate-o lá.

## 9. Interface, áudio e efeitos

**UI** (`src/ui/`, DOM sobre o canvas): `ui.js` orquestra as camadas (tela inicial com seleção de fases, cartão da
fase, HUD, pausa, comemoração, vitória); `markup.js` tem o template e o HTML gerado (teclas e botões desenhados);
`hud.js`, o HUD; `curtain.js`, a transição entre fases; `menuNav.js`, o foco por teclado e controle; `progress.js`,
o progresso salvo (`localStorage` `rr-progress-v1`: melhor tempo, petiscos e conclusões por fase; uma fase é
liberada quando a anterior foi concluída). Estilos em `ui.css`, ícones SVG em `icons.js`.

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
| `npm test` | testes em Node (`test/*.test.mjs`): as 5 fases jogadas inteiras no jogo headless, navegação e colisão de todas as fases, cenário fora do pacote inicial, irrigador, dogs e regressões | ~8 s |
| `npm run typecheck` | TypeScript sobre o JavaScript (JSDoc) | ~2 s |
| `npm run test:e2e` | partidas com teclas reais no Chrome (Playwright): fases 1–5, controle, regressões, pulo e bafo; sobe e derruba sozinho um Vite sem HMR numa porta livre | ~13 min |
| `npm run build` | roda typecheck + `npm test` antes (`prebuild`) e gera `dist/` | ~15 s |
| `npm run verify` | build + e2e | ~14 min |

**Jogo headless** (`test/helpers/headless.mjs`): roda o `game.js` de verdade no Node, com dublês de motor, dogs e
props (o cenário nem é importado: o `load` das fases é descartado), e teclado/controle simulados. `createHeadlessGame({ level, query })` devolve `walkTo(x, z)`, `tap('KeyE')`,
`hold([dx, dz], ['ShiftLeft'])`, `run(segundos, { until })`, `teleport`, `info()` e `log(evento)`. É a forma mais
rápida de testar a lógica de um puzzle ou de uma mecânica nova.

**Partidas no navegador** (`tools/scripts/playthrough*.mjs`, `test-gamepad.mjs`, `test-regressoes.mjs`, `test-pulo.mjs`, `test-bafo.mjs`): usam
`tools/scripts/lib/harness.mjs` (Chrome do sistema, teclas reais, leitura do estado por `window.__game`). As das fases
1–3 andam o caminho inteiro com WASD; as das fases 4 e 5 usam teclas reais nas ações (R, Espaço, E, Shift, Q e o ✕ do
controle) e teletransportam entre os trechos, porque os testes headless já cobrem os caminhos.
Capturas vão para `shots/` (fora do git).

**Outras ferramentas**: `tools/shot.mjs` (captura com roteiro de teclas, ver o cabeçalho),
`tools/scripts/sim-sprinkler.mjs` (equilíbrio do irrigador), `sandbox/*.html` (dogs, gansa, cenário e efeitos isolados).

**Parâmetros de URL**: `?level=2` (fase inicial), `?level=pulo` (fase de desenvolvimento pelo id, ver
`src/levels/dev.js`), `?play` (pula a tela inicial), `?dog=rhaenyra`, `?stage=<etapa>`
(se o puzzle suportar), `?debug` (colisores e grafo), `?cam=x,y,z&look=x,y,z` (câmera fixa), `?nopost`
(sem pós-processamento).

**Ganchos de depuração**: `window.__game` = `{ engine, dogs, game, audio, particles, feedback, ui, events, levels,
THREE, env, props, layout }`; `game.debug` = `{ teleport(nome, x, z), setStage, info(), events(nome), log, world,
nav, ctrls, puzzle, cam }`.

## 11. Tipos

`jsconfig.json` liga a checagem de tipos (`checkJs`) em todo o `src/`, o que equivale a `// @ts-check` em cada
arquivo, inclusive nos novos. Os tipos das APIs públicas estão em `src/types.d.ts` e entram nos `.js` por JSDoc:

```js
/** @import { PuzzleContext, Puzzle } from '../../types' */

/**
 * @param {PuzzleContext} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) { … }
```

A checagem é tolerante (`strict: false`): ela pega nomes errados, campos que não existem e formatos trocados nas
APIs, sem exigir tipo em tudo. O editor (VS Code) usa o mesmo `jsconfig.json`.

## 12. Convenções

- Código, nomes e comentários seguem o estilo do arquivo em volta; comentários em português.
- Tudo de uma fase mora no `root` dela; nada de estado global entre fases (exceto as dogs).
- Puzzles chamam props sempre com `?.` e nunca dependem de detalhes visuais para a lógica.
- Mudanças de jogabilidade vêm com teste (`test/faseN.test.mjs` ou `test/regressoes.test.mjs`).
- `referencias/fotos/` (fotos das cachorrinhas) e `shots/` ficam fora do git; ver o `.gitignore`.

## 13. Licenças

Tudo procedural e próprio. Dependências: Three.js (MIT), Vite (MIT), Fredoka e Nunito via @fontsource (SIL OFL 1.1).
Ferramentas de desenvolvimento: TypeScript (Apache-2.0), Playwright (Apache-2.0).
