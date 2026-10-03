---
slug: switch
order: 8
group: Reference
title: What's different on Switch
summary: What the Switch version does differently from the cartridge, and why some codes need their own version.
needs: nothing
level: reference
---
The Switch game is the original ROM, revision 10, running in Nintendo's emulator. Almost everything is the same as the cartridge. What's different:

- **Names go through a filter.** The naming screen rejects words on Nintendo's list. That's why some box names used for ACE won't go through.
- **Addresses shifted a little.** A chunk of memory got smaller, so codes that point to fixed addresses need their own version.
- **The save belongs to the emulator.** The game doesn't write straight to a save chip, and the save wait during trades was removed.
- **Free tickets.** When you enter the Hall of Fame for the first time, you get the Aurora Ticket and the Mystic Ticket (Deoxys, Lugia and Ho-Oh), which were event-only on cartridge.
- **Fixes.** The legendary beasts' Roar bug was fixed.
- **Wireless only.** There's no emulated link cable: trades and battles use local wireless.
