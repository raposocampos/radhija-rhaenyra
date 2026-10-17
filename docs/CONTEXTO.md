# Contexto para retomar o projeto

Última atualização: 2026-10-17. Agente: Codex.

Leia primeiro `AGENTS.md`, na raiz, para as regras de entrega, testes e
privacidade. Este documento registra o andamento compartilhado com o Claude.

## Onde paramos

**PR #1 aprovado pelo usuário, integrado e publicado em produção.** O usuário
confirmou no chat que testou a prévia e aprovou a publicação no link principal.
Não há aprovação de produção pendente para esta entrega.

- PR: https://github.com/raposocampos/radhija-rhaenyra/pull/1.
- Head aprovado: `e219af7662f5db22196a7aace79deeca63fd861e`.
- Merge squash no main: `e85b927954f38430b26b5680324a88614bc2e416`.
  A árvore integrada foi comparada à aprovada: nenhum arquivo diferente.
- [CI do main 39002906594](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39002906594):
  tipos, 116 testes e build aprovados.
- [Publicação 39002937318](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39002937318):
  disparada automaticamente por workflow_run, aguardou a aprovação do ambiente
  github-pages, foi liberada com a autorização do chat e terminou com sucesso.
- Produção: https://raposocampos.github.io/radhija-rhaenyra/.
  HTML, JavaScript e CSS HTTP 200; version.json confirmou o commit e85b927 e
  o CI 39002906594. A prévia aprovada também permanece acessível.
- E2E controle: 46 verificações, zero falhas e nenhum erro de console na
  [execução 39001905192](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39001905192),
  em d53b8d4. Código do jogo e testes não mudaram depois desse commit.

O fluxo de AGENTS.md/CLAUDE.md está no main: PR, CI, prévia, aprovação humana
explícita e publicação no mesmo link. Nenhum teste ou build foi executado no PC.
Main exige PR atualizado e checks testes-e-build/publicar-site, inclusive para
admins. Produção exige revisão no ambiente github-pages e só permite main.

A exceção delivery-bootstrap (policy 63342097) foi removida do ambiente preview,
que agora aceita somente main. O branch bootstrap permanece bloqueado como
registro: não integrá-lo nem reutilizá-lo. O publicador confiável do main já
assumiu o fluxo. pages-state continua sendo um branch órfão só de estáticos.
A brecha apontada na revisão foi corrigida antes da aprovação: CI de PR só tem
leitura; publicação usa código do main e trata o artefato somente como dados.

O usuário solicitou salvar este registro pós-publicação por PR para encerrar a
pendência local antes de continuar com o Claude. Esta entrega é somente de
documentação; o código do jogo permanece igual ao aprovado no PR #1.
Registro: [PR #2](https://github.com/raposocampos/radhija-rhaenyra/pull/2), branch
`codex/contexto-publicacao`, commit inicial `43cd9baaf39088d503decc016e5657ce29e0d77f`.
Esse commit passou no [CI 39004558716](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39004558716)
e na [publicação da prévia 39004583094](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39004583094).
Ao retomar, conferir o head atual, o merge e os checks no PR #2; as validações
citadas não aprovam antecipadamente commits posteriores. Não criar novos commits
apenas para atualizar o status do próprio registro. A autorização desta entrega
documental não dispensa prévia e aprovação para futuras mudanças no jogo.

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
3. PR #1 concluído e publicado; não repetir seu merge/deploy. O registro da
   entrega também segue por PR documental, conforme pedido explícito do usuário.
   Não há autorização para instalar ai-memory neste projeto.
4. Ao receber uma tarefa, atualizar este documento com o novo objetivo e,
   durante a execução, manter um ponto de retomada útil ao outro agente.
