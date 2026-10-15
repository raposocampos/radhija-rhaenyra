# Radhija & Rhaenyra — Contrato da equipe (v2: sistema de fases)

Demo 3D jogável em Three.js r170 + Vite, com JavaScript puro e ES modules. Já tem **3 fases** e foi
estruturada para ganhar mais. Este documento é a **fonte da verdade** entre os agentes: leia tudo antes de começar.

## 0. Barra de qualidade (inegociável)

O usuário amou a fase 1 ("o jogo está ótimo!"). As fases novas precisam estar **no mesmo nível ou acima**:
- Parecer um jogo indie bonito e bem acabado. Nada de greybox, cubos crus ou "cara de protótipo".
- Formas orgânicas, materiais convincentes, composição cuidadosa e luz com personalidade.
- **Puzzles caprichados**: cada um legível, justo, sem becos sem saída e com feedback claro.
- Controle gostoso no teclado **e no controle (gamepad)**.
- Todos os textos visíveis em **português do Brasil**.

## 1. Arquitetura

```
src/main.js                 integrador: monta engine, dogs, jogo, UI, áudio e partículas; loop
src/core/engine.js          renderer + luz/céu/névoa/pós por preset (applyLighting); dono: integrador
src/core/events.js          barramento de eventos
src/game/                   NÚCLEO genérico: estados, gerenciador de fases (game.js), entrada,
                            colisão, navegação, companheira, câmera, kit de puzzle + mecânicas
src/levels/index.js         registro das fases (ordem)
src/levels/faseN/index.js   definição da fase (nome, textos, layout, lighting, build, createPuzzle)
src/levels/faseN/layout.js  coordenadas, colisores, grafo de navegação, câmera, objetivo final
src/levels/faseN/lighting.js preset de iluminação da fase
src/levels/faseN/world/     cenário + props visuais da fase (fase 1: src/world/)
src/levels/faseN/puzzle.js  lógica do puzzle da fase (interface §5)
src/dogs/                   as cachorrinhas (modelo + animação procedural)
src/characters/             outros personagens (Dona Gansa)
src/ui/, src/fx/            interface, áudio, partículas e feedback
```

**Fluxo de uma fase**: `game.loadLevel(i)` emite `level:loading` (a UI cobre a tela), descarta a fase
anterior (tudo dela mora num `root` Group), aplica `def.lighting` e monta `def.build(...)`. Em seguida cria
o mundo de colisão e a navegação a partir de `def.layout`, cria `def.createPuzzle(...)`, posiciona as dogs
e emite `level:loaded` (a UI revela). Estados: `loading`, `title`, `intro`, `playing`, `paused`,
`celebrating` e `victory`.

## 2. Donos dos arquivos (edite só os seus)

| Caminho | Dono |
|---|---|
| `src/main.js`, `src/core/*`, `src/levels/index.js`, `src/levels/*/index.js`, `src/levels/*/layout.js`, `src/levels/_placeholder.js`, `src/world/seeThrough.js`, `docs/*` | **Integrador** (peça mudanças no relatório) |
| `src/dogs/**`, `src/characters/**`, `sandbox/dogs*`, `sandbox/goose*` | **Agente Personagens** |
| `src/levels/fase2/world/**`, `src/levels/fase2/lighting.js`, `sandbox/fase2*` | **Agente Cenário F2** |
| `src/levels/fase3/world/**`, `src/levels/fase3/lighting.js`, `sandbox/fase3*` | **Agente Cenário F3** |
| `src/game/**`, `src/levels/*/puzzle.js`, `tools/scripts/**` (exceto `fx-*`) | **Agente Mecânica** |
| `src/ui/**`, `src/fx/**`, `index.html`, `public/**`, `sandbox/fx*`, `tools/scripts/fx-*` | **Agente Polimento** |
| `src/world/**` (cenário da fase 1 + utilitários: `util.js`, `plants.js`, `ground.js`, `sky.js`…) | **Somente leitura** para todos. Pode importar; para uma variante, copie para a sua pasta. |

Regras:
1. Cinco agentes trabalham **ao mesmo tempo** na mesma pasta. Edite só os seus arquivos.
2. **Não rode `npm install`** nem mude `package.json`. Já instalados: three@0.170.0, vite, playwright-core, @fontsource/fredoka, @fontsource/nunito. Addons: `three/addons/...`.
3. **Nenhum asset baixado.** Tudo é procedural: geometria em código, texturas em canvas ou shader, sons em WebAudio.
4. Programe contra as APIs deste contrato. Os módulos dos outros podem estar provisórios (`_placeholder.js`). Use `?.` onde o outro lado ainda pode faltar.
5. Pode acrescentar campos às APIs, mas não remova nem renomeie.
6. **Não quebre a fase 1.** Ela é a referência de qualidade e tem testes (`node tools/scripts/playthrough.mjs`, `node tools/scripts/test-collision.mjs`).

