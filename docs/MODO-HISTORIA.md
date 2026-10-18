# Modo História: visão de design

Situação: **proposta registrada em 2026-10-18, ainda não implementada.** No menu (Jogar), o cartão "Modo História"
aparece com o selo "Em breve" e não abre nada (`MODES.story` em `src/ui/markup.js`). Este documento guarda a visão
do usuário para quando o modo for construído; os detalhes marcados como proposta precisam do ok dele antes.

## O que o usuário pediu

- Um **mapa-múndi** no estilo de Super Mario World: um mapa maior com áreas, que podem ser ilhas ou cidades.
- A primeira área é o **Condomínio**. Entrando nela, abre-se um **mapa aberto** do jogo.
- Dentro de cada área há **vários puzzles** como os do modo Fases, **colecionáveis**, **easter eggs** e uma
  **missão principal**, que libera o próximo mapa.
- O motivo do mapa-múndi é o desempenho: áreas separadas em vez de um mapa aberto gigantesco.

## Estrutura

1. **Mapa-múndi**: uma maquete pequena e leve, na mesma direção artística das fases (procedural, cores quentes,
   brinquedos e casinhas em miniatura). Cada área é um ponto do mapa ligado por caminhos. Como no Mario World, as
   cachorrinhas andam pelos caminhos (não livremente) e um caminho só se abre quando a missão principal da área
   anterior termina. Em cada ponto aparecem o estado da missão, os puzzles resolvidos e os colecionáveis achados.
2. **Área**: um mapa aberto de **tamanho limitado** (proposta: o equivalente a três a cinco fases atuais, dividido em
   zonas), carregado sob demanda quando a jogadora entra e descartado ao sair, como as fases hoje.
3. **Conteúdo de cada área**:
   - **Missão principal**: uma sequência de etapas com objetivo (como as fases), que termina num acontecimento que
     abre o caminho seguinte no mapa-múndi.
   - **Puzzles**: desafios independentes espalhados pelas zonas, com as mecânicas que já existem (cordinha, tábua de
     pressão, ventilador e superbafo, trem, pulo e impulso na parede, Lambe-Lambe) e mecânicas novas. Cada puzzle
     tem a própria recompensa.
   - **Colecionáveis**: os petiscos de sempre e um colecionável próprio da área.
   - **Easter eggs**: segredos sem dica, que não aparecem em nenhum menu, contador ou texto do jogo.

## Primeira área: Condomínio (proposta, a confirmar)

O condomínio junta lugares que as fases já visitaram, agora conectados: a portaria, o jardim com o lago, a pracinha,
a lavanderia coletiva, a garagem e o terraço do prédio. Ideias de missão principal para o usuário escolher: achar o
que impede o portão da garagem de abrir para chegar à próxima área, ou ajudar um vizinho a recuperar algo que mudou
de lugar pelo condomínio, passando por várias zonas. O cenário e os objetos devem ser apresentados ao usuário em
poucas linhas antes da construção, como nas fases.

## Desempenho (celular incluído)

- **Mapa-múndi**: cena pequena, poucas luzes, sem física; usa os mesmos perfis de qualidade (`src/core/quality.js`).
- **Áreas**: orçamento medido com `tools/scripts/measure-resources.mjs`, com teto de desenho e de triângulos
  definido a partir da fase mais pesada. Zonas fora de vista não desenham (culling por zona), objetos repetidos
  usam instâncias e as sombras ficam limitadas à vizinhança das cachorrinhas. Nada de streaming contínuo na primeira
  versão: a área inteira carrega na entrada, atrás da cortina.
- Precisa rodar bem nos aparelhos de referência (Infinix Note 30 5G e iPhone 13) sem mudar o perfil do PC.

## Progresso

- Save próprio do modo (proposta: chave `rr-story-v1`), sem tocar no save das fases (`rr-progress-v1`).
- Por área: missão concluída, puzzles resolvidos, colecionáveis e segredos achados (por id, para sobreviver a
  mudanças de versão), e o caminho do mapa-múndi já aberto.
- Continuar no modo leva ao mapa-múndi, no ponto da última área visitada.
- O modo sem dicas (Opções) também vale aqui: sem objetivo escrito, marcador e dicas em balão.

## Arquitetura (proposta)

- Pasta própria (`src/story/`): o mapa-múndi e as áreas (`areas/condominio/` com layout, cenário e puzzles).
- Reaproveitar o que existe: mecânicas de `src/game/mechanics/`, `puzzleKit`, HUD, cortina, câmera de seguimento,
  colisão e navegação por layout (`createCollisionWorld`, `createNavigator`) e o descarte de recursos por escopo.
- O núcleo hoje trata a fase como uma unidade com uma vitória. A área precisa de vários objetivos ao mesmo tempo,
  uma missão que atravessa zonas e salvar no meio. Proposta: um "puzzle de área" que compõe puzzles de zona (cada
  um com o contrato de `Puzzle` atual) e emite eventos `story:*` para o progresso e o HUD.
- No menu, trocar o "Em breve" do cartão Modo História pela abertura do mapa-múndi.

## Entregas sugeridas (um PR cada, com prévia e aprovação)

1. Mapa-múndi navegável com o Condomínio e um caminho ainda fechado; entrar e sair da área (só o cenário).
2. Condomínio com o cenário completo, dois puzzles, colecionáveis e o save do modo.
3. Missão principal do Condomínio abrindo o caminho; os segredos da área.
4. Segunda área.

## Em aberto com o usuário

- Os lugares do Condomínio e a missão principal.
- Como as cachorrinhas aparecem no mapa-múndi (as duas juntas, em miniatura?) e o ângulo da câmera.
- O tema das próximas áreas (ilhas, cidades, bairros).
