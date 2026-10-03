---
title: Primeira seed no RNG
summary: Do seu jogo até o timer, escolhendo uma seed e um alvo de verdade.
---

## -

Olá! Eu sou o Professor Oak. Vou te mostrar como funciona o RNG no FireRed e no LeafGreen do Switch: escolher a hora certa de começar o jogo para que o Pokémon saia do jeito que você quer. Use **Próximo** para seguir e **Sair** quando quiser.

## rng-game

Primeiro, o seu jogo. Marque a versão e o console. O TID é o número do seu cartão de treinador; o SID só importa se você quer um shiny.

## rng-option

Este é o menu OPTION. SOUND, BUTTON MODE e o botão que você aperta no PRESS START mudam a tabela de seeds. Deixe tudo igual ao do seu jogo, senão o timer erra a hora.

## rng-steps

O caminho tem quatro etapas: a seed, o alvo, o timer e o ajuste. Vamos passar por cada uma.

## rng-seed-list go=rng:seed wait=rng:seed-chosen

A seed depende de quanto tempo passa até você apertar o botão no PRESS START. Escolha uma da lista e clique em **Usar**. Qualquer uma serve para começar.

## rng-target go=rng:target wait=rng:target-aimed

Agora, o Pokémon que você quer. Escolha o tipo de encontro, o Pokémon e os filtros, clique em **Buscar** e depois em **Mirar** num dos resultados.

## rng-timer go=rng:timer

Com a seed e o alvo, o timer sabe quando apertar cada botão. Salve na frente do Pokémon e feche o jogo. Clique em **Começar** junto com o último [[A]] antes de o jogo carregar, o que confirma o perfil. Depois, aperte [[A]] em cada bipe: no PRESS START, no CONTINUE e, no último, fale com o Pokémon ou comece o encontro.

## rng-adjust-tab go=rng:timer

Saiu outro Pokémon? É normal nas primeiras tentativas. Na etapa **Ajustar**, conte o que saiu: o site descobre onde você caiu e corrige o timer.

## -

Pronto, esse é o ciclo! Antes de mirar no Pokémon dos seus sonhos, vale calibrar uma vez na aba **Conferir seed**: um bipe no PRESS START e dois Pokémon selvagens mostram quanto o seu aperto cai antes ou depois. Boa sorte, treinador!
