---
slug: esp32
order: 9
group: Referência
title: Placa ESP32
summary: Em breve, uma placa barata que conversa com o Switch como se fosse outro console.
needs: placa ESP32, chaves do seu console
level: avançado
---
Uma placa ESP32 vai fingir ser outro Switch na comunicação local. Com ela, o PC troca Pokémon com o seu jogo e usa o Mystery Gift, sem digitar códigos.

:::note Em breve
O firmware da placa e o programa de troca do PC estão em desenvolvimento e ainda não estão disponíveis. Este guia ganha o passo a passo quando tudo funcionar de ponta a ponta. Até lá, leve o Pokémon ao jogo pelos códigos: veja [Coloque seu Pokémon no jogo](/guides/put-in-game).
:::

O que vai precisar:

- um ESP32 clássico (2,4 GHz), como um dongle USB com ESP32-PICO-D4 ou uma placa DevKitC;
- as chaves do seu próprio console (`prod.keys`), que a comunicação local exige.

:::warn Só chaves suas
O projeto não aceita nem distribui chaves de outras pessoas.
:::
