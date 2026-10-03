// Words shown on the game screen (uppercase as in game), highlighted automatically in UI text and guides.

export const GAME_WORDS = [
  "PRESS START", "BUTTON MODE", "BATTLE SCENE", "BATTLE STYLE", "TEXT SPEED", "NEW GAME", "CONTINUE", "OPTION", "SOUND", "STEREO", "MONO",
  "HELP", "FRAME", "L=A", "LR",
] as const;

// Item ids from include/constants/items.h. Only names that cannot be mistaken for common words.
export const ITEM_WORDS: Readonly<Record<string, number>> = {
  "Master Ball": 1, "Ultra Ball": 2, "Great Ball": 3, "Poké Ball": 4, "Safari Ball": 5, "Net Ball": 6, "Dive Ball": 7,
  "Nest Ball": 8, "Repeat Ball": 9, "Timer Ball": 10, "Luxury Ball": 11, "Premier Ball": 12,
  "Rare Candy": 68, "PP Up": 69, "PP Max": 71, "Escape Rope": 85, "Macho Brace": 181, "Exp. Share": 182,
  "Soothe Bell": 184, "Everstone": 195, "Lucky Egg": 197, "Old Rod": 262, "Good Rod": 263, "Super Rod": 264,
  // Plurals and generic names use a representative icon (Poké Ball, Orange Mail).
  "Poké Balls": 4, "Retro Mail": 132, "Mail": 121,
};

export const isItemWord = (word: string) => Object.hasOwn(ITEM_WORDS, word);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole words, with a capture group for `split`. */
export function wordsPattern(extra: readonly string[] = []): RegExp {
  const words = [...new Set([...extra, ...GAME_WORDS, ...Object.keys(ITEM_WORDS)])].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\d=])(${words.map(escape).join("|")})(?![\\p{L}\\d=])`, "gu");
}
