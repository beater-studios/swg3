---
slug: sid
order: 10
group: Referência
title: Como descobrir o SID
summary: O que é o Secret ID, quando ele importa e os caminhos para descobrir o seu no Switch.
needs: depende do caminho
level: intermediário
---
O SID (Secret ID) é o número secreto do treinador. O jogo nunca mostra: no Trainer Card aparece só o TID (IDNo.).

**Ele só importa para shiny.** Junto com o TID e o PID do Pokémon, o SID decide se ele sai shiny. Para fazer RNG de nature, IVs ou habilidade, não precisa dele: deixe o campo SID vazio na página de [RNG](/rng).

## Como o jogo cria o TID e o SID

Num jogo novo, quando você termina a tela de nome do jogador, o jogo lê o relógio interno. Esse número vira o seu TID e também a seed do gerador. Um pouco depois, ainda no discurso do Oak, o jogo sorteia o SID a partir dessa seed.

Por isso, sabendo o TID, dá para listar os SIDs possíveis, mas não saber qual é: depende de quantos sorteios passaram até o fim do discurso, e isso muda com o seu ritmo de apertar A.

## Caminhos no Switch

1. **Troca pela placa ESP32** (em breve). O Pokémon que você manda pela troca traz o seu TID e o seu SID, e a página [Editor](/editor) mostra os dois ao abrir o arquivo. Não mexe no save. Depende do programa de troca, ainda em construção ([ESP32](/guides/esp32)).
2. **Código de ACE "Read Pokemon TID and SID".** Tem versão para o Switch no gerador da comunidade. Coloque um Pokémon capturado por você no 2º lugar da party, rode o código e siga as instruções do gerador para ler o resultado. Exige a ACE funcionando ([ACE](/guides/ace)) e os cuidados de sempre com o save ([segurança](/guides/safety)).
3. **Um shiny capturado por você.** Com o PID de um shiny, o SID fica entre 8 valores; cruzando com a lista que sai do TID, deve sobrar um. Só serve se você tiver um shiny e souber o PID dele, por exemplo pela aba Conferir seed, se ele saiu numa tentativa cronometrada.

:::tip Para shiny sem saber o SID
Sem o SID, a busca de shiny não funciona, mas nature, IVs e habilidade funcionam normalmente. Dá para fazer o RNG do que importa e deixar o shiny para depois.
:::

:::source
Criação do TID e do SID: decomp pret/pokefirered (`SeedRngAndSetTrainerId`, `InitPlayerTrainerId`) e PokeFinder (gerador de IDs do Gen 3). Os caminhos 1 e 3 ainda não foram testados no console deste projeto.
:::
