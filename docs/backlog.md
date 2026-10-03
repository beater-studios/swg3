# Backlog

What is left, in priority order within each group. Update it when something gets done or comes up. The suite build order is in [architecture](architecture.md).

## Test on the console

The code exists; it still needs confirming on a console. In order, from simplest to most laborious.

1. **Full RNG with a target** (the most important thing left). Calibration done (2026-09-29): with the timer starting on the profile click, the press lands about 1.7 s early (two measurements, 70 ms apart) and the seed comes out 0 to 19 below the table, varying between attempts ([RNG](research/rng.md)). Left: apply the correction (+1.75 s), confirm in a check that it lands near 0, and run the whole flow with a real target (Target, Timer, Adjust), noting how many attempts it takes. This also measures what is still not verified: 2 advances per frame on the map, the 450-frame minimum on CONTINUE, the H2/H4 methods and the egg pickup ones, the 750 ms of the Switch 2.
2. **RNG with an unmeasured combination** (after item 1). Lock off and the same OPTION menu in the game, for example MONO + L=A + A. Note: whether Find out found the seed and whether the following attempts got closer. Tests the estimate (`web/src/pages/rng/learned.ts`).
3. **ACE and Base64 writer** (touches the save; save before each step). Pre-E4 route up to the verification code (expected Pokémon in Box 9). Then install the writer and put in a Pokémon from the site. Note: whether the Switch accepted the 14 names and whether the Pokémon in Box 14, slot 30 matched the site's.

Outside this list: moving 0x0351 in the move-multiple-Pokémon mode should not be tested on purpose (the community reports that it disappears); the ESP32 board is tested together with the PC program (item 1 of Build).

## Site

1. **Ruby, Sapphire and Emerald encounters.** On FR/LG the validation already cross-checks species, location and met level (wild, static, gifts, events, roaming dogs, in-game trades and eggs, `src/swg3/gen3/encounters.py`). The same is missing for Ruby, Sapphire and Emerald: generate from `pret/pokeruby` and `pret/pokeemerald` (clone into `references/`) the wild encounters per version, the static and gift encounters from the scripts, the in-game trades and the map to location link, in the format of `frlg_wild.json` and `frlg_encounters.json`. Caveats: Ruby and Sapphire have version exclusives; in Emerald locations 197 to 212 are its own; the events (Southern Island, Faraway Island, Birth Island, Navel Rock) depend on tickets. Until then, Pokémon originating from these games do not get this check.
2. **Frame advance offset** (ten-lines field): only if Adjust shows large fixed deviations (hundreds of frame advances), which today would fall outside the search's ±300.

## Build

1. **ESP32 board and PC program.** The board firmware and the serial protocol with the PC are being developed outside this repository and come back when they work end to end. Next: test the firmware on the board and write the PC side.
2. **LDN session.** Join a Switch local communication session with the board ([LDN](research/ldn.md)).
3. **FR/LG trade host.** Consumes the [recipe](project/recipe.md). Unlocks on the site "Put in your game" through the ESP32 and "Edit and send back" (scope items 7 and 8, ESP32 half), and allows checking the pk3 against a Pokémon taken from the target console.
4. **Web Serial on the site.** Connect the board from the browser (Chrome and Edge), after the host.
5. **Mystery Gift and save reader.** Read-only save dump, then hooks. A save reader can start earlier, tested against real FR/LG saves.
6. **Emulator rehearsal.** Run the compiled `pokefirered_switch.gba` in a PC emulator to rehearse codes without risking the save. The Switch wrapper syscalls may not work outside it: verify.
7. **Map the missing OPTION menu combinations.** The cheap path is done: with the "Only combinations measured by the community" lock off, the site estimates from the closest measured combination and learns from hits confirmed in Adjust (browser only, no export). Left: confirm on the console that the estimate is right. Full path, if worth it: automated frame-by-frame collection, like the Japanese community's ([RNG, unmapped combinations](research/rng.md)).
8. **Ideas not started yet:** what else pokeldn enables, fast-forward and gameplay tweaks, a trade simulator (including trade evolution), online trades and a device without a PC.
9. **Emerald.** In scope because of the shared base with FR/LG; not started.

## Adjust

- **LDN keys.** Confirm which keys the pokeldn host requires and whether there is an alternative to `prod.keys` ([keys](project/keys.md)).
- **Pokémon HOME (October 2026, expected).** When it reaches FR/LG, revalidate codes and addresses on the new game version before recommending any code.
