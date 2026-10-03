# Pokémon formats

What the suite reads and writes, and with what guarantee.

## Gen 3: pk3 (`src/swg3/gen3/pk3.py`)

- 80 bytes in the box, 100 in the party. Substructures shuffled by `PID % 24` and encrypted with `PID ^ OTID`, 16-bit checksum. All of it from the decomp (`include/pokemon.h`, `src/pokemon.c`).
- Fields: species, item, experience, friendship, moves and PP, EVs, contest, Pokérus, origin (level, game, ball, OT gender), IVs, ability, ribbons, nickname and OT (decomp character table), TID and SID, nature, shiny, level and stats in the party.
- Guarantee: round-trip tests in all 24 orders and block positions checked against `GetSubstruct`, plus the real files below. A Pokémon taken from the target console is still missing, which depends on the trade host.
- `pk3.load` accepts the game format (encrypted and shuffled) and plain text in canonical order, deciding by the checksum. Confirmed with 1,463 real files exported by PKHeX: `.pk3` is plain text; `.ek3` is the game format.
- Checked with real Pokémon: 1,463 `.pk3` from PKHeX (1,455 Japanese, events from several games) without a single validation error and with an exact round trip through the cipher, and the 31 from `rawpk.txt` in the game format. Test in `tests/test_samples.py`, which uses `pk3-en/`, `pk3-jp/`, `samples/` and `rawpk.txt` when they exist on the machine (they do not go into git).
- Japanese names: the decomp's Japanese table (`charmap_jp.tsv`) overrides the Western one when the Pokémon's language is Japanese.

## Creation and editing (`src/swg3/gen3/builder.py`)

- Follows `CreateBoxMon` and `GiveBoxMonInitialMoveset` (`src/pokemon.c`): minimum experience for the level, base friendship, Poké Ball, met level equal to the level, ability from the PID, level-up moves in the game's order; party with calculated stats and empty mail (`CreateMon`).
- The PID is drawn at random to satisfy nature, shiny, gender, ability and Unown letter. It does not follow the PID and IV correlation of any RNG method: legality checkers that verify this reject it.
- Editing: missing fields stay as they are; the PID only changes if it no longer satisfies what was requested. Changing the species redoes the moves and the default nickname; changing the level adjusts the experience.

## Box names (`src/swg3/gen3/boxnames.py`)

- 14 boxes of 8 characters plus the 0xFF terminator, side by side (`boxNames` in `include/pokemon_storage_system.h`).
- Naming screen keyboard (`sKeyboardChars` in `src/naming_screen.c`): uppercase, lowercase and symbols; starts empty on uppercase; Select switches the page, B deletes, Start goes to OK.
- Checks characters, length, empty box, terminators in the raw bytes and differences between names and bytes. It does not know the revision 10 word filter (`svc_BadWordCheck`).

## Base64 writer and Switch filter

- `src/swg3/gen3/base64box.py`: the Pokémon's 80 bytes to the names of the 14 boxes, with the output for the Switch, and the reverse. See [Base64 writer](../research/base64-writer.md).
- `src/swg3/gen3/badwords.py`: prediction of the Switch word filter, also used when checking box names.

## pk3 validation (`src/swg3/gen3/validate.py`)

Rejects what the game would not generate or what can corrupt a save: checksum, Bad Egg, nonexistent species (including the placeholders 252 to 276 and 412), language, item, moves (nonexistent, repeated or none), EV total above 510, ball, met level, empty names or names outside the table, and in the party level, zeroed stats and current HP above the maximum.

Consistency with the species data (`src/swg3/gen3/species.py`):

- error: experience above the maximum; party level different from the level by experience;
- warning: party stats different from the calculation (the game recalculates); ability that does not match the PID or set on a species with a single ability; move outside what is learned by that level. Event moves are not considered, which is why it is a warning.

Moves (`species.learnable_moves`, `species.egg_father`):

