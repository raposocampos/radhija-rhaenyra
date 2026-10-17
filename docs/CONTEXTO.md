# Contexto para retomar o projeto

Última atualização: 2026-10-17. Agente: Codex.

Leia primeiro `AGENTS.md`, na raiz, para as regras de entrega, testes e
privacidade. Este documento registra o andamento compartilhado com o Claude.

## Onde paramos

O usuário pediu corrigir a dica de empurrar da Rhaenyra: com controle, ela
mostrava "Shift". A causa estava em `src/ui/markup.js`: `richText` só convertia
teclas entre parênteses. A correção reconhece também Shift no texto corrido,
usando o mesmo desenho adaptável da UI (R1 no PlayStation, RB no Xbox, Shift
no teclado), inclusive quando o dispositivo muda com a dica já na tela.

Implementação `f925a94` aprovada no CI e na suíte E2E `controle` (30 verificações,
incluindo três novas para a mesma dica nos três modos, sem erros de console).
Integrada ao `main` após essas validações. Esta atualização final muda apenas
o resumo; o código do jogo e os testes são os mesmos que passaram no E2E.
Ao retomar, conferir o CI/deploy do commit atual no GitHub para confirmar a
publicação. Não há ajuste de código pendente conhecido nesta tarefa.

- Jogo: https://raposocampos.github.io/radhija-rhaenyra/
- Repositório: https://github.com/raposocampos/radhija-rhaenyra
- Branch de entrega: `main`.
- Base desta atualização: `383dbe4` (passagem de contexto entre agentes).
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
3. **CI e publicação:** `.github/workflows/ci.yml` roda tipos, testes rápidos
   e build no GitHub. Após sucesso no `main`, publica no GitHub Pages.
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

## Validações já realizadas

- Correção da dica, commit `f925a94`: CI aprovado na
  [execução 38999413489](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999413489)
  e E2E `controle` aprovado na
  [execução 38999413926](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/38999413926).
  Todos os testes desta tarefa rodaram no GitHub, sem build ou partidas locais.
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

- Pedir uma implementação inclui enviar, acompanhar os testes no GitHub e
  atualizar o mesmo link, sem nova confirmação só para publicar.
- Testes e build devem rodar na nuvem. Testes pesados no PC só por pedido
  explícito. E2E é separado e acionado quando necessário.
- A passagem entre Codex e Claude será por este Markdown. **ai-memory foi
  pesquisado, mas não instalado; ficou para outro projeto.**
- Foi discutido usar branches e worktrees separados para trabalho simultâneo,
  com integração uma por vez. Também foi sugerido um único agente responsável
  pela integração, mas essa atribuição ainda não foi definida pelo usuário.
  Este documento não é um bloqueio automático de edição entre agentes.

## Próximo passo para o agente que assumir

1. Ler as instruções e este resumo; conferir `git status`, branch, commits e
   estado remoto, preservando alterações existentes.
2. Se precisar confirmar a última entrega, localizar o CI pelo SHA atual no
   GitHub. Não confundir um workflow anterior aprovado com o commit atual.
3. A correção da dica já está integrada e validada; conferir a publicação do
   commit atual e seguir o próximo pedido. Não há autorização para instalar
   ai-memory neste projeto.
4. Ao receber uma tarefa, atualizar este documento com o novo objetivo e,
   durante a execução, manter um ponto de retomada útil ao outro agente.
