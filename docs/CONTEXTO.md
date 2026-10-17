# Contexto para retomar o projeto

Última atualização: 2026-10-17. Agente: Codex.

Leia primeiro `AGENTS.md`, na raiz, para as regras de entrega, testes e
privacidade. Este documento registra o andamento compartilhado com o Claude.

## Onde paramos

**Modelagem dos pombos concluída no PR #3; produção ainda não autorizada.**
Branch `codex/pombos-organicos`, worktree isolado `pombos-organicos`.
Objetivo: silhuetas orgânicas e reconhecíveis, preservando o estilo fofo,
as animações, a jogabilidade e o desempenho.

- Retomada conferida: PR #2 integrado no main `3e826e48f9eac644681b718470f9d75f6e207de5`.
  [CI 39004801467](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39004801467)
  e [publicação 39004826940](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39004826940)
  concluídos com sucesso. PR #1 também está integrado; não repetir esses merges.
- Pesquisa de Cornell/Macaulay Library e RSPB documentada em `docs/POMBOS.md`.
  As fotografias foram consultadas, não incorporadas ao repositório.
- Implementado em `src/world/pigeon.js`: corpo em gota, pescoço contínuo,
  cabeça e olhos laterais, asas com duas barras, cauda em penas e pés suaves.
  Os quatro pombos compartilham a fábrica. Lógica da fase não foi alterada.
- Ferramenta de comparação em `tools/pigeon-review.html` e
  `tools/scripts/*pigeons*` / `tools/scripts/pigeon-review-scene.mjs`.
  E2E fase4 passa a gerar capturas comparativas e métricas no GitHub.
- [PR #3](https://github.com/raposocampos/radhija-rhaenyra/pull/3), primeiro head
  `85d91bd859e39c0bc93cdd31cf3dc9efd3b1ac75`: tipos, 116 testes e build passaram
  no [CI 39005534435](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39005534435).
  A prévia passou na [publicação 39005553543](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39005553543).
  [E2E 39005533740](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39005533740):
  17 verificações aprovadas, sem erros de console; capturas antes/depois de
  silhuetas, sono, espiada e voo inspecionadas, além do cochilo no cenário real.
- Custo medido: 25 → 13 meshes e 3.020 → 4.740 triângulos por pombo;
  na cena de estudo, 29 → 17 chamadas de desenho em três quartos. Não é um
  benchmark de FPS em aparelhos reais. Nenhum teste ou build foi rodado no PC.
- Este registro acompanha o ajuste das legendas da comparação e capturas
  adicionais dos pombos do portão/pombal. O código do jogo não mudou desde
  `85d91bd`. O commit contendo este registro terá novo CI/prévia e E2E;
  conferir seus resultados pelo head atual do PR, sem assumir aprovação antecipada.
- Próximo passo: concluir a conferência do head final e entregar a prévia
  indicada no check `publicar-site`/descrição do PR para aprovação humana.
  Aguardar aprovação explícita dessa versão antes de integrar e publicar.
  Não ativar auto-merge nem liberar ambiente de produção enquanto aguarda.

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
3. PRs #1 e #2 concluídos e publicados; não repetir seus merges/deploys.
   PR #3 é a entrega dos pombos e depende da aprovação humana da versão validada.
   Conferir head/base/CI/prévia/E2E atuais antes de qualquer integração.
   Não há autorização para instalar ai-memory neste projeto.
4. Ao receber uma tarefa, atualizar este documento com o novo objetivo e,
   durante a execução, manter um ponto de retomada útil ao outro agente.
