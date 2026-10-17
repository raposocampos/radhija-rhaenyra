# Entrega por PR e prévia

O usuário pede a mudança → agente abre PR → GitHub roda CI e publica prévia →
usuário joga e aprova no chat → agente integra → CI do main → agente libera
produção usando a aprovação recebida → mesmo link principal atualizado.

Não executar testes/build no PC como etapa automática. A leitura de arquivos,
a revisão do diff e `git diff --check` são locais; testes, tipos e build são
GitHub Actions. As partidas E2E continuam no workflow manual separado.

## Proteções configuradas no GitHub

- `main`: exige PR, branch atualizado, resolução de conversas e checks
  `testes-e-build` e `publicar-site` do GitHub Actions. A regra inclui admins;
  force push e exclusão são proibidos. Histórico linear: usar squash.
- `github-pages`: produção, permitido apenas `main`, revisão obrigatória de
  `raposocampos`. Como o agente usa a conta do responsável, a autorrevisão do
  ambiente fica permitida: **só exercê-la após aprovação humana no chat**.
- Não exigimos um segundo usuário aprovador do PR: o GitHub não permite aprovar
  o próprio PR, e este projeto tem um responsável. A decisão humana é registrada
  no chat e aplicada no ambiente de produção, separadamente dos checks.
- `preview`: aceita `refs/pull/*/merge`, sem aprovação manual. O workflow só
  publica PRs do mesmo repositório. Forks recebem testes; para uma prévia,
  revisar o código e trazê-lo para um branch interno. Nunca usar
  `pull_request_target` para executar código de um fork com escrita.

Essas configurações são do servidor e não são criadas pelo YAML. Ao migrar o
repositório, recriá-las e conferir por API. Administradores podem mudar regras;
isso não é autorização para agentes contorná-las. `AGENTS.md` é a política
compartilhada e `CLAUDE.md` a importa.

## Como as prévias funcionam

Produção continua em https://raposocampos.github.io/radhija-rhaenyra/.
Prévia: `.../previews/pr-N/EXECUCAO-TENTATIVA/`. O caminho é gerado no CI,
aparece no deployment do PR e no resumo do job `publicar-site`. O agente
também o coloca na descrição do PR e entrega ao usuário no chat.

O Pages hospeda um site: o branch órfão `pages-state` guarda apenas os arquivos
estáticos em `site/`. O job serializa leitura, atualização e publicação para
preservar produção e prévias dos outros PRs. A fila comporta até 100 jobs.
`pages-state` nunca deve ser integrado ao `main` nem receber código-fonte,
credenciais ou fotos. O token do GitHub Actions basta; nenhum token pessoal
deve ser salvo no repositório.

Cada PR mantém a última prévia. Uma nova execução usa outra URL e remove a
anterior: não testar um link antigo nem reaproveitar aprovação de outra versão.
Os arquivos `version.json` identificam head, base, commit testado e execução.
No PR, o commit testado é o merge sintético do GitHub; na produção é o commit
final do `main`. `main` é recompilado após o merge, com o lockfile versionado.
Não se deve apresentar os dois commits como se fossem o mesmo SHA.

As prévias são públicas e compartilham o domínio de produção. Progresso e volume
usam chaves separadas por PR para não alterar o save principal; isso é isolamento
funcional, não uma barreira de segurança entre origens. Não publicar código
não confiável, segredos nem dados privados nas prévias.

Prévia de PR fechado permanece disponível para comparação até limpeza de
manutenção em `pages-state`. Não há limpeza automática de PRs encerrados nesta
versão; monitorar o tamanho do site e remover apenas as prévias encerradas,
sob a mesma serialização. O histórico Git conserva arquivos antigos.

## Procedimento para os agentes

1. Ler `AGENTS.md` e `docs/CONTEXTO.md`; conferir estado real do Git/GitHub.
2. Usar branch por tarefa e worktree separado para trabalho simultâneo. Não
   editar a mesma pasta que outro agente. Combinar mudanças na mesma área e
   integrar um PR por vez; branches não resolvem conflitos de lógica sozinhos.
3. Implementar e adicionar teste de regressão útil para bugs de comportamento.
   Enviar o branch e abrir PR. Monitorar os checks e corrigir falhas na nuvem.
4. Se necessário, disparar E2E na referência do branch pelo CLI/API. Conferir
   que o SHA testado corresponde ao head apresentado. CI não espera E2E sozinho.
5. Preencher o PR com links, SHAs, resultados e roteiro de teste. Entregar a
   prévia e aguardar aprovação explícita do usuário. Não ativar auto-merge.
6. Após aprovação, conferir head/base novamente e se os checks estão verdes.
   Se outra mudança entrou no main, atualizar o branch, testar e apresentar nova
   prévia para aprovação. Nunca usar bypass de proteção.
7. Integrar com `gh pr merge NUMERO --squash --match-head-commit SHA_APROVADO`.
   Acompanhar o CI do novo SHA no main e o deployment pendente de `github-pages`.
8. Conferir o SHA da execução e a aprovação no chat. Consultar
   `GET /repos/raposocampos/radhija-rhaenyra/actions/runs/RUN/pending_deployments`.
   Usar o ID retornado para liberar **somente esse ambiente e essa execução**:
   `POST` no mesmo endpoint com `environment_ids: [ID]`, `state: "approved"`
   e comentário que identifique a aprovação, o PR e a versão. Não inventar IDs
   nem enviar essa aprovação antes da manifestação humana.
9. Aguardar deploy; conferir HTTP e `version.json` no link principal. Atualizar
   contexto sem afirmar que testes pendentes passaram.

## Recuperação

- CI falhou: ler o log, corrigir em outro commit do mesmo PR e gerar nova prévia.
- Job antigo falhou por head/base diferente: sincronizar com main e revalidar.
- Publicação falhou: consultar logs, deployment e `version.json`; o branch
  `pages-state` é salvo antes do deploy e pode conter uma versão aprovada que
  ainda não chegou ao site. Não concluir que push equivale a publicação.
- Não reenviar uma execução antiga do main para fazer rollback: o workflow
  rejeita versões que não sejam o head atual. Reverter via novo PR, com CI,
  prévia e aprovação. Para incidente urgente, pedir orientação explícita.
- A inicialização de `pages-state` foi feita a partir do artefato Pages da
  produção `f457844` (execução `39000135800`), sem build local. Se o estado for
  perdido, recuperar os arquivos de uma publicação aprovada antes de publicar
  outra prévia; o script recusa um estado sem produção inicial.

Referências: [workflows do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[fila de publicação](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
