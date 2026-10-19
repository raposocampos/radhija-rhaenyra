# Contexto para retomar o projeto

Última atualização: **2026-10-19, Claude** (empurrão em pé da Rhaenyra, em andamento). Ler primeiro [AGENTS.md](../AGENTS.md)
e [ENTREGA.md](ENTREGA.md); conferir Git/GitHub antes de editar.

## Em andamento: comemoração sem giro parado (Claude, branch `claude/comemoracao-natural`)

- Pedido do usuário (2026-10-19): na comemoração as dogs "giram um 360 sem andar, estranho, não fica natural".
- Feito: em `dogAnimation.js` o ciclo da comemoração (3,2 s) virou pulinhos → **voltinha andando** num círculo de
  ~20 cm (rumo, velocidade e giro vêm do círculo: as patas pisam, o corpo inclina e curva, a cabeça olha para onde
  vai) → reverência. O giro de 360° do corpo parado saiu. `game.js` manda `anim.celebrateSide` (a voltinha vai para o
  lado de fora, longe da irmã). Vale para o modelo atual e para o novo (que copia a pose). Teste em
  `test/dogs.test.mjs`.
- Retorno na prévia: "no fim das fases ... o loop corta no meio e ela fica sentada": a voltinha em andamento
  termina antes de sentar ou parar (teste novo). Ordem combinada: entra depois do #38 (empurrão em pé).
- O usuário aprovou a versão `2b3fdf0`, mas o merge ficou bloqueado por 3 observações da revisão automática (a
  proteção do `main` exige conversas resolvidas). Corrigido depois da aprovação (pede CI, prévia e aprovação novas):
  a voltinha é só visual, então `src/game/celebrateLoop.js` escolhe lado e tamanho que cabem (colisores, irmã e a
  borda da caminha `GOAL.celebrateRim` nas fases 5 e 8 e na Arena dos Porquinhos); sem espaço, pulinhos no lugar
  (fase 5). As pisadas da voltinha levam a passada da animação (`onFootstep(i, v)`: som e pegadas). Interrompida
  por outra ação, ela volta ao lugar suave. Testes em `test/dogs.test.mjs` e `test/comemoracao.test.mjs`.
