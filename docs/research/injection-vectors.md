# Injection vectors

Catalog of the ways to get data or code into the game on the Switch. Each item gives what it controls, the cost and the status.

## 1. Typable text fields

- What they are: box names, Pokémon nicknames, trainer name, mail. On Emerald, also Easy Chat.
- What they control: bytes in RAM or in the save, limited to the character table.
- Use: code area for ACE. Box names are the best known case (see [ACE via box names](ace-box-names.md)).
- Cost: long, error-prone typing.
- Status: known technique on the GBA. Not verified on the Switch.

## 2. Data corruption glitches

- What they are: corruption of Pokémon data that creates glitch species. On non-Japanese FRLG, the documented path is the Mail glitch, which creates species 0x0351 (see [ACE via box names](ace-box-names.md)).
- What they control: the ACE entry point (the jump to the box names, for example).
- Cost: a sequence of in-game actions, usually requiring specific items and progress.
- Status: pre-E4 route documented by the community, with Switch-specific adjustments. Still to be tested on a Switch.

## 3. Trade channel

- What it is: the trade communication between two games, over LDN (local Wi-Fi) on the Switch. pokeldn already implements the trade partner on a PC with an ESP32 as the radio.
- What it controls: complete Pokémon and mail structs received from the partner. A controlled partner can send arbitrary data, including glitch species or malformed data.
- Potential use:
  - deliver a ready-made glitch Pokémon as the ACE entry point, without needing the Pomeg glitch;
  - explore bugs in the handling of received data;
  - simulate trades and online trades.
- Cost: requires understanding and reproducing the Switch protocol, which may have encryption or authentication.
- Status: implemented in pokeldn (trade host and joiner).

## 4. Mystery Gift client

- What it is: the game's Mystery Gift client runs scripts sent by the server. pokeldn plays the server over LDN.
- What it controls: native ARM code of up to 1024 bytes, field scripts and Mystery Event VM scripts, reading and writing RAM, save and flash.
- Cost: `prod.keys` from your own unlocked console and an ESP32. No glitch.
- Status: implemented in pokeldn (see [pokeldn](pokeldn.md)). It is the most powerful vector and makes box ACE secondary.

## Suggested priority

With `prod.keys` from your own console, vectors 3 and 4 are available.

1. Set up pokeldn: ESP32 with the firmware, host on the PC and first contact with the console (vectors 3 and 4).
2. First read-only test: save dump via Mystery Gift.
3. ACE through box names (vectors 1 and 2) as a complement.