## 3. Servidor, testes e capturas

- Servidor Vite compartilhado em `http://127.0.0.1:5173/` (HMR: salvar um arquivo recarrega a página; em testes longos, use um servidor sem HMR na sua porta: `npx vite --config tools/scripts/vite.nohmr.config.mjs --port 51XX --strictPort --host 127.0.0.1`, onde Personagens = 5174, Cenário F2 = 5175, Cenário F3 = 5178, Mecânica = 5176 e Polimento = 5177).
- Parâmetros de URL:
  - `?level=2` fase inicial (base 1); `?play` pula a tela inicial;
  - `?dog=rhaenyra`; `?stage=<etapa>` (pula etapas, se o puzzle suportar); `?debug` (colisores + grafo);
  - `?cam=x,y,z&look=x,y,z` câmera fixa; `?nopost`.
- Captura headless com a GPU real: `node tools/shot.mjs --url "http://127.0.0.1:5173/?level=2&play" --out shots/<agente>/x.png --wait 3000`. Roteiro de teclas: `--script arq.json` (ver cabeçalho de `tools/shot.mjs`).
- **Abra as capturas com Read e itere.** Não declare pronto sem ter olhado.
- `window.__game` = `{ engine, dogs, game, audio, particles, feedback, ui, events, levels, THREE, env, props, layout }`. `game.debug` = `{ teleport(name,x,z), setStage, info(), events(name), log, world, nav, ctrls, puzzle, cam }`. `game.loadLevel(i, { mode: 'play'|'intro'|'title' })`.
- No fim, compile num diretório só seu: `npx vite build --outDir .builds/<agente> --emptyOutDir`.

## 4. Definição de fase (`src/levels/faseN/index.js`)

```js
export default {
  id: 'fase2', number: 2, name: 'Operação Bolinha', subtitle: '…', intro: 'texto curto do cartão de abertura',
  item: 'carrot' | 'ball' | 'slipper',          // ícone do item na UI
  ambience: 'day' | 'dusk' | 'night',            // som ambiente
  texts: { celebrate, victoryTitle, victorySub },
  layout,                                        // layout.js (ver §4.1)
  lighting,                                      // preset (ver §4.2)
  build({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose?() },
  createPuzzle(ctx) → puzzle,                     // §5
}
```

### 4.1 Layout: campos que o núcleo usa (as fases acrescentam os seus)
`WORLD.bounds`, `DOGS.{radhija,rhaenyra}` (stats + `start {x,z,yaw}`), `STATIC_COLLIDERS`, `NAV_NODES`, `NAV_EDGES`, `COLLECTIBLES`, `COLLECTIBLE_PICKUP_R`,
`GOAL {x, z, r, celebrate:{radhija:{x,z}, rhaenyra:{x,z}}, entryPoints}` e
`CAMERA {fov, offset, lookHeight, limits, title:{center, radius, angle, height, look}, celebrate:{pos, look}, victoryOffset}`.

Colisores (2D, plano XZ):
- Formatos: `box {x,z,hx,hz}`, `circle {x,z,r}` e `segment {ax,az,bx,bz,t}`.
- `blocks`: `'all'` (padrão), `'large'` (só bloqueia a Rhaenyra) ou `'small'` (só bloqueia a Radhija).
- `except`: `{minX,maxX,minZ,maxZ}`. O colisor é ignorado quando o centro da dog está dentro (água sob uma ponte, por exemplo).
- `companionOnly`: só a IA da companheira desvia (ex.: o disco do irrigador ligado).
- `kind`: `'water'`, por exemplo.
- **Dinâmicos**: o puzzle registra com `world.addDynamic({...})` e recebe o objeto mutável (mova x/z/ax…; liga e desliga com `enabled`). Há também `removeDynamic` e `getDynamic`.

Arestas de navegação: `[a, b, { requires }]`. `requires` aceita `'small'`, `'large'` ou uma **flag do puzzle** (`puzzle.navFlags()`), por exemplo `gateOpen`, `sprinklersOff` e `bridge`.

### 4.2 Preset de iluminação
Formato de `LIGHTING_DEFAULT` em `src/core/engine.js`, com o merge feito sobre ele:
`sun {dir, color, intensity, castShadow?}`, `hemi {sky, ground, intensity}`, `fog {color, near, far}`, `exposure`,
`sky {zenith, mid, horizon, ground, sun, stars 0..1, clouds 0..1, glow, disk, cloudTint:[r,g,b] linear}`, `env {intensity, ground}`,
`grade {warm:[r,g,b], sat, lift:[r,g,b], vignette}` e `bloom {strength, radius, threshold}`.
Luzes extras da fase (lanternas, arandelas) são PointLight/SpotLight **dentro do `root`**; use no máximo cerca de 6 PointLights sem sombra.

