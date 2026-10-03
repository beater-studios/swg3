# Available ACE codes (EmeraldACE_web)

Collection of box name codes used by E-Sh4rk's CodeGenerator and by the ACE notes. Source: `references/EmeraldACE_web/files_frlg/list.json`. The codes are generated at https://e-sh4rk.github.io/CodeGenerator/ (FRLG version).

## How to read

- Keys per version: `eng0` and `eng1` are the English 1.0 and 1.1 cartridges; `eng10` is the English Switch version (revision 10). Same for `fra10`, `ger10`, `spa10`, `ita10`.
- Only what has `eng10` is ready for our target. Some use their own `_SWITCH` file, others the same file as the cartridge (they do not depend on addresses).
- "Bootstrapped" requires the Box 14 exit: every file with `exit = "Bootstrapped"` says "requires a Box 14 exit code for grab ACE". The code takes Boxes 1 to 13 and Box 14 holds the prebuilt exit. The files do not mention the Beedrill bootstrap (correction of an earlier reading).
- Box counts estimated from the start of each exit in `exit.txt`: GrabACEExit and ROM_BX_lr_Box10_Grab about 11, ROM_BX_lr_Box6_Grab about 7, Bootstrapped 13 plus Box 14.
- Format: header with `@@` (title, author, exit code), configurable constants and ARM instructions. Comments with `;` explain usage and prerequisites.

## User goals

| goal | code | Switch (`eng10`) |
|---|---|---|
| Johto evolutions before beating the game | Get National Dex via NPC | yes |
| Find the secret ID | Read Pokemon TID and SID / Read Pokemon SID | yes (`_SWITCH`) |
| Trade evolution on your own | Create Tradeback NPC | yes (`CreateTradebackNPCSwitch.txt`) |

Create Tradeback NPC: after running it, talk to the Old Gentleman in the Viridian Pokémon Center. He trades the first Pokémon in the party for a placeholder and, on the second conversation, gives the original back, triggering the trade evolution.

## With Switch support

- Pokémon, reading: PID, SID, TID and SID, IVs and ability (IVEA), EVs, contest stats, Pokérus, ribbons and obedience (all with `_SWITCH`).
- Pokémon, editing: level (`_SWITCH`), species, experience, IVs and ability, EVs, contest stats, Pokérus and origin, ribbons and obedience, make shiny (`_SWITCH`), teach any move.
- Pokémon, creation: species from nothing, 6IV egg, egg with custom Hidden Power, egg with any PID, any gift Pokémon, wild battle with any Pokémon.
- Events: "fateful" Mew battle (FR and LG with `_SWITCH`, and a universal version at the Daycare).
- Respawn: Zapdos, Articuno, Moltres, Mewtwo, Deoxys, Lugia and Ho-Oh, Lapras, Eevee, Magikarp, Togepi, Hitmonlee and Hitmonchan, Snorlax, starters, fossils.
- Trainer and world: change TID and SID, swap TID with SID, change trainer gender, change flag, variable and weather, re-enable single-use tutors, any item, item in the wrong pocket, all Poké Balls, TMs and berries.
- Pokédex: complete Kanto, National or the whole Pokédex.
- Roamer: change species, IVs and PID.
- RNG and map: change PRNG seed and warp (bootstrapped, `_Switch`), warp anywhere (`_SWITCH`).
- Scripts: run script via NPC (FR and LG, `_SWITCH`).

## Without Switch support (yet)

- Change Trainer Name (and bootstrapped version).
- Change Pokémon OT Name, Replace Pokemon OT.
- Perform PID or TID corruption, Change Pokémon PID or TID (bootstrapped).
- Run script via GlobalScriptContext.
- "move ACE" and "grab ACE" versions specific to other regions.

These are candidates for porting using the `pret/pokefirered` symbol map (`firered_switch`).

## PDF guides (`references/EmeraldACE_web/doc/`)

- `FRLG_Short_Exit_Codes_Guide.pdf`: short exit codes.
- `SeedChangeAndWarpFRLG_Guide.pdf`: seed change and warp.
- `PRNG_stall_guide.pdf`, `SetMonDataFields.txt`, `HiddenPowerHex.txt`, `naturewords.txt`: supporting references.

## Bringing a Pokémon into the game with the codes

Survey of the parameters of each relevant eng10 code (reading the files, without running them). Implemented in `src/swg3/gen3/codeplan.py`, which builds the plan for a Pokémon.

- Creation: "Start wild battle with any Pokemon" (species, level, NPC; the caught Pokémon is legitimate, nature from the game), "Create any Gift Pokemon (Bootstrapped)" (species and level only), "Generate egg with any PID" (species and PID, Box 10 slot 2; data almost all zeroed), "Create 6IV Egg from Nothing" and "Create Egg with Custom Hidden Power" (PID and OTID zeroed, Hardy nature; adjusted through the Mail glitch with `naturewords.txt`), "Create Pokemon species from nothing" (species only, shiny, Box 10 slot 19).
- Reading (party): "Read Pokemon PID" and "Read Pokemon TID and SID" (2nd in the party, result in the stats), "Read Pokemon IVEA field" and "Read EVs field" (1st in the party, output in the 2nd).
- Editing (Box 10 slot 19, they ask for the Pokémon's `pid`, `tid`, `sid` and the current value): "Change experience", "Change IVs and ability" (IVs, egg and ability in one 32-bit field: enter all of them), "Change EVs", "Change Pokerus and Origin Data", "Change ribbons and obedience", "Change species". "Change Pokemon Level" touches the 6th in the party and is temporary.
- "Make any Pokémon Shiny" (Box 10 slot 2) copies the PID into the OTID: it keeps the nature, but the Pokémon's TID and SID become the halves of the PID (it counts as a traded Pokémon).
- "Teach Pokemon Any Move": move and slot, 1st in the party, then talk to the NPC.
- No eng10 code: nature (it is PID % 25; only on creation through the egg with PID), nickname, OT name and a Pokémon's TID/SID. "Change Pokémon PID or TID" only has eng0 and eng1.
- Uncertain: NPC 2 being the Viridian Old Gentleman (it is the default, the comments do not say); what changes when hatching the egg from "Generate egg with any PID"; slot conflict between `naturewords.txt` (Box 9 slot 27) and the 6IV egg code (Box 10 slot 2).
