# Documentation

- [Suite architecture](architecture.md): layers, principles and build order of our own tools.
- [Backlog](backlog.md): what is left to test on the console, build and adjust, in order.

## Project

Specifications of our tools.

- [Pokémon formats](project/formats.md): pk3, validation and generated data.
- [Recipe](project/recipe.md): JSON file the site generates for the ESP32 trade host.
- [Console keys](project/keys.md): minimal file in `.secrets/`, generation and rules.

## Research

- [LDN](research/ldn.md): the Switch local communication protocol (advertisement, authentication, keys, IP).
- [pokeldn](research/pokeldn.md): what the reference project already does (LDN, ESP32, Mystery Gift, native code, resident hooks).
- [Switch build differences](research/switch-build.md): what changes in revision 10 (save by syscall, profanity filter, event tickets, fixes).
- [Platform: Nintendo Switch](research/switch-platform.md): what changes because the game runs in the Switch emulator.
- [Injection vectors](research/injection-vectors.md): catalog of the ways to inject data or code, with priority.
- [Available ACE codes](research/available-ace-codes.md): the EmeraldACE_web collection, with what already supports the Switch.
- [Base64 writer](research/base64-writer.md): a whole Pokémon in box names, setup on FR/LG, the Switch word filter and how the site works around it.
- [CodeGenerator](research/codegenerator.md): how the community generator turns ARM into box names, character table, versions and what this changes for the suite.
- [RNG](research/rng.md): algorithm, ten-lines (supports the Switch), EonTimer and opportunities with ACE.
- [ACE via box names](research/ace-box-names.md): grab ACE, pre-E4 route (Mail glitch), Switch adjustments, hexwriter and risks to the save.

