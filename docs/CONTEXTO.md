# Contexto para retomar o projeto

Última atualização: 2026-10-17. Agente: Codex.

Leia primeiro `AGENTS.md`, na raiz, para as regras de entrega, testes e
privacidade. Este documento registra o andamento compartilhado com o Claude.

## Onde paramos

**PR #3 em correção de pernas/câmera; produção não autorizada.**
Branch `codex/pombos-organicos`, worktree isolado `pombos-organicos`.
Objetivo: manter os pombos arredondados aceitos e tornar o voo e o mecanismo
pombo → placa → portão legíveis.

- Usuário aceitou o visual de `7427dda`, pediu melhorar o voo e depois relatou
  pernas separadas do corpo em `a9b0906` e câmera que não acompanha o segundo
  pombo. Esses retornos não autorizam publicação em produção.
- Última versão entregue: `a9b090606d5e646d8a8ed4cf70c8be1bf5c36947`.
  [CI 39007017743](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39007017743),
  [prévia 39007043021](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39007043021)
  e [E2E 39007014701](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39007014701)
  passaram: tipos, 120 testes, build, 17 verificações da fase 4 e capturas/vídeo.
  Isso valida a versão anterior, não as novas correções.
- Correção atual: pernas presas ao grupo do corpo, pivô no quadril dentro do
  tronco e contato dos pés resolvido no pouso/sono. Teste geométrico verifica
  as raízes das duas pernas dentro da malha durante voo, curva e pouso.
- Câmera: alvo vivo com altura, antecipação de 0,3 s antes de voar e um único
  plano contínuo para trajeto, placa e portão. Retorna suavemente à dog.
  Placa maior com molas, compressão, mudança de cor e pulso na corda; pombo
  acompanha a superfície da placa. Eventos, controles e colisões preservados.
- Capturas na nuvem comparam as pernas com `a9b0906` e acrescentam vídeo da
  câmera real do mecanismo, validação de enquadramento e captura vertical.
  Testes de câmera cobrem seguimento 3D, troca de foco e retorno à dog.
- Validação das correções pendente: enviar o novo commit no PR #3, acompanhar
  CI/prévia e E2E fase4, inspecionar capturas e entregar SHA/link ao usuário.
  Nenhum teste, build ou partida automatizada foi executado localmente.
- Base conferida: `main` em `3e826e48f9eac644681b718470f9d75f6e207de5`, PR #2
  integrado. CI `39004801467` e deploy `39004826940` passaram. PR #1 integrado.
- Pesquisa e decisões visuais em `docs/POMBOS.md`. Fotografias consultadas não
  incorporadas. Fábrica compartilhada pelos quatro pombos; 25 → 13 meshes e
  3.020 → 4.740 triângulos por pombo na revisão anterior. Não é benchmark de FPS.
- Próximo passo: conferir resultados do head atual, inclusive o commit deste
  documento, apresentar a nova prévia e aguardar aprovação explícita dessa
  versão. Não ativar auto-merge, integrar ou liberar produção enquanto aguarda.

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
