# Plano de estabilização do jogo

Data de início: 2026-10-17. Coordenação: Codex.

Preparar o jogo para receber novas fases e mecânicas com menos regressões.
A execução foi autorizada pelo usuário. As regras de entrega, privacidade e
validação estão em [AGENTS.md](../AGENTS.md); integração e produção dependem
da aprovação explícita de cada versão apresentada.

## Base e organização

Base inicial: `baa8af07e8f1e81bf03c7ec6f379c32955a2efd6`.
A [avaliação registrada](CONTEXTO.md) confirmou 123 testes rápidos e
299 verificações E2E nessa base. Novos commits precisam de validação própria.

Um coordenador mantém prioridades, reconcilia registros e revisa entregas.
Até dois executores trabalham em escopos delimitados, cada um com branch e
worktree próprios. O coordenador acompanha CI e prévias, apresenta as versões
ao usuário e integra um PR por vez, somente após aprovação.

As tarefas podem ser desenvolvidas em paralelo; uma alteração na base exige
atualizar as branches restantes, revalidar e apresentar as novas versões.
Carregamento, descarte de recursos e divisão do núcleo avançam em sequência
quando alteram a mesma área. Revisões sem alterações podem ocorrer em paralelo.

Ordem proposta de integração da primeira etapa: PR #6 (E2E), PR #5 (Vite) e
PR #4 (documentação consolidada). Assim, a atualização do Vite também será
testada com o E2E manual reforçado após atualizar a base. O plano já está preservado
no branch remoto do PR #4 e pode orientar os executores antes de ser integrado.

## Boas práticas a preservar

- Fases com definição, layout, puzzle e cenário separados, reunidas no
  [registro de fases](../src/levels/index.js). Novas fases devem seguir o
  [guia existente](COMO-CRIAR-UMA-FASE.md), evitando condições específicas no núcleo.
- [Mecânicas compartilhadas](../src/game/mechanics/index.js) para comportamentos
  reutilizáveis. Corrigir a mecânica comum reduz divergências entre fases.
- [Entrada centralizada](../src/game/input.js) traduz teclado e controle para
  comandos lógicos comuns. Preservar esse contrato ao acrescentar ações.
- Tipos verificados em JavaScript, testes rápidos e partidas E2E já existentes.
  Ampliar a cobertura nas fronteiras alteradas; as lacunas abaixo não exigem
  reescrever o jogo nem trocar toda a tecnologia.
- Versões exatas e lockfile versionado, CI com leitura e publicação confiável
  separada, prévias identificadas por commit e aprovação humana para produção.
- Documentação de arquitetura e criação de fases já presente. Manter decisões,
  checklist e retomada junto do código para não depender do histórico dos chats.

## Checklist e ordem

A caixa marcada indica que os critérios de aceitação foram atendidos e
validados. O estado de publicação é registrado separadamente.

| Critérios atendidos | ID | Entrega | Responsável | Dependência | Situação neste marco |
| --- | --- | --- | --- | --- | --- |
| [ ] | EST-00 | Avaliação preservada e plano de execução | Coordenador | Nenhuma | PR #4 em validação |
| [x] | EST-01 | E2E rigoroso e smoke do build | Executor E2E | Base inicial | PR #6 validado; aguardando aprovação |
| [x] | EST-02 | Atualização pontual do Vite | Executor dependências | Base inicial | PR #5 validado nesta base; revalidar após #6 |
| [ ] | EST-03 | Recuperação de falhas no carregamento | A atribuir | EST-01 e EST-02 integrados | Planejado |
| [ ] | EST-04 | Validação e migração do progresso | A atribuir | EST-01 integrado | Planejado |
| [ ] | EST-05 | Ciclo de vida dos recursos gráficos | A atribuir | EST-03 integrado | Planejado |
| [ ] | EST-06 | Contratos entre puzzle e cenário | A atribuir | EST-05 integrado para edições no núcleo | Planejado |
| [ ] | EST-07 | Configuração comum e divisão gradual do núcleo | A atribuir | EST-03, EST-05 e EST-06 integrados | Planejado |
| [ ] | EST-08 | Medições de desempenho e protocolo para novas fases | A atribuir | EST-05 e EST-06 validados | Planejado |
| [ ] | EST-09 | Botão Jogar desaparece ao navegar no menu | A atribuir | Após a primeira etapa, conforme pedido do usuário | Planejado |

