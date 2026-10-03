---
title: First seed in the RNG
summary: From your game to the timer, picking a real seed and target.
---

## -

Hello there! I'm Professor Oak. Let me show you how RNG works in FireRed and LeafGreen on Switch: picking the right moment to start the game so the Pokémon comes out the way you want. Use **Next** to move on and **Exit** whenever you like.

## rng-game

First, your game. Mark the version and the console. The TID is the number on your trainer card; the SID only matters if you want a shiny.

## rng-option

This is the OPTION menu. SOUND, BUTTON MODE and the button you press on PRESS START change the seed table. Keep everything the same as in your game, or the timer will miss the moment.

## rng-steps

The path has four steps: the seed, the target, the timer and the adjustment. Let's go through each one.

## rng-seed-list go=rng:seed wait=rng:seed-chosen

The seed depends on how much time passes until you press the button on PRESS START. Pick one from the list and click **Use**. Any of them works to start.

## rng-target go=rng:target wait=rng:target-aimed

Now, the Pokémon you want. Choose the encounter type, the Pokémon and the filters, click **Search** and then **Aim** on one of the results.

## rng-timer go=rng:timer

With the seed and the target, the timer knows when to press each button. Save in front of the Pokémon and close the game. Click **Start** together with the last [[A]] before the game loads, the one that confirms the profile. Then press [[A]] on each beep: on PRESS START, on CONTINUE and, on the last one, talk to the Pokémon or start the encounter.

## rng-adjust-tab go=rng:timer

Got a different Pokémon? That's normal on the first tries. In the **Adjust** step, tell what came out: the site finds where you landed and corrects the timer.

## -

That's the whole cycle! Before aiming at the Pokémon of your dreams, it's worth calibrating once in the **Check seed** tab: a beep on PRESS START and two wild Pokémon show how early or late your press lands. Good luck, trainer!
