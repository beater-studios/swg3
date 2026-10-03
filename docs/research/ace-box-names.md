# ACE via box names

Arbitrary code execution (ACE) in FireRed/LeafGreen (non-Japanese) using the PC box names as ARM code. Main source: [pokemon-ace-notes](https://pomeg-letterbombers.github.io/pokemon-ace-notes/) (abbreviated as `B/` below). Summary made by automated reading of the site: check character by character on the pages before typing any code in the game.

## How it works (grab ACE)

- Glitch species 0x0351 has a very long name. When you swap its place in the PC (Relocate mode: pick up a Pokémon, swap it with the 0x0351, swap again), the name overwrites the `monPlaceChangeFunc` pointer and execution lands in PC storage, running the box names as ARM (`B/frlg-grab-ace-exit/`).
- Default exit: returns 0 and jumps to a `BX lr` inside the BIOS, because `BX lr` cannot be typed.
- The PC ends up misaligned (odd address), so PC-relative offsets are off by 2 (`B/frlg-hexwriter-setup-explanation/`).

## Entry point: pre-E4 route (`B/frlg-non-jpn-pre-e4-route/`)

Creates the 0x0351 without having beaten the Elite Four.

1. Mail glitch (`B/mail-glitch/`): double battle with Knock Off (Farfetch'd from the in-game trade), Recycle (Mr. Mime from the in-game trade or Porygon), a consumable item and Retro Mail (100 units). Save first.
2. With Box 3, slot 1 empty, write the glitched Mail with the words from the page. This creates glitch species 0x0200 (HOCK in English, level 4, female). The glitched Mail appears when you give a Mail to the 6th Pokémon in the party; it is the Mail's Easy Chat screen (2 columns, 5 rows, 9 words, `src/easy_chat_3.c`), and each word writes 2 bytes of the Pokémon in Box 3, slot 1, in message order. In English: `???`, `HIGHS`, `I CHOOSE YOU`, `WANDERING` (the remaining 5 stay `???`). The words exist in the decomp (`src/data/easy_chat/`: HIGHS in misc, I CHOOSE YOU in trainer, WANDERING in adjectives; all three groups are unlocked from the start, `IsECGroupUnlocked` in `src/easy_chat.c`).
3. Adjust HOCK's EVs (HP Ups and specific battles, see the page) and put it back in Box 3, slot 1.
4. Rewrite the Mail swapping the 2nd and 4th words (`???`, `WANDERING`, `I CHOOSE YOU`, `HIGHS`). HOCK becomes 0x0351 (level 100, male).

Languages: English, French, Italian, German and Spanish, each with its own words. No time estimate published.

## After the entry

- Route verification code: box names that create a shiny level 0 Bulbasaur in Box 9, slot 30.
- Box 14 exit (`B/frlg-box-14-exit/`): frees more space for codes. Supports the Switch re-releases (they have a built-in BIOS).
- Exit bootstrap (`B/frlg-exit-code-bootstrap/`): creates a Beedrill with Thumb code in the OT field, allowing larger payloads that end in `BX r0`.
- Hexwriter (`B/frlg-hex-writer/`): a Bad Egg that reads box names as hex, 4 bytes per name and 56 bytes per run, written to the address in r12. It is the path for writing arbitrary payloads. Requires Snorlax and Omanyte registered and the Box 14 exit. Does not mention the Switch.

## Switch (`B/frlg-faq/`)

The Switch re-releases have quirks that break existing codes. They need rewriting:

- codes that use ROM addresses (script hooks, function calls);
- codes that read or write fixed RAM addresses (RNG seed, warp, `GlobalScriptContext`);
- codes that depend on GBA behavior that is not emulated;
- names blocked by Nintendo's profanity filter (pokeldn mapped this filter as a wrapper syscall, `swi 0x4D`).

Box name adjustments already documented for the Switch:

- do not use a space in the last three characters of Boxes 4, 8 and 12 (leave them empty and confirm first);
- some ARM instructions hang on the Switch, so two exit patterns change (details in the FAQ). The pre-E4 route verification already uses the Switch form.

## Restrictions

- The non-Japanese encoding makes Thumb impractical: codes are in ARM, with opcodes and shifts limited to what can be typed.
- The game shifts a large block of memory by 0 to 124 bytes from the base (`B/frlg-introduction/`).

## Save risks

- Save before the Mail glitch and the hexwriter.
- Wrong EVs or words turn HOCK into a Bad Egg. Delete it and redo, if there is still Mail.
- 0x0351 and ACE species disappear if moved by group selection (community report, not verified). In the PC, in MOVE POKÉMON, Select toggles the cursor (`ToggleCursorMultiMoveMode`, `src/pokemon_storage_system_data.c`): with the orange cursor, A on a Pokémon picks it up directly, without the menu, and this is the mode group selection comes from (`MOVE_MODE_MULTIPLE_SELECTING`, `MultiMove_*` functions in `src/pokemon_storage_system_misc.c`). It is the same mode the pokemon-ace-notes use to trigger (called Relocate): pick up a single Pokémon, swap it with the 0x0351 and swap again.
- Box 13 from slot 7 or 8 on and all following boxes must be empty before triggering. Never keep anything valuable in Box 13, slots 7 to 9.
- A badly written hexwriter crashes the game. It changes the Trainer ID, so save first.

## Tools

- E-Sh4rk CodeGenerator (`references/CodeGenerator`): generates box names from ARM code with a `@@` header. The ready-made codes live in `references/EmeraldACE_web` (see [Available ACE codes](available-ace-codes.md)).
- PokeGlitzer: save editor for glitchers.
- Theocatic's scripting environment for generating hexwriter payloads (link on the site).
