---
slug: ace
order: 3
group: ACE e códigos
title: Libere a ACE
summary: A rota com o Mail glitch que faz o jogo executar os nomes das boxes, sem vencer a Elite Four.
needs: itens e trocas do jogo
level: avançado
---
ACE (execução de código arbitrário) faz o jogo ler os nomes das boxes do PC como instruções. A porta de entrada é uma espécie glitch, a 0x0351: quando você a move no PC, o jogo executa o que está escrito nas boxes. Esta rota cria a espécie sem precisar vencer a Elite Four.

1. **Junte o necessário e salve.** Para o [Mail glitch](https://pomeg-letterbombers.github.io/pokemon-ace-notes/mail-glitch/): o Farfetch'd e o Mr. Mime das trocas do jogo (Knock Off e Recycle), um item que se consome em batalha, Retro Mail e 8 HP Up.
2. **Abra o Mail glitchado.** Com a Box 3, slot 1 vazia e 6 Pokémon na party, dê um Mail a cada um. No 6º, a tela de escrever o Mail abre diferente, com as palavras já preenchidas: é o Mail glitchado. Cada uma das 9 palavras grava num pedaço do Pokémon da Box 3, slot 1.
3. **Escreva o 1º Mail e confirme.** Deixe a mensagem como na tela do meio, abaixo (cada palavra está no grupo indicado). Na Box 3, slot 1 aparece a espécie glitch 0x0200: HOCK, nível 4, fêmea. Se vier outro nome ou um Bad Egg, confira se o slot estava vazio e escreva de novo.

:::screen mail-glitch

4. **Ajuste os EVs.** Ponha o HOCK na party e dê 8 HP Up. Depois derrote 1 Caterpie (Viridian Forest) e 1 Doduo (Route 16) ou 1 Mankey (Route 22) com ele. Não deixe ele ganhar outros EVs de HP ou Attack. Devolva o HOCK à Box 3, slot 1.
5. **Escreva o 2º Mail e confirme.** No Mail glitchado de novo, a mensagem do 1º aparece: só troque a 2ª e a 4ª palavra, como na última tela. O HOCK vira a 0x0351: nível 100, macho, com um nome estranho. Ela é a sua espécie de ACE.
6. **Teste.** Digite o código de verificação e dispare. Se aparecer o Pokémon esperado na Box 9, a ACE está funcionando.

:::warn No Switch
Não use espaço nos três últimos caracteres das Boxes 4, 8 e 12, e use só códigos feitos para o Switch: algumas instruções travam e o filtro de palavras recusa certos nomes. Detalhes na [FAQ](https://pomeg-letterbombers.github.io/pokemon-ace-notes/frlg-faq/).
:::

:::note Se der errado
EVs ou palavras erradas transformam a espécie em Bad Egg. Apague e refaça enquanto tiver Mail.
:::

:::note Jogo em outra língua
As telas acima são do jogo em inglês. Nas outras línguas, as palavras são estas (o 2º Mail troca a 2ª e a 4ª do mesmo jeito):

| língua | 1ª | 2ª | 3ª | 4ª | espécie 0x0200 |
|---|---|---|---|---|---|
| francês | ??? | HAUTEUR | CE SERA TOI | NOMADE | TONNE |
| italiano | ??? | SUL SERIO | FATTI AVANTI | CRUDELE | CK |
| alemão | ??? | HÖHEN | DU BIST DRAN | LATSCH | HOCK |
| espanhol | (?) | INFANTIL | TE ELIJO | RIDÍCULO | ENO |
:::

:::source
Resumo das [pokemon-ace-notes](https://pomeg-letterbombers.github.io/pokemon-ace-notes/). Ainda não testado no console deste projeto.
:::
