# Referências e revisão dos pombos

Pesquisa e implementação: Codex, 2026-10-17.

## Direção visual

Preservar a escala, a paleta suave e o comportamento da fase 4. O pombo deve
ser reconhecível pela silhueta, mesmo pequeno na câmera alta: peito cheio,
cabeça menor que o corpo, pescoço contínuo, asas fechadas afiladas e cauda
larga com ponta arredondada. O objetivo é uma interpretação fofa, não uma
reprodução fotográfica.

Referências consultadas (fotografias não são copiadas para o jogo):

- [Cornell Lab — Rock Pigeon, identificação e galeria](https://www.allaboutbirds.org/guide/Rock_Pigeon/id):
  proporções, cabeça pequena, pernas curtas, asas largas que terminam em ponta,
  cauda arredondada, duas barras escuras nas asas e plumagem cinza-azulada.
- [Macaulay Library — referência 201329971](https://macaulaylibrary.org/asset/201329971):
  fotografia de J. del Hoyo/Lynx, inspecionada em detalhe; peito arredondado,
  pescoço verde, cabeça cinza, bico fino com cera clara e asas sobrepostas.
- [Macaulay Library — referência 659425743](https://macaulaylibrary.org/asset/659425743):
  vista alta de pombos no chão; relação entre dorso, asas, cauda e pés rosados.
- [RSPB — Rock Dove/Feral Pigeon](https://www.rspb.org.uk/birds-and-wildlife/rock-dove-feral-pigeon):
  referência complementar da espécie e de sua variedade de plumagens.

Tradução para a modelagem: corpo em gota e pescoço afunilado com normais suaves;
cabeça arredondada, olhos laterais âmbar e bico curto; verde e violeta graduais
no pescoço; duas barras seguindo a superfície das asas; cauda em leque com
penas arredondadas e faixa terminal escura; dedos delicados, incluindo o dedo
traseiro. Sem novas texturas externas, shaders especiais ou dependências.

## Escopo e custo

`src/world/pigeon.js` continua sendo a única fábrica dos quatro pombos de
`src/levels/fase4/world/props.js`: passagem, portão e dois no pombal. API,
posições, escalas, sementes e tons de cada instância são preservados. Sono,
espiada, balanço da cabeça, voo e sprites de sono usam o mesmo controlador.
Não há alterações de colisão, regras, controles ou progressão.

Barras pintadas nos vértices substituem peças sobrepostas. Penas da cauda e
partes dos pés são unidas por material para conter draw calls. A geometria é
criada uma vez por pombo; o update não reconstrói malhas. O relatório de revisão
mede meshes, triângulos e chamadas de desenho antes/depois. Contagens não são
uma medição de FPS em aparelhos reais.

## Como validar na nuvem

Executar **E2E manual**, suíte `fase4`, no branch do PR. Além da partida normal,
o workflow gera o artefato `capturas-fase4`, pasta `pombos/`:

- `01-silhuetas.png`: antes/depois em três quartos, perfil, frente e vista alta.
- `02-animacoes.png`: sono, espiada e dois extremos da batida de asas.
- `03-fase4.png` e `04-cochilo-no-cenario.png`: fase real e detalhe no cenário,
  com resolução normal, sombras e pós-processamento do jogo.
- `metrics.json`: SHAs da base e do head, contagens e erros do navegador.

O script compara o head com o ancestral comum de `origin/main`, usando os
mesmos tempos, semente, câmera e luz. Requer histórico completo no checkout.
A página de estudo em `tools/` não é uma entrada do build publicado. O modelo
antigo é criado temporariamente no runner e removido no encerramento.

No teste humano da prévia: abrir a fase 4, observar o cochilo, latir para o
pombo espiar, usar superbafo para fazê-lo voar e conferir o pombo do portão e
os dois sobre o pombal. A publicação em produção depende da aprovação da
versão apresentada, conforme `AGENTS.md`.
