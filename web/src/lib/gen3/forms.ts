// Gen 3 forms that change a Pokémon's sprite. The pk3 stores no form: the Unown letter comes from the PID (LoadSpecialPokePic,
// src/decompress.c) and the Deoxys form from the game it is in (here, the origin game). Sprites from tools/gen_mon_sprites.py.

import { UNOWN, UNOWN_LETTERS, unownLetter } from "./wild";

export const DEOXYS = 410;
export const EGG = 412;
const UNOWN_B = 413;   // SPECIES_UNOWN_B: letters B to ? come after the egg

export type DeoxysForm = "normal" | "attack" | "defense" | "speed";
const DEOXYS_BY_GAME: Record<number, DeoxysForm> = { 3: "speed", 4: "attack", 5: "defense" };

/** Deoxys form for a game (pk3 game number); Ruby, Sapphire, Colosseum and XD show the normal form. */
export const deoxysForm = (game: number | null | undefined): DeoxysForm => (game != null && DEOXYS_BY_GAME[game]) || "normal";

/** Sprite and icon id for an Unown letter (0 is A, the base Unown). */
export const unownId = (letter: number) => (letter ? UNOWN_B + letter - 1 : UNOWN);

/** Unown letter (0 to 27) from the PID, or from the written letter ("A" to "?"); null when neither is given. */
export function unownLetterOf(pid: number | null, letter?: string): number | null {
  if (pid !== null) return unownLetter(pid);
  const i = letter ? UNOWN_LETTERS.indexOf(letter) : -1;
  return i >= 0 ? i : null;
}

/** Sprite key: the game id, the Unown letter id instead, or "410-<form>" for a non-normal Deoxys. */
export function formKey(species: number, { pid = null, letter, game = null }: { pid?: number | null; letter?: string; game?: number | null } = {}): string {
  if (species === UNOWN) return String(unownId(unownLetterOf(pid, letter) ?? 0));
  if (species === DEOXYS) {
    const form = deoxysForm(game);
    return form === "normal" ? String(DEOXYS) : `${DEOXYS}-${form}`;
  }
  return String(species);
}
