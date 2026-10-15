# Radhija & Rhaenyra

Aventura 3D curta e aconchegante com duas cachorrinhas de verdade, a Radhija (pequena, ágil, creme-dourada)
e a Rhaenyra (maior, forte, branca). Feita em Three.js + Vite, com tudo gerado em código: modelos, texturas e sons.

## Como jogar

```bash
npm install
npm run dev
```

Depois, abra `http://127.0.0.1:5173/`.

| Ação | Teclado | Controle |
|---|---|---|
| Mover | WASD / setas | analógico esquerdo / D-pad |
| Interagir / latir | E | A |
| Latir | — | X |
| Arrancada (Radhija) / empurrar (Rhaenyra), segurar | Shift | B ou RT |
| Trocar de cachorrinha | Q | LB / RB |
| Fica / Vem (companheira) | F | Y |
| Pausar | Esc | Start |

## Fases

1. **Operação Cenoura**: fim de tarde no jardim. Cerca com abertura, cordinha do portão e carrinho.
2. **Operação Bolinha**: crepúsculo na área de serviço. Tábua de pressão, calço, irrigador e caixote que vira ponte.
3. **Operação Pantufa**: noite no jardim do lago. Duas pedras com lanternas e a Dona Gansa guardando a ponte.

Parâmetros úteis: `?level=2` (começa na fase 2), `?play` (pula a tela inicial), `?debug` (colisores e grafo de navegação).

## Estrutura

- `src/game/`: núcleo genérico (gerenciador de fases, entrada, colisão, navegação, companheira, câmera, kit de puzzle e mecânicas).
- `src/levels/faseN/`: cada fase (`index.js` com a definição, `layout.js` com as coordenadas, `lighting.js`, `world/` com o cenário e `puzzle.js` com a lógica).
- `src/dogs/` e `src/characters/`: personagens procedurais.
- `src/ui/` e `src/fx/`: interface, áudio sintetizado, partículas e feedback.
- `docs/CONTRATO.md`: APIs e convenções entre os módulos.

### Criando uma fase nova

1. Copie a pasta de uma fase (por exemplo, `src/levels/fase2/`) para `src/levels/fase4/`.
2. Edite o `layout.js` (limites, colisores, grafo de navegação, objetivo final, câmera), o `lighting.js`, o `world/` e o `puzzle.js` (interface em `docs/CONTRATO.md` §5; peças prontas em `src/game/puzzleKit.js` e `src/game/mechanics/`).
3. Registre a fase em `src/levels/index.js`.

## Testes

```bash
node tools/scripts/test-collision.mjs
```

Para as partidas automatizadas, use um servidor sem recarga automática:

```bash
npx vite --config tools/scripts/vite.nohmr.config.mjs --port 5176 --strictPort --host 127.0.0.1
```

Depois, em outro terminal, cada fase e o controle:

```bash
node tools/scripts/playthrough.mjs --url http://127.0.0.1:5176/
```

```bash
node tools/scripts/playthrough-fase2.mjs --url http://127.0.0.1:5176/
```

```bash
node tools/scripts/playthrough-fase3.mjs --url http://127.0.0.1:5176/
```

```bash
node tools/scripts/test-gamepad.mjs --url http://127.0.0.1:5176/
```

`tools/shot.mjs` tira capturas headless com roteiro de teclas (ver cabeçalho do arquivo).

## Créditos e licenças

Nenhum asset de terceiros: modelos, texturas, músicas e efeitos são gerados proceduralmente no código do projeto.
As cachorrinhas foram modeladas a partir de fotos das próprias Radhija e Rhaenyra.

Dependências: [Three.js](https://threejs.org) (MIT), [Vite](https://vitejs.dev) (MIT) e as fontes
Fredoka e Nunito via [@fontsource](https://fontsource.org) (SIL Open Font License 1.1).
