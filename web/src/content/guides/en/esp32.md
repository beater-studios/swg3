---
slug: esp32
order: 9
group: Reference
title: ESP32 board
summary: Coming soon, a cheap board that talks to the Switch as if it were another console.
needs: ESP32 board, your console's keys
level: advanced
---
An ESP32 board will pretend to be another Switch over local wireless. With it, your PC trades Pokémon with your game and uses Mystery Gift, no codes to type.

:::note Coming soon
The board firmware and the PC trade program are in development and not available yet. This guide gets the step by step once everything works end to end. Until then, bring your Pokémon into the game with codes: see [Put your Pokémon in the game](/guides/put-in-game).
:::

What you will need:

- a classic ESP32 (2.4 GHz), such as a USB dongle with an ESP32-PICO-D4 or a DevKitC board;
- the keys from your own console (`prod.keys`), which local wireless requires.

:::warn Only your own keys
The project doesn't accept or distribute anyone else's keys.
:::
