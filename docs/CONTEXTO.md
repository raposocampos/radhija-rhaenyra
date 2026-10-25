# Contexto para retomar o projeto

Última atualização: **2026-10-24, Claude** (superbafo sem atalho pelo duto, PR #63, em andamento; #65, patas
alternadas, em v0.10.13 · build 105; o #60, engasgo na primeira passagem, em v0.10.12 · build 104; #61 em v0.10.10 ·
build 102; #58 em v0.10.9 · build 101). Ler primeiro [AGENTS.md](../AGENTS.md) e [ENTREGA.md](ENTREGA.md); conferir
Git/GitHub antes de editar.

## Em andamento: E2E `fase3` intermitente na dica do cantinho (Claude, 2026-10-24, branch `claude/dica-cantinho-deterministica`)

- Pedido (pelo orquestrador): a suíte `fase3` do E2E às vezes reprovava em "dica do cantinho" e passava ao repetir
  (E2E `todas` `39492800353` do #48, head `1d8e00e`; `40141363602` do #63, que não mexe na fase 3).
- Evidência: nas duas falhas a Rhaenyra termina em (-3,66, -2,61) e (-3,67, -2,61); nas verdes, com x de -3,29 a
  -3,48. Sempre encostada na cerca-viva baixa, a oeste do vão (x de -3,27 a -2,81). Histórico: 2 falhas em 44
  execuções completas da suíte.
- Causa (o roteiro do teste, não o jogo): o passo parava no meio do vão, em (-3,04, -2,45), com 10 cm de tolerância e o
  rumo que sobrasse da aproximação, e segurava W 0,9 s. O W da câmera da fase 3 puxa 17° para oeste e, virando de um
  rumo qualquer, ela faz uma curva: conforme o ponto e o rumo da chegada, encostava na cerca-viva com o centro já a
  oeste do vão, só na cerca comum (`cantinho-sul-a`), escorregava para oeste e nunca tocava o colisor do vão
  (`cantinho-vao-grande`, que dá a dica). Medido no jogo headless (9 pontos da tolerância × 24 rumos × 20, 30 e 60 fps):
  11% das chegadas sem dica, de 8,8% a 12,5% em cada ritmo (não é o FPS); igual sem o peito e a garupa do #48. O jogo
  está certo: a dica sai quando ela empurra com o centro na frente do vão.
- Correção (`tools/scripts/playthrough-fase3.mjs`): ela chega a leste do vão, em (-2,66, -2,3), e segura W até o centro
  passar a oeste dele (`holdUntil`, solto pela página; prazo de 4 s de jogo): encosta na cerca-viva e escorrega rente a
  ela pela frente do vão inteiro, sempre empurrando para dentro. As conferências ficaram mais fortes: "não entra no
  cantinho" vale para todos os quadros gravados (antes, só a posição final) e uma nova confere que ela passou
  empurrando a cerca na frente do vão. Teste novo em `test/fase3.test.mjs`: a mesma varredura de 9 pontos × 8 rumos ×
  20 e 60 fps (com o ponto antigo, reprova).
- Não mexido: o jogo; `tools/scripts/lib/harness.mjs` (também está no #64).
- Validação do código (`a221084`, sobre o main `60dc88c`), PR #66: varredura temporária `40146842803` (branch auxiliar
  `claude/dica-cantinho-varredura`, só o workflow e um script; apagar no fim): a suíte `fase3` inteira 6× em paralelo,
  todas verdes (52 checks cada), e 6 lotes A/B no mesmo runner (roteiro antigo × novo, 8 cargas cada): o antigo perdeu
  a dica 1 vez em 48 (chegou virado para o sul em (-3,10, -2,47) e terminou em x = -3,68, a mesma assinatura das
  falhas), o novo 0 em 48. E2E `todas` `40146733563`: tudo verde menos `toque`, que passou nos 99 checks e falhou depois,
  nas capturas do celular (`capture-celular.mjs`: o "Começar" da abertura da fase 1 não pegou e a partida ficou na
  abertura); não é desta mudança. Depois veio a sincronização com o main `1b4ea05` (#63): CI e E2E do head no PR.
  No PC, só o diagnóstico headless, o teste novo e `node --check`/`git diff --check`.

## Em andamento: superbafo sem atalho pelo duto da fase 4 (Claude, 2026-10-24, branch `claude/duto-sem-atalho`, PR #63)

- Retorno do usuário (PC e celular): "Na parte do duto, se você encosta e usa o superbafo, acaba atravessando e
  atingindo o pombo, sem precisar fazer a mecânica do ventilador."
- Causa: a nuvem nascia na boca (0,36 m à frente do centro da Radhija) sem olhar o caminho. Encostada na caixa do duto,
  a boca ficava 0,16 m dentro da caixa, depois do meio dela; a colisão da nuvem a empurrava para a mureta e dali para o
  lado do pombo (x = 2,68 em dois quadros), e o nariz do pombo do portão só media a distância no chão. O mesmo pela
  mureta e pelo portão fechado (zona B → C), pela lateral do corredor (aparelhos e mureta baixa → dentro do corredor; com
  o ventilador na marca, duto e pombo) e na Arena do Bafo. Encostada na boca com o ventilador na marca, a nuvem também
  passava direto e o duto não a engolia.
- Fase 10 sem o furo: o pombo só aceita a nuvem que veio pelo cano (`cloud.duct`), e o funil no chão abre para todos os
  lados. Fase 9: o Bichano também só aceita a do duto, e a boca fica na parede do fundo. Não mexidas.
- Correção: `scent.js` (`birthPlace`): o sopro leva a origem (`fromX`, `fromZ`, o centro dela, `game.js` `bafoShot`) e a
  nuvem vai dali até a boca com a colisão dela (o que já envolve a origem, um obstáculo baixo embaixo dela, não conta);
  a mira usa o mesmo; a poeirinha do sopro (`dog:bafo`) sai onde a nuvem nasce. Boca de duto virada para um lado
  (`inlet.dirX/dirZ`; fase 4 e Arena do Bafo, para o oeste) só engole a nuvem da frente. O pombo do portão da fase 4 e o
  da Arena só aceitam a nuvem do duto (fase 4: a nuvem do chão perto do poleiro dá a dica "alto demais… duto"). Tipos e
  ARQUITETURA §5.1.
- Testes: `test/duto-sem-atalho.test.mjs` (10 testes, sementes 404–410 e 41–53): o campo de cheiro (parede, ponta da
  parede, obstáculo baixo, boca virada); na fase 4, encostada na boca do duto, na mureta, no portão, pela lateral
  (aparelhos, mureta baixa) e por trás da grade (entre o ventilador encaixado e ela), com o ventilador no começo, fora
  da marca e na marca; o caminho certo (até encostada na boca); refazer depois de errar; a nuvem do chão perto do
  poleiro; a Arena do Bafo. Reprodução: CI `40140693699` no `664261a` (só os testes, sem a correção): 9 dos 10
  reprovaram, com a nuvem do outro lado da mureta e o pombo sentindo o cheiro.
- O vão embaixo dos canos (`CORRIDOR.door`) é passagem, não parede: soprando em cima dele, a nuvem sai ou entra no
  corredor por ali, como a Radhija (de fora, só com o ventilador na marca ela chega ao duto). Os sorteios ficam longe
  dele (o CI `40141093564` reprovou um sorteio assim no caminho certo).
- E2E `todas` `40141363602` (no `56fad30`): partidas `fase4` 17/17, `quintal` e `bafo` verdes; reprovou a captura dos
  pombos (`capture-pigeons.mjs` chamava a reação do pombo sem nuvem; agora passa a do duto, `mech.duct`) e, sem
  ligação com o cheiro, `fase3` ("dica do cantinho", página lentíssima no runner) e a primeira passagem da fase 10
  (`celular-baixa`: 5 picos de tempo; `celular-media`: 1 programa e 1 textura antes do superbafo). A dica do cantinho
  já tinha falhado uma vez no #48 e passado ao repetir. O E2E do `8a46e80` foi cancelado: o main andou (#65) e o
  branch foi sincronizado com o `60dc88c` (merge, sem conflito).
- Validação: CI e E2E (`fase4`, `quintal`, `todas`) do head final no PR. No PC, só `node --check` e `git diff --check`.
- Próximo passo: com tudo verde, entregar a prévia e esperar o "pode integrar" do usuário no chat desta sessão.

## Entregue: patas alternadas na arrancada (PR #65, squash `60dc88c`, v0.10.13 · build 105)

- Retorno do usuário (2026-10-24, pelo orquestrador): "quando você tá parado e sai correndo com as dogs, elas mexem as
  duas patas, principalmente a traseira (...), saem iguais no movimento, fica parecendo um trote de cavalo".
- Medida (`test/patas-alternadas.test.mjs`): em que ponto da passada da outra do par cada pata sai do chão (0,5 =
  alternadas; 0 = juntas), saindo de parada como o controle do jogo (aceleração, giro, arrancada), 12 sementes. No main
  `81165a7`: no modelo novo, 17–77% das decolagens das traseiras abaixo de 0,25 (trote, corrida, curvas, analógico
  pela metade; mínimo 0), também no trote firme; no atual, 99–100% com o analógico pela metade (~0,8 m/s).
- Causas: (1) fases do passo [0,25; 0,75; 0; 0,5] e do trote [0; 0,5; 0,5; 0]: na mistura, as traseiras iam uma ao
  encontro da outra e no meio da troca ficavam juntas (nos dois modelos); (2) no novo, a fase de cada pata atrasava
  no apoio: a traseira trotando termina o apoio a ~90% do alcance, passava dele, saía no passo de conforto fora do
  ritmo, a fase recomeçava no pouso e a correção nunca terminava (laço estável, às vezes com as duas juntas); (3)
  depois da arrancada as patas voltavam ao compasso do guia atrasando até ~1 ciclo/s; (4) parada, a fase de cada pata
  é a do relógio: a primeira traseira esperava a vez dela e a outra chegava ao fim do alcance logo depois.
- Feito (`src/dogs/v2/gait.js`, `src/dogs/dogAnimation.js`): fases reescritas (o passo meio ciclo adiante, o mesmo
  passo; o balanço de lado do guia vai junto); a fase só atrasa no balanço (parada e no galope, como antes); o passo
  fora do ritmo pousa no lugar dele contado da outra do par; saindo de parada, uma traseira já sai; o corpo do guia
  segue a fase das patas; no galope e logo depois, a fase acompanha a 3 ciclos/s.
- Resultado (12 sementes): no novo, traseiras com mínimo 0,21–0,40 e 0–1% abaixo de 0,25 em todos os casos;
  dianteiras com mínimo ≥ 0,11; no atual, traseiras ≥ 0,40. `test/locomocao.test.mjs` continua passando (arrancada:
  a pata de trás vai até 9,3 cm para trás, perna nunca reta nem arrastada, primeiro passo de cada pata até 0,12 s).
- Validação: CI e E2E `todas` (tiras do trote e da arrancada em `capture-modelos.mjs`, suíte `canil`) do PR; conferir
  pelo commit no GitHub. No PC do usuário, só os testes da locomoção e `git diff --check`.
- Fora daqui: o porquinho (`src/characters/pig.js`) usa as fases antigas (as traseiras se encontram do passo ao trote).
- Integrado com a aprovação do usuário (squash `60dc88c`, CI do main `40146255256`): produção em v0.10.13 · build 105
  (`version.json` conferido).

## Em andamento: sem engasgo na primeira passagem pelas áreas (Claude, branch `claude/primeira-passagem-sem-engasgo`, PR #60)

- Retorno do usuário na prévia do #58: "fica engasgando sempre que vou pra alguma parte nova a primeira vez".
- Causa: o `renderer.compile` da carga (`loadLevel`) rodava sem alvo, mas o jogo desenha no alvo do compositor
  (perfis alta, média e baixa): ali o three r170 monta os programas sem tone mapping e em espaço linear, outra
  variante. Os programas certos, as texturas e as geometrias só iam para a GPU quando cada coisa entrava na câmera.
  Medido no código antigo: depois da carga, +28 a +95 programas, +30 a +137 texturas e +307 a +1222 geometrias por
  fase; o primeiro superbafo, +1 programa.
- Feito: `engine.prepare()` (`src/core/engine.js`), chamado no `loadLevel` atrás da cortina: compila a cena toda
  com um alvo do tipo do compositor ligado (`compileAsync`), desenha tudo uma vez — sem recorte e com o que está
  escondido (as luzes escondidas continuam apagadas) — de uma vista geral da fase num alvo de 256×144, um quadro normal
  e espera a GPU (fence); marcas `rr:gpu:*`. Trocar o perfil de qualidade recompila a fase em segundo plano. Bolha
  escondida `cheiro-aquecimento` (`scentView.js`) para o superbafo; pool de ícones e de pegadas (`feedback.js`) começa
  com cada textura. `game.js`: só a linha do compile no `loadLevel`.
- Medição: `tools/scripts/measure-first-pass.mjs`, suíte `primeira-passagem` do E2E manual (também em `todas`): um
  job por fase e aparelho (PC `alta`; iPhone 13 emulado em `media`; Infinix Note 30 emulado em `baixa`; entrada
  `qualidades` do workflow), navegador novo sem cache de shaders em disco, 3 s parado depois da carga, a dog de nó em
  nó duas vezes e um superbafo; cada quadro espera a GPU lendo um pixel (o `gl.finish()` do Chromium não espera).
  Reprova com programa, textura ou geometria depois da carga, com mais de 3 picos (quadro da 1ª passagem > max(150 ms,
  35%) do mesmo da 2ª, com a mesma cena) ou com um pico acima de 2,5×. O relatório lista o que entrou na câmera em
  cada pico. Smoke do build com 8 min (cada carga prepara a GPU).
- Achados: (1) a variante errada da carga e a certa no 1º uso somavam ~1,7× os programas de uma passagem (fase 10:
  176 → 99); (2) no SwiftShader, o resto do custo era na hora do desenho (por isso a vista geral cobrindo pixels e a
  fence); (3) a fase 10 tem dois quadros (cerca do fundo em `Y_south`, folhinhas em `Y_pinata`) +40 a +120% na
  primeira vez, já antes da correção, sem nada novo no renderer; (4) o perfil `baixa` redesenha a sombra a cada 2
  quadros: as passagens precisam começar na mesma paridade.
- Números (SwiftShader do CI; antes → depois): depois da carga, 29–96 programas, 30–138 texturas e 307–1222 geometrias
  por fase → 0/0/0 nos três aparelhos; programas compilados no total −40% (fase 10: 176 → 99 no PC); o 1º quadro de
  2,5–9,8 s (normal 0,2–1,9 s) → o normal; o pior quadro do percurso de 1,2–3,7× → 1,0–1,9× o mesmo da 2ª passagem.
  Em troca, a carga: PC 0,6–3,6 s → 6,5–21 s; iPhone 13 emulado 0,4–3,0 s → 5,4–18,6 s; Infinix emulado 0,4–2,7 s →
  6,5–14,9 s. No SwiftShader um quadro normal leva 0,2–2 s; em aparelho real o que manda é a compilação (−40%), então
  o usuário decide pela prévia. Se a carga pesar no celular: progresso real na cortina, ou preparar primeiro a câmera
  inicial e o resto em fatias.
- Validação: `858cd5b` (sobre o main `c9848e4`): CI `39701913894` verde e prévia publicada; E2E `todas`
  `39701942844` com os 52 jobs verdes (partidas, smoke, recursos e os 30 da primeira-passagem). Antes, sem a correção
  e com o mesmo código do jogo (branch auxiliar `claude/primeira-passagem-antes`, main `e2bcd61` + medidor; apagar no
  fim): PC `39686929789`, iPhone `39695409535`, Infinix `39701939928`. Os commits seguintes só mudam este arquivo;
  conferir o CI deles no PR. No PC do usuário, só `node --check` e `git diff --check`.
- Próximo passo: entregar a prévia com a tabela por aparelho e esperar o "pode integrar" do usuário nesta sessão. Se o
  main andar, sincronizar de novo e conferir que `src/game/pushRest.js` e o `pushFace` de `game.js` continuam iguais aos
  do main.

## Entregue: empurrar sem queda de desempenho (PR #61, squash `e2bcd61`, deploy `39686660421`, v0.10.10 · build 102)

- Retorno do usuário ao testar a prévia do #58: "como se o fps baixasse muito quando eu aperto o R1 pra empurrar
  algo". O engasgo na primeira passagem por uma área nova (compilação de shaders e texturas) ficou com outra sessão
  (PR #60).
- Medida no GitHub (`tools/scripts/measure-push.mjs` e a medida `empurrar` do `desempenho.yml`, só no branch
  `claude/medir-empurrar`, que não vai para o main; execução 39548900185): controle falso com o R1 e o analógico,
  v0.10.8 e v0.10.9 com os dois modelos, em A/B/A/B no mesmo runner. Empurrando o carrinho, o caixote e o ventilador,
  o `pushRest` (~110 raios contra todas as malhas do objeto) era refeito 1 a 2 vezes por segundo: um quadro com 40 a
  90 ms de CPU no runner (28 a 38 ms no PC do usuário). Igual em v0.10.8 e v0.10.9 (não veio do #58); o R1 sem nada à
  frente e a arrancada não custam nada a mais; o modelo novo só soma ~0,1–0,2 ms de animação por quadro.
- Correção: `pushRest.nearestHit` (cada raio só testa as malhas cuja caixa ele cruza, até o primeiro acerto; o mesmo
  resultado do Raycaster) e `pushFace` guardando a medida por objeto e lugar (lado, posição na face, rumo; um lugar
  novo no máximo a cada 0,25 s). Por medida: carrinho 28,5 → 3,4 ms, caixote 37,9 → 3,9 ms, ventilador 32 → 16,5 ms.
  Testes em `test/chao.test.mjs`. Aprovado pelo usuário no chat ("não teve nenhum travamento segurando o R1 pode
  integrar") na versão `f61856b`. A medida de confirmação no navegador (v0.10.8 × correção) é a execução 39684301271.
- Para outra rodada, se o ventilador ainda pesar no celular: a grade de aros finos ainda é testada inteira por raio
  (16 ms por medida no PC); dá para medir o lado dele uma vez na carga da fase.

## Entregue: modelos novos das dogs, etapa 5: o novo como padrão (PR #58, squash `401f01a`, deploy `39548092269`, v0.10.9 · build 101)

- Pedidos do usuário (2026-10-21, pelo orquestrador): "implementar o novo modelo das dogs em produção além de testar
  tudo e criar novos testes"; o plano aprovado: (1) o novo vira o padrão nas 10 fases e nas arenas, com um jeito de
  voltar ao atual (`?dogs=atual`) e sem quebrar `?dogs=novo`; (2) cascas de pelo mais leves só no celular, sem mudar
  o PC (Infinix Note 30 5G e iPhone 13, perfis de qualidade); (3) testes novos onde o novo ainda não tem cobertura,
  revisão das capturas de todas as fases e E2E `todas` no head final; (4) conferir no novo o detalhe escondido, a pose
  do cocô com corcunda e a irmã dando espaço (sem citar o detalhe em textos visíveis); (5) e, pedido seguinte: "Também
  gostaria de incluir essas animações: parada muito tempo, coçar, xixi agachada, sentar e deitar" (no novo com
  certeza; no atual se der; nada atravessa o chão e a irmã dá espaço). A franja das orelhas em close e morder o
  volante do registro entram se couberem.
- Feito até aqui (PR #58):
  - (1) `main.js` usa o modelo novo; `?dogs=atual` volta ao anterior; o painel do canil e o README apontam para o
    padrão; o E2E `canil` confere o padrão e o `?dogs=atual` (`19a6abf`).
  - (2) Pelo no celular: `quality.furShellsFor` (10 cascas no PC, 6 no celular e no tablet; o mesmo comprimento, 40%
    menos malha de pelo), `createDogV2(kind, { shells })`, teste em `test/dogV2.test.mjs` (`d3c3ac3`). Medido em Node:
    a animação do novo custa 0,163 ms por quadro para as duas (o atual, 0,105); a malha é do mesmo tamanho.
  - (5) Parada por muito tempo (`src/game/idle.js`, poses em `dogAnimation.js`, a poça em `feedback.js`): deita
    depois de um tempo (a cabeça descansa nas patas depois) e, às vezes, faz xixi agachada antes de sentar; qualquer
    movimento a levanta. Testes em `test/parada.test.mjs` e nos casos de `test/dogV2.test.mjs` (nada passa do chão nos
    dois modelos); capturas 60–63 (`d64de82`).
  - Rodada de retorno do usuário (2026-10-21, com dois vídeos de cachorros se coçando): xixi mais raro (12% das
    paradas, um a cada 4 min por dog, nunca logo depois do da irmã); depois dele ela anda até a poça, cheira e senta em
    outro lugar, andando (caminhos curva-reta-curva em `walkPath.js`, que agora também guarda os da voltinha do cocô);
    as irmãs fora de compasso (tempos sorteados por dog a cada parada; sentar sozinha de 4 a 8,5 s; uma não deita junto
    com a outra). Conferido nas 10 fases (3 sementes cada): a sequência inteira, sem colisor, sem encostar na irmã
    (≥ 0,63 m entre os centros) e ela continua sentada depois.
  - CI de `f22fa89` reprovado nos testes da companheira do #57 ("andando em loop"): o xixi sorteado tirava a irmã do
    lugar no meio da medida. Corrigido no jogo (sem xixi com o Fica nem esperando uma irmã que ela não alcança; o lugar
    novo fica a até 1,25 m da irmã) e nos testes (o headless e o E2E desligam o xixi sorteado; `test/parada.test.mjs`
    liga e confere, com teste novo do Fica e da espera). Os testes do #57 não mudaram (`b24a1cd`). Rodados com o xixi
    ligado, só caíam onde o próprio xixi mexe em alguém (a volta depois dele, a da irmã ou a da líder), e um caso
    mostrou um defeito de verdade: a companheira sentava de costas para a irmã e a IA a virava no lugar (girando
    parada e levantando). Agora, com a irmã por perto, ela termina de frente para ela; nas 10 fases e arenas
    (4 sorteios cada, xixi ligado) nenhuma levantou nem girou depois de sentar.
  - Coçar: DESLIGADO a pedido do usuário ("Não precisa mais ter a animação de coçar, pode deixar de fora, outro dia
    refinamos isso"; `IDLE.scratch.on`). A pose entregue em `3124772` ficou como estava (só no sandbox). Para a próxima
    vez: ele achou a perna "torta, parece quebrado" (o joelho esticava ao contrário). Na anatomia do cão, para a pata
    chegar ao pescoço, a coxa sobe junto às costelas (o quadril dobra muito), o joelho fica para cima e para trás, a
    canela vai para a frente até o jarrete (perto do cotovelo) e o pé sobe; o "joelho para a frente" dos vídeos é o
    jarrete. No modelo, sentada, o pescoço fica a ~0,31 m do quadril e a perna inteira tem ~0,285 m: a pata só chega à
    lateral do pescoço com a perna quase esticada ou com o pescoço descendo até ela; com o quadril muito dobrado, a pele
    da parte de dentro da coxa do modelo novo estica como uma vela. Vídeos e quadros só na máquina do usuário.
- Aprovado pelo usuário no chat ("pode integrar") na versão `769af34`, com CI e E2E `todas` (39545473391) verdes;
  integrado e publicado (`version.json` v0.10.9 · build 101, commit `401f01a`). Na captura do E2E da fase 1, a
  Rhaenyra espera sentada no portão fechado (o lugar alcançável mais perto), já no modelo novo.
- Depois: as páginas das capturas também desligam o xixi sorteado (`page-guard.mjs`, `QUIET_IDLE_SCRIPT`).
- Pendências da etapa 5 para outra rodada: a coceira (desligada, ver acima); a franja das orelhas em close e morder o
  volante do registro (não couberam).

## Entregue: irmã que segue sem loop quando não alcança a outra (PR #57, squash `54a7116`)

- Retorno do usuário (2026-10-20): "quando estamos em um lugar parado em que a irmã não consegue alcançar, a
  inteligência artificial dela fica bugada, andando em círculos ou com comportamentos estranhos em looping". A imagem
  é da **despensa da fase 10** (os caixotes da escadinha na frente do armário alto), não da fase 5.
- Causa: sem nenhum nó à vista da líder, `findPath` usava "os dois nós mais próximos" sem conferir o último trecho e
  dava o alvo como alcançável; a companheira batia no obstáculo, a detecção de "presa" forçava o grafo, ela voltava
  ao nó e tentava de novo. A despensa só tem um nó (`D_mid`) e os caixotes mudam de lugar.
- Feito:
  - `navigation.js`: `ctx.approach` (só a companheira seguindo a irmã) só dá como alcançável o que ela enxerga, com a
    posição da irmã assentada no círculo dela (`settleGoal`). Onde o grafo não resolve (nenhum nó vê a irmã, ou ela
    mesma isolada num cantinho), busca local em grade (`gridSearch`: 15 cm, até 7 m, cache por `worldKey`) acha o
    caminho ou o lugar alcançável mais perto. Atrás de restrição do puzzle (portão, ponte, irrigador), espera no nó do
    grafo, como antes (`playthrough.mjs` confere isso na fase 1). Arestas sem restrição que passam por dentro de um
    dinâmico que não é bicho (caixote, ventilador, escada) saem do Dijkstra enquanto ele está lá (`edgeBlocked`).
    Bichos ficam fora da `worldKey`, mas ocupam a grade: `syncNpcs` tira do cache as células em volta de onde cada um
    estava e de onde está e esvazia as buscas guardadas (revisão do Codex no #57). O lugar de espera fica a 0,85 m da
    irmã ou mais (`WAIT_MIN`). O modo antigo (gansa, comemoração, testes) não mudou.
  - `companion.js`: `watchProgress`. 3 s tentando sem chegar 0,2 m mais perto da irmã → `block` (espera no lugar
    mais perto a que chegou); 1,2 s sem chegar ao ponto de espera → `settle` (espera onde está). Os dois se desfazem
    quando a irmã sai 0,5 m do lugar ou a `worldKey` muda; bicho no caminho → tenta de novo em 2,5 s (nos dois; o
    `settle` ganhou isso na revisão). Pontos da grade (`id: 'grade'`) chegam a 15 cm antes de largar. Chegando por um
    caminho, para quando falta menos que `FOLLOW_STOP` (retorno do usuário na 1ª prévia: o caminho da grade termina
    colado na irmã, e as duas ficavam com os corpos uma dentro da outra no pé da escadinha).
- Testes: `test/companheira.test.mjs` (casos do retorno e sorteio com semente em todas as fases e arenas: na janela
  final, ≤ 0,45 m andados, ≤ 1 rad de giro e ≥ 0,7 m entre os centros quando nada as separa; bicho entrando e saindo
  de um corredor estreito; espera com bicho tenta de novo, com móvel não); `test/navegacao.test.mjs` (nós livres e plano da companheira sem
  atravessar os colisores dos puzzles; achados: ventilador da fase 9 em `J_mid–J_south`, trilho do ventilador da
  arena do bafo em `W_fan–W_mid`).
- Validação: CI `39530112422` (1º commit): testes da companheira verdes, 2 falhas do teste novo do grafo, corrigidas
  no 2º commit. Reprodução: CI `39530573875` rodou só `companheira.test.mjs` sobre o código antigo (branch temporário,
  já apagado): 4 casos falham com o loop (despensa: 7,1 m andados e 33 rad de giro em 5 s, 0,47 m de deslocamento
  líquido; sofá, cercadinho e mesa parecidos). 1ª prévia (`ff7b11c`, sobre o main com o #55): CI `39533171242` e E2E
  `todas` `39533166415` verdes; o usuário viu as duas coladas e o Codex achou os bichos no cache. Correções em
  `d312674`: CI `39535652405` e E2E `todas` `39535648210` verdes, as duas conversas da revisão respondidas e
  resolvidas. Conferir no PR o CI e o E2E do commit que traz esta atualização. No PC, só `node --check` e
  `git diff --check`.
- Integrado ao main (squash `54a7116`) pela sessão da irmã; conferir no GitHub o deploy e o `version.json`.

## Entregue: interações de verdade, molejo na curva e pulo (PR #55, squash `1c61405`, deploy `39532803952`)

- Pedidos do usuário (2026-10-20, ao aprovar a prévia do #48): "o botão do ventilador, as dogs poderiam de fato
  apertar o botão"; "as cordas do portão elas de fato poderiam colocar na boca e puxar, sempre respeitando a física e
  o realismo"; "dar um pouco mais de molejo, pouca coisa: quando andar e virar, a cabeça também vira, o tronco… ficar
  mais natural"; e "deixa o pulo mais fluido, hoje está muito travado e duro, sem deixar aquele bug de quando
  aterrissar o dog fica com as patas presas".
- 1ª prévia (`637fcbe`, CI `39507380599` e E2E `todas` `39507375922` verdes), retorno do usuário: "não senti o
  molejo"; o pulo "ainda está meio duro, pulando reto, esticado"; no botão, "o cachorro é meio que puxado para frente
  do botão, como se tivesse sendo arrastado, ou como se tivesse um ímã"; e "nas cordas ficou ok, mas poderia ser
  melhor: o player puxar ela; pro gerador, puxar 2 vezes até ligar; e pros portões… o player controla o cachorro até
  abrir. No caso da fase 10, abrir pro lado da corda talvez, sem que atrapalhe nada".
- Feito (2ª rodada; o branch está sincronizado com o main `196bf63`, que tem o #56):
  - Ir até a coisa andando (`src/game/mechanics/mouthTug.js`, `planStep`/`driveStep`): a trava pede o passo
    (`lock.move`) e o núcleo anda com o controle e a colisão de sempre (`game.js`); ela vira de frente e para; passou
    um tiquinho do ponto, dá uns passinhos de ré (`intent.back` no `steer`). Antes era um deslize roteirizado.
  - Puxar de ré: mordendo, a trava tem `pull` (o eixo, da corda para ela) e o direcional para longe puxa de ré, de
    frente para a corda; para perto, dá folga; o E solta (`lock.letGo`). As patas andam ao contrário (`anim.back`,
    `st.backK` no `dogAnimation.js`).
  - Fase 1: a cordinha presa na ponta do portão (a argola gira junto, `world/props.js`); puxando, o trinco levanta
    (8 cm) e o portão vem junto até 28%; puxou 42 cm, ela solta e ele termina de abrir no embalo; soltou antes, ele
    volta. O brinquedo de corda deixa de ser colisor quando o portão abre.
  - Fase 10: o portãozinho pende na face do lado do quintal e abre para lá, para o lado da cordinha (`layout.js`
    `GATE`, `world/fences.js`); aberto, fica rente à cerca ao sul do vão (longe da gansa, da trepadeira e do painel;
    a dog que puxa fica fora do giro e quem estiver no caminho dá um pulinho para fora, `sweepExit`). Puxando, o
    ferrolho solta e ele vem junto até 30%; puxou 38 cm, termina de abrir. O gerador: puxou 24 cm, a cordinha corre e
    o motor tenta; no primeiro puxão engasga (a cordinha recolhe, ela solta, dica "puxe de novo"), no segundo pega.
  - Fase 9: ela anda até a frente do botão do ventilador e aperta com a pata (`lock.move`; a pata chega a menos de
    1 cm do alto dele, com a colisão e a cabeça que desvia).
  - Pulo encolhido: as dianteiras dobram já na decolagem, no meio as quatro dobradas (0,55–0,72 do comprimento de
    pé) e as costas arredondadas; descendo, as dianteiras desdobram e pousam primeiro, as traseiras dobradas até o fim;
    sem perna esticada para baixo.
  - Molejo: o corpo tem inércia no giro (`st.dev`, movida pelas mudanças do giro, mola ω 13): andando e virando 90°, o
    tronco fica até 11° atrás do corpo e, ao parar de virar, passa 6–7° e assenta em meio segundo; a cabeça vai na
    frente. Girando parada, bem menos (a cabeça perto da parede não entra).
  - Testes: `test/interacoes.test.mjs` (andar sem deslizar, a boca a até 5 cm da corda, a corda na boca puxando de ré
    com passos das patas, o portão junto, a alça fora do gerador, a curva e o pulo), fases 1, 9 e 10 com o puxão de
    ré e os dois puxões do gerador; E2E `playthrough`, `test-toque` (joystick), `test-quintal` e `capture-quintal`
    puxando.
- 2ª prévia (`b73ab0a`, CI `39518610795`; E2E `todas` `39518510410` no `2e84872`, o mesmo código), retorno do
  usuário: "o resto funcionou perfeitamente", mas três pontos: o pulo "parecendo pulo de coelho, pulando com as duas
  patas" (quer inclinar o corpo, as dianteiras subindo primeiro, o impulso das traseiras; pousar com as dianteiras e
  depois as traseiras, natural e fluido); na fase 10, a área do puzzle da despensa "não me deixa passar pro outro
  lado"; na fase 5, "o pulo está atravessando a caixa, as patas traseiras às vezes boa parte do corpo" e "as almofadas
  da caixa quebrada não têm colisão, as dogs ficam atravessando".
- Feito (3ª rodada):
  - Pulo de quadrúpede (`dogAnimation.js`): decolando, o corpo gira sobre o quadril (`jTake`, a frente sobe primeiro)
    e as traseiras ficam empurrando o chão; descendo, gira sobre os ombros (`jFall`) e as dianteiras pousam primeiro;
    pousada, a garupa desce depois (`landFall`, ~0,1 s). O giro do corpo inteiro no ar saiu.
  - Despensa (fase 10): o colisor dos sacos de farinha do #53 fechava a passagem ao sul dos caixotes; o trilho
    começa em `x0 = -6,25` (era -6,5).
  - Pulo por cima do que dá para pular (`collision.js`, `dogController.js`, `game.js`): o desenho fica acima do alto
    da coisa em que o tronco entra (`jumpableUnder`, sobe depressa) e, passada ela, cai com a gravidade do pulo; o
    pouso (a pose, o som e a poeira) espera o desenho chegar ao chão. Descendo, abaixo do alto da coisa, o que ela
    ainda não tem embaixo do corpo é sólido de lado (`opts.lowY`/`over`): ela bate na lateral em vez de entrar. Com o
    arco acabando em cima de uma caixa (de 0,8 m, a garupa ficava sobre ela e a colisão a jogava meio metro para fora
    num quadro), ela segue no ar até sair de cima (`JUMP_CLEAR`, 0,3 s; `clearsAhead` simula com as paredes) ou,
    com o batente da porta no caminho, escorrega de cima pelo lado mais perto, com 16 cm de folga para as dianteiras
    esticadas (`slideOff`, `SLIDE_ROOM`). O portãozinho da fase 5 ganhou o alto (0,42 m) no colisor.
  - Almofadas (fase 5): a caixa achatada, as abas e as almofadas espalhadas são chão de pisar (`walkable`); o chão
    acompanha o que muda de lugar (`userData.moving`, `ground.js`). Inteira, o tampo (0,42 m) passa de `GROUND_MAX` e
    não conta.
  - Testes: `test/fase5.test.mjs` (pulos de 0,3 a 1 m e de viés na porta: o corpo desenhado acima da caixa, sem
    empurrão de mais de 7 cm num quadro, pouso fora dela e com o som na hora em que o desenho chega; as almofadas como
    chão, também com a caixa empurrada; falha sem a correção); na mesma fase, os modelos de verdade (o atual e o
    novo) espelhando o jogo headless quadro a quadro, com a pele medida contra as duas caixas da porta em nove pulos:
    no ar, nada entra (só o focinho do atual encosta 0,9 cm na beira ao decolar rente à caixa; com o código da 2ª
    prévia, entrava de 3 a 26 cm); `test/interacoes.test.mjs` (a frente sobe primeiro na decolagem e a garupa desce
    depois do pouso) e `test/fase10.test.mjs` (as duas chegam às alças da despensa).
- 3ª prévia (`f949714`, CI `39525880259`, E2E `todas` `39525903344` verdes), retorno do usuário: "o resto ficou bom",
  mas: na fase 10, "diminuir um pouco as caixas, fica muito perto da parede, às vezes buga e não dá pra terminar de
  puxar", e puxando para trás "as patas não se mexem, o cachorro fica deslizando"; na fase 5, nada atravessa mais a
  caixa, "porém o pulo dá um boost e parece que tá voando" (diminuir a caixa, largura e altura) e o pulo "ainda não tá
  fluido" (as patas saindo do chão uma antes da outra).
- Feito (4ª rodada):
  - Caixotes da despensa (fase 10): menores (`hx` 0,22, `hz` 0,15) e a marca 12 cm para dentro da frente do armário
    (`x1 = CUPBOARD.x - 0,12`): no fim do puxão ela fica a 11–13 cm da parede leste. A alça agora usa o `mouthTug`
    das cordinhas (`crateTug`): no E ela anda até a alça chegando pelo leste (`start({ yaw })`), morde e o jogador
    puxa de ré pelo núcleo (as patas andam de ré; antes a fase mudava o `c.x` direto e a animação ficava parada).
    `pullSpeed` 0,6 m/s (`start({ speed })`). O `info` mantém `crateHold` (o caixote) e ganhou `crateTug` (a fase).
  - `mouthTug`: soltando (`let`), a trava sai (ela anda e troca de dog na hora; a corda só termina de voltar no
    desenho). Antes, o Q logo depois de travar um caixote era ignorado.
  - Barricada (fase 5): as duas caixas com 0,5 × 0,5 m e 0,32 m de alto (eram 0,6 e 0,42) e a porta da cozinha com
    1 m (`WALL_HK.gap` ±0,5): continua fechada pelas duas.
  - Pulo por cima de coisa (`dogController.fitJump`, logo depois de `startJump`): olha o caminho; havendo o que ela
    pula pela frente, o arco estica (até 1,25× o tempo, a coisa no meio dele) e sobe (até 1,25× a altura) o quanto o
    tronco precisa, numa parábola só (`c.jumpH`). No desenho (`game.js`): passada a coisa, o corpo cai já com a
    velocidade do arco (antes partia do repouso, ficava para trás e parecia planar); a subida do chão desenhado ficou
    mais suave.
  - Decolagem e patas (`game.js`, `dogAnimation.js`): o corpo desenhado acelera para cima no empurrão (0,12 s, o arco
    da colisão sai na hora); a pose do pulo entra mais depressa; as traseiras ficam no chão empurrando já no primeiro
    quadro; uma pata de cada par vai na frente (`JUMP_LAG`, `st.jLead`, troca a cada pulo): a outra dianteira sai do
    chão um tiquinho depois e, no pouso, chega depois da outra; a garupa desce um pouco mais devagar.
  - Medidas: na fase 5, de 0,2 a 0,6 m da caixa o desenho fica no arco (só sobe na decolagem rente à caixa) e pousa
    com ele; de 0,8 m, uns 3 quadros depois; de 1 m ou mais (pulou cedo demais) ainda segue no ar um pouco. No modelo
    atual, as patas saem do chão e pousam em quadros diferentes; no novo, a diferença é menor (a locomoção dele).
  - Testes: `test/fase10.test.mjs` (puxando, ela anda de ré com as patas, e termina longe da parede); `test/fase5.test.mjs`
    (a partida passa pela porta mais estreita por dentro da cozinha; pulos e pele com as caixas novas).
- Validação: CI e E2E (`todas`) do commit desta rodada: conferir no PR #55. No PC, diagnósticos leves em Node e
  testes dos arquivos afetados durante o trabalho; a bateria fica no CI.
- Fica para depois (não é do pulo): encostada de viés numa caixa, uma pata ou a ponta da orelha passa um pouco da
  face dela (o corpo é mais largo que os círculos da colisão nas pontas).
- 4ª prévia (`1fcd4b1`, CI `39530179741`, E2E `todas` `39530176729` verdes): o usuário aprovou ("Aprovado!").
  Integrado: squash `1c61405`, CI do main `39532679914`, deploy `39532803952` liberado; produção em v0.10.7 · build 99
  (`version.json` conferido). Não repetir merge/deploy do #55.

## Entregue: superbafo pelos dutos sai na boca, na altura dela (fases 10 e 4) (PR #56, squash `196bf63`, deploy `39518235787`)

- Pedido do usuário (2026-10-20, logo depois de aprovar o #54): fase 10, "quando o bafo sai do cano, o efeito de
  fumaça acaba saindo na parte de baixo, quando deveria sair na ponta do cano que está do lado do pombo"; fase 4, o duto
  que leva o superbafo aos pombos "tem a saída muito baixa em comparação com onde está o pombo".
- Causa: o cheiro (`src/game/mechanics/scent.js`) só tinha x e z; a nuvem e a poeirinha da saída (`scent:exit`, a
  30 cm) eram desenhadas no chão. Na fase 10, a saída do cano era o x/z do pombo (embaixo do deque) e o puzzle apagava a
  nuvem na hora: só a poeirinha aparecia, no chão; o `outletPuff` do cano não desenhava nada, e a boca de trompete
  estava ao contrário (a beira larga encostada no cano). Na fase 4, a caixa da saída ficava a 0,5 m e o pombo a 1,27 m.
- Feito:
  - `scent.js`: `outlet.y` (altura da boca); a nuvem sai com `y` e `exitAge` e fica lá em cima; acima de 0,8 m passa
    por cima dos colisores, do vento e das bocas do chão, e o `near` (o "eca" da Rhaenyra) não a alcança do chão;
    `scent:exit` traz `y` e a direção; a prévia da mira também leva `y` (o anel da saída fica na boca).
  - `scentView.js`: a nuvem fica na altura dela (a bolha do meio na altura da boca) e, saindo de um duto, nasce do
    tamanho da boca e cresce em 0,4 s. `feedback.js`: a poeirinha sai na boca, soprada para fora.
  - Fase 10: `TUBE.mouth` e `TUBE.outlet` no layout (a beira larga da boca, na altura do peito do pombo, soprando para
    ele); o cano chega deitado numa curva e a boca de trompete foi desvirada (a beira larga para o pombo). A nuvem não
    é mais apagada: sai da boca, envolve o pombo e se espalha lá em cima. Saiu o `outletPuff`, que não fazia nada.
  - Fase 4: `DUCT.outlet.y` no peito do pombo do poleiro A (`PERCH_A.y + 0,15`); o tubo cruza a mureta nessa altura
    e entra pelas costas da caixa da saída, num pé de ferro acima das dogs. O colisor `duto-saida` virou o do pé.
- Testes: `test/saida-dos-dutos.test.mjs` (a mecânica, o desenho, o cenário real das duas fases e as duas partidas
  em Node). Capturas novas: `21a`, `21c` e `21d` (`capture-quintal.mjs`), `12` a `15` (`capture-pigeons.mjs`). Revisadas
  no E2E do `46e6a01`: a fumaça nasce na beira larga da boca do cano, lá em cima, e envolve o pombo; na fase 4, sai da
  caixa alta direto no pombo, na altura dele.
- Não mexido: a fase 9 (a saída fica dentro do armário e o cenário desenha a baforada na grade) e a Arena do Bafo
  (fase de desenvolvimento, com a caixa baixa de antes).
- Validação: CI `39510626848` verde no código de `46e6a01` (573 testes, 0 falhas); E2E `fase4` e `quintal` e os do
  head final registrados no PR. No PC, só `node --check` e `git diff --check`.
- Integrado ao main com a aprovação do usuário (squash `196bf63`, deploy `39518235787`): produção em v0.10.6 · build 98
  (conferido pelo orquestrador).

## Entregue: o balde da fase 10 (colisão das duas, alça, pose lá dentro e pulos do deque) (PR #54, squash `3bd1b7b`, deploy `39507237110`)

- Pedido (seguimento do #53): o colisor do balde-elevador (`fase10/puzzle.js`) deixava a Rhaenyra entrar 18,8 cm no
  balde deitado, pela boca e por cima da alça (CI `39476688055`). Retornos do usuário nas prévias: 1ª (`a7574d8`), "a
  colisão da Rhaenyra está ok", mas a Radhija atravessava o balde e a câmera (zona `casa-na-arvore`) deixava o balde no
  rodapé da tela, atrás do botão; 2ª (`36177f7`), "as colisões funcionaram", mas a alça ficava para fora da boca, com a
  corda na frente da entrada; deitada lá dentro, a cabeça vazava; e o pulo para o deque atravessava o balde; 3ª
  (`bf15bbd`), "ficou bom", mas com o balde virando as pernas dela atravessavam o balde.
- Feito (`fase10/puzzle.js`, `layout.js`, `world/treehouse.js`):
  - Colisor do balde para as duas (`fitBucketCol`): caixa do tamanho dele visto de cima, do fundo até a boca, enquanto
    ele está deitado ou levantando; quase em pé, o círculo da boca. Só desliga quando o fundo passa da cabeça da
    Rhaenyra. Com a Radhija lá dentro, vale só para a Rhaenyra (ativa no balde, ela não tem trava, para a troca
    continuar valendo; a colisão a empurraria a cada quadro).
  - A Radhija entra só pela boca (`atMouth`, `BUCKET.mouthR`); de lado ou por trás, o E dá a dica `bucketMouth`.
  - A alça fica presa em orelhas um pouco abaixo da borda e aponta para a roldana (`layoutRope`): deitado, por cima do
    balde; puxando, gira com ele. A corda desce por cima do balde, longe da boca.
  - Achado: a pose do balde (`rideSeq`) nunca chegava à animação, e ela ficava sentada no balde deitado (a cabeça
    passava do teto). Agora fica deitada de barriga (`slide`), a `RIDE_IN` do meio, virada como entrou (`rideYaw`).
    A posição dela (`ridePos`) fica no espaço do balde e gira com ele: deitada perto da boca, na parede de baixo, até
    a metade do giro; depois vai para o meio, senta (`SIT_TILT`) e desce até `RIDE_SIT` acima do fundo. Antes era
    uma reta no mundo, e no meio do giro as patas de trás passavam pela parede.
  - Os pulos do deque usam o `hopStep` (agacha, salta com a pose de pulo e pousa): a saída, sentada, sobe por cima da
    borda; a volta salta até em cima do balde e desce sentada. `DECK_PATH.arrive` foi para 50 cm da beira do deque.
  - Câmera: zona `balde-no-chao` (o olhar sobe 0,5 m, em vez de 1,2 m, na volta do balde).
  - A exceção `balde` saiu da auditoria (`test/colisao-cenario.test.mjs`); ela passa a conferir também o balde da
    fase 8, que tinha o mesmo nome.
- Testes (`test/fase10.test.mjs`): o desenho real (`buildLevelWorld`) contra o colisor, com o `findLooseObstacles` do
  #53, para as duas, em 9 pontos da corda, e as duas livres a 3 cm do balde deitado; deitado, nada do balde nem da
  corda na frente da boca; a Radhija esbarra de lado, por trás e na boca, entra só pela boca, fica quieta lá dentro,
  sai sem tranco e aparece acima do botão na tela; os modelos de verdade (atual e novo), com a pose do jogo quadro a
  quadro: deitada e com o balde virando (corda puxada devagar, com paradas), a pele cabe nele; nos pulos do deque, não
  cruza a parede abaixo da borda. Medidas no CI `39503913840`: deitada, 2,6 cm (atual) e 0,9 cm (novo) para dentro;
  virando, 1,6 cm e 0,9 cm; nos pulos, de 3,0 a 4,7 cm da parede.
- Branch atualizado com o main `38f5677` (#48: peito e garupa na colisão, cabeça que desvia). Validação: CI, prévia e
  E2E `todas` do head final registrados no PR #54. No PC, só `node --check` e `git diff --check`.
- Integrado ao main com a aprovação do usuário (squash `3bd1b7b`); a publicação (`39507237110`) foi liberada pela
  sessão do balde: conferir o deploy e o `version.json` (previsto v0.10.5 · build 97).

## Entregue: modelos novos das dogs, etapa 4 de 5: colisão do corpo e da cabeça (PR #48, squash `38f5677`, deploy `39496742933`)

- Plano aprovado: o peito e a garupa na colisão (dois círculos) e a cabeça que desvia, sem mudar o gating dos puzzles.
  Pedidos do usuário para esta etapa (2026-10-20): "diminuir um pouco a velocidade da Radhija, ela está andando muito
  rápido"; "analisar a arrancada: a pata traseira acaba ficando tempo demais no chão e esticando a perna de um jeito
  estranho"; e, no meio do trabalho, "essa mecânica de empurrar poderia usar uma animação parecida com aquela de
  empurrar em pé... ela empurraria com as patas, andando apenas em duas patas traseiras; resolveria essa colisão".
- Feito (PR #48):
  - Radhija a 2,1 m/s (era 2,4; a Rhaenyra continua a 2,0): `src/dogs/config.js`.
  - Arrancada (`src/dogs/v2/gait.js`): o ritmo do guia demora uns décimos de segundo para acompanhar a aceleração do
    controle (12–16 m/s²) e a pata de trás ia até o limite (~11 cm atrás, perna reta) e era arrastada. Agora, acelerando,
    o compasso e o apoio já são os da velocidade de agora e as fases das patas convergem depressa; a traseira dá um
    passo de conforto antes de a perna esticar. Achado no diagnóstico do CI (cada passo registra por que saiu,
    `leg.why`): andando a 2 m/s o trote tem duas patas ou mais no ar em 92–99% dos quadros, então o passo extra e o de
    conforto agora saem com até duas outras no ar, e um passo fora do ritmo recomeça a fase da pata (senão o apoio
    seguinte ficava longo e a pata ia até 17 cm atrás). Medido no CI `7972bf6`: arrancada até 9,4 cm atrás (perna até
    0,94, nada arrastado). Teste novo em `test/locomocao.test.mjs`.
  - Teste instável do main ("ao parar, as patas assentam…", do #43; caiu no E2E do #51): parando de repente, o corpo
    sobe um tiquinho e a pata no limite era arrastada 4 mm por quadro; agora dá o passinho de ajuste na hora. O teste
    roda com 8 sementes.
  - Corpo na colisão (`world.resolveBody` em `src/game/collision.js`, chamado pelo `integrate`): peito e garupa em
    círculos menores que o do meio (`DOG_CONFIG[nome].body`); os vãos não mudam e, de frente para a parede, ela para
    uns 3 cm antes. Vale para os dois modelos (é o jogo). Testes em `test/colisao.test.mjs`.
  - Empurrando caixote ou carrinho de pé (`dogAnimation.js`, os dois modelos): a pose do empurrão em pé, patas da
    frente na face (ou em cima, se é baixo), andando nas traseiras; a Radhija fazendo força também fica de pé e
    patina no lugar. O núcleo manda `pushGap`/`pushTop`/`pushY` (`game.js` `pushFace`). Testes em
    `test/empurrao.test.mjs`.
  - Cabeça que desvia (`src/dogs/v2/head.js`, só o modelo novo, primeira camada de `LAYERS`): com o mundo da fase
    (`d.setWorld`), o desenho freia antes de uma parede (aos poucos, até o focinho encostar) e a cabeça vira
    farejando; raspando de lado, gira para fora. A locomoção não trata o recuo como esteira. Testes em
    `test/cabeca.test.mjs`; sandbox `wall=<m>`/`crate=<altura>` e capturas `45-parede`, `46-empurrando-de-pe`,
    `47-empurrando-cesto`, `48-forca-de-pe`.
- 1ª prévia (`94579d0`), retorno do usuário: "a pata fica distante do objeto, no ar"; "alguns botões e cenários os
  personagens atravessam, é como se só existisse a colisão do chão"; "segurando o direcional antes de a animação
  acabar, as patas ficam presas"; "o círculo branco está muito forte". Corrigido:
  - as patas apoiam no desenho do objeto empurrado, medido por raios (`src/game/pushRest.js`: face, beirada e altura
    das patas, pulando frestas); o colisor dos empurráveis leva o desenho (`visual`). No carrinho da fase 1 a caixa
    passa 6 cm das pontas e a beirada (37,5 cm) fica abaixo das patas: agora elas vão em cima dela;
  - coisas baixas de pisar (placas, pedais e botões do chão, marcadas com `userData.walkable`) viram chão
    (`src/game/ground.js`): o objeto da dog sobe (suave) e, no modelo novo, cada pata pisa em cima (chão por pata no
    `gait.js`; a correção do chão do corpo vai até a pata mais baixa). Marcadas: fase 2 (tábua), fase 3 (pedras),
    fase 6 (pedal e placa da cancela), fase 9 (botão do registro) e Arena dos Porquinhos (botão);
  - andando, as poses de ação que acabaram saem 2,6× mais depressa (as patas não ficam presas);
  - o anel da dog ativa ficou fino e discreto (`src/fx/feedback.js`).
  Testes em `test/chao.test.mjs` (cenário real de cada fase). CI `39458897060` (509 testes) e E2E `todas`
  `39460483667` verdes no código de `3b2520b`.
- Pedidos do mesmo retorno que ficam para depois do #48 (combinados com o usuário): animações de interação de verdade
  (a corda do portão presa na boca, fechar o registro mordendo o volante) e, parada muito tempo, coçar de olhinho
  fechado e xixi agachada (fêmea), além de sentar e deitar; pegar e largar objetos em todas as fases foi feito na
  sessão própria `pegar-largar` (PR #52, já no main).
- 2ª prévia (`8f27f1a`), retorno do usuário: muitos objetos sem colisão (vasos, a madeira do portão da fase 2, o
  irrigador, as caminhas, a tábua de passar, sabonetes, a bandeja da fase 6) e o biscoito da caminha da fase 8
  confundido com os colecionáveis: com a sessão própria "Colisão e acabamento do cenário" (branch
  `claude/colisao-cenario`), menos as caminhas. Aqui (commit seguinte a `8f27f1a`):
  - "quando se pula, no pouso, ou segurando o Shift e soltando com o direcional, as patas ainda ficam presas no chão":
    a pose do pulo também sai 2,6× mais depressa andando (e lamber, escorregar e reverência), a locomoção do modelo
    novo assume com a pose quase fora (peso 0,9) e a traseira correndo dá o passo mesmo com as outras três no ar.
    Medido em Node: o primeiro passo sai 0,08 s depois do pouso (era 0,33 s) e 0,15 s depois de soltar o Shift (era
    0,27 s); a traseira apoiada com a perna reta, 0 quadros (eram 3 a 5). Teste novo em `test/locomocao.test.mjs`;
  - "poderia ter um aviso dizendo que é pesado para ela, e só a irmã consegue empurrar": a dica de cada fase só saía
    no primeiro toque, por 3,4 s; agora o núcleo (`game.js`, `HEAVY_HINT`) mostra "Pesado demais para a Radhija: só a
    Rhaenyra consegue empurrar! Troque (Q) e segure Shift." enquanto ela faz força (repete a cada 3,6 s), em todas as
    fases, sem mexer nos `puzzle.js` (área do #52). Teste em `test/empurrao.test.mjs`;
  - caminhas: na 2ª prévia (`fb551bf`, CI `39477096835` e E2E `todas` `39477101963` verdes) só a almofada virava chão
    e as dogs ainda atravessavam a borda (retorno do usuário, com imagens das fases 2 e 8: "esse ainda não foi
    arrumado"; "deve ser aplicada a todas caminhas, ou objetos com esse tipo de borda"). Medido em Node, pisar na borda
    com a pata não fica bom (arrastava 10 a 40 quadros e a pata entrava até 10 cm). Agora: nas caminhas grandes (fases
    5 e 8 e Arena dos Porquinhos), andando para a borda a dog dá um pulinho por cima (`userData.rim`,
    `ground.planRimHop`, `game.js` `hopOverRim`, `startHop`), as duas, e pousa na almofada; as pequenas (fase 2, 80 × 60
    cm com encosto de 36 cm, e Arena do Empurrão) são sólidas (colisor `caminha`); a almofada do gato (fase 9, 12 cm) é
    chão de pisar. O corpo apoia no chão embaixo das patas da frente e de trás (`bodyGround`), a pata no balanço passa
    por cima do que vem à frente e a apoiada sobe no que estiver embaixo. Medido nas caminhas reais: dois pulinhos
    (entrar e sair), dentro a 4–8 cm do meio com o corpo na almofada (10 cm), pata apoiada a 14–22 mm do chão
    embaixo dela, arrasto de 0 a 12 quadros (logo depois do pouso). Os raios do chão e do empurrar olham só malhas (as
    estrelinhas da caminha da fase 2 são sprites e quebrariam o raycast). Testes em `test/chao.test.mjs`;
  - prévia `165dcb0`, retorno do usuário: "a 2 elas contornam, a 5 e 8 ainda está com problema na borda" (as dogs
    em pé em cima dela). Causa: o jogo monta o chão logo depois de construir a fase, antes do primeiro quadro, e o
    grupo da caminha (posto no lugar dela) ainda não tinha a posição no mundo: o chão a media na origem e, no jogo,
    nem a almofada nem a borda contavam (os testes atualizavam a cena antes; reproduzido em Node com o `game.js`, o
    cenário real e teclas). Corrigido (`updateWorldMatrix` com os pais, teste que falha sem a correção) e, do lado de
    fora, a borda segura o corpo de quem está no chão (`rim: { r, t }`, `pushOffRims`, `keepOffRims`): a irmã
    empurrada ou passando rente não fica em cima dela. Medido no jogo em Node (fases 5 e 8, seis jeitos de chegar, as
    duas dogs): pulinhos para entrar e sair e, de fora, no máximo 4 quadros raspando. E2E `todas` `39484870979` do
    `165dcb0`: 21 de 22 partes verdes; a `biblioteca` falhou uma vez (o E do ventilador) e passou ao repetir
    (`39486030063`, mesmo commit);
  - empurrando de pé (retorno do usuário com o ventilador): "tem hora que encosta, tem hora que fica no ar" — um raio
    só, no meio da dog, ora pegava o cano, ora a grade, ora nada (a pata ia para a caixa de colisão, no ar). Agora são
    cinco raios na largura do peito; um pé fino só vale sem face larga ao alcance e as patas o abraçam; sem nada, o eixo
    do meio; a medida nova chega suave na pose. "Andando de duas patas, a esquerda abre demais": de pé, o joelho de
    trás ficava sem rumo (o "para a frente" da garupa inclinada apontava na direção da perna) e abria até 4,5 cm além
    da pata; agora aponta para a frente no chão. Testes novos em `test/chao.test.mjs` (o ventilador das fases 4 e 9 de
    240 posições) e `test/empurrao.test.mjs` (o joelho);
  - thread do Codex no PR ("Apply body collision after forced displacements"): os empurrões das mecânicas
    (`dogEffects`: irrigador, gansa, porcos, portão da fase 7) e a irmã cedendo espaço moviam só o círculo do meio e a
    garupa entrava na parede; agora chamam `resolveDogBody`. Teste em `test/colisao.test.mjs`.
  - Head final `1d8e00e`: CI `39492776642` e E2E `todas` `39492800353` verdes (a parte da fase 3 falhou uma vez na dica
    do cantinho e passou ao repetir, `39494273942`).
- Integrado com a aprovação do usuário ("Ta aprovado a prévia"): squash `38f5677`, CI do main `39496518317`, deploy
  `39496742933`; produção em v0.10.4 · build 96 (`version.json` conferido). Não repetir merge/deploy do #48.
- Depois: as interações de verdade (seção acima, em andamento) e a etapa 5 (troca nas 10 fases e cascas de pelo mais
  leves só no celular); fechar o registro mordendo o volante e, parada muito tempo, coçar, xixi agachada, sentar e
  deitar continuam anotados.

## Entregue: colisão dos objetos do cenário (PR #53, squash `acae42f`, deploy `39489612450`)

- Pedido do usuário (2026-10-20, na prévia do #48, pela sessão dos modelos das dogs): "muitos objetos dos mapas ainda
  permanecem sem colisão" (vasos, a madeira que atravessa o portão da fase 2, o irrigador, a bandeja da fase 6, as
  pernas da tábua de passar, a pilha da lavanderia); o biscoito da caminha da fase 8 confundia com os ossinhos.
- Feito: auditoria `test/colisao-cenario.test.mjs` (com `test/helpers/obstaculos.mjs`): monta o cenário real de cada
  fase e arena e acha desenho na altura do corpo (de 8 cm a 85% do alto da cabeça) onde o círculo de uma dog, num lugar
  livre, entra mais de 6 cm. As exceções, com motivo, ficam na lista `SEM_COLISOR` do teste (caminhas e placas viram
  chão no #48). Colisores novos nos `layout.js` das 10 fases e do superbafo; desenho ajustado onde um colisor
  atrapalharia o jogo (irrigador da fase 2 embutido no gramado, raízes da casa na árvore e pé da mangueira rentes,
  canos e frondes acima das dogs). Calço da fase 2: travado, a ponta fica por baixo da folha aberta
  (`test/helpers/interpenetra.mjs`, teste novo em `test/fase2.test.mjs`). Fase 8: a almofada em forma de osso da
  caminha virou argolinha. Navegação da companheira ajustada nas fases 2, 4 e 7.
- Testes ajustados: as dogs param diante da bandeja da fase 6 (TRAY.z + 0,55, fora do colisor), inclusive na linha
  nova do #52; `test/regressoes.test.mjs` aceita o calço a até 10 cm da linha da folha.
- Não mexido (trabalho paralelo): os arquivos do #48 e os `puzzle.js`/`puzzleKit.js`. O merge de teste com o branch do
  #48 não deu conflito de texto (ambos mexem em `fase2/3/8/world/props.js`, `fase9/world/conservatory.js` e
  `types.d.ts`); quem integrar depois sincroniza e roda o CI.
- Validação: até `7f95a34`, o CI só falhava nos 9 achados da fase 10, corrigidos em `3657884`; depois veio a
  sincronização com o main (#52). CI e E2E `todas` do head final: conferir no PR #53.
- Pendência: o balde deitado da fase 10 (colisor dinâmico em `fase10/puzzle.js`) deixa a Rhaenyra entrar uns 19 cm
  na boca dele; fica para um PR próprio.
- Integrado ao main com a aprovação do usuário, antes do #48 (squash `acae42f`, CI do main `39489396152`, deploy
  `39489612450`): produção em v0.10.3 · build 95. O #48 sincronizou com ele.

## Entregue: largar e pegar os objetos em todas as fases (PR #52, squash `8a3c743`, deploy `39473919953`)

- Pedido do usuário (2026-10-20, pela sessão dos modelos das dogs): "deveria ter a opção de largar e pegar os objetos
  em todas as fases, não somente em algumas". Com o item na boca, E larga no chão à frente quando não há outra ação ali;
  E perto pega de volta (só quem pode carregar: a pantufa e o livro, só a Rhaenyra).
- Feito: `src/game/puzzleKit.js` (`dropSpot`, `inZones`, `mouthPoint`, `FLOOR_REACH`; `createCarryItem` com `dropBy`,
  `putDown`, `floor`, `nearFloor` e `update`: o item cai da boca e pousa deitado do jeito dele, num ponto fora de
  colisores, sem nada entre a dog e ele e ao alcance dela; se algo passar por cima, ele é empurrado para fora). As 10
  fases: prompt "Largar…", objetivo "Pegue … de volta (E)", destaque no chão; largado de frente para a entrega, entrega;
  fase 6: perto da bandeja a carga volta para ela; fase 7: dentro do túnel não larga; fases 9 e 10: o livro e os enfeites
  caem num ponto seguro (antes, `world.resolve` podia jogá-los do outro lado da porta ou da cerca); fase 10: com algo na
  boca, E na frente do quadro olha o quadro. A fase 1 passou a usar `createCarryItem` (o colisor do carrinho, do PR #48,
  ficou intocado). Visual: o patinho largado fora da bacia não boia; a sombra da carga da fase 6 acompanha o chão.
  Docs: ARQUITETURA §4 (peças prontas).
- Testes: `test/pegar-largar.test.mjs` (as 10 fases, cerca, porta e cerca da horta, caixote por cima, entrega largando,
  sorteio com semente); `test/fase6.test.mjs` e o E2E `test-expresso.mjs` ajustados (E com a carga na boca, na bandeja,
  agora a devolve à bandeja; na borda da bandeja, fora do alcance dela, larga no chão sem a dica do trem). O 1º CI
  (`fab6abc`) só falhou nesse teste da borda, que ainda esperava o E sem efeito com a carga na boca. Nada rodou no PC
  além de `node --check`/`git diff --check`.
- Coordenação: o PR #48 mexe em `game.js`, colisão e modelos; este PR (#52) não toca nesses arquivos e, no
  `docs/CONTEXTO.md`, só nesta seção (acabou entrando antes do #48, que sincronizou com ele).
- Integrado ao main com a aprovação do usuário (squash `8a3c743`, deploy `39473919953`): produção em v0.10.2. Não
  repetir merge/deploy do #52.

## Entregue: E2E `lambe` intermitente — o portão da fase 7 arrastava a Radhija (PR #51, squash `0c22c48`, deploy `39443414245`)

- Sintoma: `cinco lambidas limpam a Radhija` falhava às vezes (E2E `39313770288` e `39373228456`, tentativa 1, ritmo
  0,54× e 0,47×) e o resto da fase 7 caía em cascata; 37 outras execuções passaram.
- Causa (bug do jogo, não do teste): a folha do portão abre para dentro, por cima de onde a Radhija puxa o trinco, e a
  colisão de cada quadro a arrastava junto. Onde ela terminava dependia do passo do quadro: simulando a mesma partida
  em Node, a 60 fps ela saía do lado do vão; a 30 e a 20 fps (CI lento, celular fraco), parava em (1,18; 0,7), atrás
  da folha aberta. A Rhaenyra que entra pelo vão recebia "Tem cerca no meio!" e, com o L segurado, a lambida não
  recomeçava. As capturas `05-lambe-lambe` das duas falhas mostram a folha entre as duas e a Rhaenyra sem virar.
- Correção: `createHingedGate().sweepExit(ctrl)` (a folha, abrindo, vai passar pela dog? para onde ela sai, além da
  ponta) e, na fase 7, quem está no caminho dá um pulinho assustado para lá (`effects.pushTo`, 0,3 s, olhando o
  portão). Mesmo lugar a 60, 30 e 20 fps. Teste novo em `test/fase7.test.mjs`; a partida completa em Node espera o
  pulinho antes de trocar de dog. O E2E ganhou a checagem da posição depois do portão e a do início da lambida pelo
  registro da página (aponta a causa se voltar).
- PR #51, sincronizado com o main (#47 e #50). Antes da sincronização: CI verde (o teste novo incluso), E2E `lambe`
  `39378009030` verde (32/32, ritmo 0,60×, Radhija em (2,51; 0,96) depois do portão). A validação do head final
  (CI, `lambe` em várias rodadas e `todas`) fica registrada no PR.
- Integrado ao main com a aprovação do usuário (squash `0c22c48`, deploy `39443414245`): produção em v0.10.1. Não
  repetir merge/deploy do #51.

## Entregue: versão automática do jogo, v0.10.0 (PR #50, squash `f1218f5`, deploy `39379501836`)

- Pedido do usuário (pelo orquestrador): "cada versão ser cada PR"; depois, "só pra ter um controle ali do tanto
  de mudanças que já teve": o mais simples possível, sem changelog, tags, releases nem passos manuais por PR.
  Regra curta no `AGENTS.md` e detalhes no `docs/ENTREGA.md` ("Versão do jogo"): PATCH e build automáticos pelos
  commits de primeiro pai do main; o campo `"version"` só muda em marco pedido pelo usuário. Este PR declara
  `0.10.0` (fecha a demo de 10 fases).
- Feito (PR #50): `tools/deploy/version.mjs` (cálculo e rótulos), passo no `ci.yml` (`fetch-depth: 0`,
  `GAME_VERSION_INFO`, `version.json` com version/build/pr/label), texto pequeno no canto da tela inicial
  (`src/core/version.js`, `.rr-version`) e `test/versao.test.mjs`. O `deploy.yml` não muda: ele só copia o artefato.
- Número: build = commits de primeiro pai do main (6 commits laterais de dois merges antigos não contam). Com o
  #49 e o #47 já no main (91 commits de primeiro pai: hoje `v0.1.90 · build 91`), o merge deste PR vira
  **v0.10.0 · build 92** se nada mais entrar antes (cada PR integrado antes soma 1 ao build; a versão continua 0.10.0).
- Integrado e publicado (pelo orquestrador): produção em **v0.10.0 · build 92**. Cada PR integrado depois soma 1 ao
  build (o próximo, v0.10.1 · build 93).

## Entregue: travamentos do iPhone emulado na suíte `toque` (PR #47, squash `3c41acd`, deploy `39378360338`)

- Pedido (orquestrador): investigar os travamentos intermitentes do iPhone emulado na suíte `toque` dentro do
  `todas` (PR #43, E2E `39358151432`: `test-toque.mjs:581` preso na intro; 2ª tentativa, `capture-celular.mjs:88` sem
  responder) e corrigir sem afrouxar verificações. Só ferramentas de E2E; nada em `src/`.
- Dois sintomas nos logs desde 2026-10-18. (1) "Deixa de responder": a aba nova (boot da página principal, das
  páginas extras do PC/iPhone ou de cada aparelho das capturas) para em `rr:boot:ui` com a thread principal presa
  fora do JavaScript. É o mesmo "travamento no primeiro carregamento" de ~1% documentado na ARQUITETURA §10.
  (2) "Não sai da intro": 4 vezes (`39358151432`, `39313770288`, `39303364280`, `39178028583`), sempre depois do
  `ip.reload()` do iPhone, sempre em runner AMD EPYC 7763, com `simSec` parado em ~5 s e a aba respondendo.
- Causa de (1), com pilhas nativas (gdb) em 4 travamentos (experimento `toque-diag`, E2E `39365366605` e
  `39366431425`): impasse dentro da aba. Os módulos do Vite compilam em segundo plano
  (`BackgroundResourceScriptStreamer`) no pool de threads da aba (3 vagas no runner de 4 núcleos) e esperam uma coleta
  de lixo da thread principal; a thread principal, no layout do logotipo com a fonte web carregando, espera o
  serviço de fontes (`FontServiceThread`), cuja tarefa vai para o mesmo pool, sem vaga. Navegador e GPU ociosos.
  Correção: `--disable-features=ScriptStreaming` em `tools/scripts/lib/browser.mjs`, junto com a lista do
  Playwright (o Chromium só lê o último `--disable-features`); teste em `test/e2e-runner.test.mjs`.
- (2) não se repetiu em ~75 sequências do iPhone nos experimentos (nem nas de runner EPYC 7763). Pista: nas falhas o
  `simSec` chegou a ~5 s antes de parar; nos experimentos, no mesmo ponto, fica em 0,7–1,4 s (cada quadro do iPhone
  levava 0,7–2 s, desenhando todo quadro no SwiftShader, dividindo a GPU com a página principal). Mitigação: as
  páginas do iPhone ganharam a mesma redução de desenho do harness (1 de 30 quadros, desenho real antes das
  capturas). Se voltar, o diagnóstico agora sai no prazo vencido, com os quadros de cada aba e as pilhas.
- Diagnóstico novo (fica): `hang-probe.mjs` testa se cada aba recebe quadros, lista todas as threads da GPU e das abas
  e grava pilhas nativas com gdb (só se houver gdb no job); `page-guard.mjs` imprime o diagnóstico em todo prazo
  vencido do Playwright numa página protegida. ARQUITETURA §10 atualizada.
- **PR #47.** Validação: estresse da correção (este código + um laço que repete PC e iPhones 6×, no branch descartável
  já apagado; E2E `39369177965`): 10/10 jobs verdes, 60 sequências PC+iPhone (42 em EPYC 7763) e 20 rodadas de
  capturas, sem nenhum diagnóstico; sem a correção, a mesma configuração deu 3 travamentos em 10 jobs. E2E `toque`
  verde em `ffd9cab` (`39369408152`, EPYC 7763, 98/98). O job temporário `toque-diag` já saiu do `e2e.yml`.
  Integrado ao main com a aprovação do usuário (squash `3c41acd`, deploy `39378360338`, `version.json` conferido
  pelo orquestrador). Não repetir merge/deploy do #47.
- Pendência separada (não é deste PR): a suíte `lambe` cai de vez em quando em "cinco lambidas limpam a Radhija" com
  o jogo lento (E2E `39313770288` e 1ª tentativa de `39373228456`, mesma cascata); sessão própria aberta para isso.

## Entregue: modelos novos das dogs, etapa 3 de 5: poses em camadas (PR #45, squash `b95c2b0`, deploy `39368373474`)

- Pedido do usuário (pelo orquestrador, 2026-10-20): "pode começar as etapas novas" — 3, depois 4 (colisão do corpo e
  da cabeça), depois 5 (troca nas 10 fases). Lembretes dele: pata firme, compasso calmo, nada de giro parado; mudança
  grande de estilo tende a ser reprovada (manter o jeito do modelo atual).
- Achado: as poses e extras do jogo já existem no modelo novo pela base (as do modelo atual, retarget) e ficam limpas
  no chão em todas as ações (relatório do `test/dogV2.test.mjs`); só a Rhaenyra sentada usa o giro da correção do
  chão (5,4°: no atual a garupa dela fica 2 cm dentro do chão). Por isso a etapa 3 não refaz poses que já estão
  certas: organiza o modelo novo em camadas e acrescenta o que ele faz melhor.
- Feito: camadas em ordem em `src/dogs/v2/dog.js` (`LAYERS`, pesos em `d.layers`), física de correntinhas genérica
  (`physics.js`: orelhas com os mesmos números aprovados e o rabo, firme), testes do rabo, da boca (bebendo e comendo,
  no mesmo lugar do atual) e das camadas; captura `39-rabo-parando`.
- Integrado ao main com a aprovação do usuário (squash `b95c2b0`, deploy `39368373474`). Não repetir merge/deploy do
  #45. A etapa 4 (colisão do corpo e da cabeça) segue no PR #48.

## Entregue: modelos novos das dogs, etapa 2 de 5: locomoção (PR #43, squash `ef2cb50`, deploy `39362697455`)

- Plano aprovado pelo usuário (etapas 1–5; a 1 entrou no #37). Etapa 2: locomoção própria do modelo novo em
  `src/dogs/v2/gait.js`, por cima da pose do guia (sem mexer em `dogAnimation.js`, a pedido do orquestrador): pata
  apoiada plantada no chão do mundo (sem patinar ao arrancar, frear, virar e na voltinha), balanço que prevê onde a
  pata vai pousar, pulso e jarrete que rolam e dobram, escápula acompanhando a pata, tronco que desce quando a passada
  pede alcance e passinhos de ajuste ao parar. Ritmo e pisadas continuam os do guia. Testes em
  `test/locomocao.test.mjs`; capturas novas (`32-andando`, `33-parando`, `34-curva`, `35-galope`) em
  `tools/scripts/capture-modelos.mjs`; sandbox com `stop=<s>`.
- Fila: o #43 é o último da fila; branch atualizado com o main `03dcf1d` (fase 10, #33). A fase 10 trouxe o
  agachadinho de preparo (`crouch`, só abaixa o tronco do guia: com as patas plantadas as pernas dobram junto) e
  pulinhos roteirizados (`airK` dos locks, que a locomoção trata como pulo: sai e volta) — teste das trocas cobre.
- Também: alcance da pata (estica até 4%, tronco desce até 1 cm, passo extra ou arrasto lento quando longe demais),
  compasso que acelera em curva fechada (voltinha) e volta ao do guia, pisadas (som e pegada) no pouso de cada pata,
  esteira só com a velocidade pedida, e a locomoção sai na hora no empurrão em pé e na parede. Medido no CI
  `39341264410`: a pata apoiada escorrega até 0,5 mm por quadro no passo, trote e curva e até 0,74 mm na voltinha
  (antes, presa ao corpo, vários centímetros). Capturas revisadas (E2E `canil` `39341411128`): parando assenta em
  ~0,6 s; galope estica e recolhe.
- O teste do modelo novo no empurrão (`test/empurrao.test.mjs`) comparava a subida/descida com o passo comum da
  própria dog; como o passo novo afunda menos (−5,2 mm), a referência passou a ser a do passo do guia (−7,1 mm, #41).
  A subida e a descida ainda são do guia: melhoram na etapa 3, quando o empurrão vier para as camadas do modelo novo.
- 1ª prévia reprovada: "travando tudo, quando senta do nada a pata estica, ou dependendo do movimento fica se
  tremendo toda; parece um ragdoll estranho". Causas e correções: na troca com as poses do guia, as rotações das
  patas eram misturadas (a pata afundava e a correção do chão fazia o corpo saltar): agora a mistura é dos alvos das
  juntas e, fora da locomoção pura, a pata segue a do guia; a correção do chão do corpo muda no máximo 0,5° e 2 mm por
  quadro; a pata não atravessa o chão (gira no tornozelo; também resolveu o −9,6 mm da descida do empurrão, achado
  do orquestrador); o balanço não salta (alvo contínuo, fase de cada pata suave, fim garantido). Testes com sementes
  (`test/helpers/seeded.mjs`) e o das trocas de pose.
- 2ª prévia (`0d48e63`): "na comemoração a pata fica acelerada e meio transparente, os passos são curtos; andando,
  parece que a pata é de borracha, mole demais". Agora: a comemoração inteira e a voltinha antes do cocô ficam com as
  patas do guia (as aprovadas); as dobras do pulso/jarrete/dedos voltaram às do modelo atual (antes iam até 1,8 rad no
  pulso), a pata não estica mais (era até 4%) e a escápula mexe menos; numa curva fechada o compasso acelera no máximo
  1,35× e, além disso, a pata gira com o corpo (pivô).
- 3ª prévia aprovada pelo usuário ("aprovado", versão `9a4a16a`, sobre a fase 10): integrada e publicada (squash
  `ef2cb50`, CI do main `39362616970`, deploy `39362697455`).

## Entregue: empurrão em pé, pés no chão no modelo novo (PR #41, squash `0bc887a`, deploy `39337609932`)

- Achado do orquestrador (2026-10-19): a verificação "modelo novo: nada abaixo do chão" da suíte `empurra` falhou no
  E2E do #40 (`39327090192`: −0,011 e −0,010; o limite é −0,010). O `lowest` do modelo novo é o ponto mais baixo ANTES
  da correção do chão (`src/dogs/v2/dog.js`, `settle`: acima de 4 mm ele gira/levanta o corpo); na tela nada passa de
  4 mm, mas o corpo dava um pulinho de até ~8 mm.
- Causa: ao subir e descer, a passada volta aos poucos e a dobra da pata do passo (`curl`) não diminuía junto com a
  subida do pé (o alvo de pé não levanta a pata): a ponta da pata de trás entrava no chão. Medido no modelo novo (Node,
  13 fases): antes −11,7 mm na descida; com a correção −7,3 a −8,6 mm, o mesmo nível do passo comum dele (−7,1 mm ao
  andar e parar). De pé, empurrando: −4,0 mm (só as almofadinhas). Sem a passada na descida sumiria de vez, mas as
  traseiras deslizariam 16 cm (mudaria o visual aprovado); não foi feito.
- Feito: `curl *= gaitAmp * (1 − sk)` e o alvo da pata não passa da altura de apoio (`dogAnimation.js`, sem mexer na
  comemoração do #39; `git merge-tree` com `claude/comemoracao-natural` sem conflito); teste novo com o modelo novo em
  `test/empurrao.test.mjs`; capturas: a descida no meio dela e o close da rosnadinha de perfil.
- **PR #41.** Atualizado com o main `9715ee8` (PRs #40 e #39): conferir no PR o CI, o E2E `empurra` e a prévia do
  head atual. Próximo passo: aprovação do usuário e integração; depois vêm o #42 e o #33.

## Entregue: comemoração sem giro parado (PR #39, squash `9715ee8`, deploy `39336319071`)

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
- Branch atualizado com o main `369b0ff` (PR #38, empurrão em pé: a voltinha e o empurrão convivem em
  `dogAnimation.js`/`game.js`) e depois com `1cd6647` (PR #40). E2E `todas` verde em `2c5f328` (39327099995, 2ª
  tentativa; a 1ª caiu no teste instável dos porquinhos, corrigido no #40). As 3 conversas da revisão foram
  respondidas e resolvidas.
- Integrado ao main e publicado (squash `9715ee8`, deploy `39336319071`). Não repetir merge/deploy do #39.

## Entregue: empurrão em pé da Rhaenyra (PR #38, squash `369b0ff`, deploy `39326965839`)

- Pedido do usuário (2026-10-19): a mania da Rhaenyra de empurrar, para derrubar coisas do alto. Segurar **R1 / Shift /
  Empurrar** de frente para algo empurrável no alto (árvore, mesinha, estante): ela fica de pé, empurra pelos ombros e
  patas da frente (quadril parado), rosna a cada empurrão; **3 empurrões** e o item cai do outro lado. A irmã não é
  empurrada (retorno do usuário). Arena: `?level=empurra&play`. Peças para fases: `createShoveTarget`,
  `src/world/shoveProps.js`, `puzzle.shoveSpots`/`onShove` (ARQUITETURA §6). A fase 10 (#33) usa a árvore.
- Aprovado no chat e integrado (head `07dc74a`, base `1a8fde5`); CI do main `39326868737`; produção conferida em
  `369b0ff`. Não repetir merge/deploy do #38. Campos do `anim` e quadros da pose enviados à sessão dos modelos.
- A correção seguinte do empurrão (pés no chão no modelo novo) está no PR #41.

## Entregue: os porquinhos e a Arena dos Porquinhos (PR #36, squash `1a8fde5`, deploy `39320045323`); ajuste no PR #40 (squash `1cd6647`, deploy `39332428726`)

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
- Integrado ao main com a aprovação do usuário (squash `1a8fde5`, deploy `39320045323`). Não repetir merge/deploy
  do #36. A sessão da fase 10 (PR #33) integra a partir daqui: API e receita em ARQUITETURA §7 "Porquinhos".
- Entregue, **PR #40** (squash `1cd6647`, deploy `39332428726`; branch `claude/porcos-teste-estavel`): o teste "presos no
  cercado…; saem um atrás do outro" falhou de vez em quando no CI. Um diagnóstico no CI (400 sementes) mostrou bugs
  reais no caminho dos porcos, corrigidos em `pigHerd.js`: (1) dois porcos entravam juntos no vão da porteira,
  entalavam lado a lado e ninguém saía: agora passa um de cada vez (`assignDoor`/`waitDoor`: a vez é de quem está mais
  perto do vão; quem espera fica antes dele e, colado, recua); (2) o desvio pela ponta da porteira aberta tinha os dois
  pontos a 0,28 m e o porco "chegava" nos dois sem andar, preso para sempre do lado de fora depois do sininho: agora
  ficam a 0,64 m e, já atrás da ponta, ele vai direto ao do outro lado; (3) dois porcos se empurrando focinho com
  focinho não contavam como empacados: 2,5 s sem chegar mais perto do ponto agora conta. Também: a saída que não deu
  certo em 12 s tenta de novo; na volta, dentro do cercado e longe da porta já é casa (o cantinho pode estar com
  alguém cochilando); fora há 20 s, refaz a rota. Testes: semente 191 (antes travava), 200 sorteios de saída e 100 de
  volta com o sininho, sem dois porcos no vão ao mesmo tempo; a bagunça conta os eventos no barramento.
- Entregue, **PR #42** (squash `f50db80`, deploy `39338511759`) (branch `claude/porcos-arena-estavel`, a partir do main `1cd6647`, atualizado com o main
  `0bc887a`, PR #39 e #41): o teste "arena: E pega
  o legume…; pegar de volta tira dele" falhou 1 vez em 7. Diagnóstico no CI (120 sementes): 3 falhavam ao pegar o
  milho de volta, porque os outros porquinhos estavam em volta da Radhija e um esbarrão (susto de 0,3 s) engolia o E.
  É o comportamento pedido (eles atrapalham), não bug: o teste agora tenta o E de novo depois do susto, como quem
  joga (`pickFrom`), e roda com semente (58, que falhava); o da bolinha derrubada, com o mesmo padrão, também.
  Varredura temporária no CI: 120 sementes do legume e 80 da bolinha passaram (já removida). Só mexe nos testes e no CONTEXTO.
- Entregue (**PR #46**, squash `cdabb1b`, deploy `39372958855`; Claude, 2026-10-20; branch `claude/fase10-sementes`, a partir do main `ef2cb50`): o teste dos
  porquinhos da fase 10 caiu no CI do #45 (`knocks: 0`). `test/fase10.test.mjs` passou a rodar com semente
  (`seededTest`) e ganhou uma varredura persistente (desligada; liga com `FASE10_SEMENTES`, início em
  `FASE10_SEMENTES_DE`; até ~260 partidas por processo, porque cada partida headless deixa ouvintes globais e ~430
  estouraram a memória do CI). Achados: (1) o teste punha a Radhija a 0,7 m do primeiro porco (lugar sorteado) e às
  vezes ela ficava na beirada da área deles; agora fica no meio da horta; (2) bug real no `pigHerd.js`: com a dog parada
  no cantinho entre o galpão, a cerca e a porteira aberta, o lugar de cada porco no arco caía num obstáculo e eles
  ficavam parados sem encostar (ela a salvo com a vela). Agora, com a dog parada e dentro da área, 1,2 s sem chegar
  mais perto leva o porco a ir direto encostar pelo lado dele (focinho na distância do arco, contorna a folha da
  porteira, passo de lado se empacar) e, encostado, ele fica. Varreduras no CI: porquinhos da fase 10 com 240 sementes,
  galinhas 100, botão da porta 40, e a dos porcos (200/60/10), todas verdes; desligadas no commit final.
- Entregue (**PR #44**, squash `1b93b41`, deploy `39351131808`; branch `claude/porcos-testes-semente`): "o sininho não prende
  a dog no chiqueiro" falhou no CI da fase 10. Todos os testes de modelo, rebanho e arena de `test/porcos.test.mjs`
  agora rodam com semente fixa (`seededTest`), e uma varredura de sementes (desligada por padrão; liga com
  `PORCOS_SEMENTES`) rodou no CI: 200 sementes por teste de rebanho, 60 de arena e 10 de modelo. Achados: (1) bug real
  no `pigHerd.js`: do lado de fora, no cantinho entre a folha aberta da porteira e a cerca, um porco ficava preso na
  volta com o sininho (o passo de lado era cego e o enfiava lá; e dali ele tentava atravessar a folha até o ponto do
  outro lado). Agora o passo de lado só vai para onde há lugar (cercas e folha; os outros porcos saem da frente), quem
  está atrás da folha sai primeiro pelo seu lado, e quem espera a vez abre caminho para quem a tem. (2) Só o teste: a
  distração media a distância final (o passeio pode dar a volta); agora mede quanto o porco anda. Com isso, a
  varredura passou inteira.

## Entregue: modelos novos das dogs, etapa 1 de 5 (PR #37, squash `e9e61fb`, deploy `39312448427`); etapas 2 a 5 em andamento

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

## Entregue: travamento no primeiro boot do E2E (PR #31, squash `eb1a148`)

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

## Entregue: demo de 10 fases (pedido de 2026-10-18; a última, a fase 10, no PR #33)

- Pedido do usuário: mais três fases criativas (8, 9 e 10, fechando a demo), puzzles mais complexos, **no mínimo
  dois objetos** em cada uma, a mecânica nova de **pulo na parede** da Rhaenyra (alcançar botões e alavancas no
  alto) e animações extras de interação. Entregas em sequência, um PR cada, com prévia e aprovação:
  **A** impulso na parede · **B** fase 8 "Lavanderia de Domingo" · **C** fase 9 "Biblioteca do Vovô" ·
  **D** fase 10 "Festa no Quintal" · **E** animações extras. Antes de construir cada fase, apresentar ao usuário
  cenário e objetos em poucas linhas e esperar o ok.
- **Ordem atual:** A, B, C, D e E entregues.
- **D (entregue: PR #33, squash `03dcf1d`, deploy `39357683189`): fase 10 "Festa no Quintal"**, branch
  `claude/fase10-quintal` (worktree próprio), base
  `efa779c`. Desenho aprovado pelo usuário em 2026-10-19 ("grande, complexa e a mais bonita"), com o pedido de que
  as duas fizeram **3 anos** (faixa "Feliz 3 anos", vela do número 3; o quadro mostra a festa de 2 anos). Três
  cenários: a casa em corte (sala com o quadro "Festa do ano passado", cozinha com o disjuntor), a varanda com o bolo
  e o quintal (piscininha, a Dona Gansa no portão) e o fundo (casa na árvore, horta com lama, galpão). Ordem do bolo,
  de baixo para cima: laço, vela do 3, chapéu (`CAKE_ORDER`); fora de ordem o enfeite cai ao lado da mesa e o objetivo
  manda olhar o quadro (o texto não entrega a ordem). Chapéu: caixote fora da mangueira, torneira (impulso), água
  sobe, disjuntor (impulso) liga luzinhas e ventilador, o barquinho vai até a borda. Laço: latido distrai a gansa (de
  guarda, ela não deixa puxar a cordinha), cordinha abre o portão, superbafo pelo cano de brinquedo (duto) espanta o
  pombo, a Radhija no balde e a Rhaenyra puxando a corda (segura na troca; a câmera recua pela zona `balde`), o deque
  roteirizado e o escorregador. Vela: vão da horta e lama, Lambe-Lambe, placa (só a Rhaenyra; fica lá na troca) que
  segura a porta basculante, rampa só com arrancada. Ligações visíveis com pulso de luz: conduíte do disjuntor até o
  pergolado e a tomada, cano da torneira, cabo da placa à porta, cordinha até o ferrolho (`src/world/links.js`,
  movido da fase 9). Itens novos `hat`, `ribbon`, `candle` e `rope` (pose, ícones, nomes, sons). Feito no branch:
  `src/levels/fase10/` (layout, puzzle, world/), `soundsQuintal.js`, eventos no feedback, catálogo com dez fases
  (menu 5 + 5; a 9 oferece "Próxima fase"), `test/fase10.test.mjs`, suíte E2E `quintal` e `capture-quintal.mjs`.
  Consultar o PR para SHA, CI, E2E e prévia; nada rodou no PC.
- Estado da D: **PR #33**, atualizado com o main `415bd67` (#32). O CI apontou faces coplanares, tipos e duas
  esperas nos testes (corrigidos). O primeiro E2E passava de 30 min sem log; com a grama mais aberta, as auréolas
  das luzinhas num desenho só e o ritmo medido logo no início, a suíte `quintal` roda em ~2 min (32/32) e as 66
  capturas foram revisadas (ajustados: a vela do 2 no anel do meio do quadro, o brilho do bolo aceso, o laço e a
  estante). No E2E, o E e o Q no mesmo quadro levavam o E para a outra dog: esperar o efeito do E antes do Q.
- Retorno do usuário na prévia do #33 (2026-10-19), "melhore esses pontos iniciais, depois acrescentamos mais
  coisas", e o que mudou no branch (consultar o PR para SHA, CI e E2E):
  - Câmera e quadro: sem plano automático do quadro (saíram a zona `quadro` e o plano da apresentação; fica o E na
    frente dele). Ao ligar o disjuntor, o pulso sobe até a parede do fundo, acende as luzinhas novas em volta do
    quadro (ramal do conduíte; a câmera mostra) e só depois segue para a varanda (a câmera vai para as luzinhas da
    festa). Etapas em `props.power.stage` (`house` → `painting` → `porch` → `on`), `info().quintal.powerStage`.
    `cam.focusShot` ganhou `from` opcional (de onde a câmera olha; sem ele, nada muda nas outras fases).
  - Portão: pendurado atrás dos mourões e abrindo 162°, encostado na cerca. Antes a folha aberta formava um bolsão
    com a cerca da horta e a Radhija, voltando do galpão pelo vão, ficava presa.
  - Casa na árvore ampliada (deque 3,4 × 2,35 m, tronco no canto de trás, casinha nos fundos, luneta, baú,
    bandeirinhas; balde na frente do deque, escorregador a leste). O pombo dorme no corrimão em cima do laço: plano de
    câmera e dica na primeira vez no fundo do quintal; com ele lá, o balde chega e ele bate as asas (ela fica no
    balde). Lá em cima a Radhija anda livre (`confineDeck`: corrimão, tronco, casinha, luneta e baú seguram), E
    desamarra o laço, E na boca do escorregador desce, E na abertura volta para o balde. O roteiro antigo atravessava
    o tronco.
  - Sofá com saia até o chão: o ossinho fica no vão de 42 cm atrás do encosto (só a Radhija). Antes ela passava por
    baixo de um vão de 16 cm e atravessava o assento.
  - FPS: o usuário notou FPS baixo com a GTX 1650 "inativa" (o Windows rodava o navegador na placa integrada; o jogo
    já pede `high-performance`). Na fase 10 a grama era metade dos triângulos do cenário (~250 mil de ~555 mil):
    tufos mais leves e malha um pouco mais aberta (~126 mil); peças com menos de ~9 cm não fazem sombra.
- Segunda rodada de retorno (2026-10-19), com sessões paralelas para o que não é da fase: pombo mais bonito
  (PR #34), Lambe-Lambe também na Radhija com superbafo no R2 e Lambe-Lambe no L2 (PR #35), porcos (PR #36,
  `createPigHerd` em `src/game/mechanics/pigHerd.js`) e modelos das dogs com rig (PR #37). No branch da D (consultar o
  PR #33 para SHA, CI e E2E):
  - Já validado antes: balde começa deitado (a Radhija entra pela boca), a Rhaenyra anda normal com a corda, o
    escorregador saiu da cerca, a rampa do galpão não vira de ponta-cabeça, potes de ração e água à vista,
    colisões de móveis revistas.
  - Desenho novo aprovado ("Pode ser assim"): **cinco enfeites**, `CAKE_ORDER` laço → biscoito de osso de glacê →
    vela do 3 → chapéu → estrela; o quadro da sala mostra os cinco. **Despensa** nova ao sul da cozinha com o
    **gaveteiro** (`DRAWERS`): a Rhaenyra puxa cada gaveta com a boca (E, andando para trás; `modifyIntent`) até virar
    degrau (a de baixo 0,34–0,5 m para fora, cada uma ao menos 10 cm mais para dentro; puxada além de 0,55 m cai e E
    encaixa); a Radhija sobe (E, `stepClimb`) e pega o biscoito. **Piñata** da estrela pendurada na mangueira, em
    cima da roseira (`PINATA`, pêndulo): o superbafo balança, a Rhaenyra pula e bate quando ela passa por cima, três
    batidas abrem e a estrela cai fora da roseira. **Horta e galpão maiores**, **chiqueiro** ao sul do galpão e
    **dois botões altos** na parede do galpão: um abre a porta, o outro a porteira (sorteado; `?botao=1|2` fixa).
    **Campinho** (milho, cenouras, abóboras) no quintal vazio: E colhe, E larga; o pé rebrota em 6 s. A placa de
    pressão saiu. Os porcos ainda são um marcador em `puzzle.js` (`pigs`, nada sai do chiqueiro) até o PR #36.
  - **Cinco ossinhos** na fase 10 (um no deque, `y` por ossinho em `COLLECTIBLES`, com `treats.js` e
    `createCollectibles` respeitando a altura; `test/extras.test.mjs` aceita cinco na última fase).
  - Segredo novo, **nunca citar no jogo, menu ou README**: com todos os ossinhos e o extra usado (`ctx.extrasUsed`),
    a tábua do muro leste, atrás da casa na árvore, fica frouxa; E a empurra e, no cantinho do vizinho, o quadro
    "Raniri e Radidi" (apelidos delas) com a foto real das duas (`public/img/quintal-quadro.jpg`, recortada e regravada sem
    metadados; exceção registrada no AGENTS.md). Sem texto na tela; `debugSet('secret')` para testes e capturas.
  - Testes: `test/fase10.test.mjs` refeito (partida completa com os cinco, botões, gavetas, piñata, legumes,
    tábua); `test/helpers/props.mjs` com as peças novas; E2E `quintal` e `capture-quintal.mjs` com as cenas novas.
- Prévia entregue em `55a811e` (CI ok, E2E `quintal` 48/48 e `todas` verdes, capturas revisadas). Terceira rodada
  de retorno do usuário (2026-10-19), feita no branch (consultar o PR #33 para SHA, CI e E2E):
  - Abóbora do pé do tamanho da que vai na boca; plaquinha do cantinho "Raniri e Radidi"; o plano do quadro repete a
    cada entrada.
  - Despensa: no lugar das gavetas, o armário alto (`CUPBOARD`) e **três caixotes** (`PANTRY_CRATES`, escolha do
    usuário). A Rhaenyra pega a alça (E) e anda para trás num trilho reto; na marca do chão o caixote trava sozinho e
    a marca fica verde (sem "puxar demais"). Com os três travados, a Radhija sobe pelo pé da escadinha (E).
  - Pulinhos roteirizados com preparo: `InputLock.airK` (pose de pulo) e `InputLock.crouch` (agachadinha), lidos em
    `game.js` e em `dogAnimation.js` (duas linhas; o resto é da fase). Usados na escadinha e na descida da prateleira
    do galpão (agacha na beirada antes de pular).
  - Funil do cano deitado, de boca para o sul, na altura do focinho; botões do galpão com placa branca, borda
    vermelha, plaquinha "?" e lampadinha que pisca até serem apertados; animação de comer no pote de ração (e de
    beber no de água) nos extras; dois canteiros a mais na horta; roseira com rosas; milho com folhas em fita.
  - Duas **galinhas** (`src/characters/chicken.js`, `src/levels/fase10/chickens.js`, `CHICKENS`): ciscam do lado de fora
    da cerca oeste da horta; dog chegando de frente as faz correr; por trás não; latido, esbarrão ou arrancada as faz
    voar baixinho. Sons novos (cocoricó, alarme, asas, caixote travando, piñata, colheita) em `soundsQuintal.js`.
  - Com o #35 no main: a lama da horta vale para as duas. A Rhaenyra que o jogador leva para a lama fica com as patas
    escorregadias (sem impulso na parede: `wallSpots` vazio) até a Radhija lambê-la (L); a Radhija continua se sujando
    no vão. `onLick`/`onLickMiss` seguem o modelo da fase 7 (as duas lambem). Nos testes, lamber é `KeyL`.
  - Com o #36 no main: os porquinhos ligados (`createPigHerd` no puzzle, `PIGS` com `STY_PEN = pigPenLayout(...)`,
    porteira com o mesmo ângulo do colisor, `STY.swing`). O botão errado do galpão abre o chiqueiro e eles saem para
    a horta; atrapalham, derrubam o enfeite ou o legume da boca (`knockItem`) e o legume no chão vira comida por um
    tempo (`feedPigs`; pegar de volta chama `removeFood`). `debugSet('pigsOut')` solta já fora (testes e capturas).
  - Retorno do usuário na prévia de `cefe748`: os botões quase não apareciam (ficavam na parede oeste do galpão, vista
    de lado pela câmera): agora estão num painel de madeira virado para o sul (`BUTTON_BOARD`), encostado no galpão,
    com os fios pela frestinha entre os dois. No cantinho secreto ela ficava presa (sala maior que a fresta e fora da
    vista): o nicho agora tem a largura da fresta, a tábua abre para fora e o muro leste e o nicho entram no "ver
    através". As galinhas foram para o campinho (milho e legumes) e ganharam modelo arredondado (cores por vértice,
    crista serrilhada, asas em penas) e animação (cabeça parada que dá o tranco, ciscar, planar, piscar, arrepiar).
  - Com o #38 no main: a piñata começa enroscada no galho, perto da copa da mangueira (`MANGO_SHOVE.tangled`; fora de
    alcance, o superbafo não a mexe). A Rhaenyra fica de pé de frente para o tronco e empurra (`createShoveTarget` só
    para o balanço da copa e a contagem; `shoveSpots`/`onShove` no puzzle); no 3º empurrão ela escorrega pelo galho
    (`slide`) e desce na corda (`drop`) até em cima da roseira (`free`), e daí segue o superbafo e as batidas.
    `debugSet('pinataDown')` pula a etapa. A Rhaenyra só se suja quando o jogador anda com ela na lama (parada ali na
    troca, não).
  - Ainda falta: a cabeça das dogs atravessando paredes e móveis (etapa 4 do PR #37, das sessões dos modelos).
  - Quarta rodada (prévia de `1a8562b`: CI ok, E2E `quintal` 52/52, `todas` verde em `5c56527`): com algo na boca,
    nada de pegar outro item (`take()` recusa; a rampa também).
  - Quinta rodada de retorno (2026-10-19), feita no branch (consultar o PR #33 para SHA, CI e E2E):
    - Saiu o vaso do canto da porta da varanda (`PORCH_POTS` ficou com um, no canto do fundo).
    - Empurrão na mangueira pelo **oeste** (`MANGO_SHOVE.nx = -1`, do lado da roseira, à vista da câmera); a copa
      balança para longe da dog (`setSway` segue a normal), a piñata enroscada gira junto (`swayPoint`, `pivotY`) e o
      tronco e a copa entram no "ver através".
    - O vão da horta foi para o **fundo** (`HORTA.gap` z 4,95–5,35, na altura da porteira do chiqueiro) com a lama logo
      depois (`MUD`); canteiros, tomateiro e grafo (`B_pass`, `B_strip`, `B_gap`, `H_mud`) refeitos. A cerca oeste da
      horta foi 30 cm para leste (`HORTA.x0 = 7.1`) para caber o painel na faixa ao lado da cerca branca.
    - **Rhaenyra enlameada não pula**: gancho novo do núcleo `puzzle.canJump`/`onJumpBlocked` (evento
      `dog:jumpBlocked`, ARQUITETURA §6), além do impulso já bloqueado.
    - Funil do cano: no lugar dos pés em V, um pezinho só (argola, haste e base) dentro do colisor; a plaquinha
      "FALE AQUI" foi para cima da argola.
    - Painel dos botões na faixa entre a cerca branca e a horta (`BUTTON_BOARD`, preso na cerca, virado para o sul,
      passagem de 74 cm na ponta) com luz de força, e o **gerador** (`GENERATOR`, `sty.js`): a Rhaenyra puxa a cordinha
      (E; a Radhija não tem força), ele engasga (`crank`) e pega; ligado, treme, solta fumacinha e faz "tá-tá-tá"
      (eventos `generator:pull|crank|start|hum`, sons `genPull|genCrank|genStart|genHum`). Sem ele, os botões ficam
      fora de `wallSpots` (dica `noPowerBoard`); os fios vão pelo chão até a caixinha do galpão.
    - Galinha refeita (`src/characters/chicken.js`): corpo numa malha só, sem a "bola" atrás; rabo de penas compridas
      escuras, arqueadas; crista serrilhada (extrusão); duas cores de marrom; mesma animação.
    - Testes (`fase10.test.mjs`), E2E (`test-quintal.mjs`) e capturas (`capture-quintal.mjs`) com o gerador, o vão
      novo, o empurrão pelo oeste e o pulo bloqueado.
  - Prévia da quinta rodada em `4d22f9f` (CI ok; E2E `todas` 39348516051 com a partida `quintal` ok; as duas falhas
    eram de fora: teste do empurrão herdado, corrigido no #43, e download do Chromium). Main com o #44 (`1b93b41`)
    trazido para o branch.
  - Sexta rodada de retorno (2026-10-19): o painel dos botões ficou maior (1,35 × 1,65 m) e de costas para a cerca
    branca, virado para o leste (`BUTTON_BOARD` com `x`, `z0`, `z1`; botões com `nx = 1`), com o gerador ao lado, ao
    sul; o rodapé de pedra da fachada não atravessa mais a porta da varanda e saiu o capacho (era a "mancha" no chão);
    no empurrão, as patas apoiam na casca de verdade (`MANGO_BARK`: o tronco sobe torto e afina; o colisor ficou
    rente a ela).
  - Entregue, ajuste visual pedido em 2026-10-20 (**PR #49**, squash `7737c04`, deploy `39376268869`; branch
    `claude/fase10-chao`, a partir do main `cdabb1b`): a terra da
    horta ficou seca (castanho claro, rachadinhas, torrões) e a lama, mais escura, molhada e brilhante, com a borda de
    terra úmida, respingos e um rastro de patinhas saindo dela (`ground.js`); caminho de pedras com cascalho na porta
    do galpão; o chão do chiqueiro virou barro (manchas molhadas que brilham, marcas de casco, palha) com a poça mais
    clara (`sty.js`). Só visual.
- Próximo passo da D: com o #43 no main, sincronizar, rodar CI e E2E `todas` no head final, revisar as capturas
  (painel, gerador, vão, galinha, empurrão, porta da varanda) e entregar a prévia; integrar só com a aprovação do
  usuário (squash com SHA esperado, deploy do `github-pages` dessa versão e aviso ao orquestrador).
- **C entregue (fase 9, PR #29):** squash `efa779c` no main, CI do main `39193811954`, deploy `39193868755`
  (deployment `7164861501`); `version.json` de produção conferido em `efa779c`. Não repetir merge/deploy. Feito na C: cenário em `src/levels/fase9/world/` (casa em corte com escritório,
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

## Entregue: tela cheia no iPhone (PR #25, squash `ccfaf4a`)

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
