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

| Ação | Teclado | Controle (PlayStation · Xbox) | Celular (toque) |
|---|---|---|---|
| Mover | WASD / setas | analógico esquerdo / D-pad | joystick à esquerda |
| Pular · impulso na parede com patinhas (Rhaenyra) | Espaço | ✕ · A | Pular |
| Interagir / latir | E | ○ · B | Agir |
| Latir | — | □ · X | Agir (sem nada perto) |
| Fica / Vem (companheira) | F | △ · Y | Fica · Vem |
| Superbafo (Radhija): segure para mirar, solte para soprar | R | L2 · LT | Bafo |
| Lambe-Lambe (Rhaenyra, perto da irmã): segure para lamber | R | L2 · LT | Lamber |
| Arrancada (Radhija) / empurrar (Rhaenyra), segurar | Shift | R1 ou R2 · RB ou RT | Arrancada · Empurrar |
| Trocar de cachorrinha | Q | L1 · LB | Trocar |
| Pausar | Esc | Options · Start | botão no canto |

A tela desenha os botões no estilo PlayStation; se o controle conectado for de Xbox, no estilo Xbox.

**Menu**: Jogar abre a escolha do modo. O Modo História (mapas abertos, a começar pelo Condomínio) aparece como
"Em breve"; em Fases, o botão Continuar leva à próxima fase não concluída (ou à última escolhida) e os cartões
abrem qualquer fase liberada. Em Opções ficam o volume, a qualidade gráfica e as Dicas: desligadas (modo desafio),
o jogo não mostra o objetivo escrito, o marcador laranja nem as dicas em balão; os controles continuam na pausa, onde
também dá para religar as dicas. Para voltar: Esc, ○ · B ou o botão Voltar no canto.

**No celular**: abra o mesmo link com o celular deitado. Os controles de toque aparecem depois do primeiro toque e
somem se você usar teclado ou controle. O jogo escolhe uma qualidade gráfica mais leve para o celular e baixa sozinho
se ficar lento; em Opções ou na pausa dá para escolher Auto, Alta, Média ou Baixa. No Android, o primeiro toque já põe em
tela cheia; no iPhone, use Compartilhar → "Adicionar à Tela de Início" para jogar em tela cheia. No PC nada muda.

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
6. **Expresso do Superbafo**: uma oficina cheia de brinquedos. Um pulão da Rhaenyra no pedal muda o trilho e o
   superbafo da Radhija faz o trem de brinquedo espirrar e partir. O trem busca a lua presa no pórtico; a cancela da
   estrela só sobe com alguém na placa (a Rhaenyra fica lá com o Fica), e as duas levam o planeta e a lua ao
   foguete, que decola.
7. **Lambe-Lambe na Pracinha**: manhã depois da chuva. Só a Radhija cabe no túnel de lama e sai enlameada, lenta e
   sem arrancada; ela destrava o portão por dentro e a Rhaenyra a limpa com o Lambe-Lambe. Limpa, a Radhija sobe o
   escorregador com uma arrancada e desce com o frisbee; as duas levam frisbee e bolinha ao piquenique.
8. **Lavanderia de Domingo**: manhã de sol na área de serviço, a fase do impulso na parede. Na parede com patinhas, a
   Rhaenyra pega impulso e aperta os botões do alto: o do varal faz a meia listrada descer por alguns segundos (só o
   tranco de uma arrancada da Radhija solta o pregador); o da centrífuga chacoalha a máquina e a mantinha escorrega
   para o cesto de rodinhas, que a Rhaenyra empurra até a caminha.
9. **Biblioteca do Vovô**: noite de chuva na casa do vovô, com escritório, hall, biblioteca e jardim de inverno. Os
   óculos estão no alto da estante: um impulso na alavanca solta a trava da roda da escadinha (um cabo liga as duas),
   a Rhaenyra tira o globo do trilho, empurra a escada até debaixo dos óculos e segura o pé dela (E), e a Radhija
   sobe e pega. O livro de histórias está no alto do armário, embaixo do gato Bichano: no jardim de inverno, a
   Rhaenyra liga o disjuntor (as luzes acendem), liga o ventilador, encaixa-o na grade do duto e empurra o vaso de
   rodinhas até o botão do chão, que abre o registro. O superbafo da Radhija vai pelo vento e pelo duto até o gato,
   que acorda, pula e derruba o livro. A porta do escritório tem mola: a Radhija fica no vão enquanto a Rhaenyra busca
   o livro, e os dois vão para a mesinha da poltrona.

Parâmetros úteis: `?level=2` ou `?level=fase2` (começa na fase 2), `?play` (pula a tela inicial), `?debug` (colisores e grafo de navegação),
`?stage=<etapa>` (pula etapas do puzzle).

Protótipos fora do menu (fases de desenvolvimento):

