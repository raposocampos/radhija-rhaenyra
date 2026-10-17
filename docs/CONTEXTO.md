# Contexto para retomar o projeto

Última atualização: 2026-10-17. Agente: Codex.

Leia primeiro `AGENTS.md`, na raiz, para as regras de entrega, testes e
privacidade. Este documento registra o andamento compartilhado com o Claude.

## Onde paramos

Implementando PRs com CI obrigatório, prévia jogável e aprovação humana antes
da publicação. **A autorização antiga de publicar automaticamente foi
substituída pelo usuário. Não integrar este PR nem aprovar produção sem ele
testar a prévia e aprovar explicitamente.**

Branch: `codex/prs-ci-previas`, base de produção `f457844`. As alterações neste
branch atualizam CI, instruções, documentação e template de PR; adicionam
montagem do site com prévias, quatro testes de regressão e separação dos saves
e volume por PR. Ao retomar, localizar o PR desse branch e conferir os checks
do head atual. Nenhum teste ou build foi executado no PC.

A implementação `d53b8d4` passou nos 116 testes, tipos, build e publicação de
prévia na [execução 39001850255](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39001850255).
O HTML e os assets da produção foram preservados (diff do estado estático vazio
fora de previews/.nojekyll; HTML público com o mesmo SHA-256). Prévia e assets
responderam HTTP 200, e `version.json` confirmou head/base/execução esperados.
O E2E `controle` foi disparado no mesmo código na
[execução 39001905192](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39001905192);
estava em andamento nesta atualização documental. Conferir o resultado real.
Esta atualização muda apenas o resumo; conferir também o CI do seu commit.
Cada novo CI gera outra URL, então usar o deployment mais recente do PR.

Configurações já aplicadas no servidor: main exige PR atualizado, checks
`testes-e-build` e `publicar-site`, incluindo admins; ambiente `github-pages`
exige aprovação de `raposocampos` e branch main. Ambiente `preview` permite
`refs/pull/*/merge`. `pages-state` foi inicializado com os arquivos da produção
`f457844` (artefato da execução `39000135800`); o HTML coincide com o site atual.
É um branch órfão só de estáticos: nunca integrar ao main.

PR: https://github.com/raposocampos/radhija-rhaenyra/pull/1.
Próximo passo: conferir CI e E2E deste PR, entregar a prévia mais recente e
aguardar aprovação. Depois seguir `docs/ENTREGA.md`. Não afirmar que a nova
política já está integrada ao main: os arquivos aguardam aprovação no PR,
embora as proteções no servidor já estejam ativas.

- Jogo: https://raposocampos.github.io/radhija-rhaenyra/
- Repositório: https://github.com/raposocampos/radhija-rhaenyra
- Branch de entrega: `codex/prs-ci-previas` → PR → aprovação → `main`.
- Base desta atualização: `f457844` (dica e navegação corrigidas e publicadas).
- No início desta tarefa, a árvore estava limpa e `main` sincronizado com
  `origin/main`. Conferir novamente ao retomar; isso é um registro histórico.

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
3. A navegação do menu já está integrada e validada. O trabalho atual é o PR de
   CI e prévias, aguardando validação e aprovação conforme o topo deste resumo.
   Não há autorização para instalar ai-memory neste projeto.
4. Ao receber uma tarefa, atualizar este documento com o novo objetivo e,
   durante a execução, manter um ponto de retomada útil ao outro agente.
