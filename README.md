# Radhija & Rhaenyra

Aventura 3D curta e aconchegante com duas cachorrinhas de verdade, a Radhija (pequena, ágil, creme-dourada)
e a Rhaenyra (maior, forte, branca). Feita em Three.js + Vite, com tudo gerado em código: modelos, texturas e sons.

## Como jogar

**[Jogar no navegador](https://raposocampos.github.io/radhija-rhaenyra/)** — sem instalar nada.

Para desenvolver localmente:

```bash
npm install
```

```bash
npm run dev
```

Depois, abra `http://127.0.0.1:5173/`.

| Ação | Teclado | Controle (PlayStation · Xbox) |
|---|---|---|
| Mover | WASD / setas | analógico esquerdo / D-pad |
| Pular (Rhaenyra) | Espaço | ✕ · A |
| Interagir / latir | E | ○ · B |
| Latir | — | □ · X |
| Fica / Vem (companheira) | F | △ · Y |
| Superbafo (Radhija): segure para mirar, solte para soprar | R | L2 · LT |
| Arrancada (Radhija) / empurrar (Rhaenyra), segurar | Shift | R1 ou R2 · RB ou RT |
| Trocar de cachorrinha | Q | L1 · LB |
| Pausar | Esc | Options · Start |

A tela desenha os botões no estilo PlayStation; se o controle conectado for de Xbox, no estilo Xbox.

## Fases

1. **Operação Cenoura**: fim de tarde no jardim. Cerca com abertura, cordinha do portão e carrinho.
2. **Operação Bolinha**: crepúsculo na área de serviço. Tábua de pressão, calço, irrigador e caixote que vira ponte.
3. **Operação Pantufa**: noite no jardim do lago. Duas pedras com lanternas e a Dona Gansa guardando a ponte.
4. **Operação Patinho**: manhã no terraço do prédio, a fase do superbafo da Radhija. Um pombo cochila na única
   passagem (latido não adianta, bafo sim); depois a Rhaenyra encaixa o ventilador no trilho, a Radhija passa por
   baixo dos canos dos aparelhos e sopra no vento, o duto leva o cheiro até o pombo do portão e ele voa para a placa.
5. **Operação Ursinho**: tarde de chuva dentro de casa, a fase do pulo da Rhaenyra. Ela pula o portãozinho de bebê
   e abre a trava para a irmã, pula a barricada de caixas da mudança e empurra de dentro a caixa de almofadas (que
   desmonta); o ursinho está debaixo da mesa, atrás da toalha comprida, onde só a Radhija cabe.

Parâmetros úteis: `?level=2` (começa na fase 2), `?play` (pula a tela inicial), `?debug` (colisores e grafo de navegação),
`?stage=<etapa>` (pula etapas do puzzle).

Protótipos fora do menu (fases de desenvolvimento):

- **Arena do Pulo**: `http://127.0.0.1:5173/?level=pulo&play`. Troncos dá para pular; muretas altas, não.
- **Arena do Bafo**: `http://127.0.0.1:5173/?level=bafo&play`. O protótipo do puzzle do superbafo que virou a fase 4: a Rhaenyra
  encaixa o ventilador, a Radhija sopra no corredor, o vento leva o cheiro pelo duto, o pombo foge para o poleiro da
  placa e o portão abre.

## Estrutura

- `src/game/`: núcleo genérico (gerenciador de fases, entrada, colisão, navegação, companheira, câmera, kit de puzzle e mecânicas).
- `src/levels/faseN/`: cada fase (`index.js` com a definição, `layout.js` com as coordenadas, `lighting.js`, `world/` com o cenário, carregado sob demanda, e `puzzle.js` com a lógica).
  `src/levels/_modelo/` é um modelo de fase completo e testado, ponto de partida das fases novas.
- `src/dogs/` e `src/characters/`: personagens procedurais.
- `src/ui/` e `src/fx/`: interface, áudio sintetizado, partículas e feedback.
- `src/types.d.ts`: tipos das APIs públicas (checados pelo TypeScript sobre o JavaScript).
- `test/`: testes rápidos em Node; `tools/`: partidas automatizadas no navegador e ferramentas.

Documentação:

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como as peças se encaixam, APIs, eventos, testes e convenções.
- [docs/COMO-CRIAR-UMA-FASE.md](docs/COMO-CRIAR-UMA-FASE.md): passo a passo de uma fase nova.

## Testes

Os testes automáticos rodam nos servidores do GitHub. Envie o código com `git push`: o workflow
**CI e publicação** instala as dependências, checa os tipos, executa os testes rápidos e gera a build.
Quando tudo passa no `main`, publica o jogo no link acima. Se falhar, a versão anterior continua no ar.
Não é preciso gerar ou enviar a pasta `dist/`, nem rodar os testes no PC antes de cada envio.

As partidas completas ficam separadas: abra [Actions → E2E manual](https://github.com/raposocampos/radhija-rhaenyra/actions/workflows/e2e.yml),
clique em **Run workflow**, escolha o branch e confirme. Elas rodam em máquinas Linux do GitHub,
com uma suíte por máquina. As capturas ficam nos artefatos da execução por 7 dias.
Como essas máquinas não têm GPU, o navegador dos testes usa resolução 3D reduzida, sem sombras
nem bloom. A lógica e os controles continuam reais; a qualidade visual do jogo publicado não muda.

Os comandos abaixo continuam disponíveis para quem quiser rodar testes **localmente**:

| Comando | O que faz |
|---|---|
| `npm test` | testes em Node, cerca de 30 s: as 5 fases jogadas inteiras num jogo headless, navegação e colisão de todas as fases, cenário sem z-fighting (faces no mesmo plano "tremendo"), equilíbrio do irrigador, dogs e regressões de bugs já corrigidos |
| `npm run typecheck` | checagem de tipos (TypeScript sobre os comentários JSDoc) |
| `npm run test:e2e` | partidas com teclas reais no Chrome (fases 1–5, controle, regressões, pulo e bafo), cerca de 15 minutos |
| `npm run build` | roda `typecheck` e `npm test` antes de gerar `dist/`: nenhum build sai quebrado |
| `npm run verify` | build + partidas no navegador |

O `test:e2e` sobe sozinho um servidor Vite sem recarga automática numa porta livre (sem atrapalhar o `npm run dev`
na 5173), roda as partidas em sequência e derruba o servidor no fim, inclusive em erro ou Ctrl+C. Ele usa o Chrome
(ou o Edge) instalado no sistema. No GitHub, usa o Chromium instalado pela versão fixada do Playwright.
Também é possível escolher um executável com a variável `CHROME_PATH`.
Para rodar só algumas partidas: `node tools/scripts/run-e2e.mjs --only fase2,controle`.
As capturas das partidas vão para `shots/`.

`tools/shot.mjs` tira capturas headless com roteiro de teclas (ver cabeçalho do arquivo).

## O que fica fora do git

O `.gitignore` deixa de fora:

- `referencias/fotos/`: as fotos das cachorrinhas usadas como referência para a modelagem. São fotos pessoais e
  ficam só nesta máquina, para não vazarem se o repositório for publicado (no GitHub, por exemplo). O jogo não
  depende delas: os modelos são gerados em código.
- `shots/`: capturas geradas pelos testes e pelas ferramentas (centenas de MB, recriadas a cada execução).
- `node_modules/`, `dist/` e `.builds/`: dependências e saídas de build.
- `.env`, `.env.*` (exceto `.env.example`), chaves privadas e `.claude/`: configurações locais e credenciais.

Os commits publicados usam o usuário do GitHub e seu endereço `noreply`, sem nome ou e-mail pessoal.

## Créditos e licenças

Nenhum asset de terceiros: modelos, texturas, músicas e efeitos são gerados proceduralmente no código do projeto.
As cachorrinhas foram modeladas a partir de fotos das próprias Radhija e Rhaenyra.

Dependências: [Three.js](https://threejs.org) (MIT), [Vite](https://vitejs.dev) (MIT) e as fontes
Fredoka e Nunito via [@fontsource](https://fontsource.org) (SIL Open Font License 1.1).
Desenvolvimento: TypeScript e Playwright (Apache-2.0).
