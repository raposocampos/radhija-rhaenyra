# Contexto para retomar o projeto

Última atualização: **2026-10-20, Claude** (travamento das abas no carregamento do E2E, PR #47; #33 a #46 e #49 já no main). Ler primeiro [AGENTS.md](../AGENTS.md)
e [ENTREGA.md](ENTREGA.md); conferir Git/GitHub antes de editar.

## Em andamento: E2E `lambe` intermitente — o portão da fase 7 arrastava a Radhija (Claude, branch `claude/lambe-e2e-intermitente`)

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
- Próximo passo: CI do PR, várias rodadas do E2E `lambe` e uma do `todas`; prévia e aprovação do usuário.

## Em andamento: versão automática do jogo, v0.10.0 (Claude, branch `claude/versao-automatica`, 2026-10-20)

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
- Próximo passo: CI e prévia do head sincronizado (canto: `prévia PR #50 · sobre v0.1.90`), aprovação do usuário;
  depois do merge, conferir `version.json` e o menu em produção.

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
  - Entregue: ajuste visual pedido em 2026-10-20 (PR #49, squash `7737c04`, deploy liberado pela sessão da fase 10;
    branch `claude/fase10-chao`, a partir do main `cdabb1b`): a terra da
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
