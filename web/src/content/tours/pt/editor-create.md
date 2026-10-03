---
title: Criar um Pokémon e levar ao jogo
summary: Montar um Pokémon no editor, conferir a validação e escolher como levar ao jogo.
---

## -

Olá! No editor você monta um Pokémon do jeito que quiser, confere se o jogo aceitaria e leva para o seu save. Vamos criar um juntos.

## editor-tabs go=editor:edit

O editor tem três abas: **Abrir**, para ver um arquivo .pk3; **Criar ou editar**, onde estamos; e **Colocar no jogo**, para levar o Pokémon ao seu save.

## editor-species

Escolha a espécie e o nível. O site já preenche golpes e encontro como o jogo daria.

## editor-nature

Aqui ficam nature, shiny, gênero e Ability. O site sorteia um PID que bate com tudo o que você pedir.

## editor-trainer

O nome do OT é obrigatório. TID, SID e nome do OT ficam guardados neste navegador e valem também no RNG.

## editor-create wait=editor:created

Pronto para ver o resultado? Preencha o nome do OT, se ainda não preencheu, e clique em **Criar e conferir**.

## editor-result

Aqui está o seu Pokémon! A validação mostra erros, avisos e o que o site escolheu sozinho. Na aba **Como no jogo**, você vê a tela de resumo do jogo.

## editor-send wait=editor:sent

Gostou? Clique em **Colocar no jogo**.

## editor-send-writer go=editor:send

Agora, escolha como levar: digitando nomes de box no jogo com o Base64 writer, que já leva os nomes para a página Códigos, ou pela placa ESP32, mais abaixo.

## -

Muito bem! Só um cuidado: Pokémon criados ou alterados aqui não devem ir para o Pokémon HOME. Divirta-se, treinador!
