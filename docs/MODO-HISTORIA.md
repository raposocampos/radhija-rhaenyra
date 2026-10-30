# Modo História: visão de design

Situação: **enredo aprovado no plano em 2026-10-29. O storyboard e as seis decisões padrão aguardam confirmação, e
nada foi implementado.**
- O roteiro completo ("As Aventuras de Radhija & Rhaenyra": enredo, elenco, casos, capítulos e mapa-múndi) está em
  [HISTORIA.md](HISTORIA.md).
- Este documento trata da estrutura, do desempenho, do progresso e das etapas de entrega.
- No menu (Jogar), o cartão "Modo História" ainda mostra o selo "Em breve" e não abre nada (`MODES.story` em
  `src/ui/markup.js`).

## O que o usuário pediu

**Em 2026-10-18:**
- um **mapa-múndi** no estilo de Super Mario World, com áreas;
- áreas que guardam puzzles, colecionáveis, segredos e uma **missão principal** que libera o próximo mapa;
- o Condomínio como primeira área;
- áreas separadas por causa do desempenho.

**Em 2026-10-29, com o roteiro:**
- **O mapa-múndi é próprio e separado do mapa das fases.** Pandorópolis, o mapa livre isométrico, continua sendo o
  mapa das fases. O Modo História tem uma maquete leve com caminhos, como no Mario World, e cada área abre um mapa
  maior, com carregamentos escondidos.
- **O Condomínio é o Recanto das Patinhas** (cap. 1).
- **8 capítulos, com um núcleo de 4** (1, 2, 6 e 8), que conta a história completa sozinho.
- **Sem palavras nas cenas:** só desenhos e gestos. Os humanos aparecem só de relance.
- **Investigação:** Faro, Reconstrução, pistas, mural de pistas e enigmas.
- **Sem ligação de enredo com as 10 fases.** Personagens e peças podem ser reaproveitados.

## Estrutura

### 1. Mapa-múndi

Uma maquete pequena e leve, na direção artística das fases.
- As irmãs andam pela trilha entre os nós, a ativa na frente e a irmã atrás.
- Um caminho só abre quando a missão da área anterior termina. Às vezes também depende do enigma do mapa do Capitão.
- Cada nó mostra o estado da missão, as pistas e os colecionáveis achados.
- O mural de pistas abre a partir do mapa.

### 2. Área

- **Tamanho.** Um mapa aberto do tamanho de **uma a duas fases atuais**, dividido em zonas.
- **Carregamento.** Ela carrega inteira atrás do cartão "Capítulo N" e é descartada ao sair, como as fases hoje.

### 3. Conteúdo de cada área

- **Missão principal:** uma sequência de etapas que termina num acontecimento e abre o caminho seguinte.
- **Pistas:** 1 obrigatória na missão e 2 escondidas, achadas com Faro, enigma ou observação.
- **Puzzles paralelos:** 2 ou 3, com as mecânicas atuais e as novas da história.
- **Colecionáveis:** o colecionável próprio da área e os petiscos de sempre.
- **Segredos:** sem dica, sem aparecer em nenhum menu, contador ou texto do jogo.

## Desempenho (celular incluído)

- **Aparelhos-alvo.** Precisa rodar bem no Infinix Note 30 5G, no iPhone 13 e no Android pequeno, inclusive no perfil
  `minima` (sem pós-processamento e sem sombras), sem mudar o perfil do PC.
- **Mapa-múndi.** Cena pequena, com poucas luzes e sem física. Usa os perfis de `src/core/quality.js`.
- **Áreas.** O orçamento é medido com `tools/scripts/measure-resources.mjs`.
  - O teto de desenho e de triângulos é o da fase 10.
  - Zonas fora de vista não desenham.
  - Objetos repetidos usam instâncias.
  - As sombras ficam limitadas à vizinhança das cachorrinhas.
- **Carregamentos escondidos.** A área inteira monta e compila (`compileAsync`) atrás do cartão, como o PR #60 faz
  nas fases.
  - Nada é montado nem compilado com a câmera andando.
  - Mudanças de luz, maré e chuva acontecem só nas transições.
- **Faro.** Funciona sem pós-processamento: trilhas emissivas e um véu leve à frente da câmera.

## Progresso

- **Save próprio.** O modo tem a chave `rr-story-v1`, separada do save das fases (`rr-progress-v1`), e usa
  `storageKey()` nas prévias.
- **O que se guarda, sempre por id para sobreviver a mudanças de versão:**
  - o capítulo atual;
  - os nós e caminhos abertos;
  - a etapa da missão de cada área;
  - as pistas achadas;
  - os casos fechados, com o carimbo comum ou dourado;
  - os puzzles resolvidos, os colecionáveis e os segredos;
  - as cenas já vistas.