- **Arena do Pulo**: `http://127.0.0.1:5173/?level=pulo&play`. Troncos dá para pular; muretas altas, não. Na parede de
  treino, as patinhas marcam onde o pulo vira impulso na parede (botão e alavanca).
- **Arena do Bafo**: `http://127.0.0.1:5173/?level=bafo&play`. O protótipo do puzzle do superbafo que virou a fase 4: a Rhaenyra
  encaixa o ventilador, a Radhija sopra no corredor, o vento leva o cheiro pelo duto, o pombo foge para o poleiro da
  placa e o portão abre.
- **Canil das Dogs**: `http://127.0.0.1:5173/?level=canil&play`. Vitrine com a Radhija e a Rhaenyra no modelo atual e no
  novo (em teste), lado a lado, com um painel de poses e vistas. Para jogar qualquer fase com o modelo novo, acrescente
  `&dogs=novo` ao endereço (por exemplo, `?level=1&play&dogs=novo`).

## Estrutura

- `src/game/`: núcleo genérico (gerenciador de fases, entrada, colisão, navegação, companheira, câmera, kit de puzzle e mecânicas).
- `src/levels/faseN/`: cada fase (`index.js` com a definição, `layout.js` com as coordenadas, `lighting.js`, `world/` com o cenário, carregado sob demanda, e `puzzle.js` com a lógica).
  `src/levels/_modelo/` é um modelo de fase completo e testado, ponto de partida das fases novas.
- `src/dogs/` e `src/characters/`: personagens procedurais.
- `src/ui/` e `src/fx/`: interface, áudio sintetizado, partículas e feedback.
- `src/types.d.ts`: tipos das APIs públicas (checados pelo TypeScript sobre o JavaScript).
- `test/`: testes rápidos em Node; `tools/`: partidas automatizadas no navegador e ferramentas.

Documentação:

- [docs/CONTEXTO.md](docs/CONTEXTO.md): andamento e ponto de retomada compartilhado entre Codex e Claude.
- [docs/ENTREGA.md](docs/ENTREGA.md): PRs, CI obrigatório, prévias e aprovação de produção.
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como as peças se encaixam, APIs, eventos, testes e convenções.
- [docs/COMO-CRIAR-UMA-FASE.md](docs/COMO-CRIAR-UMA-FASE.md): passo a passo de uma fase nova.

## Testes

O fluxo padrão dos agentes está em [AGENTS.md](AGENTS.md). O Codex lê esse
arquivo e o [CLAUDE.md](CLAUDE.md) o importa para o Claude: pedidos de mudanças
incluem abrir um PR, acompanhar o CI no GitHub e entregar um link de prévia.
O usuário testa e aprova no chat; só então o agente integra e atualiza o link
principal. Não é necessário operar o GitHub. Testes e build ficam na nuvem.

Os testes automáticos rodam nos servidores do GitHub. Envie um branch e abra um PR:
**CI e prévias** instala dependências, checa tipos, executa testes e gera a build.
`main` exige PR atualizado e os checks `testes-e-build` e `publicar-site` aprovados.
O workflow separado **Publicar versão validada** usa código confiável do main
para publicar o artefato testado. Cada PR interno recebe uma prévia pública;
o link aparece no check `publicar-site` e no resumo do workflow de publicação.
Após aprovação e merge, a publicação principal ainda passa pelo ambiente protegido `github-pages`.
Uma falha de build não substitui a versão que está no ar.
Não é preciso gerar ou enviar a pasta `dist/`, nem rodar os testes no PC antes de cada envio.

As partidas completas ficam separadas: abra [Actions → E2E manual](https://github.com/raposocampos/radhija-rhaenyra/actions/workflows/e2e.yml),
clique em **Run workflow**, escolha o branch e a suíte (`todas` para a bateria completa) e confirme. Elas rodam em máquinas Linux do GitHub,
com uma suíte por máquina. As capturas ficam nos artefatos da execução por 7 dias.
Como essas máquinas não têm GPU, o navegador dos testes usa resolução 3D reduzida, sem sombras
nem bloom, desenha a cada 30 quadros e força um desenho antes de cada captura. A simulação e os
controles continuam em todos os quadros; as esperas acompanham o tempo do jogo. Essas partidas
verificam a jogabilidade, não o desempenho gráfico. A qualidade visual do jogo publicado não muda.

Os comandos abaixo continuam disponíveis para quem quiser rodar testes **localmente**:

| Comando | O que faz |
|---|---|
| `npm test` | testes em Node, cerca de 30 s: as 7 fases jogadas inteiras num jogo headless, navegação e colisão de todas as fases, cenário sem z-fighting (faces no mesmo plano "tremendo"), equilíbrio do irrigador, dogs e regressões de bugs já corrigidos |
| `npm run typecheck` | checagem de tipos (TypeScript sobre os comentários JSDoc) |
| `npm run test:e2e` | partidas com teclas reais no Chrome (fases 1–7, controle, regressões, pulo e bafo), cerca de 15 minutos |
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
