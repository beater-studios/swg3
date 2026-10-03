---
slug: base64
order: 4
group: ACE and codes
title: Install the Base64 writer
summary: A prepared Pokémon in the PC that turns box names into any Pokémon, with a single code.
needs: ACE unlocked
level: advanced
---
The Base64 writer, made by Mettrich, reads the box names and writes a whole Pokémon to Box 14, slot 30. Once it's installed, any Pokémon you create here goes into your game with a single trigger, with the nature, OT and nickname exactly as you set them.

1. **Get ACE working.** See [Unlock ACE](/guides/ace).
2. **Set up the writer.** Follow [MankeyMite's interactive guide](https://mankeymite.github.io/Gen3ACEPokemonBuilder/docs/spawn-setup-interactive.html) and pick FireRed or LeafGreen on Switch. It's five codes that create a Metang named WELDR (it goes to Box 14, slot 28), plus a Pokémon with the nickname the guide tells you (slot 29).
3. **Clear the area.** From row 2 of Box 13 through Box 14, slot 30, keep everything empty, except for the writer's pieces.
4. **Generate the names.** In [Editor](/editor), create or open the Pokémon and go to "Put in your game".
5. **Check and type.** The [Codes](/codes) page shows which Pokémon the names will create and the key for each letter.
6. **Save and trigger.** The Pokémon shows up in Box 14, slot 30.

:::tip When the Switch rejects a name
The site already builds the names with the Switch word filter in mind, without changing the Pokémon. If a box still gets rejected, use "Convert" on it: the uppercase letters become symbols the writer reads the same way.
:::

:::note If it goes wrong
A Bad Egg or scrambled data means a typo: restart without saving and compare on the Codes page. If the game crashes, a writer piece is out of place or something is sitting in the clear area. Shorter box names don't get a space at the end.
:::

:::source
Based on the [Gen3ACEPokemonBuilder](https://github.com/MankeyMite/Gen3ACEPokemonBuilder) guide and code. Not yet tested on this project's console.
:::
