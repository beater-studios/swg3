# Credits

Copyright (C) 2026 Beater Studios (https://beaterstudios.com/, studiosbeater@gmail.com). Distributed under the AGPLv3 (`LICENSE`). Code ported from third parties keeps its original authorship, listed below.

Projects studied and, where noted, with ported code. Each ported file cites its origin in the header.

| project | authors | license | use |
|---|---|---|---|
| [pret/pokefirered](https://github.com/pret/pokefirered) | pret | no license stated | structures, symbols and character table generated from the compiled decomp |
| [pret/pokeemerald](https://github.com/pret/pokeemerald) | pret | no license stated | study: the Pokérus rule (`src/pokemon.c`), which was left empty in FR/LG; Emerald-only map sections (`src/data/region_map/region_map_sections.json`) and Emerald tutors (`src/data/pokemon/tutor_learnsets.h`), read by `tools/gen_species_data.py`; Emerald Brendan walking in the empty state of the Emerald theme (`graphics/object_events/pics/people/brendan/walking.png` and `palettes/brendan.pal`, sprites © Nintendo/Creatures Inc./GAME FREAK inc.), by `tools/gen_player.py`; the Faraway Island Mew that flies around the site (`graphics/object_events/pics/pokemon/mew.png`, sprites © Nintendo/Creatures Inc./GAME FREAK inc.), also by `tools/gen_player.py`; Deoxys's Speed Forme, the Emerald one (`graphics/pokemon/deoxys/anim_front.png` and `icon_speed.png`, sprites © Nintendo/Creatures Inc./GAME FREAK inc.), by `tools/gen_mon_sprites.py`; the summary screen (INFO, SKILLS, MOVES) of the editor card's "as in the game" view, in `web/src/assets/summary/` by `tools/gen_summary.py`; the location grid of the Hoenn map (`src/data/region_map/region_map_layout.h` and the positions from `region_map_sections.json`), in `src/swg3/data/frlg_region_map.json` by `tools/gen_town_map.py` |
| [pret/pokeruby](https://github.com/pret/pokeruby) | pret | no license stated | Ruby/Sapphire Brendan and May walking in the empty states of the Ruby and Sapphire themes (`graphics/object_events/pics/people/brendan/normal.png` and `may/normal.png`, sprites © Nintendo/Creatures Inc./GAME FREAK inc.), by `tools/gen_player.py` |
| [Decryptu/pokeldn](https://github.com/Decryptu/pokeldn) | Decryptu and contributors | AGPLv3 | study of LDN, Pia, GBA link, Mystery Gift and payloads |
| [tornadus/frlg-ldn-trade](https://github.com/tornadus/frlg-ldn-trade) | tornadus | AGPLv3 | study |
| [MercuryEnigma/frlg-ldn-trade](https://github.com/MercuryEnigma/frlg-ldn-trade) | MercuryEnigma | AGPLv3 | study |
| [kinnay/LDN](https://github.com/kinnay/LDN) | kinnay | GPLv3 | study of LDN |
| [PKHeX](https://github.com/kwsch/PKHeX) | kwsch and contributors | GPLv3 | reference for the PID and IV method check; source of the Switch word list (via Gen3ACEPokemonBuilder) |
| [NintendoClients wiki](https://github.com/kinnay/NintendoClients/wiki) | kinnay and contributors | no license stated | documentation of LDN and Pia |
| [lincoln-lm/ten-lines](https://github.com/lincoln-lm/ten-lines) | lincoln-lm | GPLv3 | Switch seed timing rules, search and calibration ported |
| FR/LG Switch initial seeds spreadsheet | RNG community (used by ten-lines) | no license stated | table of seeds and timings, downloaded by `tools/gen_switch_seeds.py` |
| [Admiral-Fish/PokeFinder](https://github.com/Admiral-Fish/PokeFinder) | Admiral-Fish | GPLv3 | study of RNG |
| [DasAmpharos/EonTimer](https://github.com/DasAmpharos/EonTimer) | DasAmpharos | no license stated | study only; the site's timer was reimplemented |
| [E-Sh4rk/CodeGenerator](https://github.com/E-Sh4rk/CodeGenerator) | E-Sh4rk | no license stated | study only |
| [E-Sh4rk/EmeraldACE_web](https://github.com/E-Sh4rk/EmeraldACE_web) | E-Sh4rk and contributors | no license stated | study only |
| [pokemon-ace-notes](https://pomeg-letterbombers.github.io/pokemon-ace-notes/) | pomeg-letterbombers | website | documentation of ACE |
| [MankeyMite/Gen3ACEPokemonBuilder](https://github.com/MankeyMite/Gen3ACEPokemonBuilder) | MankeyMite and contributors | GPLv3 | Base64 writer conversion and Switch word filter ported; writer guide |
| Base64 writer | Mettrich | no license stated | ACE setup cited in the guides; no box code copied |
| list of Pokémon in Base64 (`rawpk.txt`) | MankeyMite | public text | test vectors read from the local file, not copied into the repository |
| codes from the EmeraldACE_web collection | Shao, Papa Jefe, Mettrich, final, ComplexRobot and others (the `@@ author` field of each code) | no license stated | study only; the site links to them |
| [PokeAPI](https://github.com/PokeAPI/pokeapi) | Paul Hallett and PokéAPI contributors | BSD 3-Clause (© 2013–2023 Paul Hallett and PokéAPI contributors) | XD tutors per species (`data/v2/csv/pokemon_moves.csv`, version group xd, tutor method), in `tutor_xd` of `src/swg3/data/frlg_species.json` by `tools/gen_species_data.py`; there is no XD decomp |
| [PokéSprite](https://github.com/msikma/pokesprite) | msikma and contributors | MIT code; sprites © Nintendo/Creatures Inc./GAME FREAK inc. | item icons (normal version, Gen 3 when it exists) and the 32 Gen 3 ribbons, in `web/src/assets/items.png` and `ribbons.png`, generated by `tools/gen_sprites.py` |
| [The Spriters Resource](https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/3864/), FR/LG "Town Map" sheet | FrenchOrange (who submitted the sheet) | sprites © Nintendo/Creatures Inc./GAME FREAK inc. | the site's region map: crops in `web/src/assets/townmap/`, generated by `tools/gen_town_map.py` from `references/sprites/frlg_town_map_sheet.png` (the maps come from the row with the fly and cave markers; the case also serves Hoenn, in a taller version, `case-*-tall.png`) |
| [The Spriters Resource](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/116724/), Emerald "Hoenn Map UI" sheet | Zeronutty (who submitted the sheet; asks for credit, not required) | sprites © Nintendo/Creatures Inc./GAME FREAK inc. | Hoenn map (`web/src/assets/townmap/map-hoenn.png`), generated by `tools/gen_town_map.py` from `references/sprites/hoenn_map_sheet.png` |
| graphics from the [pret/pokefirered](https://github.com/pret/pokefirered) decomp (`graphics/naming_screen/`, `graphics/fonts/`, `graphics/pokemon_storage/wallpapers/`, `graphics/easy_chat/`, `graphics/text_window/`, `graphics/interface/ball/`, `graphics/object_events/`, `graphics/summary_screen/`, `graphics/interface/menu_info`, `graphics/pokemon/`, `graphics/spinda_spots/`, `graphics/oak_speech/oak/`, `graphics/text_window/menu_message.png`, `graphics/fonts/down_arrows.png`) | pret | sprites © Nintendo/Creatures Inc./GAME FREAK inc. | the site's box naming screen (keyboard, cursor, buttons, game font) and the top of the PC boxes with the default wallpapers, built in `web/src/assets/naming/` by `tools/gen_naming_screen.py`; the Mail writing screens of the ACE guide, in `web/src/assets/mail/` by `tools/gen_mail_screen.py`; the catch Poké Ball that wobbles in the RNG searches, in `web/src/assets/ball-poke.png` by `tools/gen_ball.py`; Red and Leaf walking in the empty states, in `web/src/assets/player-*.png` by `tools/gen_player.py`; the Pokémon front pictures (with the normal and shiny palettes and Spinda's spots) of the summary screen, in `web/public/mon/`, and the party icons of the species field, in `web/src/assets/mon-icons.png`, by `tools/gen_mon_sprites.py`; Professor Oak from the game's intro, the dialogue box and the continue arrow of the guided mode, in `web/src/assets/oak/` by `tools/gen_oak.py` |
| [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) | The Pixelify Sans Project Authors | OFL 1.1 | the site's heading font, in `web/src/assets/fonts/`, with the license in `web/public/fonts/OFL.txt` |

## Ported code

| our file | origin | license |
|---|---|---|
| `src/swg3/gen3/base64box.py` | `Gen3ACEPokemonBuilder/src/lib/gen3/builder.js` (`toBase64Emerald`, symbol swaps) | GPLv3 |
| `web/src/lib/gen3/switchseed.ts`, `web/src/lib/gen3/calibration.ts` (rules) | `ten-lines/src/wasm/src/initial_seed.hpp`, `src/tenLines/index.ts`, `src/components/CalibrationTable.tsx` | GPLv3 |
| `web/src/lib/gen3/base64box.ts`, `web/src/lib/gen3/badwords.ts` | `Gen3ACEPokemonBuilder/src/lib/gen3/builder.js`, `src/lib/profanityFilter.js` | GPLv3 |
| `src/swg3/gen3/badwords.py` | `Gen3ACEPokemonBuilder/src/lib/profanityFilter.js` | GPLv3 |
| `src/swg3/data/badwords_switch.txt` | `Gen3ACEPokemonBuilder/src/data/profanity.gen3.js`, from PKHeX's `badwords_switch.txt` | GPLv3 |

Data generated from the `pret/pokefirered` decomp (symbols, character table, species, wild encounters) lives in `src/swg3/data/` and is regenerated by the scripts in `tools/`.