Etapa 1: EST-01 e EST-02. Etapa 2: EST-03 e EST-04. Etapa 3: EST-05 e
revisão sem edição de EST-06. Etapa 4: implementação de EST-06. EST-07 e
EST-08 seguem em entregas próprias, com escopo ajustado às medições.

Os estados são: planejado, em execução, em validação, aguardando aprovação e
publicado. Um PR com CI aprovado ainda pode aguardar E2E ou aprovação humana.
Consultar PR e execuções pelo SHA para o estado atual; atualizar este quadro
nos marcos, sem criar commits apenas para registrar o CI do próprio documento.

## Critérios de aceitação

### EST-00 Avaliação e plano

- Preservar achados, evidências e limites da avaliação em Markdown versionado.
- Registrar responsáveis, dependências, critérios e instruções de retomada.
- Abrir PR documental e conferir os checks e a prévia, sem E2E adicional para
  uma mudança apenas documental.

Branch: `codex/avaliacao-evolucao`. Worktree: `avaliacao-evolucao`.
Escopo: `AGENTS.md`, `docs/CONTEXTO.md`, este plano.
Entrega: [PR #4](https://github.com/raposocampos/radhija-rhaenyra/pull/4).
Conferir CI e prévia pelo head atual; o registro dos resultados desta rodada
modifica a documentação e exige seus próprios checks.

### EST-01 E2E e build

- Erros inesperados de `console.error` e `pageerror` fazem a execução reprovar.
- Um teste com erro injetado confirma a saída não zero pelo motivo esperado;
  uma execução sem erro continua aprovando. Não usar permissões amplas para
  ignorar erros.
- Um smoke testa o build estático em subcaminho semelhante à prévia, incluindo
  a abertura das cinco fases e o carregamento dos módulos sob demanda.
- Prova de erro e smoke de navegador ficam em um job do `E2E manual`, na
  seleção `todas`, conforme a separação exigida por `AGENTS.md`. O smoke testa
  o build gerado nessa execução; não é o mesmo artefato binário da prévia.
- CI e todas as suítes E2E aprovam o commit entregue, com logs conferidos.
- Preservar os nomes dos checks, permissões de leitura do CI e publicação
  confiável definida no main.

Branch: `codex/estabilidade-e2e`. Worktree: `estabilidade-e2e`.
Escopo: harness, runner, testes, smoke, workflows de CI/E2E e documentação da
tarefa. `package.json`, lockfile, gameplay e publicador ficam fora desta frente.

Entrega: [PR #6](https://github.com/raposocampos/radhija-rhaenyra/pull/6),
head `6ebacd999da6bd36249cd76ef3e90a319752b666`, base inicial acima.
[CI 39052841286](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052841286)
aprovado: 126 testes rápidos, tipos e build.
[Prévia validada](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-6/39052841286-1/).
[E2E 39052837420](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39052837420)
aprovado: 299 verificações de gameplay nas nove suítes, quatro provas da
infraestrutura e 19 verificações do build, sem erros de console. Capturas da
fase 4 concluídas, com `errors: []` no log. A revisão foi atendida: os testes
de navegador estão no workflow manual e a conversa foi resolvida.
Publicação em produção não aprovada.

### EST-02 Vite

- Atualizar o Vite para uma versão corrigida adequada da linha 6, com versão
  exata e lockfile consistente, após conferir os avisos e a auditoria atuais.
- Não misturar atualizações de outras dependências sem necessidade comprovada.
- Registrar o resultado da auditoria e validar tipos, testes, build, prévia e
  todas as suítes E2E no GitHub, para o commit entregue.

Branch: `codex/atualizar-vite`. Worktree: `atualizar-vite`.
Escopo: `package.json`, `package-lock.json` e registro próprio no contexto.

Entrega: [PR #5](https://github.com/raposocampos/radhija-rhaenyra/pull/5),
head `4f03e389335051dd2633f28feac4c6bd67c49084`, base inicial acima.
Vite 6.4.4, sem alterações de dependências transitivas; auditoria do lockfile
sem vulnerabilidades conhecidas reportadas na consulta.
[CI 39051377056](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39051377056)
aprovado: tipos, 123 testes rápidos e build.
[Prévia validada](https://raposocampos.github.io/radhija-rhaenyra/previews/pr-5/39051377056-1/).
[E2E 39051384592](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39051384592)
aprovado: 299 verificações nas nove suítes, sem erros de console. Depois de
integrar #6, atualizar a base,
revalidar e apresentar nova prévia para aprovação. Produção não aprovada.

### EST-03 Carregamento

- Falha na importação ou montagem de fase produz estado recuperável e uma
  ação clara para o jogador; não deixa o jogo preso em `loading`.
- Cobrir importação rejeitada, falha na montagem e recuperação sem duplicar
  eventos ou recursos. Testar aba antiga após publicação de novos arquivos.
- Verificar a estratégia para arquivos antigos e atualização da página,
  preservando progresso e o fluxo confiável de publicação.

### EST-04 Progresso

- Validar versão e formato do save, incluindo registros das fases; tratar
  arrays, valores inválidos, JSON corrompido e armazenamento indisponível.
- Manter compatibilidade com saves válidos existentes e preservar progresso
  ao adicionar uma fase. Introduzir migração apenas quando o formato exigir.
- Testar os casos de recuperação e manter isolamento entre prévias e produção.

### EST-05 Recursos gráficos

- Definir recursos pertencentes à fase e recursos compartilhados, com descarte
  de geometrias, materiais e texturas e limpeza das referências temporárias.
- Confirmar que voltar a uma fase mantém os recursos compartilhados válidos.
- Medir alternâncias repetidas entre fases na nuvem e verificar estabilização
  após aquecimento. Registrar contagens e condições; caches legítimos não
  precisam chegar a zero. Conferir a prévia visualmente.

### EST-06 Contratos

- Tipar a ligação entre definição, cenário e puzzle, reduzindo o uso de `any`
  nos pontos de integração e descrevendo os eventos relevantes.
- Validar contratos de objetos reais e impedir que dublês aceitem qualquer
  método silenciosamente. Cobrir incompatibilidades concretas.
- Manter tipos, testes rápidos e E2E aprovados sem uma reescrita geral do jogo.

### EST-07 Núcleo

- Extrair configurações comuns das personagens da fase 1 e explicitar o que
  permanece global ou varia por fase.
- Separar responsabilidades do núcleo em PRs pequenos, com comportamento
  preservado e testes das fronteiras alteradas. Evitar misturar refatoração
  com nova mecânica.

### EST-08 Desempenho e expansão

- Definir cenário, qualidade gráfica e ambiente de referência para medir
  carregamento, tempo por quadro e memória; estabelecer limites após medir.
- Documentar o protocolo de nova fase: protótipo, mecânica, ações fora de
  ordem, pausa, reinício, troca de personagem, itens e revisão da prévia.
- Manter medições de desempenho separadas do E2E com renderização reduzida.

### EST-09 Botão Jogar no menu

Relato de 2026-10-17: ao apertar para baixo para escolher uma fase no menu
inicial, o botão "Jogar" desaparece por alguns segundos. O usuário pediu para
corrigir depois desta rodada; a versão exata será identificada na reprodução.

- Reproduzir na nuvem a navegação para baixo e identificar a causa do sumiço.
- Manter o botão visível ou uma transição intencional e consistente, sem
  prejudicar seleção, foco, teclado ou controle.
- Acrescentar regressão útil à suíte de controle e entregar prévia própria.
  Nenhuma correção desta tarefa foi incluída nos PRs atuais.

## Evidências e retomada

Cada entrega deve identificar ID da tarefa, branch, SHA da base e do head, PR,
execuções de CI/E2E, URL da prévia e roteiro de teste. O PR concentra os links
atualizados; o contexto registra decisões e o próximo passo.

Antes de interromper ou trocar de agente, registrar no contexto da branch:
arquivos alterados, mudanças sem commit, execuções em andamento, limitações e
próxima ação. O coordenador reconcilia esses registros sem apagar trabalho de
outras frentes. Dados privados, tokens e caminhos pessoais ficam fora dos
documentos públicos.

Ao retomar, ler `AGENTS.md`, `docs/CONTEXTO.md` e este plano; conferir o Git e
o GitHub. Não repetir descobertas já documentadas nem considerar uma execução
antiga como aprovação de um novo commit.
