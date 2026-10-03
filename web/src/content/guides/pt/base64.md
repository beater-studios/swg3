---
slug: base64
order: 4
group: ACE e códigos
title: Instale o Base64 writer
summary: Um Pokémon preparado no PC que transforma nomes de box em qualquer Pokémon, com um código só.
needs: ACE liberada
level: avançado
---
O Base64 writer, criado por Mettrich, lê os nomes das boxes e grava um Pokémon inteiro na Box 14, slot 30. Depois de instalado, qualquer Pokémon criado aqui entra no jogo com um disparo, com nature, OT e apelido do jeito que você montou.

1. **Tenha a ACE funcionando.** Veja [Libere a ACE](/guides/ace).
2. **Monte o writer.** Siga o [guia interativo de MankeyMite](https://mankeymite.github.io/Gen3ACEPokemonBuilder/docs/spawn-setup-interactive.html) escolhendo FireRed ou LeafGreen no Switch. São cinco códigos que criam um Metang chamado WELDR (vai para a Box 14, slot 28), mais um Pokémon com o apelido que o guia indica (slot 29).
3. **Libere a área.** Da 2ª linha da Box 13 até o slot 30 da Box 14, deixe tudo vazio, fora as peças do writer.
4. **Gere os nomes.** Em [Editor](/editor), crie ou abra o Pokémon e vá em "Colocar no jogo".
5. **Confira e digite.** A página [Códigos](/codes) mostra qual Pokémon os nomes vão gerar e a tecla de cada letra.
6. **Salve e dispare.** O Pokémon aparece na Box 14, slot 30.

:::tip Quando o Switch recusa um nome
O site já monta os nomes pensando no filtro de palavras do Switch, sem mudar o Pokémon. Se mesmo assim uma box for recusada, use "Converter" nela: as maiúsculas viram símbolos que o writer entende igual.
:::

:::note Se der errado
Bad Egg ou dados trocados é erro de digitação: reinicie sem salvar e compare na página Códigos. Se o jogo travar, alguma peça do writer está fora do lugar ou há algo na área livre. Box mais curta não leva espaço no fim.
:::

:::source
Baseado no guia e no código do [Gen3ACEPokemonBuilder](https://github.com/MankeyMite/Gen3ACEPokemonBuilder). Ainda não testado no console deste projeto.
:::
