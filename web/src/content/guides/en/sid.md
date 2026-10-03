---
slug: sid
order: 10
group: Reference
title: How to find your SID
summary: What the Secret ID is, when it matters and the ways to find yours on the Switch.
needs: depends on the path
level: intermediate
---
The SID (Secret ID) is the trainer's secret number. The game never shows it: the Trainer Card only shows the TID (IDNo.).

**It only matters for shinies.** Together with the TID and the Pokémon's PID, the SID decides whether it comes out shiny. For RNG of nature, IVs or ability you don't need it: leave the SID field empty on the [RNG](/rng) page.

## How the game creates the TID and SID

In a new game, when you finish the player name screen, the game reads its internal clock. That number becomes your TID and also the generator's seed. A bit later, still during Oak's speech, the game rolls the SID from that seed.

So knowing the TID you can list the possible SIDs, but not know which one it is: it depends on how many rolls happened until the end of the speech, and that changes with how fast you press A.

## Paths on the Switch

1. **Trade through the ESP32 board** (coming soon). The Pokémon you send in a trade carries your TID and SID, and the [Editor](/editor) page shows both when you open the file. It doesn't touch the save. It depends on the trade program, still being built ([ESP32](/guides/esp32)).
2. **ACE code "Read Pokemon TID and SID".** The community generator has a Switch version. Put a Pokémon you caught in the 2nd party slot, run the code and follow the generator's instructions to read the result. It needs working ACE ([ACE](/guides/ace)) and the usual save precautions ([safety](/guides/safety)).
3. **A shiny you caught.** With a shiny's PID, the SID narrows to 8 values; crossing that with the list from the TID should leave one. It only works if you have a shiny and know its PID, for example from the Check seed tab if it came out in a timed attempt.

:::tip Shinies without the SID
Without the SID the shiny search doesn't work, but nature, IVs and ability work normally. You can RNG what matters and leave shininess for later.
:::

:::source
TID and SID creation: pret/pokefirered decomp (`SeedRngAndSetTrainerId`, `InitPlayerTrainerId`) and PokeFinder (Gen 3 ID generator). Paths 1 and 3 have not been tested on this project's console yet.
:::
