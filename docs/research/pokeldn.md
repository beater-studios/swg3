# pokeldn

Project in `references/pokeldn` (Decryptu/pokeldn). It combines `frlg-ldn-trade` (tornadus, trade joiner only) and `frlg-ldn-trade-fork` (MercuryEnigma, adds a trade host), and adds an ESP32 radio, Mystery Gift, Union Room, native code execution and resident hooks. It also covers other Pokémon games on the Switch.

Summary verified against the files. The details live in the original docs, cited in each section.

## How it talks to the console

- The PC poses as another Switch in local wireless mode. Nothing is installed on the console.
- Stack: 802.11 (WPA2-CCMP) > LDN > UDP 12345 > Pia (AES-GCM) > Pia Reliable > emulator frames > the ROM's own RFU protocol (`docs/frlg.md`, `docs/frlg_host.md`).
- The Switch emulator emulates the GBA wireless adapter (RFU). There is no emulated link cable.
- Radio: a classic ESP32 (2.4 GHz only) over USB serial, with the firmware in `firmware/esp32`. Encryption, LDN, IP and Pia run in Python on the PC (`docs/hardware_esp32.md`). Legacy alternative: a Wi-Fi card with AP mode on Linux (`docs/hardware_adapters.md`).

## Keys

- The real radio path requires `prod.keys` from your own console (`docs/hardware_switch_keys.md`, `docs/ldn.md`).
- The Pia game key and the emulator's LDN passphrase are in the pokeldn code. Do not copy any key into this project: reference the source files.
- For development: Ryujinx with `ldn_mitm` removes the need for the radio and the LDN `prod.keys`, but Ryujinx itself requires keys to run the game (`docs/ldn.md`).

## Code execution: Mystery Gift

- It does not use a glitch. The game's Mystery Gift client runs scripts sent by the server, and the PC plays the server. The console only needs to be at Mystery Gift > Wonder Cards > Friend (`docs/frlg_gift.md`, `docs/frlg_rom.md`).
- Three client commands run something:
  - `CLI_SAVE_RAM_SCRIPT`: writes a field script to the save, which runs when talking to an NPC;
  - `CLI_RUN_MEVENT_SCRIPT`: runs the Mystery Event VM (e.g. `givepokemon`, `initramscript`);
  - `CLI_RUN_BUFFER_SCRIPT`: runs native ARM code of up to 1024 bytes, with a return channel to the PC.
- Ready-made payloads in `asm/`, emulated with unicorn before sending: save and memory dump, Pokémon creation, arbitrary function call, flash read and write, ROM scan, RNG trace.
- Addresses measured on French FireRed (BPRF). LeafGreen has its own mapping (`pokeldn/frlg/rom/rom_map.py`, `docs/frlg_leafgreen.md`).
- English (BPRE and BPGE) is already supported: `pokeldn/frlg/rom/builds.py` has tables per build, with addresses taken from the decomp's `firered_switch` and checked against the retail image. The host picks the table by the game code the console sends. Tested on emulated English FireRed (`docs/frlg_rom_map.md`, "The English cartridges"). On an English retail console: not verified.

## Persistence

- Free area: top of EWRAM (1024 bytes).
- Per-frame hook on the VBlank vector. Lasts until reset.
- Re-arming after reset: `initramscript` binds an installer to an NPC (the player's mother), and you just talk to her.
- Resident code stored in the save and direct flash sector writes (`docs/frlg_rom.md`, sections "Code that outlives the session" onward).

## Existing residents (`asm/resident/`)

- `turbo.s`: speeds up overworld, battle and text. Can be held with R as fast forward, and disables the R help.
- `shiny.s`, `ivs.s`, `noencounter.s`: going by the names, force shiny, IVs and turn off encounters. Not read yet.
- `vblank-hook.s`, `save-head.s`, `save-payload.s`: infrastructure for the hook and for persistence in the save.

## Other features

- Trade host and joiner (`bin/frlg_trade_host.py`, `bin/frlg_trade_join.py`).
- Mystery Gift host (Wonder Card and Wonder News).
- Union Room (chat and battle) and colosseum.
- RNG research (`docs/frlg_rng.md`).
- Switch wrapper syscalls (`swi 0x40` to `0x62`), partly mapped (`docs/frlg_rom.md`, "Calling the wrapper").

## Other Switch games

All share the radio, LDN and Pia. Only FRLG has code on the console.

| game | trade | Mystery Gift | other |
|---|---|---|---|
| Let's Go | host and joiner, with link code | not available over LDN | PB7 structure written to the save as sent |
| Sword/Shield | host and joiner, with or without Link Code, PKHeX `.pk8` | Wonder Cards from the command line or published `.wc8` | League Card editable after the trade |
| BDSP | Union Room as host or joiner, with password | not available over LDN | Poké Ball capsule, record mixing |
| Scarlet/Violet | host and joiner, with or without Link Code | not available over LDN | party record built from scratch |
| Legends Z-A | host and joiner, with link code | not available over LDN | record built from scratch, the game computes level and stats |

## Known limits

- Mystery Gift's "Wireless Communication" mode (distributor without a button) does not work through the bridge, only Friend mode (`docs/frlg_gift.md`).
- The emulator can close the link through its own syscall (error 2318-0006 for the player).
