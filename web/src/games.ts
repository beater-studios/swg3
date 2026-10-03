// Gen 3 games and their themes. Others than FireRed and LeafGreen (the Switch ones) need the VITE_GAMES build flag
// (comma separated); code that depends on availability reads ENABLED_GAMES.

import type { IconName } from "./ui";

export type GameId = "firered" | "leafgreen" | "ruby" | "sapphire" | "emerald";
/** Colors in tokens.css. */
export type Accent = "fire" | "leaf" | "ruby" | "sapphire" | "emerald";

export interface Game {
  id: GameId;
  name: string;
  accent: Accent;
  icon: IconName;
  /** Origin game in the pk3 (include/constants/global.h, VERSION_*). */
  version: number;
}

export const GAMES: readonly Game[] = [
  { id: "firered", name: "FireRed", accent: "fire", icon: "flame", version: 4 },
  { id: "leafgreen", name: "LeafGreen", accent: "leaf", icon: "leaf", version: 5 },
  { id: "ruby", name: "Ruby", accent: "ruby", icon: "ruby", version: 2 },
  { id: "sapphire", name: "Sapphire", accent: "sapphire", icon: "sapphire", version: 1 },
  { id: "emerald", name: "Emerald", accent: "emerald", icon: "emerald", version: 3 },
];

export const DEFAULT_GAMES: readonly GameId[] = ["firered", "leafgreen"];

/** FireRed is always included as the default theme. */
export function enabledGames(flag: string | undefined): Game[] {
  const wanted = flag?.trim() ? flag.split(",").map((s) => s.trim().toLowerCase()) : DEFAULT_GAMES;
  return GAMES.filter((g) => g.id === "firered" || wanted.includes(g.id));
}

export const ENABLED_GAMES: readonly Game[] = enabledGames(import.meta.env.VITE_GAMES);
