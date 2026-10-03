# CodeGenerator (E-Sh4rk)

Notes on the CodeGenerator source and its output, with the 63 FireRed `eng10` codes in the collection compiled on the published site.

## Run results

- 61 of the 63 `eng10` codes compile without warnings. Create6IVEgg and HiddenPowerEgg fail outside the site because they carry the text `POKEMON` in place of the species number: on the site, the autocomplete replaces the name with the number.
- The output is deterministic. "Compute another" asks the tweaker for the next alternative.
- In the FireRed `eng10` codes, the result takes 7, 11 or 13 boxes.

## Repository structure

| folder | contents |
|---|---|
| `Charset/` | character table and conversion between bytes and characters |
| `Boxes/` | distribution of bytes across boxes and exit codes |
| `IO/` | lexer, parser and the `=====` separator |
| `ARM/` | ARM assembler and the tweaker |
| `Main/ace_common.ml` | ties everything together and prints the result |

The FRLG page is `html/index_frlg.html`. It downloads `list.json`, the codes and `exit.txt` straight from EmeraldACE_web.

## Code format

- Header with `@@ name = value` (null, boolean, integer or text), a line with only `@@`, then the instructions.
- Parameters: `exit` (exit code at the end), `start` (start in bytes from the beginning of the names), `fill` (fills the last box with spaces, default true), `filler0` to `filler4`, `filler0_alt`, `rewrite`, `onlyraw`. `title` and `author` have no effect.
- Constants `name = expression` with C operators and ternary; in instructions, `{expr}`.
- Comments: `@`, `%%`, `;` and `//`. `@input:species` is just a comment that the site's autocomplete reads.
- Instruction: ARM or a raw 32-bit word. `?` at the end asks the tweaker to rewrite the instruction as up to 5 typable instructions; `?5` fixes the count. 33 of the 61 codes that compile use the tweaker.
- `exit.txt`: library of exit codes separated by `=====`, each with `@@ filename` and usually `@@ start`.

## How the output is produced

- 14 boxes of up to 8 characters. In memory, each box takes 9 bytes: 8 for the name and the `0xFF` terminator, which the game always writes. The bytes at positions 8, 17, 26 and so on in the stream are `0xFF`.
- A short name ends in `0xFF`, and after that only `0xFF` can follow until the terminator.
- The generator places each 4-byte word so that the `0xFF` bytes fall at the end of a name or on the terminator, inserting fillers. Near the terminator the fillers put `0xFF` at the end and `0xBB` ("A") at the start of the next box: that is why so many names start with "A", "AA" or "AAA". Fillers made only of `0xFF` do not execute ("never" condition in ARMv4).
- After the program comes the chosen exit code, at its `start` position.
- Finishing: rewrite rules, splitting into boxes, aligned blocks of spaces become `0xFF` (less to type), an empty box or one with only spaces becomes "A".
- The list goes from Box 1 to N without skipping: boxes with only "A" also need to be renamed.
- In the array output, `_` is a space (e.g. `_____F9q`). The text report shows both forms.
- Warnings: more than 14 boxes, untypable character, box with only spaces (the game does not accept it).

## Versions

- The engine only looks at the first 3 letters of the language (`Utils/settings.ml`): `eng0`, `eng1` and `eng10` are identical to it. Checked: `tidsid.txt` produces the same names in `eng1` and `eng10`.
- The difference between versions is in the page and the collection: `list.json` maps each version to a file, and the site replaces `{LANG}`, `{lang}`, `{LANGNR}` and `{GAME}` before compiling (`html/scripts.js:62-78`).
- Switch addresses are fixed inside each `_SWITCH` file. `exit.txt` has ENG0, ENG1, ITA, GER, SPA, FRA and JAP variants, none specific to the Switch.
- The character table only changes between languages. Only Japanese changes the engine's logic (another table, other default fillers, strict tweaker).

## Character table (English)

`Charset/charset.ml`: 256-entry array per language, with the states available (on the box name keyboard), unavailable (in the font, not on the keyboard), unreadable (control) and unused.

| characters | bytes |
|---|---|
| space | 0x00 |
| 0 to 9 | 0xA1 to 0xAA |
| `!` `?` `.` | 0xAB to 0xAD |
| hyphen (displayed as U+2013) | 0xAE |
| `…` | 0xB0 |
| `“` `”` `‘` `’` | 0xB1 to 0xB4 |
| `♂` `♀` | 0xB5, 0xB6 |
| `,` and `/` | 0xB8, 0xBA |
| A to Z | 0xBB to 0xD4 |
| a to z | 0xD5 to 0xEE |

- Same table as Emerald; the only per-game difference is the `…` in Ruby and Sapphire. German switches the quotes to `„ “` and unlocks Ä Ö Ü ä ö ü; French uses `« »`; Italian and Spanish are the same as English.
- Characters present in the 61 codes: `! , . / 0-9 ? A-Z a-z` (without y), space, hyphen, curly quotes, `…`, `♀` and `♂`.
- When showing to the player: convert `_` to a space and display the hyphen, ellipsis and quotes as on the game keyboard.
- Checked against our table generated from the decomp (`src/swg3/data/charmap_en.tsv`): all bytes in the table above match.

## Switch and the profanity filter

- The engine has no specific handling for `eng10`. What is Switch-specific is in the `*_SWITCH.txt` and `*Switch.txt` files: their own addresses, fillers in the header and an instruction to build the Box 14 exit first.
- The generator does not know about the profanity filter (nothing about `svc_BadWordCheck`, "badword", "profan" or "censor" in either repository). The only hint: `misc/GetAllBallsTmsBerries.txt:52` ("moved up to bypass language filter"), a manual reordering.
- Conclusion: validating against the filter is our job; there is no ready-made list or rule.

## License

- CodeGenerator and EmeraldACE_web have no license: all rights reserved. Study and reimplementation only.
- Main author: Mickael Laurent (E-Sh4rk), about 300 of the 323 commits; contributions from final, thespbgamer and others.
- The codes have their own authors in `@@ author` (Shao, Papa Jefe, Mettrich, final, ComplexRobot and others). Credited in `CREDITS.md`.

## What this changes for the suite

- Reimplementing generation would require an ARM assembler, fillers, rewriting and the tweaker, with output byte for byte identical to the site's.
- Alternative: take as input the names (or the raw bytes from the "Raw data" section) generated by the official site. The tool only decodes and validates, without an assembler and without copying code.
- A useful check in any case: convert the names back into bytes and check that the `0xFF` bytes fall at positions 8, 17, 26 and so on, and that every character is typable. It catches typos before triggering the code. Candidate for a site tool.