- **Continuar** leva ao mapa-múndi, no nó da última área visitada.
- **O modo sem dicas.** Vale também aqui:
  - esconde o objetivo do HUD, o marcador e os balões de dica;
  - mantém os títulos de capítulo, as cenas e o mural, onde a pergunta aberta continua como pictograma.

## Arquitetura (proposta)

- **Pasta própria, `src/story/`:**
  - o controlador do modo;
  - o mapa-múndi;
  - o save;
  - o kit de cenas: sequenciador com botão de pular (segurar), gestos, balões de ícone, faixas de cinema e íris;
  - a investigação: Faro, Reconstrução e mural;
  - as áreas, por exemplo `areas/recanto/`, com layout, cenário e puzzles.
- **O que se reaproveita:**
  - as mecânicas de `src/game/mechanics/` e o `puzzleKit`;
  - o HUD e a cortina;
  - a câmera de seguimento e o `focusShot` de `src/game/cameraRig.js`;
  - o `walkPath` e o `InputLock.drive`;
  - a colisão e a navegação por layout;
  - o descarte de recursos por escopo;
  - o padrão do mapa das fases (`src/levels/mapa/`, `levelPreload`).
- **O "puzzle de área".** O núcleo hoje trata a fase como uma unidade com uma vitória. A área precisa de vários
  objetivos ao mesmo tempo, de uma missão que atravessa zonas e de salvar no meio. A proposta é um "puzzle de área"
  que compõe puzzles de zona, cada um com o contrato de `Puzzle` atual, e emite eventos `story:*` para o progresso, o
  mural e o HUD.
- **Sistemas novos:**
  - o Faro e a Reconstrução;
  - os NPCs cachorros, Pandora e Amora (`npcDog` sobre `src/dogs/v2/`);
  - as mãos e os pés humanos.
- **No menu,** o "Em breve" do cartão Modo História dá lugar à abertura do mapa-múndi.

## Entregas (um PR cada, com prévia e aprovação)

Cada etapa começa depois de o usuário aprovar a anterior. **A etapa 2 é um portão:** se a fatia jogável não divertir
ou não se entender, a história volta para revisão antes de seguir.

| Etapa | O que entrega |
|---|---|
| 1 | O roteiro ([HISTORIA.md](HISTORIA.md)) e um storyboard visual para aprovação. |
| 2 | **Fatia jogável.** Inclui:<br>• a abertura e o cap. 1 completo;<br>• o Faro em pulso e a Reconstrução da piscina;<br>• a lupa do HUD guardando as pistas;<br>• um mural provisório, aberto no fim do cap. 1, só com o caso 3 e um tutorial curto sem a Pandora (a etapa 4 o troca pelo empréstimo e pelo tutorial dela);<br>• o kit de cenas, só no que essas cenas pedem.<br>É testada nos três aparelhos e mostrada a alguém que não leu o roteiro. |
| 3 | Mapa-múndi, save `rr-story-v1`, mural completo e cartão do menu ativo. Na prévia, `?historia&tudo` libera tudo. |
| 4 | Cap. 2: Pandora e Amora, o latidão e o tutorial completo do mural. |
| 5 | Cap. 6: lanterna, equilíbrio nos raios, roda-gigante e a virada do meio. |
| 6 | Cap. 8, final e créditos, com o cabrestante. No núcleo, a escada usa o empurrão no lugar do quebra-vento, e o caso 2 fecha na porta da torre. Com isso o núcleo fica jogável de ponta a ponta e pode ser publicado. |
| 7 a 10 | Caps. 3, 4, 5 e 7, na ordem que o usuário preferir, cada um cortável. Uma mecânica nova (tirolesa, nado, cavar, quebra-vento) ganha antes um PR de protótipo numa arena. |
| 11 | Polimento de desempenho e créditos com todos os capítulos. |

**Verificação de cada etapa:**
- **Testes unitários:**
  - estado final igual com e sem pular a cena;
  - nenhuma trava de controle sobrando;
  - ninguém atravessando;
  - regras do mural: a ligação errada volta, e o caso só fecha com as pistas necessárias.
- **E2E** do capítulo pelo workflow manual.
- **Capturas** nos 11 tamanhos de tela.
- **Orçamento** com `measure-resources.mjs`.
- **Fluidez:** nenhum quadro longo com a câmera andando, e Faro legível no perfil `minima`.
- **Teste do usuário** nos três aparelhos.

## Em aberto com o usuário

**As seis decisões padrão do roteiro,** listadas em [HISTORIA.md](HISTORIA.md):
- mistério de verdade;
- prazo visível;
- fatia jogável primeiro;
- núcleo de 4 capítulos;
- Faro em pulso;
- custo do erro no mural.

**Ainda por decidir:**
- a voz "uá-uá" dos humanos;
- a duração de cada capítulo (proposta: 12 a 20 minutos);
- o botão do Faro;
- o ângulo de câmera do mapa-múndi.
