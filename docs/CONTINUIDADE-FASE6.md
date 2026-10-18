# Continuidade da fase 6 — Expresso do Superbafo

Passagem Codex → Claude, 2026-10-17. A **Entrega A (acabamento mantendo DEV)**
foi publicada por Claude em 2026-10-18 (PR #18, squash `31e8b26`); a fase mais
longa, no PR #19 (squash `0281956`). A **Entrega B (campanha)** está no branch
`claude/campanha-fases-6-7`, junto com a fase 7, aguardando CI, E2E e aprovação
(estado em [CONTEXTO.md](CONTEXTO.md)).

### Fase mais longa (duas cargas e cancela)

O foguete do tapete só decola com **as duas cargas**, e as duas começam **dentro da maquete**, onde só o trem
chega. (Uma primeira versão deixava a lua numa cestinha do lado de fora e exigia levá-la a um funil para o trem;
o usuário apontou que isso não fazia sentido: se as dogs já alcançam a lua, o trem não é necessário.)

1. **A lua no pórtico.** No fim da rota da lua (logo depois da agulha) há um pórtico de postes finos com uma
   cestinha suspensa. O pedal tem três posições, na ordem **volta → lua → estrela** (placa da agulha em prisma
   de três faces). Com a seta da lua e um superbafo, o vagão para embaixo da cestinha, a portinhola abre e a lua
   cai no lugar da frente do vagão (o planeta rola para trás); o trem volta sozinho, de frente, com as duas.
2. **As duas pela estrela.** Na reta leste da estrela há uma **cancela** que só sobe com alguém na **placa do
   lado de fora** da maquete: a Rhaenyra fica lá com o **Fica (F)** enquanto a Radhija sopra. Fechada, o trem
   para antes do braço, apita e volta com as cargas (recuperável); depois de passar, o próprio trem segura a
   cancela em pé até sair. No fim, a caçamba bascula e as cargas descem pela canaleta, a da frente primeiro,
   cada uma para o seu lado da bandeja; o trem volta sozinho.
3. Cada dog leva uma carga na boca: com a boca vazia, a outra irmã pega a segunda (Q para trocar) e as duas
   vão juntas ao foguete; também dá para levar uma de cada vez. Com planeta e lua nos berços, ele decola.

A ordem inversa também vale (planeta pela estrela, depois buscar a lua e outra viagem pela estrela); viagem à
lua com o pórtico vazio só dá uma volta. Etapas: `blocked`, `movingMoon`, `moonLoaded`, `ready` (as duas na
bandeja), `planetDocked` (planeta no foguete, lua no pórtico), `moonReady`, `carryingMoon` (todas em `?stage=`).
Testes: pórtico, as duas pela estrela, ordem inversa, cancela, entrega real e partida longa andando com a
companheira (sem atravessar móveis). Capturas do E2E: `02a-lua-caindo`, `02b-cancela-fechada`,
`02c-cancela-aberta`, `03-descarga-das-duas`, `04-as-duas-na-boca`, `05-foguete-decola`.

### O que mudou no acabamento

- **Trilho único** (`src/levels/fase6/track.js` + `TRACK` no layout): retas e
  arcos com tangente contínua. O puzzle só avança a distância; o cenário desenha
  as mesmas peças. A volta é um circuito fechado que chega à estação pelo sul já
  alinhado (acabou o giro parado); `returning` é a reta e a curva finais.
- **Composição**: locomotiva com cara (pálpebras, bochechas, nariz vermelho numa
  mola), vagão-caçamba articulado na própria tangente, engate entre os dois,
  rodas e bielas girando pela distância. Na entrega, a caçamba bascula e a
  bolinha rola pela canaleta até a bandeja.
- **Espirro sincronizado**: `nose.setSneeze(fase)` cobre o espirro inteiro;
  inspira até `TRAIN.burstAt`, o "atchim" dá o tranco de ré (a partida), o trem
  acelera, freia perto do fim e chega devagar. Plano de câmera acompanha o trem.
- **Oficina** no padrão da fase 5: laje com o corte escuro, tábuas largas, lambri,
  janelas de fim de tarde, painel de ferramentas, placa, bandeirinhas, mural de
  desenhos, bancada com luminária, baú com o ursinho, estante com globo,
  armário, caixotes, planta e luminária de pé; maquete com feltro, trilho de
  madeira com sulcos, cerquinha, janela do nariz, placa da agulha que vira
  (seta circular / seta da estrela), alavanca ao lado do pedal, estação,
  linha de estrelas, laguinho com patinho, arvorezinhas e caixa d'água.
- **Som e efeitos** (`src/fx/audio/soundsExpresso.js` e `feedback.js`): fungada,
  atchim com spray, vapor da chaminé, agulha, bolinha rolando, plim e apito.
- A borda sul da maquete passou para z = 0,67 para a locomotiva fazer a última
  curva sem passar da cerca; nariz, janela e marca de mira não mudaram.

## Ponto de partida

O PR #15 publicou a blocagem jogável aprovada (`b954b24`), preservada no PR #16.
Acesso: https://raposocampos.github.io/radhija-rhaenyra/?level=fase6&play.
(Na época eram cinco fases normais e a sexta estava só em `DEV_LEVELS`; a Entrega B a põe na campanha, e o link
continua valendo.) O usuário escolheu
oficina, trem que espirra e bolinha-planeta e exigiu **a mesma direção artística
já existente no jogo**: maquete procedural, materiais, iluminação, escala,
câmera e personagens coerentes. Não voltar à proposta com pombo/ventilador.

Puzzle existente: o pouso da Rhaenyra no pedal escolhe o trilho; o superbafo
frontal da Radhija faz o trem espirrar e recuar. Rota circular retorna e permite
repetir; rota correta entrega a bolinha à bandeja. Qualquer dog pode retirar e
levar ao tapete de foguete. Há oito estados, petiscos opcionais, bloqueio de
nuvens antigas, pausa, reinício e descarte. A dica falsa perto da bandeja foi
corrigida e aprovada no head `05e2287`; não reabrir esse bug sem reprodução nova.

Limites atuais aprovados como protótipo: oficina simplificada, espirro visual
sem som exclusivo e trem com curvas segmentadas/giro imediato. Esses são os
pontos de acabamento; não é necessário recomeçar o puzzle ou refatorar o núcleo.

## Entrega A — acabamento mantendo DEV

- [x] Definir o contrato da trajetória, locomotiva, vagão e carga. Antes de
  paralelizar, separar a composição da oficina do trem hoje reunidos em
  `src/levels/fase6/world/index.js`. Fazer apenas extrações necessárias.
  → `track.js`; `world/{workshop,railway,train,stations}.js`; `Fase6TrainPose`
  com `wagon` e `tip` opcionais (os dublês continuam valendo).
- [x] Usar a mesma descrição geométrica para trilhos visíveis e movimento.
  Suavizar curvas e junções, orientar pela tangente e manter velocidade
  previsível. Articular o vagão, que vai à frente na marcha à ré; bola deve
  acompanhar o vagão sem saltos. Resolver também o giro parado no retorno.
- [x] Acrescentar detalhes procedurais da oficina, madeira, brinquedos e bancada
  com os materiais existentes. Preservar leitura do pedal, janela do nariz,
  bandeja e tapete, corredores livres e visibilidade das interações.
- [x] Acrescentar som procedural do espirro ao evento `expresso:sneeze`, já
  emitido pelo puzzle, mas sem tratamento específico em `src/fx/feedback.js`.
  Reusar `src/fx/audio.js` e a biblioteca `src/fx/audio/`; respeitar volume,
  pausa e limpeza de efeitos. Não baixar assets ou publicar fotos pessoais.
- [x] Sincronizar olhos/nariz, antecipação, recuo e partida com o tempo do puzzle;
  revisar câmera e dicas vendo o movimento completo. Nenhuma ação deve exigir
  precisão de plataforma ou duas personagens agindo simultaneamente.
- [x] Entregar prévia própria do acabamento em DEV; publicar somente após
  aprovação explícita dessa versão. → aprovado e publicado no PR #18.
- [x] Fase mais longa (lua no pórtico + cancela + foguete): prévia própria e nova aprovação. → PR #19.

### Divisão segura entre agentes

| Frente | Área exclusiva depois da divisão inicial | Coordenação necessária |
| --- | --- | --- |
| Coordenador | Composição de `world/index.js`, `layout.js`, tipos, fábrica de props, integração e capturas | Define contrato e reserva arquivos compartilhados antes de delegar |
| Movimento | `puzzle.js` e módulo local de trajetória/trem a criar | Trilhos e movimento consomem a mesma geometria; cenário não redefine rota |
| Cenário | Módulo extraído da oficina | Mantém colisores, escala, circulação e materiais combinados |
| Áudio | Biblioteca procedural e tratamento do evento em `feedback.js` | Não disputa efeitos/câmera com coordenador; som único por viagem |
| Revisão | Leitura de diff, dados e capturas | Pode ocorrer em paralelo sem editar arquivos dos executores |

Cada executor usa branch e worktree próprios. Não distribuir o mesmo
`world/index.js` a dois agentes. Coordenador integra uma frente por vez e
revalida o conjunto; não misturar promoção à campanha com a primeira rodada
visual se isso dificultar revisar causalidade e acabamento.

### Regressões a preservar e ampliar na nuvem

- [ ] Manter pulo real (pouso único), sensor frontal e bloqueio de nuvens antigas;
  andar/latir/interagir não substituem habilidades. Não mudar habilidades globais.
- [ ] Não trocar rota nem enfileirar viagem durante movimento; retirar a bola
  apenas em `ready`; rota errada continua recuperável sem perda/duplicação.
- [ ] Conferir continuidade nas curvas, alinhamento da carga, chegada nas duas
  rotas e retorno. Trem fica dentro da área isolada, sem plataforma móvel/física nova.
- [ ] Pausa, reinício e troca de fase em todos os estados: nenhum efeito sonoro,
  callback, nuvem, item ou recurso exclusivo deve sobreviver indevidamente.
- [x] Acrescentar uma partida caminhando entre estações. A suíte atual usa
  comandos reais nas habilidades, mas posiciona personagens para preparar trechos;
  isso não substitui a revisão do percurso completo e da companheira.
  → `test/fase6.test.mjs`: partida andando, viagem quadro a quadro, entrega com
  caçamba, trilho fechado e varredura do corpo do trem contra cerca e enfeites.
- [ ] Revisar capturas das curvas/descarga e comparar direção artística com a fase 5.
  O E2E `expresso` grava a volta na curva, a cancela, as duas descargas, o
  elevador da lua e a decolagem.
  Recursos devem estabilizar após trocas, sem descarte de recursos globais.
- [ ] Tipos/testes/build e E2E `expresso` na nuvem; E2E `todas` na entrega importante.
  Conferir SHA do head final, smoke em subcaminho e jobs de recursos. Ver guia
  [COMO-CRIAR-UMA-FASE.md](COMO-CRIAR-UMA-FASE.md) e [ENTREGA.md](ENTREGA.md).

## Entrega B — entrada na campanha, após acabamento validado

Feita junto com a fase 7 (Lambe-Lambe na Pracinha), na ordem 6 → 7, no branch `claude/campanha-fases-6-7`.

- [x] Promover a definição de `DEV_LEVELS` para `LEVELS`, sem duplicar ID e sem
  perder o import sob demanda. Acrescentar ao fim, preservando ordem/IDs existentes.
  → `LEVELS = [fase1…fase7]`; `DEV_LEVELS` só com as arenas (`pulo`, `bafo`, `modelo`);
  `devCatalog` aceita uma lista de teste e continua pondo protótipos futuros juntos e em ordem.
- [x] Preservar o link por ID: `src/main.js` resolvia IDs pelo catálogo dev e usava `parseInt` para fases
  normais; sem ajuste, `?level=fase6&play` cairia na fase 1. → `publishedLevelIndex` (`levels/index.js`)
  resolve posição ou id publicado antes de consultar `dev.js`. Regressões: `test/catalogo.test.mjs`,
  `test-expresso`/`test-lambe` (link abre a fase na campanha) e o smoke do build (`LINKED_IDS`).
- [x] Atualizar progressão 5→6, menu, tela de vitória e expectativas de `hasNext`,
  incluindo `test/fase5.test.mjs`, testes da nova última fase e suítes de navegador.
  → Os testes das fases 6 e 7 rodam na campanha real (vitória da 6 com "Próxima fase", a 7 sem);
  `playthrough-fase5` confere o botão; o menu reparte sete cartões em 4 + 3.
- [x] Adaptar `test/contratos-props.test.mjs`: o laço sobre `LEVELS` presumia `gate` ou `petGate`.
  → Confere todo prop real com `setOpen` (portão, portãozinho, cancela e portinhola do pórtico), pela pose
  da subárvore, sem inventar prop.
- [x] Rever expectativas de protótipo em `test/fase6.test.mjs` e `tools/scripts/test-expresso.mjs`.
- [x] Validar save v1 antigo: a suíte `expresso` grava saves v1, confere que abrir o menu não os reescreve,
  que a 6 libera com a 5 concluída e a 7 com a 6. Sem migração de formato.
- [x] Atualizar README, testes de catálogo, runner/workflow, smoke e condições
  hoje especiais para DEV. → `SMOKE_DEV_LEVEL`/`MEASURE_DEV_LEVELS` vazios em `e2e.yml`.
- [ ] Ampliar explicitamente o catálogo de medição temporal, testes do instrumento
  e referência de cinco para sete fases. `REFERENCE_LEVELS` e a matriz de
  `.github/workflows/desempenho.yml` são fixos; não apenas acrescentar a fase ao jogo.
  Preservar a origem anterior, medir na nuvem e revisar a nova referência antes
  de adotá-la. Não recalibrar limites silenciosamente para esconder regressão.
  **Fica para uma entrega própria**: até lá `measure-performance.mjs` recusa o catálogo de sete
  (DESEMPENHO.md); o CI obrigatório e o E2E não dependem dele.
- [ ] Validar campanha completa, recursos, save e links; entregar nova prévia,
  aguardar aprovação da versão, integrar e conferir deploy/version.json.

## O que não é pendência da estabilização

Tipar todo o jogo, dividir mais o núcleo, trocar tecnologia, otimizar sem uma
regressão medida e provar ausência de vazamento de longo prazo não são tarefas
abertas da rodada encerrada. Só abrir essas frentes com necessidade concreta.
O medidor temporal usa SwiftShader; não promete FPS em GPU física. O medidor
de recursos verifica contagens e ownership, não mede VRAM em megabytes.

O próximo executor deve começar pela Entrega A, com uma mudança pequena e
revisável no contrato da trajetória/composição. Não publicar antecipadamente
acabamento ou campanha usando aprovações de PRs antigos.