- Branch atualizado com o main `369b0ff` (PR #38, empurrão em pé): a voltinha e o empurrão convivem em
  `dogAnimation.js`/`game.js`.
- Próximo passo: CI e E2E `todas` no head novo, prévia, responder e resolver as 3 conversas e pedir nova aprovação.


## Em andamento: empurrão em pé da Rhaenyra (Claude, branch `claude/empurrao-em-pe`, PR #38)

- Pedido do usuário (2026-10-19): "Rhaenyra tem mania de ficar empurrando os outros, aí daria pra usar pra tirar
  alguma coisa de uma árvore, ou de algum lugar alto, empurrar pra cair". Desenho aprovado: o mesmo **R1 / Shift /
  Empurrar** segurado de frente para algo empurrável no alto (árvore, mesinha, estante); ela fica de pé nas traseiras,
  apoia as patas da frente e empurra no ritmo; **3 empurrões** e o que está lá em cima cai do outro lado. Nada de
  tecla nova (longe de C e R3); o botão de toque é o Empurrar que já existe (segurar). Usar numa fase é decisão do
  usuário (a fase 10, #33, quer a árvore antes da piñata).
- Retorno do usuário na primeira prévia: **tirar o empurrão na irmã**; o movimento parecia "sarrando, não empurrando"
  (o quadril ia e voltava): agora o empurrão sai das patas da frente e dos ombros (armam e batem, tranco curto do peito),
  quadril e traseiras parados; **rosnadinha** a cada empurrão (som `shoveGrowl` e boquinha franzida).
- Referência real: vídeos privados `referencias/fotos/2026-10-19/video-2.mp4` e `video-3.mp4` (fora do Git).
- Feito: controlador (`pickShoveSpot`, `startShove`, `stepShove`, `SHOVE_*` em `dogController.js`), núcleo
  (`src/game/shove.js` ligado em `game.js`), empurrável (`src/game/mechanics/shoveTarget.js`), pose
  (`src/dogs/shovePose.js` + bloco em `dogAnimation.js`), visuais (`src/world/shoveProps.js`), Arena do Empurrão
  (`src/levels/_empurra/`, `?level=empurra&play`), sons (`soundsEmpurra.js`), folhinhas (`particles.leaves`), testes
  (`test/empurrao.test.mjs`, inclusive quadril parado e tranco dos ombros no modelo real), suíte E2E `empurra`
  (também com `?dogs=novo`) e capturas (`capture-empurra.mjs`). Docs: ARQUITETURA §6 (Empurrão em pé) e README.
- Coordenação: a sessão dos modelos das dogs porta a pose na etapa 3; mandar a ela os campos do `anim` (`shoveK`,
  `shoveCycle`, `shoveN`, `shoveGap`, `shoveY`, `shoveOver`) e os quadros de `shovePose.js` quando o PR entrar.
- Próximo passo: CI e E2E no head novo, prévia ao usuário e aprovação explícita antes de integrar; avisar o
  orquestrador ao integrar. Se o #36 entrar antes, atualizar com o main e revalidar.

## Entregue: os porquinhos (PR #36, squash `1a8fde5`, deploy `39320045323`)

- Pedido do usuário (pela sessão da fase 10): na horta, um chiqueiro com três porcos; um botão abre a porteira, eles
  saem e atrapalham as dogs, e só se resolve pegando legumes do outro lado e largando no chão para eles se
  distraírem. Ajuste do usuário: a comida distrai por um **tempo determinado e generoso** (configurável por
  legume), não de vez; depois eles voltam a atrapalhar. Peças reutilizáveis, sem mexer em `src/levels/fase10/`: a
  sessão da fase 10 (PR #33) integra depois que este PR entrar.
- Branch `claude/porcos-81f6fa` (worktree próprio), base `eb1a148`, atualizado por merge com o main `168bda6` (PR #34),
  `04d7dbe` (PR #35) e `e9e61fb` (PR #37). Consultar o PR para SHA, CI, E2E e prévia; nada
  rodou no PC além de `node --check`/`git diff --check`.
- Feito: modelo `src/characters/pig.js` (SDF + esqueleto de 10 ossos, IK das patas, trava de chão, variantes de
  manchinhas, gestos `oink`/`bump`/`shake`, ações `idle`/`walk`/`sniff`/`eat`/`alert`/`lie`/`sleep`); mecânica
  `createPigHerd` + `pigPenLayout` em `src/game/mechanics/pigHerd.js` (cercado com porteira, soltos atrapalham com
  colisor e esbarrão, `addFood`/`removeFood` com tempo de distração por legume, `recall`, `reset`, `info()`, eventos
  `pig:*`); chiqueiro `src/world/pigPen.js`; legumes `src/world/veggies.js`; sons `src/fx/audio/soundsPorcos.js` e
  o bloco `pig:*` do `feedback.js`; tipos `PigModel`/`VeggieProp`/`PorcosProps`; arena `src/levels/_porcos/`
  (`?level=porcos&play`); testes `test/porcos.test.mjs`; suíte E2E `porcos` (`tools/scripts/test-porcos.mjs`) e
  capturas `tools/scripts/capture-porcos.mjs` (`shots/porcos-revisao/`). API e receita de integração: ARQUITETURA §7
  ("Porquinhos"), eventos em §8.
- Retorno do usuário na prévia (2026-10-19): "ficou divertido, mas os porcos precisam atrapalhar mais: quando a dog
  estiver com o objeto na boca, eles derrubam". Feito: `carries(nome)` no `update` e `knockItem(nome, hit)` da fase
  (quem leva algo é o alvo preferido, de mais longe, mais rápido e sem cansar; o esbarrão derruba com
  `knockChance` 0,85 depois de `knockGrace` 1,5 s; evento `pig:knock`); na arena, legume derrubado na horta vira
  comida e a bolinha fica no chão até a dog pegar de novo (`item:land` no lugar de `veggie:drop`).
- Segundo retorno (2026-10-19): "cuidado pro objeto não cair em um limbo, e quando o porco voltou a ação após comer
  o legume, a prévia travou". Causa do travamento: ao fim da distração o porco voltava a passear com o destino
  apagado e o passeio de antes ainda ativo (`goal` nulo lido no `roam`; sem dog por perto, a exceção parava o
  laço do jogo). Corrigido em `finishDistraction`, mais uma rede de segurança no `update` (cada porco num passo
  protegido; erro no console e `info().errors`). Limbo: `landingFor` na arena (o que cai não atravessa parede alta
  nem fica onde a dog não chega) e a porteira não fecha com uma dog dentro do chiqueiro. Testes novos: o caso que
  travava, a rede de segurança, a dog no chiqueiro e uma bagunça longa com semente (200 s de jogo, ações
  aleatórias, conferindo que nada trava e que legumes e bolinha no chão seguem ao alcance).
- Próximo passo: CI e E2E `porcos` verdes no head do PR, revisar as capturas, entregar a prévia (link da arena) e
  esperar a aprovação. Depois do merge, avisar a sessão da fase 10 para integrar (conflitos esperados e simples em
  `e2e.yml`, `run-e2e.mjs`, `sounds.js`, `feedback.js`, `types.d.ts` e `test/helpers/props.mjs`).

## Entregue: modelos novos das dogs, etapa 1 de 5 (PR #37, squash `e9e61fb`, deploy `39312448427`)

- Pedido do usuário (2026-10-19): refazer os modelos das dogs, mais maleáveis, com rig, colisão e animações fluidas,
  sem perder o visual de que ele gosta. Plano aprovado ("pode seguir"), uma prévia por etapa: **1** esqueleto novo +
  proporções pelas fotos + bancada (atual × novo); **2** andar novo (passo, trote, galope, pata que rola, peso, giro
  andando, pata que acha o chão); **3** todas as poses e extras num sistema de camadas (mesma API `update(dt, anim)`);
  **4** colisão do corpo (dois círculos alinhados ao corpo e a cabeça que desvia, sem mudar os vãos dos puzzles);
  **5** troca nas 10 fases, E2E `todas`, capturas e cascas de pelo por perfil (só celular; o PC não muda).
- Referências PRIVADAS (nunca no Git, nas prévias nem em artefatos públicos): `referencias/fotos/2026-10-19/`
  (8 fotos e 3 vídeos; quadros com `python -I` + OpenCV). A Radhija é a menor, creme-dourada; a Rhaenyra, a maior,
  branca. Vídeo 3: andando, trotando, correndo e em pé no piso; a Rhaenyra empurra as pessoas em pé nas patas de trás
  (a mecânica do empurrão em pé está numa sessão própria, "Empurrão em pé da Rhaenyra").
- Etapa 1 (branch `claude/modelos-dogs-7b2d26`, worktree próprio): `src/dogs/v2/` (`skeleton.js` 38 ossos,
  `design.js`, `retarget.js` — o esqueleto atual, invisível, guia o novo —, `contacts.js` — nada passa do chão —,
  `materials.js`, `dog.js` com a API de `createDog`); `dogModel.js` ganhou `buildGeometryFromDesign` (mesmo resultado
  para o modelo atual); `?dogs=novo` no `main.js`; fase de desenvolvimento `?level=canil` (`src/levels/_canil/`,
  vitrine + painel); sandbox `dogs.html?model=both`; `test/dogV2.test.mjs`; suíte E2E `canil` e
  `capture-modelos.mjs`. Docs: ARQUITETURA §2, §7 e §10, README (protótipos).
- Coordenação: não editar `game.js`, `input.js` nem `dogAnimation.js` até o PR #35 (Lambe-Lambe nas duas) entrar no
  main; a etapa 3 porta a pose nova do Lambe-Lambe e a do empurrão em pé.
- PR **#37**. Validações: CI verde em `2ba0d64`; E2E `canil` 20/20 em `9280799` (`39290933885`) e 23/23 em
  `2507d8d` (`39292942399`), sem erros de console, 45–48 capturas revisadas. Depois disso: o corpo gira sobre as
  patas apoiadas antes de subir (a Rhaenyra sentada do modelo atual afunda 2 cm; a nova gira ~5° sobre as patas da
  frente), a vitrine volta ao enquadramento no início da fase e o teste da boca ficou determinístico. Consultar o PR
  para o CI e o E2E do head atual.
- Achados: o modelo novo segue o guia com 0,00 mm em todas as ações; triângulos até 111% do atual (pelo da
  Rhaenyra, orelhas maiores); a montagem leva o mesmo tempo. Pendente para as próximas etapas: a franja das orelhas
  longas deixa a pele da orelha aparecer perto do pescoço em close (cascas de pelo com gravidade).
- Retornos do usuário nas prévias (2026-10-19), já atendidos no PR: orelhas "vazando o outro lado" (a grade da malha
  cortava a beirada da orelha achatada: `groupsBounds` com `exact` só no modelo novo, orelha mais grossa e desenhada
  dos dois lados); cabeça da Rhaenyra grande demais (agora ~103% da da Radhija); orelhas dela grandes demais
  (menores); orelhas com física no pulo (`src/dogs/v2/physics.js`: correntinha com mola, inércia, gravidade e chão);
  rolagem "nada natural" (`src/dogs/v2/roll.js`: pose própria por cima do guia, tomba pelo ombro, de costas em "C",
  patas dobradas pedalando, se esfrega; o corpo fica apoiado no chão pelo ponto mais baixo).
- Pedido registrado para a **etapa 4** (retorno da prévia da fase 10, vale para todas as fases): a cabeça das dogs
  ainda atravessa algumas paredes e móveis, porque passa do círculo único de colisão quando a dog anda de frente.
- Etapa 1 integrada ao main com a aprovação do usuário (squash `e9e61fb`, deploy `39312448427`). Não repetir
  merge/deploy do #37; as etapas 2 a 5 seguem em PRs próprios.

## Entregue: Lambe-Lambe nas duas dogs, superbafo no R2 e Lambe-Lambe no L2 (PR #35, squash `04d7dbe`, deploy `39306814728`)

- Pedido do usuário: "colocando a mecânica de lamber também na Radhija, aí o superbafo vai pro R2 e o Lambe-Lambe fica
  no L2". Tecla do Lambe-Lambe escolhida pelo usuário: **L** (o R continua sendo o superbafo). Controle: R1 = arrancada
  ou empurrar, R2 = superbafo, L2 = Lambe-Lambe. Toque: botões separados Superbafo (só a Radhija; apagado com a
  Rhaenyra, apertar dá a dica) e Lamber (as duas), num arco em volta do Agir.
- Feito: `input.lick()` (L / L2 / botão `lick`) e `bafo()` no R / R2; `lickStroke`/`lickReach` também na Radhija
  (0,38 s, mais rapidinho); núcleo genérico (`lickDist`: quem é menor para mais perto; lambendo não há arrancada nem
  bafo, mirando não começa lambida; dica genérica só quando não alcança, numa fase sem `onLick`); pose de quem lambe
  para cima (`anim.lickY` em `dogAnimation.js`: peito sobe, pescoço estica, língua para a frente) e a Rhaenyra lambida
  abaixa a cabeça para a irmã menor. Fase 7: textos com (L); a lambida da Radhija na irmã é só carinho (dica para
  trocar), a lama continua saindo só com a Rhaenyra. Ajuda (tabela de controles, glifos `R`→R2/Superbafo,
  `L`→L2/Lamber, Shift→R1), README e ARQUITETURA §4/§6. Testes headless e as suítes E2E `lambe`, `toque`,
  `controle`, `bafo` e `expresso`; capturas novas da Radhija lambendo (bochecha e flanco) em `capture-lambe.mjs`.
- **Fase 10 (PR #33, outra sessão)**: não foi editada aqui. O `onLick` dela já recebe quem lambeu (`ctrl`) e
  `lick.target`; hoje, com a Radhija lambendo a Rhaenyra, ela mostra a dica `alreadyClean` e o `onLickMiss` mostra
  `lickFar` ("Chegue pertinho da Radhija…") também quando quem tenta é a Radhija, e os textos dela ainda dizem R.
  A sessão da fase 10 ajusta depois deste PR (aviso a ela no merge).
- Integrado ao main com a aprovação do usuário (squash `04d7dbe`, deploy `39306814728`). Não repetir merge/deploy do #35.

## Entregue: Pombo mais bonito (PR #34, squash `168bda6`, deploy `39303626593`)

- Pedido do usuário: "melhorar o visual do modelo do pombo, pode ser mais bonito" (fases 4 e 10). Branch
  `claude/pombo-bonito` (worktree próprio), **PR #34**, base `eb1a148`; consultar o PR para SHA, CI, E2E e prévia.
  Nada rodou no PC além de `node --check`/`git diff --check`.
- Feito: `src/world/pigeon.js` refeito (proporções, pescoço furta-cor no shader, carúncula, olhos com brilho, asas
  com barras e primárias em degrau, cauda em leque com faixa escura, pés rosados com unhas; olha em volta, pisca,
  cochila afofado, espia com um olho, `peck()` novo). 7 malhas e 1 material por pombo. API e campos de `setPose`
  mantidos. Testes em `test/pigeon.test.mjs`; capturas (`capture-pigeons.mjs`, suíte E2E `fase4`) comparam com
  o pombo do main, com cabeça de perto, bicada e pouso. Decisões em [POMBOS.md](POMBOS.md).
- Fase 10 (PR #33, outra sessão): `treehouse.js` pode trocar a bicada simulada com `flying` por
  `pigeonModel.peck()`; anotado no PR #34. Não editar `src/levels/fase10/**` nem `src/game/game.js` neste PR.
- Próximo passo: CI e E2E `fase4` verdes no head atual, revisar `shots/pombos/` do artefato `capturas-fase4`,
  entregar a prévia e aguardar a aprovação do usuário antes de integrar.

## Entregue: voltinha natural, recompensa do segredo e rolar sem atravessar o chão (PR #32, squash `415bd67`, deploy `39202538581`)

- Extras da tarefa E: voltinha andando antes da agachada (`planCircle` em `src/game/extras.js`), comemoração própria
  do segredo (`extra:secret`, `planZoom`: brilho, jingle, câmera de perto, zoomies ou pulinhos, a irmã espantada),
  agachada com corcunda (garupa a ~64% da altura em pé), a irmã dá espaço (`InputLock.move`) e a rolagem nova com a
  altura pelo contato real (`lowestY` em `dogAnimation.js`). Testes em `test/extras.test.mjs`, suíte E2E `extras` e
  `capture-extras.mjs`. Integrado com a aprovação do usuário; não repetir merge/deploy do #32. Nada no jogo nem no
  README cita o segredo.

## Entregue: redes de prazo nas capturas e páginas extras do E2E (PR #30, squash `0bd48d0` no main)

- Motivo: os `capture-*.mjs` e as páginas extras das suítes usavam o Playwright direto, sem as redes do PR #27. No
  E2E `39173570454` o `capture-lambe.mjs` travou até o timeout de 30 min do job (boot da fase 7, `goto` +
  `waitForFunction` de 180 s); no `39178028583` o `capture-celular.mjs` falhou com "condição não alcançada" e a
  página de iPhone da suíte `toque` estourou um `waitForFunction` de 60 s, as duas sem o estado no log.
- Feito no branch `claude/e2e-redes-capturas`, **PR #30**, base `402635e` (consultar o PR para SHA, CI e E2E):
  `tools/scripts/lib/page-guard.mjs` (`guardPage`, `openPage`, `closeBrowser`) com o teto de relógio, o vigia
  `opMaxMs` e a escuta de queda extraídos do harness. O harness passa a usá-lo (mensagens preservadas; as do vigia
  ganharam a linha do script), imprime o resumo completo ao sair pelo vigia e ganha `H.newPage(opções, nome)`. As
  seis capturas e as páginas de PC/iPhone da suíte `toque` estão protegidas; prazos de 180 s para 120 s; último
  passo (`guard.note`) e estado do jogo nos diagnósticos e nas "condições não alcançadas". Na página de iPhone, cada
  toque do menu espera o botão aparecer (com a tela seguinte ainda escondida, o toque caía em (0, 0)). Provas novas
  `extra` e `capture` em `test-e2e-infra.mjs`. Docs: ARQUITETURA (seção do E2E) e ENTREGA.
- O `capture-biblioteca.mjs` da fase 9 (PR #29) recebeu `openPage`/`closeBrowser` e os prazos de 120 s ao atualizar o
  branch com o main.
- E2E no 1º commit `1446c1c`: `toque` `39183736380` ok (96/96, PC e iPhones por `H.newPage`; `capture-celular`
  com 40 capturas sem erro); em `lambe` `39183733885`, infraestrutura 13/13 (as provas `extra` e `capture` em
  ~11,5 s cada) e `capture-lambe` com as 16 capturas, mas a partida `lambe` caiu no travamento de boot já conhecido:
  `load('?level=1&play&dog=rhaenyra')`, `window.__game` nunca apareceu, o prazo de 120 s venceu e a página não
  respondeu à leitura do estado. Reprovou em 126 s com o diagnóstico (antes, 30 min).
- Integrado ao main (squash `0bd48d0`). Não repetir merge/deploy do #30. O travamento de boot (causa raiz) é outra
  entrega.

## Entregue: tetos de relógio no harness (PR #27, squash `402635e`, deploy `39181809562`)

- Esperas em tempo de jogo com tetos de relógio, 60 s por ida ao navegador, `opMaxMs` de 150 s, escuta de
  `crash`/`disconnected` e, no runner, o vigia de 5 min de silêncio (ARQUITETURA, seção do E2E). Aprovado pelo
  usuário; head aprovado `428535b`, CI do main `39181772265`, produção conferida em `402635e`. Não repetir
  merge/deploy do #27.
- Achados: nos travamentos reais (lavanderia, `expresso`) a página abre e `window.__game` nunca aparece, com o
  `waitForFunction` de 120 s sem vencer; a prova `crash` reproduz (aba derrubada no meio da espera: o Playwright
  1.49 não avisa a queda). Hipótese: a aba cai no boot de uma fase (SwiftShader?); a causa raiz não foi investigada.
  `expresso` com o #27: 2 travamentos em 9, os dois antes das redes de queda e `opMaxMs`; sem mecanismo achado.

## Em andamento: travamento no primeiro boot do E2E (Claude, PR #31)

- Pedido (sessão aberta pela do PR #27): achar a causa dos travamentos intermitentes do primeiro carregamento de uma
  fase no E2E. Branch `claude/e2e-travamento-boot`, **PR #31**, atualizado por merge com o main `0bd48d0` (PR #30) e
  depois `415bd67` (PRs #29 e #32); consultar o PR para SHA, CI, E2E e prévia. Nada rodou no PC além de
  `node --check`/`git diff --check`.
- Casos: seis, todos no PRIMEIRO boot de um navegador novo, nunca num segundo `load()` da mesma aba: lavanderia
  (`39160265826`), fase3 (`39164306879`), expresso (`39166156986`, `39169122476`), `capture-lambe.mjs`
  (`39173570454`) e lambe com a fase 1 (`39183733885`). Cerca de 1% dos primeiros boots dos jobs normais; os
  estresses do #31 somaram 688 boots frios sem nenhum travamento (`39183700978`, `39184838127`, `39188214029`), em
  AMD EPYC 9V45/9V74/7763 e Intel Xeon 8573C.
- Provado: em quatro casos o `waitForFunction` nem venceu o prazo porque o Playwright 1.49 espera uma limpeza na
  própria página antes de rejeitar: a thread principal da aba estava parada ou a aba morta. No caso da fase 1 o prazo
  venceu e só a leitura seguinte não voltou, como na prova `crash` (aba morta sem aviso do Playwright).
- Descartado (por ora): recarga pelo otimizador do Vite (`full-reload` mesmo com `hmr: false`). Nenhuma linha
  `[vite]` nem `RECARREGOU` nos 15 primeiros boots frios do `todas` `39188211856`, nos 100 boots com o cache apagado
  (`--cold-deps`) nem nos 953 logs antigos. Causa raiz ainda não identificada.
- Feito: sonda `tools/scripts/lib/hang-probe.mjs` (pilha do JavaScript por `Debugger.pause`, processos e threads do
  Chromium, GPU/alvos pelo CDP do navegador, CPU do runner e roubo do hipervisor, memória e `dmesg`, console com os
  marcos do boot e as navegações, registro do Chromium), ligada no `page-guard.mjs` (60 s, `opMaxMs`, teto das idas,
  queda; `openPage` liga sozinho: harness, páginas extras e capturas); `browser-log.mjs` + `--enable-logging=stderr`
  e `vite.log` em `shots/diagnostico/` (artefato); marcos `rr:boot:*`/`rr:level:*` e linhas `[boot]`/`RECARREGOU`;
  `[e2e] CPU do runner`; suíte `carregamento` (`stress-boot.mjs`, fases da campanha, `--cold-deps`, `--parallel`).
  Provas `hung`, `crash`, `extra` e `capture` conferem o `[diagnóstico]`. Docs: ARQUITETURA §10.
- Próximo passo: entregar a prévia do head atualizado (CI e `todas` no PR) e integrar só com a aprovação do usuário.
  No próximo travamento real, ler o `[diagnóstico]` do log e o `navegador-*.log` do artefato.

## Entregue: menu principal, Opções e modo sem dicas (PR #26, squash `1cc73d0` no main)

- Pedido do usuário: tela inicial só com **Jogar** e **Opções**; Jogar abre **Modo História** (visível, "Em breve")
  e o modo **Fases** (nome escolhido pelo usuário; constante `MODES` em `src/ui/markup.js`), que abre
  **Continuar** + a grade de fases. Opções reúne volume, qualidade e **Dicas**
  (desligadas = modo desafio: sem objetivo escrito, marcador e dicas em balão; controles seguem na pausa).
  Registrar a visão do Modo História sem implementar: [MODO-HISTORIA.md](MODO-HISTORIA.md).
- **Claude, branch `claude/menu-principal`, PR #26** (worktree próprio, base `09ed23a`, depois atualizado com o main
  `ccfaf4a` do PR #25 e `42715b6` do PR #24, fase 8). Consultar o PR para SHA, CI, E2E e prévia; nada rodou no PC. Feito: telas do menu (`data-screen` em `.rr-title`, `showScreen`/`goBack`
  em `ui.js`), Voltar por Esc, ○ · B ou botão do canto (também no cartão de abertura), `continueTarget` e `last` no
  save v1 (`progress.js`), opções salvas em `src/core/settings.js` (`rr-settings-v1`, evento `settings:change`),
  `settingsBlock()` igual em Opções e na pausa, HUD/feedback escondendo objetivo, dicas e marcador, e o atalho do
  núcleo que abre o cartão da fase já montada sem recarregar. Testes: `test/menu.test.mjs`, suíte E2E nova `menu`
  (teclado e controle), suíte `toque` passando pelo menu com dedos reais, `controle` e `expresso` ajustadas ao
  menu novo e capturas do menu em `capture-celular.mjs`.
- Integração com o PR #25 (tela cheia no iPhone): a dica vai na tela principal do menu (`.rr-screen--main`), a nota
  de passo a passo aparece na pausa e em Opções (duas colunas no celular: a nota ocupa as duas), e os trechos de
  iPhone de `test-toque.mjs`/`capture-celular.mjs` passam por Jogar → Fases → Continuar → Começar.
- Integração com a fase 8 (PR #24): as listas de suítes (`e2e.yml`, `run-e2e.mjs`) têm `lavanderia` e `menu`; a
  tela das fases mostra as oito fases (4 + 4) e `menuWith` (`test-expresso.mjs`) abre Jogar → Fases antes de ler.
- Integrado ao main (squash `1cc73d0`, CI do main `39169001462`). Não repetir merge/deploy do #26.

## Em andamento: demo de 10 fases (pedido de 2026-10-18)

- Pedido do usuário: mais três fases criativas (8, 9 e 10, fechando a demo), puzzles mais complexos, **no mínimo
  dois objetos** em cada uma, a mecânica nova de **pulo na parede** da Rhaenyra (alcançar botões e alavancas no
  alto) e animações extras de interação. Entregas em sequência, um PR cada, com prévia e aprovação:
  **A** impulso na parede · **B** fase 8 "Lavanderia de Domingo" · **C** fase 9 "Biblioteca do Vovô" ·
  **D** fase 10 "Festa no Quintal" · **E** animações extras. Antes de construir cada fase, apresentar ao usuário
  cenário e objetos em poucas linhas e esperar o ok.
- **Ordem atual:** A, B e E entregues; **C (fase 9) em andamento**; depois D (fase 10).
- **C (em andamento, Claude): fase 9 "Biblioteca do Vovô"**, branch `claude/fase9-biblioteca` (worktree próprio),
  **PR #29**, já com o main `d306983`. Feito: cenário em `src/levels/fase9/world/` (casa em corte com escritório,
  hall, biblioteca e jardim de inverno; estantes instanciadas, lareira oca com fogo, escadinha de rodinhas, globo,
  poltrona, mesa de estudos, duto no alto, ventilador, vasos, chuva nas vidraças), o gato (`src/world/cat.js`), os
  itens óculos e livro (`src/world/toys.js`, `carryPose.js`, ícones), sons (`soundsBiblioteca.js`), o puzzle
  (`puzzle.js`), os extras da fase, `test/fase9.test.mjs`, a suíte E2E `biblioteca` e `capture-biblioteca.mjs`.
- Decisões da fase 9: o vento do ventilador tem `funnel` (opcional em `scent.addWind`; as outras fases não mudam),
  porque com o teclado a frente segue a câmera, girada uns 15°, e o sopro escapava da faixa; a Radhija no vão mantém
  a porta aberta (a folha encostava nela e o vão ficava estreito demais para a Rhaenyra); `info().biblioteca.catAt`
  serve aos testes e capturas; no E2E, as condições do `holdUntil` rodam na página (dados de fora só pelo `arg`).
- Retorno do usuário na prévia (2026-10-18) e o que mudou: alavancas sem ligação visível (agora cabos/conduítes com
  um pulso de luz: alavanca do freio → trava vermelha na roda da escadinha, que abre e fica verde; disjuntor →
  conduíte, varal de luzinhas, lanterna e tomada do ventilador; botão do chão → haste até a grade, cujas palhetas
  abrem com a lâmpada verde). O registro de parede virou **disjuntor** (impulso, liga a energia do jardim de
  inverno), o ventilador ganhou **botão de liga** (E, só com energia) e o registro do duto abre com o **vaso de
  rodinhas** empurrado até o **botão do chão** (as dogs são leves demais). **Segurar a escada com a própria dog:**
  E no pé da escada (a Rhaenyra continua segurando depois da troca; andando, solta). Câmera: zonas em
  `CAMERA.zones` (no escritório o olhar sobe e o Bichano no alto do armário aparece) e uma apresentação no início
  (óculos e gato, uma vez por carregamento); "Zzz" no gato dormindo. Portinha de gato com buraco de verdade,
  moldura em arco, aba âmbar que balança, plaquinha e capachos. Escadinha e ventilador remodelados. A animação de
  rolar (tapete) e o cocô secreto ficaram com a sessão dos extras, num PR próprio.
- Próximo passo da C: CI e E2E `biblioteca` (depois `todas`) no head novo do PR #29, revisar as capturas
  (`shots/biblioteca-revisao/`), entregar a prévia e esperar a aprovação. Depois, apresentar o desenho da fase 10 e
  esperar o ok.
- **E entregue (extras escondidos, PR #28):** squash `d306983` no main, CI do main `39174689553`, deployment
  `7162054221` no ambiente `github-pages`; `version.json` de produção conferido em `d306983`. Não repetir
  merge/deploy. Resumo: extras escondidos nas fases, branch
  `claude/animacoes-extras`. Regras do usuário: o cocô com **C** no teclado e
  **R3** no controle, só depois dos 3 ossinhos e uma vez por fase (o reinício libera); a animação é o principal
  (agachada, traseiras dobradas, rabinho em pé, tremidinha, cara de concentração, cocô de desenho fofo e alívio
  cavando com as traseiras). As animações do cenário (beber, comer, balanço, areia etc.) valem a qualquer hora, com
  E perto do objeto, e foram todas aprovadas. Tudo escondido no jogo e no README; a nota técnica discreta está em
  ARQUITETURA §6 ("Extras"), liberada pelo usuário. O menu novo (PR #26) não pode citar o C nem o R3.
  Arquivos: `src/game/extras.js`, poses em `src/dogs/dogAnimation.js`, `src/world/poop.js`, `src/world/extraProps.js`,
  `src/levels/faseN/extras.js`, sons em `src/fx/audio/soundsExtras.js`, `test/extras.test.mjs`, suíte E2E `extras` e
  `tools/scripts/capture-extras.mjs`. A fase 9 já tem os seus extras (`src/levels/fase9/extras.js`).
- **B entregue (fase 8, PR #24):** squash `42715b6` no main (head aprovado `2cd2eda`), CI do main `39166620003`,
  deploy `39166669699` com sucesso; `version.json` de produção conferido em `42715b6`. Não repetir merge/deploy.
- Prazo de relógio no harness E2E: entregue à parte (PR #27, de outra sessão); conferir o estado no GitHub.
- **Retorno do usuário sobre a progressão (2026-10-18):** a 8 está de bom tamanho para apresentar a mecânica nova; a
  **9** deve ser um pouco mais complexa (mais elementos, **mais áreas**, puzzle mais difícil); a **10** fecha a demo
  com **todas as mecânicas**, o puzzle mais elaborado, **no mínimo 3 objetos** e um **pequeno enigma**: a ordem certa
  de colocar os 3 objetos, com a pista num detalhe de um quadro ou parede. Atualizar COMO-CRIAR-UMA-FASE §1 junto.
- **C (desenho aprovado, 2026-10-18):** fase 9 "Biblioteca do Vovô", noite de chuva, quatro áreas (hall de entrada,
  biblioteca com lareira e a poltrona do vovô = entrega, escritório fechado com portinha de gato, jardim de inverno).
  Óculos (Radhija) no alto da estante: impulso na alavanca do freio da escada de rodinhas → a Rhaenyra empurra o
  globo para fora do trilho e a escada até os óculos → só o peso dela segura a escada (Fica no pé) enquanto a Radhija
  sobe os degraus largos. Livro (Rhaenyra, pesado) no alto do armário do escritório, com o gato Bichano dormindo em
  cima: latido não adianta, superbafo direto não alcança; impulso no botão do ventilador do jardim de inverno, a
  Rhaenyra empurra o ventilador até a boca do duto, a Radhija sopra o superbafo no vento, a grade alta do escritório
  solta o cheiro, o Bichano pula, derruba o livro e sai pela portinha; impulso na maçaneta (alavanca alta) abre a
  porta, a mola fecha de novo, a Radhija segura a porta com o Fica e a Rhaenyra traz o livro. Na versão construída,
  o ventilador fica no jardim de inverno e o impulso é no registro do duto (alavanca na parede de tijolos).
- **D (rascunho):** fase 10 "Festa no Quintal": laço, chapéu e vela estrela na torre de presentes; o quadro "Festa
  do ano passado" na varanda mostra a ordem de baixo para cima (ordem errada: a peça balança e cai na grama).

## Entregue: impulso na parede (PR #23)

`pickWallSpot`/`startWallJump`/`integrateWall` (`dogController.js`), pose em `dogAnimation.js`, `createWallButton` e
`buildWallButton`, parede de treino na Arena do Pulo. Squash `09ed23a` no main, CI `39156660735`, deploy
`39156707851` com sucesso; `version.json` de produção conferido em `09ed23a`. Detalhes em ARQUITETURA §6
(Impulso na parede). Não repetir merge/deploy do #23.

## Entregue: jogar no celular (PR #22)

Controles de toque (joystick flutuante e botões, `src/ui/touchControls.js`, dispositivo `touch`), layout próprio do
celular (`.rr[data-mobile]`), perfis de qualidade por aparelho com governador de FPS (`src/core/quality.js`; PC =
alta, sem mudança), manifest e ícones. Squash `1fbc631` no main, publicado pelo deploy `39151418291` (liberado com
a aprovação do chat); `version.json` e HTTP 200 conferidos. Detalhes em ARQUITETURA §6, §9 e §10.

## Em andamento: tela cheia no iPhone (branch `claude/iphone-tela-cheia`)

- Retorno do usuário (2026-10-18): no iPhone 13 rodou bem, mas não abriu em tela cheia e a barra de endereço
  atrapalha. O Safari do iPhone não deixa uma página ocupar a tela inteira; o caminho é o app da tela inicial.
- Feito: manifest com `display: standalone` (o iOS respeita) e `display_override: [fullscreen, standalone]` (o
  Android segue em tela cheia); dica discreta só no iPhone fora do app e sem a API de tela cheia
  (`needsInstallTip`/`readInstallEnv` em `src/core/quality.js`; `src/ui/installHint.js` + `installHint.css`):
  cartão sob o Jogar uma vez só, linha no aviso de girar e nota com o passo a passo na pausa (só texto). Elementos
  inseridos no DOM depois da UI (sem mexer em `ui.js`/`markup.js`, que o menu novo e o PR #24 editam). E2E `toque`
  confere o Android (tela cheia automática e o botão) e páginas de iPhone (dica, × salvo, pausa, modo aplicativo).
- PR #25. O branch `claude/menu-principal` (menu novo) reescreve `ui.js`/`markup.js` e também mexe em `main.js`,
  `test-toque.mjs` e `capture-celular.mjs`: quem integrar depois resolve os conflitos e confere que a dica ainda
  encontra `.rr-title__center`, `.rr-rotate__box` e `.rr-pause__settings` (ou os equivalentes do menu novo).
- Próximo passo: CI e E2E verdes, capturas do iPhone, prévia com o passo a passo e **aguardar aprovação**.

## Entregue: fases 6 e 7 na campanha (PR #21)

As fases 6 (Expresso do Superbafo) e 7 (Lambe-Lambe na Pracinha) saíram de `DEV_LEVELS` e entraram em `LEVELS`;
o menu tem sete fases (4 + 3) e os links por id da época de protótipo continuam valendo (`publishedLevelIndex`).
Squash `a7d59ed` no main. A medição temporal para sete fases ficou como entrega própria; até lá `desempenho.yml`
recusa o catálogo de sete por desenho (DESEMPENHO.md).

## Entregue: Lambe-Lambe e fase 7 (PR #20)

Habilidade Lambe-Lambe da Rhaenyra (R / L2·LT perto da irmã), lama da Radhija,
frisbee e a fase 7 (pracinha depois da chuva), entregues em `DEV_LEVELS`. Squash
`dc1a0e5` no main, CI `39138452577`, deploy `39138502934` com sucesso;
`version.json` de produção conferido em `dc1a0e5`. Não repetir merge/deploy do #20.

## Entregue: fase 6 mais longa (PR #19)

Lua no pórtico, cancela na estrela e foguete de duas cargas, entregues em `DEV_LEVELS`.
Squash `0281956` no main, publicado antes do #20.
Diretriz do usuário para as próximas fases: **dois objetos** por fase até a 10;
a partir da 11, três ou mecânicas novas (ver COMO-CRIAR-UMA-FASE, seção 1).

## Entregue: acabamento da fase 6 (PR #18)

Squash `31e8b26` no main, publicado pelo deploy `39095730915` (deployment
`7149690293`, liberado com a aprovação do chat); `version.json` e HTTP 200
conferidos. Não repetir merge/deploy do #18.

## Passagem anterior (Codex → Claude, 2026-10-17)

O usuário pediu publicar o PR #16 e documentar a passagem; continuará o
desenvolvimento com Claude.

## Estado atual confirmado

**A rodada inicial de estabilização EST-00 a EST-09 está concluída e publicada.**
As fases 6 e 7 foram aprovadas/publicadas em `DEV_LEVELS`; a entrada delas no menu
normal está em andamento (topo). Não reiniciar tarefas já entregues.

- Produção: https://raposocampos.github.io/radhija-rhaenyra/.
- Main publicado: `45bf0cc4b90abc32b3992ce93fa7055bff248cdd` (squash do PR #16).
- Head aprovado do PR #16: `622d30302e5c6d0209a0993f8c4dabe952cb5274`, base `b954b24`.
  Árvores do head aprovado e do squash idênticas.
- [CI do head](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39084258076):
  207 testes, tipos e build aprovados, prévia conferida.
- [Medição do head](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39084258063):
  oito testes da infraestrutura, cinco pares A/B, 30 janelas medidas/600 quadros,
  dez provas negativas reais; nenhum erro/warning nos relatórios. Revisão independente.
- [CI do main](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39087411898)
  e [deploy](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39087441755)
  concluídos com sucesso. Só o deployment `7148473323` foi liberado usando a
  aprovação explícita do chat. Site HTTP 200 e `version.json` confirmaram
  `45bf0cc`, run `39087411898`, tentativa 1. **Não repetir merge/deploy do #16.**

## O que foi entregue

| Frente | Resultado | PR |
| --- | --- | --- |
| Plano e contexto | Avaliação, prioridades, checklist e divisão por worktrees | #4 |
| Confiabilidade do E2E | Erros inesperados reprovam; prova negativa e smoke do build em subcaminho | #6 |
| Dependência de desenvolvimento | Vite atualizado pontualmente, com lockfile | #5 |
| Carregamento | Recuperação de falhas, boot e aba antiga com chunk removido | #10 |
| Progresso | Save validado/compatível, preservação de registros e fallback | #7 |
| Recursos gráficos | Ownership/descarte por fase, globais preservados e contagens após alternâncias | #11 |
| Contratos | Ligação tipada entre definição/puzzle/cenário, props reais e dublês estritos | #12 |
| Configuração das personagens | Atributos comuns independentes da fase 1; posições por layout | #13 |
| Núcleo | Extração de eventos/efeitos associados, preservando ordem e comportamento | #14 |
| Menu | Botão Jogar não desaparece ao navegar para a seleção de fases | #8 |
| Desempenho e expansão | Protocolo temporal, baseline revisada e guia completo para novas fases | #16 |
| Fase 6 | Protótipo Expresso do Superbafo e correção da dica da bandeja | #15 |

Todos esses PRs foram integrados e publicados. O PR #9 foi **encerrado sem merge**
porque sua proposta foi incorporada ao #15; não há entrega exclusiva pendente nele.
O plano completo está em [PLANO-ESTABILIZACAO.md](PLANO-ESTABILIZACAO.md).
A avaliação original, entregas anteriores (incluindo infraestrutura inicial e
pombos) e evidências históricas foram preservadas em
[HISTORICO-ESTABILIZACAO.md](HISTORICO-ESTABILIZACAO.md), sem tratar seus antigos
“próximos passos” como comandos atuais. Decisões dos pombos em [POMBOS.md](POMBOS.md).

## Limites da conclusão

Não há requisito obrigatório esquecido na rodada acordada. Tipagem exaustiva de
IA/layout/listeners, extrações adicionais do núcleo e otimizações preventivas
são melhorias futuras, dependentes de necessidade concreta; não bloqueiam a fase 6.
Testes reduzem regressões, não garantem que nenhuma alteração futura possa quebrar.

A baseline mantém sua origem **`b4a61b3` / `39082606479`**, mesmo após publicação:
[JSON adotado](performance-baseline.json), [valores e dispersão](DESEMPENHO-REFERENCIA.md),
[protocolo](DESEMPENHO.md). Não substituir pelos candidatos de novas execuções.
Na validação final `39084258063`, fases 2/5 tiveram ambientes equivalentes e
nenhuma métrica acima dos limites; fases 1/3/4 tiveram CPUs diferentes e sua
comparação temporal foi recusada. Não alegar ganho/regressão nesses três casos.
SwiftShader não representa GPU/FPS do jogador, heap JS não é VRAM e seis visitas
não provam ausência de vazamento longo. O catálogo temporal ainda tem cinco fases.
O run incompleto `39080397088` é diagnóstico de timeout, nunca baseline válida.

## Fase 6: entregue como protótipo

Acesso: https://raposocampos.github.io/radhija-rhaenyra/?level=fase6&play (o link
continua valendo depois da promoção). Registro em `src/levels/dev.js` até a Entrega B.
O usuário escolheu **Expresso do Superbafo**, rejeitou repetir pombo/ventilador e
exigiu a **mesma direção artística do jogo**, sem redesenhar as personagens.

Rhaenyra pousa no pedal para escolher trilho; o superbafo frontal da Radhija faz
o trem espirrar e trazer a bolinha-planeta. Rota circular é recuperável, rota
fica travada em movimento, retirada ocorre em `ready`, entrega no tapete.
Há oito estados, bloqueio/poda de nuvens antigas, petiscos, pausa/reset/descarte.

PR #15: head corrigido aprovado `05e2287`, base `fae8acd`, squash `b954b24`.
CI `39082917531` passou 207 testes/tipos/build. E2E `39082921941`: 24 verificações
Expresso, quatro de infraestrutura, 23 smoke, 28 recuperação e 30 comparações
gráficas estáveis nas seis fases, sem erros/warnings/descarte global; capturas
revisadas. São 18 testes específicos da fase e oito provas negativas de tipos.
O E2E completo `39081100507` passou no head anterior `92b9306`; não atribuir esse
run à correção posterior, que teve validação própria da suíte afetada.
CI main `39083884706` e deploy `39083918751` publicaram o #15 antes do #16.

Limites aprovados: **blocagem jogável**, oficina simplificada, espirro sem som
exclusivo e curvas segmentadas com giro imediato. Acabamento e entrada na campanha
não foram implementados. Plano concreto em [CONTINUIDADE-FASE6.md](CONTINUIDADE-FASE6.md).

## Retomada pelo Claude

1. Conferir branch, status, worktrees e `origin/main`. A pasta principal foi
   sincronizada por fast-forward em `45bf0cc`, sem mudar o branch `main`, e estava
   limpa. Não presumir que worktrees antigos tenham a mesma base; não descartá-los.
2. A consolidação documental do Codex (`codex/passagem-claude`) virou o PR #17,
   integrado ao main em `5e434f7`.
3. A aprovação do #16 já foi consumada na publicação acima; não repetir.
4. O acabamento da fase 6 (DEV) foi publicado no #18, a versão mais longa no #19 e
   a fase 7 no #20. A promoção das duas à campanha está em andamento (topo).
5. Os três pressupostos da promoção (URL por ID só no DEV, contratos que presumiam
   portão, fase 5 com `hasNext=false`) foram corrigidos nesse branch; a medição
   temporal para sete fases ficou como entrega própria.
6. Toda validação pesada permanece no GitHub. CI e prévia próprios a cada head/base;
   E2E da suíte e `todas` na entrega importante. Preservar save, recursos e arte;
   aprovação explícita antes de merge/deploy. Não instalar ai-memory.

Na passagem do Codex não havia acabamento em andamento; o trabalho atual está na
seção "Em andamento" no topo. Histórico de branches e capturas ignoradas foi
preservado. Conferir o estado remoto ao retomar: este é um checkpoint, não uma fonte viva.
