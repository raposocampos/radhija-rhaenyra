# Contexto para retomar o projeto

Última atualização: **2026-10-18, Claude**. Ler primeiro [AGENTS.md](../AGENTS.md)
e [ENTREGA.md](ENTREGA.md); conferir Git/GitHub antes de editar.

## Em andamento: fase 6 mais longa

- Pedido do usuário (2026-10-18): o acabamento ficou bonito, mas a fase curta.
  Escolheu **as duas coisas**: cancela no trilho da estrela e duas entregas pelo
  trem. A fase continua só em `DEV_LEVELS`.
- Branch **`claude/fase6-longa`** (worktree próprio), base `31e8b26`. Consultar o
  PR dessa branch para SHA, CI, E2E e prévia; este texto não antecipa resultados.
  Nenhum teste ou build rodou no PC.
- Feito: agulha com três posições (volta → lua → estrela); a lua começa presa num
  pórtico dentro da maquete e o trem a busca (ela cai no vagão ao lado do planeta);
  cancela na reta leste da estrela que só sobe com alguém na placa do lado de fora
  (Fica) e barra o trem antes do braço; as duas cargas descem juntas até a bandeja;
  o trem volta sozinho depois de cada parada; foguete com dois berços que decola.
  Na primeira prévia a lua ficava do lado de fora e ia a um funil; o usuário
  apontou que isso não fazia sentido e o fluxo foi refeito. Testes em `test/fase6.test.mjs` e
  E2E `expresso` reescritos. Detalhes na continuidade.
- Diretriz do usuário para as próximas fases: **dois objetos** por fase até a 10;
  a partir da 11, três ou mecânicas novas (ver COMO-CRIAR-UMA-FASE, seção 1).
- Próximo passo: CI verde, E2E `expresso` e `todas`, revisar as capturas,
  entregar a prévia e **aguardar aprovação** antes do merge/deploy. Depois,
  Entrega B (campanha) em outro PR.

## Entregue: acabamento da fase 6 (PR #18)

Squash `31e8b26` no main, publicado pelo deploy `39095730915` (deployment
`7149690293`, liberado com a aprovação do chat); `version.json` e HTTP 200
conferidos. Não repetir merge/deploy do #18.

## Passagem anterior (Codex → Claude, 2026-10-17)

O usuário pediu publicar o PR #16 e documentar a passagem; continuará o
desenvolvimento com Claude.

## Estado atual confirmado

**A rodada inicial de estabilização EST-00 a EST-09 está concluída e publicada.**
O protótipo da fase 6 também foi aprovado/publicado, mas ainda não é a fase final
nem aparece no menu normal. Não reiniciar tarefas já entregues.

