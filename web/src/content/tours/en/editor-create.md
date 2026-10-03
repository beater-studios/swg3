---
title: Create a Pokémon and take it to the game
summary: Build a Pokémon in the editor, check the validation and choose how to take it to the game.
---

## -

Hello there! In the editor you build a Pokémon any way you like, check whether the game would accept it and take it to your save. Let's create one together.

## editor-tabs go=editor:edit

The editor has three tabs: **Open**, to look at a .pk3 file; **Create or edit**, where we are; and **Put in your game**, to take the Pokémon to your save.

## editor-species

Choose the species and the level. The site already fills in moves and the encounter the way the game would.

## editor-nature

Here you set nature, shiny, gender and Ability. The site draws a PID that matches everything you ask for.

## editor-trainer

The OT name is required. TID, SID and OT name are kept in this browser and also apply in the RNG.

## editor-create wait=editor:created

Ready to see the result? Fill in the OT name, if you haven't yet, and click **Create and check**.

## editor-result

Here's your Pokémon! The validation shows errors, warnings and what the site chose by itself. In the **As in the game** tab, you see the game's summary screen.

## editor-send wait=editor:sent

Like it? Click **Put in your game**.

## editor-send-writer go=editor:send

Now choose how to take it: typing box names in the game with the Base64 writer, which sends the names to the Codes page, or with the ESP32 board, further down.

## -

Well done! Just one thing: Pokémon created or changed here shouldn't go to Pokémon HOME. Have fun, trainer!
