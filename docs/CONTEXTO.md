# Contexto para retomar o projeto

Última atualização: **2026-10-18, Claude** (tetos de relógio do E2E). Ler primeiro [AGENTS.md](../AGENTS.md)
e [ENTREGA.md](ENTREGA.md); conferir Git/GitHub antes de editar.

## Em andamento: tetos de relógio no harness do E2E (Claude, 2026-10-18)

- Motivo: no E2E manual `39160265826` (suíte lavanderia, 1ª tentativa) o log parou em `load('?level=fase8&play')`
  e o job só caiu no timeout de 30 min, sem nenhum check: `page.evaluate` não tem prazo e as esperas contavam só
  tempo de jogo. Refeita, a suíte passou 12/12 em 78 s; a causa do travamento não foi identificada.
- Feito no branch `claude/e2e-teto-relogio`, **PR #27** (consultar o PR para SHA, CI e E2E):
  `tools/scripts/lib/harness.mjs` ganhou `DEFAULT_LIMITS`/`HarnessAbort`: `simSec` 60 s sem mudar (contado entre
  esperas) reprova com diagnóstico; prazo de 60 s em cada `page.evaluate`/teclado/mouse, com a página marcada como
  travada; etapas do `load()` nomeadas; `close()` com prazo. O teto max(10 s, 8× o prazo) com o jogo andando só
  encerra a espera com aviso, como antes: a 1ª versão reprovava ali e o E2E `39165419409` mostrou que fase1/fase3
  passam por esse teto depois de `ui:restart` (0,03–0,06 s de jogo em 10 s). No E2E `39166156986` (head `78c076f`)
  13 de 14 jobs passaram, mas `expresso` travou 30 min no primeiro `load('?level=fase6&play')` sem imprimir nada,
  apesar dos prazos internos: a causa continua desconhecida (processo da suíte sem rodar ou prazo do Playwright
  falhando). Por isso entraram duas redes: operação em curso além de 4 min encerra o processo da suíte
  (`opMaxMs`), e o runner (`suite-runner.mjs`) encerra de fora uma suíte 5 min calada, com o sinal do harness por
  IPC (o que estava em curso, se o processo parou de responder), carga, memória e processos. Provas em
  `tools/scripts/fixtures/harness-probe.mjs` e `test-e2e-infra.mjs` (`paced`, `slow`, `stalled`, `hung`, `stuck`,
  `mute`, `crash`). Docs: ARQUITETURA (seção do E2E) e ENTREGA.
- E2E `39169122476` (head `0f3e940`): 13 de 14 jobs ok; `expresso` reprovou em 4,5 min (antes 30) com
  "`load('?level=fase6&play'): esperar window.__game` sem retorno há 242 s": a página abriu, `window.__game` nunca
  apareceu e o prazo de 120 s do `waitForFunction` não venceu, com o processo da suíte vivo. A prova `crash`
  (E2E `39171716703`) reproduziu isso: com a aba derrubada por `chrome://crash` no meio da espera, o Playwright não
  avisou a queda, a espera ficou pendente e a página parou de responder. Hipótese mais provável para os
  travamentos reais: a aba cai no boot da fase. O harness ouve `crash`/`disconnected` (se vier o aviso) e o
  `opMaxMs` caiu para 150 s. Contagem do `expresso`: sem este PR, 7 de 7 ok nas execuções recentes; com ele,
  3 ok e 2 travamentos em 5. Não se achou mecanismo no código (nesse ponto o harness faz as mesmas chamadas da
  1ª versão, que passou); a lavanderia travou antes do PR.
- Nenhum teste ou build no PC (só `node --check` e `git diff --check`). Próximo passo: CI e E2E `todas` verdes no
  head do PR, entregar e aguardar aprovação. Os PRs #24 e #26 recebem os tetos ao atualizar a base.

## Em andamento: demo de 10 fases (pedido de 2026-10-18)

- Pedido do usuário: mais três fases criativas (8, 9 e 10, fechando a demo), puzzles mais complexos, **no mínimo
  dois objetos** em cada uma, a mecânica nova de **pulo na parede** da Rhaenyra (alcançar botões e alavancas no
  alto) e animações extras de interação. Entregas em sequência, um PR cada, com prévia e aprovação:
  **A** impulso na parede · **B** fase 8 "Lavanderia de Domingo" · **C** fase 9 "Biblioteca do Vovô" ·
  **D** fase 10 "Festa no Quintal" · **E** animações extras. Antes de construir cada fase, apresentar ao usuário
  cenário e objetos em poucas linhas e esperar o ok.
- **A (em andamento, Claude):** branch `claude/pulo-parede` (worktree próprio), **PR #23**, com o main do #22
  (`1fbc631`) integrado. Consultar o PR para SHA, CI, E2E e prévia; nenhum teste ou build rodou no PC.
  Feito: `pickWallSpot`/`startWallJump`/`integrateWall` em `dogController.js` (roteiro de 1,05 s, toque no alto em
  52%, volta 0,32 m afastada, sempre com colisão); `game.js` troca o pulo pelo impulso quando a fase oferece um
  ponto (`puzzle.wallSpots`) e avisa o toque (`puzzle.onWallTouch`, `wall:touch`); pose em `dogAnimation.js`
  (corpo de pé girando no quadril, IK com alvos na parede, pata no botão, carinha feliz); `createWallButton`
  (botão com tempo e anel de luzes, alavanca, "uma vez") e `buildWallButton` (placa, botão de cogumelo ou
  alavanca de bolinha, patinhas pintadas); sons `soundsParede.js`; parede de treino na Arena do Pulo (botão abre a
  portinhola do armarinho por 6 s, alavanca liga as luzinhas). Testes: `test/parede.test.mjs` (escolha do ponto,
  roteiro, pose no modelo real, botão/alavanca, arena com pausa/troca/reinício) e a suíte E2E `pulo`, com as
  capturas `tools/scripts/capture-parede.mjs` (quadro a quadro, qualidade completa).
- Próximo passo: CI verde, E2E `pulo` e revisão das capturas `shots/parede-revisao/` contra o padrão das fases
  4 a 7; ajustar a pose se preciso; conferir o botão de pulo de toque (o impulso usa o mesmo `Jump`); entregar a
  prévia (`?level=pulo&play`) e aguardar aprovação. Em seguida, apresentar o desenho da fase 8.

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
