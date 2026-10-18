# Contexto para retomar o projeto

Última atualização: **2026-10-18, Claude** (menu principal e modo sem dicas; fase 8). Ler primeiro [AGENTS.md](../AGENTS.md)
e [ENTREGA.md](ENTREGA.md); conferir Git/GitHub antes de editar.

## Em andamento: menu principal, Opções e modo sem dicas (pedido de 2026-10-18)

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
- Próximo passo: CI e E2E (`menu`, `toque`, `controle`, `expresso` e depois `todas`) no head do PR, revisar as
  capturas (`shots/menu/`, `shots/celular-revisao/`) e entregar a prévia. Merge só com a aprovação do usuário.

## Em andamento: demo de 10 fases (pedido de 2026-10-18)

- Pedido do usuário: mais três fases criativas (8, 9 e 10, fechando a demo), puzzles mais complexos, **no mínimo
  dois objetos** em cada uma, a mecânica nova de **pulo na parede** da Rhaenyra (alcançar botões e alavancas no
  alto) e animações extras de interação. Entregas em sequência, um PR cada, com prévia e aprovação:
  **A** impulso na parede · **B** fase 8 "Lavanderia de Domingo" · **C** fase 9 "Biblioteca do Vovô" ·
  **D** fase 10 "Festa no Quintal" · **E** animações extras. Antes de construir cada fase, apresentar ao usuário
  cenário e objetos em poucas linhas e esperar o ok.
- **E (escopo ampliado pelo usuário, 2026-10-18):** as animações extras e o segredo combinado valem nas **10 fases**,
  cada fase com animações do próprio cenário; o segredo só depois de pegar todos os ossinhos da fase (todas têm 3).
  O usuário aceitou um registro técnico discreto nos docs (resposta de 2026-10-18); nada no jogo, no README ou na
  tela de controles.
- **B (aprovada, integrando; Claude):** fase 8 "Lavanderia de Domingo", PR #24, branch `claude/fase8-lavanderia`
  (worktree próprio), base `09ed23a`. Nenhum teste ou build rodou no PC. Desenho aprovado pelo usuário: a meia
  listrada presa com pregador no varal elétrico de teto (botão alto → o varal desce por 6 s; só o tranco da arrancada
  da Radhija solta a meia) e a mantinha em cima da máquina (o cesto de rodinhas na frente da máquina + botão de
  centrifugar → ela cai no cesto; sem o cesto cai no chão e volta ao cesto com E; o cesto empurrado até a caminha a
  entrega e estaciona ao lado). Entra direto na campanha (`LEVELS`, oito fases, 4 + 4 no menu); a meia é um item
  novo (`sock`: pose de boca, ícone, nome, som, modelo em `toys.js`). `createPushCrate` ganhou `freeze()`.
  Testes: `test/fase8.test.mjs`, catálogo com oito fases, suíte E2E `lavanderia` e capturas
  `tools/scripts/capture-lavanderia.mjs`.
- Validação do código em `5b97413`: CI `39160268932` verde, prévia publicada, E2E `todas` `39160265826` com sucesso
  (na 1ª tentativa a partida `lavanderia` travou logo após carregar a fase e caiu no limite de 30 min; refeita, passou
  12/12). O usuário aprovou a versão `1faefbd`, mas o main avançou (#25, tela cheia no iPhone): merge do main no
  branch sem conflitos; pelo AGENTS.md, CI/prévia novos e nova aprovação antes de integrar.
- Pendência registrada: no CI, os prazos do harness E2E contam tempo de jogo (`deadline`, `gsleep`, `waitFor`). Se o
  jogo congelar, eles nunca vencem e o job só cai no limite de 30 min. Vale um prazo de relógio como teto (entrega
  própria, fora do #24).
- Próximo passo do #24: com a nova aprovação, merge squash com SHA esperado, CI do main, liberar o deploy e conferir
  `version.json`.
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
  porta, a mola fecha de novo, a Radhija segura a porta com o Fica e a Rhaenyra traz o livro.
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
