# RNG in FRLG on the Switch

## Algorithm

- Standard Gen 3 LCRNG: `state = state * 0x41C64E6D + 0x6073`, with a 16-bit initial seed set by the moment the game leaves the title screen.
- RNG manipulation is legitimate and needs no code: you only need to get the timing right. With ACE, you can read or write the state directly.

## Tools (in `references/`)

### ten-lines

- Gen 3 RNG suite (web): target finder, initial seed, calibration with an IV calculator.
- Explicitly supports the Switch: "Switch FireRed (ENG/SPA/FRE/ITA/GER)" and LeafGreen, with consoles "Nintendo Switch 1" (offset 0 ms) and "Nintendo Switch 2" (offset -750 ms) (`src/components/InitialSeedForm.tsx:197`, `src/tenLines/index.ts:97`).
- The seed data comes from community spreadsheets. On the Switch only some option combinations are mapped (ENG FR: Help+A mono and stereo, Help+Start mono).
- On the Switch, the calibrator assumes 2 RNG advances per frame in the overworld (`src/components/CalibrationTable.tsx:121`).
- The PokeFinder submodule (`src/wasm/lib/PokeFinder`) is empty. Run `git submodule update --init` to get the code.

### EonTimer

- Timer with beeps only, no RNG calculation. Gen 3 modes: Standard and Variable Target.
- GBA rate: 16777216/280896, about 59.7275 Hz. No Switch option: use GBA and absorb the latency in calibration.

### PokeFinder

- In `references/PokeFinder` (C++/Qt). RNG tool for Gen 3 to 8. In Gen 3: Wild, Static, Egg, IDs and GameCube. It is the core that ten-lines uses as a submodule for its searches.
- Has no Switch-specific mode: the Switch timing part lives in ten-lines.

## Addresses

- pokeldn uses `gRngValue`, `Random` and `SeedRng` in `asm/rng-trace.s` and `asm/call.s`, and the residents `shiny.s` and `asm/field/shiny-seek.s` advance the RNG to the next shiny encounter.
- These addresses are from French FireRed. For the English Switch version, take them from `pret/pokefirered` (target `firered_switch`). Not verified.

## Our implementation

Only on the site, in `web/src/lib/gen3/` (`rng.ts`, `wild.ts`, `egg.ts`, `switchseed.ts`, `calibration.ts`), based on the decomp (sources cited in the modules). Until 2026-09-29 there was a Python version used as a reference; it was removed, and its results were frozen as a regression test in `web/tests/vectors/frozen/`.

- LCRNG with forward and backward stepping, jump of n steps in O(log n) and distance between two states.
- `Random32()` confirmed in the Switch binary: the first call is the low half of the PID (`CreateBoxMon`, 0x080412A8).
- PID and IVs for static encounters (`static_spread`) and for wild encounters with a locked nature (`wild_spread_from_nature`).
- Advance search by filter (`search_static`, `min_ivs`).
- Wild encounters (`wild.ts`): slot, level, nature, PID and IVs, with the tables for every FireRed and LeafGreen map generated from the decomp. The "will there be an encounter" check uses a separate generator (`WildEncounterRandom`). Before the slot, `gRngValue` still moves through `HandleWildEncounterCooldown`, `DoGlobalWildEncounterDiceRoll` and `TryStartRoamerEncounter`; this only changes the advance.
- Methods 1, 2 and 4 (H1/H2/H4 for wild, M1/M2/M4 for static): a VBlank in the middle of `CreateBoxMon` skips one call before the IVs (2) or between them (4). Same model as PokeFinder and ten-lines. The searches accept the method; Check seed and Adjust test all three.
- Per-frame consumption: the VBlank calls `Random()` once per frame (`src/main.c:412`). ten-lines assumes 2 per frame in the Switch overworld; the source of the second has not been found in the decomp yet. It does not come from code exclusive to revision 10 (no `REVISION >= 0xA` calls `Random()`) nor from NPCs, which only roll when changing direction or pausing.
- Unown (Tanoby chambers): no nature roll; the PID repeats until it matches the slot's letter. In the Switch binary the first call becomes the HIGH half of the PID (`GenerateUnownPersonalityByLetter`, 0x080861F2), the opposite of `Random32()`.
- Eggs (`egg.ts`): low half of the PID at generation (compatibility check and `Random() % 0xFFFE + 1`) and, at pickup, high half, IVs and inheritance of 3 IVs (stat and parent rolled). The inheritance follows the game's bug (`RemoveIVIndexFromList` receives the stat as a position, and the same stat can be inherited twice). Pickup has PokeFinder's four FRLG methods (Bred, Split, Alternate, Mixed), with VBlank calls before the IVs and the inheritance; not verified on the Switch. The pickup search compares all four by default and marks each egg's method.
- Switch initial seeds, timer and calibration on the site: see `web/src/lib/gen3/switchseed.ts`, `calibration.ts` and `web/src/pages/rng/`. Seed table from the community spreadsheet (FireRed: mono and stereo with Help and A, mono with Help and START; LeafGreen: those plus stereo with LR and A). Seed time = (spreadsheet time + 5737) / 16 frames; Switch 2 is 750 ms earlier.
- Missing: confirm the second advance per frame and the moment the seed time starts counting.

