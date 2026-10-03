# Switch build differences (revision 10)

Everything the decomp compiles only with `REVISION >= 0xA` (`references/pokefirered`). It explains some of the quirks mentioned in the ACE FAQ and shows what the Switch emulator assumes.

## Identification

- Build date: `2025 12 19 15:38 22afedd9` (`src/main.c`).
- Game code `BPRE` (FireRed) and `BPGE` (LeafGreen), revision 10 in the ROM header.

## Save

- Flash sector writes go to the emulator through syscalls (`svc_WriteSector`, `svc_ReplaceSector`, `svc_FinishSave` in `src/save.c`, `src/start_menu.c`). The game does not talk to the flash chip directly.
- `svc_SetSaveBlock2` tells the emulator where SaveBlock2 is (`src/load_save.c`).
- In trades, the wait for the save was removed because the emulator writes quickly and synchronously (`src/trade_scene.c`).

## Text

- The naming screen passes the text through `svc_BadWordCheck` and rejects whatever matches Nintendo's profanity list (`src/naming_screen.c`). This is what blocks some box names used in ACE.
- `gUnknownStringVar` shrank from 16 to 12 bytes (`src/string_util.c`), which shifts EWRAM addresses compared to the cartridge.

## Robustness

- `DestroyTask` gained a bounds check on the ID (`src/task.c`).
- `DestroyYesNoMenu` ignores a nonexistent window (`src/menu.c`).
- The legendary dogs' Roar bug was fixed: the battle outcome is compared by equality, not by bit (`src/battle_main.c`).
- Several link and battle points wait for `IsLinkTaskFinished()` before moving on.

## Events

- The first time the player earns the Champion Ribbon (Hall of Fame entry), the game hands out the Aurora Ticket and the Mystic Ticket, with the ship flags for Birth Island (Deoxys) and Navel Rock (Lugia and Ho-Oh) (`src/post_battle_event_funcs.c`). On the cartridge these tickets were only distributed at events.
- The button combination for the berry fix on the title screen was removed (`src/title_screen.c`).

## Communication

- Most of the changes are in link and RFU (`src/union_room.c`, `src/link_rfu_2.c`, `src/link.c`, `src/librfu_rfu.c`, `src/AgbRfu_LinkManager.c`). The communication menu uses wireless by default, because the emulator always simulates it (`src/script_menu.c`).
- `svc_SetActivity` and `svc_IncrementLinkError` inform the emulator about activity and link errors.

## Telemetry

- On receiving the first Pokémon with an empty party, the game calls `svc_SetStarter(species)` (`src/scrcmd.c`).

## Emulator syscalls

Declared in `include/sloopsvc.h`: `svc_40` to `svc_53` without names, plus `WriteSector`, `ReplaceSector`, `FinishSave`, `CommsAllowedByParentalControls`, `BadWordCheck`, `SetSaveBlock2`, `stubbed`, `SetStarter`, `SetActivity`, `IncrementLinkError`. The mapping of each number is in `references/pokeldn/docs/frlg_rom.md` ("Calling the wrapper").

## Visuals

- Intro with a black background instead of white (`src/intro.c`), and palette 0 black at startup (`src/main.c`).