## 5. Interface de puzzle (`createPuzzle(ctx)`)

`ctx` traz:
- `layout`, `props` (os do `build`), `world` (colisão), `nav`, `dogs` (modelos), `ctrls` (controladores: `{x, z, yaw, r, size, cfg, vx, vz, dashT, animSpeed}`);
- `emit(name, payload)`, `cam` (`focusShot(x, z, {hold})`), `root`, `engine`, `params`;
- `place(name, x, z, yaw)` e `activeDog` (getter).

O puzzle devolve:
```js
{
  stages: [...], stage, carrier, collected, total,        // getters
  objective(activeName) → { text, target: {x, y, z} | null, stage },   // y = altura do marcador
  update(dt, { active, comp, ctrls }) → 'delivered' | null,             // por quadro em 'playing'
  updateAlways?(dt),                                     // 'playing' e 'celebrating' (animações)
  interact(activeCtrl) → bool,                           // E: true se tratou (senão a dog late)
  lockFor(name) → { action, faceX, faceZ } | null,       // trava a entrada (ex.: puxando corda)
  lookTarget(ctrl) → {x, y, z} | null,
  modifyIntent?(dt, ctrl, intent, { shift, comp }) → { intent?, action? },  // empurrar etc.
  assist?(ctrl, intent, dt),                             // funis de movimento
  navFlags() → { flag: bool },
  setPrompt(kind|null), reset(), jumpToStage?(stage, {who}) → activeName | null,
  endActions?(), info?() → objeto para debug.info(), dispose?(),
  onBark?(ctrl),                                         // latido da dog ativa (ex.: atrair a gansa)
  set onStageChange(fn),
}
```
Kit reutilizável: `src/game/puzzleKit.js` (`reach`, `createHints`, `createCollectibles`, `createCarryItem` e `deliveredAt`).
Mecânicas genéricas prontas em `src/game/mechanics/`, para reutilizar nas fases futuras:
- `pressurePlate`: placa de pressão (dogs e caixotes; `requires 'large'|'any'`);
- `hingedGate`: portão com dobradiça;
- `pushCrate`: caixote empurrável em 2 eixos, com gancho `onLimit`;
- `sprinkler`: irrigador com jatos giratórios;
- `lockedInteractable`: alavanca, registro ou corda;
- `gooseNpc`: NPC com patrulha, alerta, investida e atração por latido;
- `dogEffects`: empurrão, ações que travam a entrada e pelo molhado.

## 6. Props visuais das fases novas (devolvidos por `build()` como `props`)

Todos os `object` são Object3D dentro do `root`. `update(dt, t)` e `reset()` são obrigatórios (`reset` volta tudo ao início, inclusive o item à cena, na posição `home`).

**Fase 2** (`src/levels/fase2/world/`):
```js
{
  gate:      { object /* pivô na dobradiça, folha ao longo de -Z local */, setOpen(t) },   // yaw = GATE.openYaw * t
  plank:     { object, setPress(t) },        // 0..1: tábua afunda nas molas, a corda estica e a roldana gira
  wedge:     { object, setState(t), bump() },// t: 0 em WEDGE.x/z → 1 travado em WEDGE.lockedAt; bump(): quica (portão fechado)
  sprinkler: { object, setAngle(a), setOn(k) }, // a: ângulo do 1º jato; direção (cos a, 0, sin a) = atan2(dz, dx); k 0..1 (desligando → jatos murcham)
  valve:     { object, setTurn(t) },         // 0..1 roda do registro girando
  crate:     { object, setPos(x, z), setSink(t) }, // sink 0..1: caindo no canal até virar ponte nivelada
  ball:      { object /* centrado */, home: Vector3, setHighlight(on) },
  bed:       { setHighlight(on) },           // caminha convidativa quando carregando a bolinha
  collectibles: [{ id, object, collect(), reset() }],
  update(dt, t), reset(),
}
```
**Fase 3** (`src/levels/fase3/world/`):
```js
{
  gate:     { object, setOpen(t) },
  plateH:   { object, setPress(t) }, plateL: { object, setPress(t) },
  lanternH: { setOn(k) }, lanternL: { setOn(k) },   // 0..1 brilho
  slipper:  { object, home, setHighlight(on) },
  door:     { setHighlight(on) },                    // porta de vidro mais quente
  collectibles: [...], update(dt, t), reset(),
}
```

## 7. Personagens

**Dogs** (`createDog(kind)`): API da v1 (`object`, `mouthSocket`, `markerAnchor`, `onFootstep`, `update(dt, anim)`, `triggerBark()`).
Ações novas em `anim.action`:
- `'shake'`: chacoalhar o pelo depois de molhar (~0,9 s);
- `'startled'`: empurrada pela gansa, recuo com orelhas para trás (~0,6 s);
- `'turn'`: girar o registro com a boca (pode variar o `tug`).

