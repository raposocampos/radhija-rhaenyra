# Contexto para retomar o projeto

Última atualização: 2026-10-17. Agente: Codex.

Leia primeiro `AGENTS.md`, na raiz, para as regras de entrega, testes e
privacidade. Este documento registra o andamento compartilhado com o Claude.

## EST-04 — progresso validado (2026-10-17, Codex)

Implementado no [PR #7](https://github.com/raposocampos/radhija-rhaenyra/pull/7),
branch `codex/progresso-validado`, worktree isolado `progresso-validado`.
Após a publicação aprovada de #8, incorporada por merge normal a base
`d38574a54d1203a3f7d71dd26541167d93819db3`, sem rebase ou force push.
Objetivo deste marco: revalidar o progresso junto da correção do menu.

- Escopo próprio: `src/ui/progress.js`, `test/progress.test.mjs`, este contexto
  e reconciliação do plano, delegada pelo coordenador nesta rodada. Código
  de progresso e seus 19 testes permanecem iguais ao head anterior; CSS e
  teste de controle vêm integralmente do #8 já publicado.
- Formato e chave v1 mantidos, sem migração necessária. Validação rejeita
  arrays/estruturas incompatíveis e normaliza os campos inválidos de cada
  fase sem apagar suas marcas válidas. Contagens exigem inteiros seguros
  não negativos; tempos exigem números finitos não negativos, sem coerção.
  Petiscos anteriores são preservados; total conhecido nunca fica abaixo
  da coleta. IDs de fases desconhecidas e chaves como `__proto__` permanecem
  propriedades próprias, sem modificar o protótipo do mapa.
- Política de versão: qualquer versão declarada diferente de 1 fica intacta
  no storage. A partida usa uma cópia v1 vazia em memória; vitórias e reset
  não sobrescrevem esse formato desconhecido. A gravação relê a versão para
  detectar alteração por outra aba e retorna booleano; vitória retorna `saved`.
- Falha de leitura impede gravação sobre conteúdo desconhecido; quota/falha
  de escrita preserva o save anterior e não interrompe a partida. JSON
  corrompido pode ser substituído por um novo save válido ao concluir fase.
- Regressões cobrem saves v1, fases desconhecidas, arrays, strings, números
  inválidos, recordes, releitura entre abas, versões futuras, falhas de
  storage e isolamento das prévias. No head anterior `8f974e1`, base
  `b1b026e`, [CI 39058245437](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39058245437)
  aprovou tipos, 145 testes e build; [E2E fase1 39058252168](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39058252168)
  passou 61 verificações, sem erros de console. Essas evidências não validam
  o novo merge. Revisão independente da implementação sem bloqueios.
- Próximo passo: enviar o merge e acompanhar CI/prévia e E2E `fase1` e
  `controle` no GitHub no mesmo head final. Neste checkpoint, as novas
  execuções ainda não foram iniciadas; conferir os resultados pelo SHA e
  atualizar o PR, sem commit apenas de status. Nenhum teste/build local.
  Apresentar a nova versão e aguardar sua aprovação antes de integrar #7.

## Onde paramos

**Menu publicado; progresso e carregamento em revalidação.** Em 2026-10-17,
o usuário aprovou a versão `8494143` do PR #8 e pediu atualizar/validar os
PRs #7 e #10 em seguida. EST-09 foi integrado e publicado em `d38574a`.
Dois executores incorporam essa base em EST-04 (progresso) e EST-03
(carregamento), cada um em seu worktree. Planejamento da próxima fase foi
revisado em paralelo, sem tema aprovado nem nova fase implementada. Testes
continuam no GitHub; #7 e #10 exigem aprovação própria da nova versão.

Plano e critérios: [PLANO-ESTABILIZACAO.md](PLANO-ESTABILIZACAO.md).
O coordenador usa branch `codex/menu-jogar-visivel`, worktree
`menu-jogar-visivel`, base `b1b026e29abb7cc80fff6a13224e967d78415151`.
EST-09: conflito entre a animação de entrada `rr-rise` e a de foco
`rr-focus-pulse` reiniciava a entrada com opacidade zero ao sair do botão.
Reprodução em `7a05466de2f3d605139ef2b8f7336b0925a8824b`,
[E2E 39057998118](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39057998118):
56 verificações passaram e quatro falharam pelo motivo esperado, opacidade
zero ao descer por teclado/D-pad/analógico e ao retornar ao mouse.
Correção: excluir Jogar apenas da animação de pulso do foco; entrada, halo e
anel de seleção permanecem. Revisão independente sem bloqueios. O teste
amostra estilos dentro do navegador, para não perder a falha entre leituras.
No head aprovado `8494143bbe918bb804c05bb115ff1e7770aaef7c`,
[CI 39058279947](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39058279947)
passou tipos, 126 testes e build; [E2E controle 39058279323](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39058279323)
passou 60 verificações, sem erros de console, com opacidade mínima 1 nos
sete cenários. O usuário aprovou essa prévia. Squash
`d38574a54d1203a3f7d71dd26541167d93819db3` tem árvore idêntica ao head
aprovado e ao merge sintético `196f108`, conferidos independentemente.
[CI main 39060437829](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39060437829)
aprovou tipos, 126 testes e build Vite 6.4.4; [deploy 39060461084](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39060461084)
concluiu após liberação do deployment `7144319080` com a aprovação do chat.
Produção HTTP 200 e `version.json` confirmou head/commit `d38574a`, run
`39060437829`, tentativa 1. Nenhum teste/build local; não repetir publicação.

- EST-01: executor Codex em `codex/estabilidade-e2e`, worktree
  `estabilidade-e2e`; implementado no [PR #6](https://github.com/raposocampos/radhija-rhaenyra/pull/6),
  head `6ebacd999da6bd36249cd76ef3e90a319752b666`.
  Harness e runner agora reprovam erros do navegador, falhas e resumo ausente;
  as provas com Chromium confirmam a propagação até o processo final. O smoke
  serve somente `dist`, abre as cinco fases e confere imports e recursos.
  [CI 39052841286](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052841286)
  aprovado: tipos, 126 testes rápidos e build. [Prévia](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-6/39052841286-1/)
  publicada, com head/base conferidos em `version.json`.
  [E2E completo 39052837420](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052837420)
  aprovado no mesmo head: nove suítes, 299 verificações de gameplay, quatro
  provas de propagação de erro e 19 verificações do build estático, sem erros
  de console. Capturas da fase 4 concluídas, com `errors: []` no log.
  A [revisão de fluxo](https://github.com/raposocampos/radhija-rhaenyra/pull/6#discussion_r4303596789)
  foi atendida e a conversa resolvida: navegador fica no `E2E manual`, na opção
  `todas`; o CI obrigatório mantém tipos/testes rápidos/build. O smoke testa
  um build próprio da execução E2E, distinto do artefato da prévia. O usuário
  aprovou essa versão no chat; integrada por squash em
  `9fcce7505e75d3080d9c2529c76ea97b7fa72a90`.
  [CI do main 39053762821](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053762821)
  aprovado. [Deploy 39053794991](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053794991)
  concluído com sucesso após liberação com essa aprovação. Produção respondeu
  HTTP 200 e `version.json` confirmou `9fcce75` e CI `39053762821`.
- EST-02: executor Codex em `codex/atualizar-vite`, worktree
  `atualizar-vite`; Vite 6.4.4 implementado no [PR #5](https://github.com/raposocampos/radhija-rhaenyra/pull/5),
  head aprovado `3f9540248b33b78b1cc43aa834352901ef3ec457`, após merge normal da
  base `9fcce7505e75d3080d9c2529c76ea97b7fa72a90`, sem force push. Nenhuma
  dependência transitiva mudou; auditoria do lockfile continua sem avisos.
  A versão segue o [aviso oficial GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22):
  `6.4.4` corrige o acesso indevido fora de `server.fs.allow`, ainda presente
  até `6.4.3`. A evidência é a versão corrigida e a auditoria do lockfile;
  não foi executada prova de exploração. A atualização usou apenas
  `--package-lock-only --ignore-scripts`, sem testes/build locais. O servidor
  de desenvolvimento continua em `127.0.0.1` e produção serve arquivos estáticos.
  O head anterior `4f03e38` passou CI `39051377056` e E2E `39051384592`
  (123 testes rápidos e 299 verificações de gameplay), mas esses resultados
  não validam a nova combinação. No head atual, [CI 39053902153](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053902153)
  aprovou tipos, 126 testes rápidos e build. [Prévia](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-5/39053902153-1/)
  publicada, HTTP 200 e head/base conferidos em `version.json`.
  [E2E completo 39053897305](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39053897305)
  aprovado no mesmo head: 299 verificações nas nove partidas, quatro provas
  de infraestrutura e 19 verificações do smoke, sem erros de console. Capturas
  da fase 4 concluídas, com `errors: []`. O usuário aprovou explicitamente
  integrar e publicar o PR #5 no chat. Integrado por squash em
  `18629a0e3877cc6c56201f5a12b3048feb1514e9`, com árvore idêntica ao head aprovado,
  confirmada por revisão independente. [CI do main 39056035625](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39056035625)
  aprovado: tipos, 126 testes rápidos e build Vite 6.4.4.
  [Deploy 39056064315](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39056064315)
  concluído com sucesso usando essa aprovação. Produção HTTP 200 e
  `version.json` confirmou `18629a0` e execução `39056035625`.
- EST-00: [PR #4](https://github.com/raposocampos/radhija-rhaenyra/pull/4)
  aprovado pelo usuário no head `2fcbca3` e integrado por squash em
  `b1b026e29abb7cc80fff6a13224e967d78415151`.
  [CI main 39057715283](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39057715283)
  e [deploy 39057744110](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39057744110)
  concluídos com sucesso. Produção HTTP 200 e `version.json` conferido no
  squash e CI acima. Primeira etapa (#6, #5, #4) integrada e publicada.
- EST-03: [PR #10](https://github.com/raposocampos/radhija-rhaenyra/pull/10), executor
  em `codex/recuperacao-carregamento`, worktree `recuperacao-carregamento`,
  incorporando `d38574a` para revalidação. Head anterior `6da8d31`, base
  `b1b026e`: CI `39058785550` tentativa 2 aprovou 134 testes; E2E completo
  `39058783617` aprovou 299 verificações de gameplay, quatro de infraestrutura,
  19 do smoke e 28 de recuperação, sem erros inesperados. Não atribuir esses
  resultados ao novo merge. Dono do núcleo,
  inicialização, UI de erro, cortina, testes de carregamento e acréscimo
  isolado ao E2E manual. Não alterar regras de foco nem teste de controle.
- EST-04: [PR #7](https://github.com/raposocampos/radhija-rhaenyra/pull/7), executor
  em `codex/progresso-validado`, worktree `progresso-validado`, revalidando
  a base `d38574a` conforme checkpoint acima. Dono de `src/ui/progress.js` e testes
  próprios. Preservar saves v1 válidos; versões não suportadas não podem ser
  sobrescritas silenciosamente. Sem mudanças no menu ou núcleo.
- EST-09: publicado no #8; coordenador dono do bloco de foco em `src/ui/ui.css`
  e regressões em `test-gamepad.mjs`. Nesta rodada, o executor EST-04 é o único
  editor do plano compartilhado por delegação. O CSS de erro de EST-03 será um bloco
  próprio, sem editar essas regras. Retomadas dos executores são registradas
  no contexto de suas branches e reconciliadas na integração.
- Ordem desta rodada: EST-09 já publicado; seguem EST-04 e EST-03, cada versão
  com aprovação própria. #7 e #10 são revalidados em paralelo sobre `d38574a`;
  após eventual aprovação/merge de #7, atualizar/revalidar #10 novamente.
  EST-05 depende de EST-03; EST-06/07/08 continuam pendentes. A próxima fase pode
  ser desenhada/prototipada isoladamente. O usuário autorizou preparar uma
  proposta combinando pulo e superbafo; ela será documentada por um terceiro
  agente em `codex/proposta-fase6`, worktree `proposta-fase6`, sem código novo
  nem mudança no catálogo. Tema/objeto sugeridos ainda precisam de aprovação.

## Evidências da avaliação anterior

- Base examinada: `baa8af07e8f1e81bf03c7ec6f379c32955a2efd6`.
  O registro anterior estava desatualizado: o [PR #3](https://github.com/raposocampos/radhija-rhaenyra/pull/3)
  foi integrado. [CI 39009757588](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39009757588)
  aprovou tipos, 123 testes e build; [deploy 39009786059](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39009786059)
  terminou com sucesso. `version.json` de produção confirmou esse SHA e CI.
  Não repetir merge/deploy. Decisões dos pombos permanecem em `docs/POMBOS.md`.
- Conferidas por API as proteções do main, checks obrigatórios e revisão do
  ambiente de produção. Nenhuma proteção ou configuração alterada.
- [E2E completo 39048060825](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39048060825)
  executado no GitHub, suíte `todas`, no SHA acima: **sucesso nas nove suítes,
  299 verificações aprovadas e nenhum erro de console nos logs**. Contagens:
  bafo 12, fase4 17, regressões 9, pulo 8, controle 46, fase5 18, fase2 77,
  fase1 61 e fase3 51. Essa execução da avaliação foi concluída; não valida
  os novos commits da estabilização.
- Prioridades propostas na avaliação da base `baa8af0`:
  1. Erros inesperados de console/pageerror eram apenas registrados pelo E2E;
     faltava um teste mínimo do build estático. **Concluído em EST-01, PR #6:**
     erros agora reprovam e há um smoke do build próprio do E2E. As partidas
     de gameplay continuam usando o servidor de desenvolvimento.
  2. Recuperar estado e oferecer ação útil quando loadLevel rejeitar. Avaliar
     também abas antigas após deploy: os arquivos anteriores são removidos,
     e imports de fases sob demanda podem apontar para chunks inexistentes.
  3. Definir descarte de materiais/texturas exclusivos e propriedade dos
     recursos compartilhados; medir memória após alternar fases repetidamente.
     O descarte incompleto foi inspecionado, mas crescimento de memória não
     foi medido nesta avaliação.
  4. Fortalecer tipos entre puzzle/cenário e dublês de props: o uso de any e
     Proxy permissivo pode esconder incompatibilidades. Validar contratos reais.
  5. Validar/migrar o progresso salvo antes de ampliar conteúdo; extrair
     configurações comuns das dogs da fase1 e dividir o núcleo gradualmente.
- Consulta leve `npm audit --package-lock-only --ignore-scripts --json`:
  Vite 6.3.5 é a única dependência sinalizada, severidade agregada alta; o
  relatório indica 6.4.4 como correção sem troca de major. Os avisos consultados
  referem-se ao servidor de desenvolvimento; produção usa arquivos estáticos.
  Nenhuma dependência foi instalada ou atualizada.
- Nenhum teste, build ou partida foi executado no PC durante a avaliação.
  Inspeção local do diff e `git diff --check` sem problemas. A implementação
  de EST-01 e EST-02 agora está autorizada e usa validações próprias na nuvem.

## O que foi feito

1. **Preparação para publicação:** o trabalho do branch
   `claude/fervent-agnesi-36ed38` foi integrado ao `main`. O histórico foi
   revisado antes de publicar e a identidade pessoal dos autores foi
   substituída pela identidade pública com e-mail `noreply`. As referências
   locais antigas foram preservadas em backup local, que não deve ser enviado.
   Não foram encontradas credenciais na revisão feita naquele momento.
2. **Privacidade:** fotos de `referencias/fotos/`, configurações locais,
   credenciais e saídas de build/testes permanecem fora do Git. Isso não dispensa
   revisar novas alterações antes de publicar.
3. **CI e publicação inicial:** `.github/workflows/ci.yml` roda tipos, testes rápidos
   e build no GitHub. O fluxo antigo publicava automaticamente após sucesso no main;
   esta tarefa substitui isso por PR, prévia e aprovação para produção.
   `vite.config.js` usa `base: './'` para os caminhos do site funcionarem.
4. **E2E na nuvem:** `.github/workflows/e2e.yml` permite escolher `todas` ou uma
   suíte. Cada suíte roda numa máquina Linux do GitHub. O Chromium é instalado
   pelo Playwright; `tools/scripts/lib/browser.mjs` centraliza a configuração.
5. **Estabilidade dos E2E:** o harness usa tempo simulado e reduz o custo de
   renderização apenas no CI. Foram corrigidas esperas de comandos curtos,
   pausa/retomada da fase 1, alinhamento ao caixote da fase 2 e medição do tempo
   de curiosidade da gansa na fase 3. A redução visual dos testes não altera a
   qualidade visual da versão publicada.
6. **Instruções dos agentes:** `AGENTS.md` define o fluxo; `CLAUDE.md` o importa.
   Ambos agora direcionam o agente a este documento de contexto.
7. **Dica de empurrar:** `richText` em `src/ui/markup.js` reconhece Shift também
   fora de parênteses. A UI mostra R1 no PlayStation, RB no Xbox e Shift no
   teclado, acompanhando a troca de dispositivo com a dica já na tela.

## Validações já realizadas

- Navegação do menu, commit `b3023aa`: CI aprovado na
  [execução 38999914786](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999914786)
  e E2E `controle` aprovado na
  [execução 38999915196](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999915196).
  As 46 verificações passaram no GitHub; nenhum teste ou build local foi rodado.
- Correção da dica, commit `f925a94`: CI aprovado na
  [execução 38999413489](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999413489)
  e E2E `controle` aprovado na
  [execução 38999413926](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999413926).
  Todos os testes desta tarefa rodaram no GitHub, sem build ou partidas locais.
  Publicada em `8fe992f`, com
  [CI/deploy 38999578176](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999578176)
  aprovado e site respondendo HTTP 200.
- CI e deploy de `7c874dc`: aprovados na
  [execução 38997538477](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38997538477).
  O site respondeu HTTP 200 após essa publicação.
- A implantação inicial validou os 112 testes rápidos no GitHub. As nove
  suítes E2E somaram 280 verificações aprovadas, sem erros de console, em
  execuções sucessivas durante os ajustes. **Não foi uma única execução completa
  no mesmo commit final.** Não atribuir esses resultados a mudanças futuras.
- Referências dos E2E aprovados: fase 4, fase 5, regressões e pulo na execução
  `38990015603` (outras suítes dessa execução falharam); controle em
  `38990311359`; bafo em `38990313401`; fase 1 em `38990463878`; fase 2 em
  `38990695795`; fase 3 em `38990809581`. Os ajustes de código terminaram em
  `cd1499a`.
- Para verificar a publicação desta atualização documental ou de uma versão
  posterior, consultar o workflow do commit correspondente no
  [histórico de CI](https://github.com/raposocampos/radhija-rhaenyra/actions/workflows/ci.yml).
  Os resultados acima são evidências anteriores, não aprovação antecipada.
- Não executar testes ou build locais para atualizar este documento. Usar
  revisão do diff e `git diff --check`; deixar o CI rodar no GitHub.

## Decisões do usuário

- Pedir uma implementação inclui enviar um branch, abrir PR, acompanhar CI e
  entregar uma prévia. **Aguardar aprovação explícita para integrar e publicar
  no mesmo link principal.** O agente pode concluir as ações no GitHub usando
  essa aprovação dada no chat, sem exigir que o usuário opere o GitHub.
- Testes e build devem rodar na nuvem. Testes pesados no PC só por pedido
  explícito. E2E é separado e acionado quando necessário.
- A passagem entre Codex e Claude será por este Markdown. **ai-memory foi
  pesquisado, mas não instalado; ficou para outro projeto.**
- Usar branches/worktrees separados para trabalho simultâneo, com integração
  de PRs uma por vez. Este documento não é um bloqueio automático de edição:
  conferir atividade alheia antes de modificar arquivos ou trocar branch.

## Próximo passo para o agente que assumir

1. Ler as instruções e este resumo; conferir `git status`, branch, commits e
   estado remoto, preservando alterações existentes.
2. Se precisar confirmar a última entrega, localizar o CI pelo SHA atual no
   GitHub. Não confundir um workflow anterior aprovado com o commit atual.
3. PRs #1, #2, #3, #6, #5, #4 e #8 integrados e publicados. Produção de #8
   confirmada em `d38574a`, deploy `39060461084`; não repetir merge/deploy.
   Conferir CI/prévia e E2E dos novos heads de #7 e #10, em revalidação sobre
   essa base; não reutilizar resultados nem aprovação das versões anteriores.
   Respeitar as áreas reservadas e a ordem de integração. Não instalar ai-memory.
4. Ao receber uma tarefa, atualizar este documento com o novo objetivo e,
   durante a execução, manter um ponto de retomada útil ao outro agente.
