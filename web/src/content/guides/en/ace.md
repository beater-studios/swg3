---
slug: ace
order: 3
group: ACE and codes
title: Unlock ACE
summary: The Mail glitch route that makes the game run the box names, without beating the Elite Four.
needs: in-game items and trades
level: advanced
---
ACE (arbitrary code execution) makes the game read the PC box names as instructions. The way in is a glitch species, 0x0351: when you move it in the PC, the game runs whatever is written in the box names. This route creates that species without beating the Elite Four.

1. **Gather what you need and save.** For the [Mail glitch](https://pomeg-letterbombers.github.io/pokemon-ace-notes/mail-glitch/): the Farfetch'd and Mr. Mime from the in-game trades (Knock Off and Recycle), an item that gets used up in battle, Retro Mail and 8 HP Ups.
2. **Open the glitched Mail.** With Box 3, slot 1 empty and 6 Pokémon in your party, give each one a Mail. On the 6th, the Mail writing screen opens differently, with the words already filled in: that's the glitched Mail. Each of the 9 words writes into a piece of the Pokémon in Box 3, slot 1.
3. **Write the 1st Mail and confirm.** Make the message look like the middle screen below (each word is in the group shown). The glitch species 0x0200 shows up in Box 3, slot 1: HOCK, level 4, female. If you get another name or a Bad Egg, check that the slot was empty and write it again.

:::screen mail-glitch

4. **Adjust the EVs.** Put HOCK in your party and give it 8 HP Ups. Then defeat 1 Caterpie (Viridian Forest) and 1 Doduo (Route 16) or 1 Mankey (Route 22) with it. Don't let it gain other HP or Attack EVs. Put HOCK back in Box 3, slot 1.
5. **Write the 2nd Mail and confirm.** In the glitched Mail again, the 1st message shows up: just swap the 2nd and 4th words, as in the last screen. HOCK turns into 0x0351: level 100, male, with a weird name. That's your ACE species.
6. **Test it.** Type the verification code and trigger it. If the expected Pokémon shows up in Box 9, ACE is working.

:::warn On Switch
Don't use spaces in the last three characters of Boxes 4, 8 and 12, and only use codes made for Switch: some instructions crash and the word filter rejects certain names. Details in the [FAQ](https://pomeg-letterbombers.github.io/pokemon-ace-notes/frlg-faq/).
:::

:::note If it goes wrong
Wrong EVs or words turn the species into a Bad Egg. Erase the Mail and try again while you still have Mail.
:::

:::note Game in another language
The screens above are from the English game. In the other languages, the words are these (the 2nd Mail swaps the 2nd and 4th the same way):

| language | 1st | 2nd | 3rd | 4th | species 0x0200 |
|---|---|---|---|---|---|
| French | ??? | HAUTEUR | CE SERA TOI | NOMADE | TONNE |
| Italian | ??? | SUL SERIO | FATTI AVANTI | CRUDELE | CK |
| German | ??? | HÖHEN | DU BIST DRAN | LATSCH | HOCK |
| Spanish | (?) | INFANTIL | TE ELIJO | RIDÍCULO | ENO |
:::

:::source
Summarized from [pokemon-ace-notes](https://pomeg-letterbombers.github.io/pokemon-ace-notes/). Not yet tested on this project's console.
:::
