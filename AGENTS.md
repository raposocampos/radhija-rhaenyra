# Instruções do projeto para agentes

Estas instruções valem para Codex/GPT, Claude e outros agentes que trabalhem neste
repositório. O fluxo abaixo foi autorizado pelo responsável pelo projeto e é o
padrão para pedidos de mudanças, salvo instrução diferente no pedido atual.

## Entregar a mudança publicada

- Um pedido de implementação inclui alterar o código, fazer commit, enviar ao
  GitHub, acompanhar os testes e publicar a mudança no mesmo endereço:
  https://raposocampos.github.io/radhija-rhaenyra/
- Repositório: https://github.com/raposocampos/radhija-rhaenyra
- Não pedir nova confirmação apenas para commit, push ou publicação de uma
  mudança solicitada. Perguntas, análises e pedidos explicitamente limitados a
  trabalho local não autorizam mudanças ou publicação por si só.
- Antes de editar e enviar, conferir branch, estado do Git e atualizações remotas.
  Preservar trabalho alheio; não usar force push nem descartar alterações para
  facilitar a publicação. Não incluir mudanças não relacionadas no commit.
- A publicação acontece a partir de `main`. Se estiver em outro branch ou
  worktree, integrar somente o trabalho solicitado ao `main`, respeitando
  proteções do repositório e sem sobrescrever trabalho de outras sessões.
- Acompanhar o workflow **CI e publicação** (`.github/workflows/ci.yml`) para o
  commit enviado. Ele instala dependências, checa tipos, roda os testes rápidos,
  gera a build e publica no GitHub Pages somente após sucesso.
- Se o CI falhar, inspecionar os logs, corrigir a causa e enviar a correção.
  Não desativar testes ou contornar o CI para publicar. A versão anterior
  permanece no ar enquanto o workflow não conseguir publicar a nova.
- Só declarar a mudança publicada depois de confirmar sucesso do deploy do
  commit correspondente e verificar que o endereço do jogo responde. Informar
  o link do jogo e o resultado da validação. Se houver um bloqueio real de
  autenticação, permissão ou infraestrutura, explicar o que falta sem alegar
  conclusão e sem pedir tokens no chat.

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
  integrar ao `main`. O workflow de publicação não aguarda o E2E manual
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