- Learnset: by level (up to the current level), TM/HM and tutor of the species and its pre-evolutions. The FR/LG tutor includes the Cape Brink one (Frenzy Plant, Blast Burn and Hydro Cannon, each only for its own species: `CanLearnTutorMove` in `src/party_menu.c`).
- Caught form: with the encounter identified (`encounters.who`, the species of the family the game gives at that location and level), pre-evolutions before the caught form do not count. A Pidgeotto caught at level 29 was never a Pidgey, so it does not have the Mirror Move that Pidgey learns at 47 (Pidgeotto only at 52): warning. An approximation that remains: a pre-evolution level-up move counts if its level does not exceed the current one, without checking the level at which it evolved.
- Egg move only on a hatched Pokémon (met level 0). When hatched, the egg moves all come from the same father (`BuildEggMoveset` in `src/daycare.c`), who had to know all of them at the same time: the father is a male sharing an egg group with the family (a male-only or genderless family breeds with Ditto, so the father belongs to it; Nidoran♀ and Illumise lay eggs that hatch Nidoran♂ and Volbeat), and knows each move by level, TM, tutor (FR/LG, Emerald or XD) or as his own egg move, inherited from his father (a chain, with no generation limit). No possible father: warning. Example: Bulbasaur with Light Screen and Skull Bash (only the Squirtle line learns Skull Bash, and it does not have Light Screen); with Light Screen and Safeguard there is a father (Chikorita learns both).
- Tutors from another game become a note: the Emerald one (`tutor_emerald`, from pokeemerald) counts if the Pokémon went through Emerald; the XD one (`tutor_xd`, from PokeAPI, not verified against the game) counts if it is from XD or went through it. In the editor, both appear in their own groups in the move choice.

Encounter, FR/LG only (`src/swg3/gen3/encounters.py`): species, location and met level against the game's encounters (wild, static, gifts, events, roaming dogs, trades and eggs), the event mark and the Unown letter against the location's Tanoby chamber. Each chamber has its own map section and gives only the letters of its slots (`sUnownLetterSlots` in `src/wild_encounter.c`; Monean gives A and ?, Viapois gives Z and !); the letter comes from the PID (`GET_UNOWN_LETTER`), so a letter from outside is a warning on the PID. The builder picks a chamber and PID that match: with the requested letter, the automatic location is a chamber that gives it; with the requested chamber, the PID comes out with one of its letters. In the editor, only the chambers that give the letter count as "where the species appears". Intended use: before writing any Pokémon and in the future trade room.

## Species data (`src/swg3/gen3/species.py`)

- Read directly from the compiled Switch ROM, at the `.elf` addresses: base stats, types, growth rate, abilities, level-up learnset, TM/HM, tutor, egg moves, experience tables, species and move names.
- Also from the ROM: type names (`gTypeNames`), abilities (`gAbilityNames`) and items (`gItems`), move PP (`gBattleMoves`), base friendship and National Pokédex number (`sSpeciesToNationalPokedexNum`). Map sections (met location) read from the enum in `include/constants/region_map_sections.h`.
- The character table includes the apostrophe (0xB4, the same byte as `’`), which the generator used to drop because it comes escaped in `charmap.txt`.
- Game calculations: level from experience, stats (with the nature's 16-bit overflow reproduced), learnable moves, gender from the PID (`GetGenderFromSpeciesAndPersonality`) and Hidden Power (`Cmd_hiddenpowercalc`).

## Command line

- `swg3 pk3 show FILE`: accepts both formats and shows the fields, level from experience, calculated stats and move names.
- `swg3 pk3 check FILES...`: validates; exits with code 1 if there is an error.
- `swg3 recipe check FILE`: checks and summarizes a recipe (`docs/project/recipe.md`).

## Generated data (`src/swg3/data/`)

| file | source | script |
|---|---|---|
| `firered_switch.sym` | `.elf` of the compiled decomp | `tools/gen_symbols.py` |
| `charmap_en.tsv` | `charmap.txt` | `tools/gen_charmap.py` |
| `species.tsv` | `include/constants/species.h` | `tools/gen_species.py` |
| `frlg_wild.json` | `src/data/wild_encounters.json` | `tools/gen_wild.py` |
| `frlg_species.json` | compiled ROM (`pokefirered_switch.gba`) | `tools/gen_species_data.py` |