Extras:
- `dog.setWet(k 0..1)`: pelo escurecido e "murcho"; a Mecânica faz o decaimento.
- `dog.setCarryPose(kind | null)` e o getter `carryKind`: pose de boca por item. Por padrão é detectada pelo `name`/`userData.carryKind` do objeto no `mouthSocket`: `'carrot'`, `'ball'` ou `'slipper'`.

**Dona Gansa** (`src/characters/goose.js`):
```js
createGoose() → {
  object,                    // origem no chão, olha +Z, ~0.5 m de altura (gansa doméstica branca, bico laranja)
  radius: 0.22,
  update(dt, { speed, turn, action: 'idle'|'walk'|'alert'|'honk'|'charge'|'curious'|'flap', lookAt }),
  triggerHonk(),
}
```

## 8. Entrada (teclado + controle)

| Ação | Teclado | Controle (padrão Xbox/PS) |
|---|---|---|
| Mover | WASD / setas | analógico esquerdo (velocidade proporcional) / D-pad |
| Interagir / latir | E | A (✕) |
| Latir (sempre) | — | X (□) |
| Arrancada / empurrar (segurar) | Shift | B (○) ou RT |
| Trocar de dog | Q | LB / RB |
| **Fica / Vem** (companheira) | **F** | **Y (△)** |
| Pausar | Esc | Start / Options |
| Menus | Enter / Esc / setas | A confirma · B volta · D-pad/analógico navega |

**Fica / Vem**: F alterna a companheira entre **seguir** (padrão) e **ficar** onde está (sentada, olhando a líder). Quem vira ativa perde o "fica". Depois de trocar (Q), a nova companheira espera 0,6 s antes de seguir, para dar tempo de apertar F. Isso é central nos puzzles das fases 2 e 3.

Leitura do controle para menus (`src/game/input.js`):
- `pollMenuPad(now?)` → `{connected, up, down, left, right, confirm, back, start, any, stick}`, com bordas e repetição ao segurar.
- Também: `readGamepad()`, `shapeStick()`, `rumblePad(pad, forte, fraca, ms)`, `PAD`, `game.input.device` e `game.input.rumble(forte, fraca, ms)`.
- Ao sair de um menu, os botões ficam travados até serem soltos (o A do "Começar" não vira latido).

## 9. Eventos

**A UI emite:**
- `ui:play` (sai de `title` ou `intro`), `ui:resume`, `ui:restart` (reinicia a fase), `ui:pause`;
- `ui:nextLevel`, `ui:selectLevel {index}` e `ui:menu` (volta à tela inicial).

**O núcleo e os puzzles emitem:**
- **Fase e estado:**
  - `game:state {state, prev, level}`, `game:reset {level}`;
  - `level:loading {index, count, id, number, name, subtitle, initial}`;
  - `level:loaded {index, count, id, number, name, subtitle, intro, item, texts, total, hasNext}`;
  - `victory {timeSec, collected, total, level, levelId, hasNext, texts}`.
- **Interface do jogo:**
  - `objective {text, target:{x,y,z}|null, stage}`;
  - `interact:prompt {text, key}` (key é a tecla lógica `'E'`, e a UI troca pelo botão do controle);
  - `hint {text, duration}`;
  - `input:device {type: 'keyboard'|'gamepad'}`.
- **Dogs:**
  - `dog:switch {name, displayName}`, `dog:step`, `dog:dash`, `dog:bump`, `dog:bark`;
  - `dog:pushStart` / `dog:pushEnd`;
  - `companion:stay {name, stay}`.
- **Itens e objetivo:**
  - `item:pickup {name, item, x, z}`, `item:revealed {item, x, z}`;
  - `collectible:pickup {id, x, z, count, total}`;
  - `celebrate:start {x, z, level}`.
- **Fase 1:** `rope:tug`, `gate:open`, `cart:move`, `carrot:revealed` e `carrot:pickup` (mantidos).
- **Mecânicas novas** (sempre com `x, z`):
  - `plate:press {id, by}`, `plate:release {id}`;
  - `gate:close`, `gate:locked`;
  - `wedge:kick {locked}`;
  - `sprinkler:hit {name}`, `sprinkler:off`, `valve:turn`;
  - `crate:move {speed}`, `crate:sink`;
  - `lantern:on {id}`, `lantern:off {id}`;
  - `goose:alert`, `goose:honk`, `goose:charge`, `goose:hit {name}`, `goose:lured`, `goose:return`.

## 10. Licenças

Tudo procedural e próprio. Dependências: Three.js (MIT), Vite (MIT), Fredoka e Nunito via @fontsource (SIL OFL 1.1).