## Opportunities

- Without ACE: use ten-lines + EonTimer on the Switch, with calibrated manual timing.
- With ACE: read the RNG to calibrate, or write the target state and skip the timer.
- Resident shiny hook (like pokeldn's `shiny.s`), installed through ACE.

## Initial seed in FR/LG (decomp)

- Timer 1 starts when the title screen starts (`CB2_InitTitleScreen`, `StartTimer1`, `src/title_screen.c`). A or START leaves the screen (`SetTitleScreenScene_Run`); with BUTTON MODE L=A, L becomes A (`src/main.c`, key remapping).
- After the button, the cover Pokémon's cry plays, 90 frames pass and the screen fades to white; only then does `SeedRngAndSetTrainerId` use the timer value as the seed (`SetTitleScreenScene_Cry`, `src/main.c`).
- Before that, only two save options are read: SOUND (`SetPokemonCryStereo` in `src/intro.c`) and BUTTON MODE (L remapping in `src/main.c` and the help system in `src/help_system_util.c`). TEXT SPEED, BATTLE SCENE, BATTLE STYLE and FRAME do not appear on this path. That is why the community table only varies sound, button mode and the button pressed.
- Exactly how sound and button mode change the timing (mono or stereo mixing of the cry, key handling) comes from reading the code, not measured.

## Unmapped combinations (search and analysis, 2026-09-29)

- The spreadsheet used by ten-lines (`tools/gen_switch_seeds.py`) has columns for 14 combinations, but only 3 measured on English FireRed and 4 on English LeafGreen. Downloaded on 2026-09-29; ten-lines says it updates the list on every build, from the same spreadsheet.
- A search on the web and on GitHub found no public list of LR or L=A for English FR/LG on the Switch. The Japanese community has lists with more combinations (for example MONO with L=A), but for the Japanese version, and the language changes the seeds ([Blisy's guide](https://blisy.net/g3/frlg-initial-seed.html)).
- The Japanese community collects seeds in an automated way: controller by macro (NX Macro Controller), receives the Eevee from Celadon Mansion (or catches Zapdos, Lugia or Ho-Oh), reads nature and stats through image recognition, computes the seed and writes it to CSV, frame by frame. Supports Switch and Switch 2 in Japanese and English ([article](https://dokudenpa.hatenablog.jp/entry/GetSeed), [common CSV format](https://hackmd.io/@niart/SJQrDiHFZg)).
- PokemonAutomation automates FRLG RNG on the Switch using the ten-lines lists, only with BUTTON MODE HELP ([guide](https://github.com/PokemonAutomation/pokemonautomation.github.io/blob/main/docs/Programs/PokemonFRLG/RngManipulationGuide.md)).
- Analysis of our table: the seed is the timer 1 cycle counter (16 bits). Between neighboring rows (about 1 frame) the seed almost always moves by close to 0x4940, which is 280,896 cycles (1 GBA frame) modulo 65,536. Changing an option shifts the seed by only a few dozen cycles, with variation: STEREO against MONO gives 0 in about 24% of the rows and is almost always within +0x40; START against A gives -8 in about 39%. Conclusion (not verified on the console): an unmapped combination should land near the measured column for the same instant, a few dozen values away.
- Implemented on the site (`web/src/pages/rng/learned.ts`): with the "Only combinations measured by the community" toggle off, a combination without a table uses the most similar measurement as a reference. Calibration tests seeds from `seed_shift - seed_spread` to `seed_shift + seed_spread` around each reference seed (new `calibrate` parameters, with Python and TS parity). Each "This one" stores in the browser the shift for that instant; the list then shows the exact seed at the instants that were hit and, at the others, the reference plus the most common shift. No export, so nobody feeds in made-up data.

## Timer starting point on the Switch (research, 2026-09-29)

- The spreadsheet used by ten-lines and its code do not say where the time counts from; English guides only say "when opening the game". ten-lines adds 5737/16 of a frame (about 6 s) to the spreadsheet time, which looks like the Switch loading before the GBA.
- The Japanese community counts from the press on the Switch menu that opens the game: the profile confirmation on the user selection screen ([guide](https://note.com/famous_auk630/n/nc13bb624166b); collection format on [HackMD](https://hackmd.io/@niart/SJQrDiHFZg)). Rule adopted on the site: the last A before the game loads (profile, or the icon if the Switch does not ask for a profile). Not verified for the English spreadsheet; the Check seed tab measures it.
- Switch 1 against Switch 2: ten-lines uses -750 ms (English version). Japanese guides report 72 to 90 frames (1.2 to 1.5 s) on the Japanese version ([blog](https://wasou3721.hatenablog.com/entry/2026/05/17/235553)). Not verified.

## Checking the seed with a wild Pokémon (measured, 2026-09-29)

- Finding the seed you got from a low-level wild Pokémon (Route 6, levels 10 to 15) carries little information: each stat accepts several IVs. With the real seed outside the searched range, seeds that match by chance show up: across 12 Pokémon, searching ±500 seeds × 20,000 advances, 91 false matches with one level, 18 with three consecutive levels and 8 with the Pokémon 10 levels higher. In the near search (±10 seeds), 6 false matches out of 12 with one level.
- Consequence: the Check seed tab only searches nearby and requires two checks with the same difference (within 50 ms) before correcting the timer. The first tests (+3.0 s, -4.2 or +5.1 s, +8.5 s) came from the far search and were probably chance.
- Pokémon with a known advance (static, gift or Sweet Scent) give a much stronger check, because the advance is no longer an unknown.

## Algorithm review (2026-09-29)

Review of the whole RNG against the decomp, PokeFinder and ten-lines, after a Pidgey that no seed explained.

- Checked and correct: LCRNG constants and jump; order of the wild calls (slot, level, nature, PID with the low half first, IVs); slot limits for grass, water, Rock Smash and fishing; Route 6 table (FireRed and LeafGreen with no difference); Unown; stat formula (including the 16-bit truncation of the nature); nature table; base stats of the 386 species; pk3 (substructure order, checksum, encryption, shiny, gender); import of the seed tables (same spreadsheet and columns as ten-lines, identical time conversion, Switch 2 with -750 ms).
- Fixed:
  - Egg IV inheritance removed the stat by value; the game removes it by position (8% of pickups change).
  - Egg pickup without the VBlank calls; now with PokeFinder's four methods.
  - Methods H2/H4 and M2/M4 missing; now in the searches, in Adjust and in Check seed.
  - The timer started 150 ms (plus the audio wake-up time) after the click, about 9 frames late on every beep. Now zero is the click, and the beeps subtract the audio output latency (Bluetooth headphones go over 100 ms).
  - The IV calculator assumed 0 EVs at every level. Whoever levels up by battling gains EVs and falls outside the range; now there is EV slack after the first row ("Leveled up by battling" option).
  - Check seed: unique per table position (the same seed appears twice in the table, a few frames apart), search only within the advances that fit the marked times, a second search up to about 1 s when nothing matches nearby (marked as less reliable), species and nature with no default value.
  - pk3 ribbons included bit 31 (fateful).
- Open, not verified: the seed is written after the cover cry, 90 frames and the fade (`SetTitleScreenScene_Cry`, `src/title_screen.c`), not on the button press. The ten-lines advance model absorbs this in step 2; the estimate of advances per frame on the map in the Check seed tab is slightly below the real value.
- The test Pidgey (Route 6, level 13, Adamant, CONTINUE at 6.6 s, battle at 15.2 s) is still unexplained: with H1/H2/H4, EV slack and any seed from the FireRed tables, no candidate fits the advances of the marked times (806 to 2,551). The ones that show up are more than 4.8 s away and need 4,000 to 20,000 advances, so they are chance. Suspects: data typed differently from the game, an encounter that was not the first after CONTINUE, or extra `Random()` calls on the map (NPCs, recap) beyond what the range accepts.

## App version on the Switch (2026-09-29, not verified)

- There are two versions: the Switch app's (emulator and package; the tested console shows 1.0.0) and the ROM's inside it (English FireRed, revision 10), which the decomp reproduces byte for byte. The encounter model and the addresses come from the ROM.
- The seed depends on the emulator (Timer1 at the moment of the press). The community spreadsheet does not say which app version it was measured on. If it is from a version other than 1.0.0 and Nintendo changed the emulator's timing, the seeds will not match. To check: whether an app update exists and which version the community measured on.

## Seed confirmed on the console: offset in value and in time (measured, 2026-09-29)

- Test with two Pokémon from the same attempt (FireRed, app 1.0.0, Switch 1, MONO + HELP + A, target 16A6, timer starting on the profile click): a Quiet male Oddish at level 16 and then a Quirky female Pidgey at level 13, on Route 6, CONTINUE at 4.8 s and battle at 12.6 s. Search over all 65,536 seeds: the only plausible combination was seed **7160** (Oddish at advance 1,017, H1; Pidgey at 8,703, H4).
- Confirmed by prediction: with 7160, the site predicted the stats at the next level (Oddish 17: 42/23/28/34/28/13; Pidgey 14 via H4: 36/17/16/16/15/23) and both matched exactly in the game. First real case of method H4.
- 7160 is not in any table. The closest row is **7170, at 33,321 ms** (MONO + HELP + A): the press landed **1.68 s before** the prediction for 16A6, and the console gave a seed **16 below** the table for that instant.
- The earlier Pidgeys, which did not match any exact seed, fit the same pattern when the search accepts seeds near the table's: Adamant Pidgey at 4E5E (table 4E71, -19, at -1.47 s, H4) and Serious Pidgey at 0010 (table 0019, -9, at -1.63 s, H2), both with advances within the marked times. The chance of both landing in that time and offset range by chance is about 1%.
- Conclusion (three attempts): with the timer starting on the profile click, the press lands about 1.5 to 1.7 s before the table time; and the seed comes out between 9 and 19 below the table value for that instant. It is not known yet whether the value offset is fixed (app version) or varies with each attempt (emulator jitter).
- Second strong measurement (2026-09-29), with the timer starting when the opening credits appear (about 0.5 s of reaction): Relaxed male Meowth at level 12 and Lonely male Pidgey at level 13, CONTINUE at 6.6 s, battle at 16.0 s. Seed **30C2**, exactly the table value, with the press **2.1 s after** the prediction (Meowth at advance 1,313, H2; Pidgey at 11,496, H4). The result held after leveling both up.
- Putting the two measurements together: from the profile click to the credits about 3.8 s pass (the ~3 s of the opening plus reaction), and the table's zero lies between the two moments, about 1.7 s after the click. The value offset is **not fixed**: -16 in one attempt, 0 in the other (and -9 and -19 for the weaker Pidgeys). For RNG this matters: even on the right frame, the seed can come out a few values off the table, and the target only appears if the value matches.
- Third strong measurement (2026-09-29), again with the timer starting on the profile click: Gentle female Pidgey at level 13 and Hasty female Oddish at level 15, CONTINUE at 7.6 s, battle at 14.6 s. Seed **58B4**, 2 below the table (58B6), press **1.750 s before** (Pidgey at advance 1,087, H4; Oddish at 9,611, H4). With the first one (-1.683 s), the profile click is consistent within about 70 ms: the step 1 adjustment for this way is about +1.7 s. Values measured so far: -16, 0 and -2 (strong), -9 and -19 (weak).
- Advances per frame on the map estimated from the marked times: 1.64 and 1.51. The delays in marking the battle (about 0.5 s) pull the estimate down; ten-lines' 2-per-frame model remains plausible, not verified.
- Consequence for the site: searching only the exact table seeds never finds anything on this console. Done: the Check seed tab tests neighboring values of each row, accepts a second Pokémon from the same attempt and learns the offset (`learned.ts`), which then applies to the seed list, the target search and Adjust.

## Cross-check with ten-lines (2026-09-29)

- The second Pidgey (Serious, levels 13 to 15) was run in the ten-lines web Calibration tab, with target 16A6, MONO + HELP + A, advances from 300 to 30,000. The only level 13 Pidgey in slot 1 it found is the same as the site's search: 51CD, -767 ms, advance 26,834, method 4, IVs 25/20/13/18/13/28. The site's model matches ten-lines'.
- This candidate is chance: 26,834 advances in 13.3 s would require about 34 per frame, and nothing in the game code consumes that much (VBlank 1 per frame; NPCs, cries and fishing rarely). Neither the site nor ten-lines explains the Pidgeys from a table seed at a possible advance. Remaining suspects: the table not applying to the tested app (version 1.0.0) or something in the attempt.

## New game TID does not show the seed in FR/LG (decomp, 2026-09-29)

- `SeedRngAndSetTrainerId` (`src/main.c`) stores the title screen Timer1 in `gTrainerId`, and `InitPlayerTrainerId` (`src/new_game.c`) uses it as the TID. It looked like a way to read the seed directly on the Trainer Card.
- It does not work: in FR/LG the player's name always opens the naming screen (`Task_OakSpeech_FadeOutForPlayerNamingScreen`, `src/oak_speech.c`; the list of preset names is only for the rival). The naming screen restarts Timer1 when it opens (`StartTimer1`) and calls `SeedRngAndSetTrainerId` on exit (`MainState_Exit`, `src/naming_screen.c`), so the TID measures the time spent on the naming screen, not the title screen seed. Confirmed on the console: the game went straight to the keyboard.
- Context: two Pidgeys with three levels each did not match any table seed at possible advances (not even with advances up to 150,000 near 16A6: only scattered hits, with no pattern), and the encounter code in the Switch binary agrees with the model (`CreateMonWithNature` 0x08041540 with the low half first; `CreateBoxMon` with no calls between the fixed PID and the IVs).

## How the game creates the SID (decomp and PokeFinder)

- `InitPlayerTrainerId` (`src/new_game.c`) builds the ID as `(Random() << 16) | gTrainerId`: the TID is the Timer1 at the exit of the naming screen (section above) and the SID is a number from the generator a few advances later, with the TID itself as the seed. PokeFinder does the same for FRLG (`IDGenerator3::generateFRLGE`: `PokeRNG rng(tid)` and `sid = rng.nextUShort()` at each advance).
- Knowing the TID, the possible SIDs are the generator's sequence starting from it; how many advances pass until the end of Oak's speech depends on each person's pace, so you are left with a list of candidates, not a single value.
- Ways to find the SID on the Switch (the site's guide, `web/src/content/guides/*/sid.md`): the ACE code "Read Pokemon TID and SID" (`_SWITCH` version); the trade through the ESP32 board, which brings the full OT ID (depends on the trade host); a shiny you caught, which narrows the SID to 8 values (`TID ^ SID ^ PID_high ^ PID_low < 8`) and, crossed with the TID candidates, should leave one (not verified on the Switch).

## Recap on continue (quest log)

- On entering CONTINUE, FR/LG shows the "Previously on your quest" recap before giving back control. During it, A skips to the next scene and B ends it all (`QL_HandleInput`, `src/quest_log.c`); at the end, A or B closes the window (`Task_WaitAtEndOfQuestLog`). The recap is the same on every attempt without saving.
- The generator keeps advancing at least once per frame during it; whether the recap makes extra `Random()` calls (moving objects) has not been verified. For RNG, what matters is always handling it the same way (recommended: B as soon as it appears). The site warns about this in the Timer and Check seed tabs.
- In a test with Meowth (level 10 to 12, Route 6), candidate CDC8 (-17 ms, advance ~4,500) is the one that fits the recap time plus a few seconds on the map; a second check is still needed to confirm it.
