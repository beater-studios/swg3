# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting (the "Report a vulnerability" button in the Security tab of this repository) or email studiosbeater@gmail.com.

Include what is affected, how to reproduce it and what an attacker could do. You will get an answer within a week, and credit in the fix if you want it.

## Scope

In scope:

- the website: anything that could run code in a visitor's browser, leak their data or tamper with files they download (pk3 files, recipes, CSV);
- the Python tools and the command line, including how they handle `.secrets/` and key files.

Out of scope:

- code execution inside the game (ACE): it is the subject of this project, not a vulnerability;
- problems in the game, the console or Nintendo's emulator;
- problems in third-party projects listed in [CREDITS.md](CREDITS.md); report those to their authors.

## Keys

If you find a console key, game key or LDN passphrase anywhere in this repository or its history, report it privately as above. Never post the value itself.
