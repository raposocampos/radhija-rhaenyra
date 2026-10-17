# Instruções do projeto para agentes

Estas instruções valem para Codex/GPT, Claude e outros agentes que trabalhem neste
repositório. O fluxo abaixo foi autorizado pelo responsável pelo projeto e é o
padrão para pedidos de mudanças, salvo instrução diferente no pedido atual.

## Retomar e registrar o trabalho

- Antes de implementar, ler `docs/CONTEXTO.md` para saber o que o agente
  anterior entregou, onde parou e quais pendências existem. Conferir essas
  informações contra o Git e o GitHub: o documento é um resumo, não substitui
  o estado real dos arquivos ou os resultados do CI.
- Atualizar `docs/CONTEXTO.md` ao concluir uma tarefa e em marcos importantes
  de trabalhos longos, para permitir troca de agente mesmo se a sessão acabar
  antes da conclusão. Antes de uma troca planejada, salvar um ponto de retomada.
- Registrar data, agente, objetivo, alterações relevantes, validações com
  referência ao commit ou execução, pendências e próximo passo concreto.
  Distinguir trabalho concluído, em andamento e apenas proposto.
- Se houver trabalho incompleto, registrar branch/worktree, arquivos alterados,
  mudanças ainda sem commit e processos ou execuções em andamento. Não marcar
  como aprovado um CI ainda pendente. O próximo agente deve conferir o resultado
  no GitHub pelo commit, inclusive o commit que contém a própria atualização
  do documento; não criar commits só para atualizar o status desse último CI.
- Manter o resumo conciso e atual, sem copiar conversas, tokens, caminhos
  pessoais ou outros dados privados: este arquivo faz parte de um repositório
  público. Preservar decisões úteis e referências às entregas anteriores.
- Neste projeto, a passagem de contexto é por Markdown. Não instalar ai-memory:
  o usuário reservou essa experiência para outro projeto.

## Entregar por PR, prévia e aprovação

- **Esta regra substitui a autorização anterior de publicação automática.**
  Um pedido de implementação autoriza alterar, fazer commit, enviar um branch,
  abrir/atualizar um PR e publicar uma prévia. **Não autoriza integrar ao `main`
  nem atualizar produção antes de o usuário testar e aprovar essa versão.**
- Repositório: https://github.com/raposocampos/radhija-rhaenyra
  Produção: https://raposocampos.github.io/radhija-rhaenyra/
- Ler também `docs/ENTREGA.md`, com configuração, comandos e recuperação.
  Antes de editar, conferir Git, worktrees e atualizações remotas. Criar um
  branch por tarefa (`codex/...` ou `claude/...`). Quando houver agentes
  simultâneos, usar worktrees separados; nunca compartilhar a mesma pasta de
  trabalho nem trocar o branch de uma sessão alheia.
- Preservar trabalho alheio; não usar force push, descartar alterações, fazer
  push direto ao `main`, usar `--admin` ou relaxar proteções para entregar.
  Não misturar tarefas não relacionadas. Integrar PRs um de cada vez.
- Abrir um PR para `main` e acompanhar **CI e prévias** e, depois,
  **Publicar versão validada**. Os checks obrigatórios
  são `testes-e-build` e `publicar-site`: tipos, testes rápidos, build e prévia
  precisam passar. Conferir os resultados do commit atual e a base atualizada.
  Se falhar, corrigir a causa; não desativar verificações.
- O CI de PR só tem leitura. Publicação usa workflow confiável do `main`
  (`workflow_run`) e trata o artefato do PR como dados; nunca executar scripts
  do PR em jobs com escrita. O ambiente de prévia também recusa branches de PR.
- Entregar ao usuário o link da prévia, o PR, o commit validado, os resultados
  e o que testar. Aguardar aprovação explícita para publicação. A aprovação pode
  ser dada no chat: o agente faz as ações no GitHub sem exigir cliques do usuário.
  Não aprovar o ambiente, ativar auto-merge nem integrar enquanto aguarda.
- A aprovação vale para a versão apresentada. Novos commits, correções ou
  atualização da base exigem CI/prévia novos e nova aprovação. Antes de integrar,
  conferir novamente head/base/checks; usar merge squash com SHA esperado.
- Depois da aprovação, integrar o PR, acompanhar o CI do `main` e liberar o
  deployment pendente do ambiente `github-pages` correspondente à versão
  aprovada. Essa liberação usa a aprovação já dada; não pedir confirmação em
  duplicidade. Nunca liberar outra execução por engano.
- Só declarar publicada em produção após sucesso do deploy e conferência de
  `version.json` e do link principal. Uma prévia publicada não é produção.
  Se houver bloqueio real, explicar o que falta sem alegar conclusão nem pedir
  tokens no chat. Fotos e dados privados também não podem ir para prévias.

## Testes e build na nuvem

- Por padrão, executar testes, checagem de tipos e build nos servidores do
  GitHub Actions. O usuário quer manter o PC livre dessa carga.
- Não executar localmente `npm run test:e2e`, `npm run verify`, partidas
  automatizadas no navegador ou outras baterias pesadas, salvo pedido explícito
  do usuário para essa execução local.
- Também não executar `npm run build`, `npm test` ou `npm run typecheck`
  localmente como etapa automática antes de enviar: o CI já faz isso.
  Atenção: `npm run build` dispara tipos e testes via `prebuild`.
- Inspeção de arquivos, revisão do diff e verificações leves como
  `git diff --check` podem ser feitas localmente. Não é necessário gerar ou
  enviar `dist/`.
- E2E fica separado, no workflow **E2E manual**
  (`.github/workflows/e2e.yml`). O agente pode dispará-lo pelo GitHub CLI/API,
  sem exigir que o usuário abra o GitHub. Escolher a suíte afetada quando
  necessário; usar `todas` para uma versão importante ou mudança abrangente.
  Não rodar E2E a cada edição de documentação.
- Para mudanças que precisem de E2E antes da publicação, enviar primeiro um
  branch de trabalho, rodar o workflow nele e aguardar sucesso antes de
  pedir aprovação para integrar ao `main`. O workflow não aguarda o E2E manual
  automaticamente.
- Conferir que os resultados correspondem ao código entregue. Não apresentar
  uma execução de um commit anterior como validação da versão atual.

## Privacidade

- Nunca publicar fotos pessoais de `referencias/fotos/`, credenciais, tokens,
  arquivos `.env`, chaves privadas ou configurações locais de agentes.
- Respeitar o `.gitignore` e revisar o conteúdo que será enviado. Não usar
  `git add -f` para incluir arquivos privados ou ignorados.
- Usar a identidade pública do projeto nos commits:
  `raposocampos <91505378+raposocampos@users.noreply.github.com>`.
  Se precisar ajustar, usar configuração Git local ao repositório; não alterar
  a configuração global do usuário.
- Nunca publicar backups locais do histórico antigo nem restaurar a identidade
  pessoal em commits públicos.

## Instruções compartilhadas

Este `AGENTS.md` é a fonte única deste fluxo. O `CLAUDE.md` da raiz aponta para
ele para que Claude e Codex sigam a mesma política. Ao alterar o fluxo,
atualizar este arquivo, evitando manter duas versões divergentes.