- Produção: https://raposocampos.github.io/radhija-rhaenyra/.
- Main publicado: `45bf0cc4b90abc32b3992ce93fa7055bff248cdd` (squash do PR #16).
- Head aprovado do PR #16: `622d30302e5c6d0209a0993f8c4dabe952cb5274`, base `b954b24`.
  Árvores do head aprovado e do squash idênticas.
- [CI do head](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39084258076):
  207 testes, tipos e build aprovados, prévia conferida.
- [Medição do head](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39084258063):
  oito testes da infraestrutura, cinco pares A/B, 30 janelas medidas/600 quadros,
  dez provas negativas reais; nenhum erro/warning nos relatórios. Revisão independente.
- [CI do main](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39087411898)
  e [deploy](https://github.com/raposocampos/radhija-rhaenyra/actions/runs/39087441755)
  concluídos com sucesso. Só o deployment `7148473323` foi liberado usando a
  aprovação explícita do chat. Site HTTP 200 e `version.json` confirmaram
  `45bf0cc`, run `39087411898`, tentativa 1. **Não repetir merge/deploy do #16.**

## O que foi entregue

| Frente | Resultado | PR |
| --- | --- | --- |
| Plano e contexto | Avaliação, prioridades, checklist e divisão por worktrees | #4 |
| Confiabilidade do E2E | Erros inesperados reprovam; prova negativa e smoke do build em subcaminho | #6 |
| Dependência de desenvolvimento | Vite atualizado pontualmente, com lockfile | #5 |
| Carregamento | Recuperação de falhas, boot e aba antiga com chunk removido | #10 |
| Progresso | Save validado/compatível, preservação de registros e fallback | #7 |
| Recursos gráficos | Ownership/descarte por fase, globais preservados e contagens após alternâncias | #11 |
| Contratos | Ligação tipada entre definição/puzzle/cenário, props reais e dublês estritos | #12 |
| Configuração das personagens | Atributos comuns independentes da fase 1; posições por layout | #13 |
| Núcleo | Extração de eventos/efeitos associados, preservando ordem e comportamento | #14 |
| Menu | Botão Jogar não desaparece ao navegar para a seleção de fases | #8 |
| Desempenho e expansão | Protocolo temporal, baseline revisada e guia completo para novas fases | #16 |
| Fase 6 | Protótipo Expresso do Superbafo e correção da dica da bandeja | #15 |

Todos esses PRs foram integrados e publicados. O PR #9 foi **encerrado sem merge**
porque sua proposta foi incorporada ao #15; não há entrega exclusiva pendente nele.
O plano completo está em [PLANO-ESTABILIZACAO.md](PLANO-ESTABILIZACAO.md).
A avaliação original, entregas anteriores (incluindo infraestrutura inicial e
pombos) e evidências históricas foram preservadas em
[HISTORICO-ESTABILIZACAO.md](HISTORICO-ESTABILIZACAO.md), sem tratar seus antigos
“próximos passos” como comandos atuais. Decisões dos pombos em [POMBOS.md](POMBOS.md).

## Limites da conclusão

Não há requisito obrigatório esquecido na rodada acordada. Tipagem exaustiva de
IA/layout/listeners, extrações adicionais do núcleo e otimizações preventivas
são melhorias futuras, dependentes de necessidade concreta; não bloqueiam a fase 6.
Testes reduzem regressões, não garantem que nenhuma alteração futura possa quebrar.

A baseline mantém sua origem **`b4a61b3` / `39082606479`**, mesmo após publicação:
[JSON adotado](performance-baseline.json), [valores e dispersão](DESEMPENHO-REFERENCIA.md),
[protocolo](DESEMPENHO.md). Não substituir pelos candidatos de novas execuções.
Na validação final `39084258063`, fases 2/5 tiveram ambientes equivalentes e
nenhuma métrica acima dos limites; fases 1/3/4 tiveram CPUs diferentes e sua
comparação temporal foi recusada. Não alegar ganho/regressão nesses três casos.
SwiftShader não representa GPU/FPS do jogador, heap JS não é VRAM e seis visitas
não provam ausência de vazamento longo. O catálogo temporal ainda tem cinco fases.
O run incompleto `39080397088` é diagnóstico de timeout, nunca baseline válida.

## Fase 6: entregue como protótipo

Acesso: https://raposocampos.github.io/radhija-rhaenyra/?level=fase6&play.
Registro só em `src/levels/dev.js`; campanha principal continua com cinco fases.
O usuário escolheu **Expresso do Superbafo**, rejeitou repetir pombo/ventilador e
exigiu a **mesma direção artística do jogo**, sem redesenhar as personagens.

Rhaenyra pousa no pedal para escolher trilho; o superbafo frontal da Radhija faz
o trem espirrar e trazer a bolinha-planeta. Rota circular é recuperável, rota
fica travada em movimento, retirada ocorre em `ready`, entrega no tapete.
Há oito estados, bloqueio/poda de nuvens antigas, petiscos, pausa/reset/descarte.

PR #15: head corrigido aprovado `05e2287`, base `fae8acd`, squash `b954b24`.
CI `39082917531` passou 207 testes/tipos/build. E2E `39082921941`: 24 verificações
Expresso, quatro de infraestrutura, 23 smoke, 28 recuperação e 30 comparações
gráficas estáveis nas seis fases, sem erros/warnings/descarte global; capturas
revisadas. São 18 testes específicos da fase e oito provas negativas de tipos.
O E2E completo `39081100507` passou no head anterior `92b9306`; não atribuir esse
run à correção posterior, que teve validação própria da suíte afetada.
CI main `39083884706` e deploy `39083918751` publicaram o #15 antes do #16.

Limites aprovados: **blocagem jogável**, oficina simplificada, espirro sem som
exclusivo e curvas segmentadas com giro imediato. Acabamento e entrada na campanha
não foram implementados. Plano concreto em [CONTINUIDADE-FASE6.md](CONTINUIDADE-FASE6.md).

## Retomada pelo Claude

1. Conferir branch, status, worktrees e `origin/main`. A pasta principal foi
   sincronizada por fast-forward em `45bf0cc`, sem mudar o branch `main`, e estava
   limpa. Não presumir que worktrees antigos tenham a mesma base; não descartá-los.
2. A consolidação documental do Codex (`codex/passagem-claude`) virou o PR #17,
   integrado ao main em `5e434f7`.
3. A aprovação do #16 já foi consumada na publicação acima; não repetir.
4. O acabamento da fase 6 (DEV) foi publicado no #18; a versão mais longa está
   em andamento (topo deste arquivo). Depois de aprovada, promover ao catálogo
   em outra entrega, conforme o checklist.
5. Ao promover, corrigir três pressupostos: URL por ID hoje só busca DEV;
   contratos genéricos presumem portão; fase 5 espera `hasNext=false`. Rever também
   testes que exigem fase6 fora do catálogo e ampliar medição temporal para seis fases.
6. Toda validação pesada permanece no GitHub. CI e prévia próprios a cada head/base;
   E2E da suíte e `todas` na entrega importante. Preservar save, recursos e arte;
   aprovação explícita antes de merge/deploy. Não instalar ai-memory.

Na passagem do Codex não havia acabamento em andamento; o trabalho atual está na
seção "Em andamento" no topo. Histórico de branches e capturas ignoradas foi
preservado. Conferir o estado remoto ao retomar: este é um checkpoint, não uma fonte viva.
