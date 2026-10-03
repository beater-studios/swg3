// Gen 3 ribbons and which games give each one. Port of src/swg3/gen3/ribbons.py. Layout: PokemonSubstruct3 (include/pokemon.h),
// low 31 bits: bits 0 to 14 contest ranks (3 bits per category, 0 none to 4 Master), 15 to 26 one ribbon per bit, 27 to 30 unused.
// Sources per the decomp comments on the same struct (Country and World only by distribution; Marine, Land and Sky never distributed).

export const CONTEST = ["cool", "beauty", "cute", "smart", "tough"] as const;
export const CONTEST_BITS = 3;
export const CONTEST_MAX = 4;
export const FLAGS = [
  "champion", "winning", "victory", "artist", "effort", "marine", "land", "sky", "country", "national", "earth", "world",
] as const;
export const FIRST_FLAG = 15;
export const UNUSED_MASK = 0xf << 27;
export const MASK = 2 ** 27 - 1;

export type ContestKey = (typeof CONTEST)[number];
export type FlagKey = (typeof FLAGS)[number];

// Origin games (include/constants/global.h, VERSION_*).
export const RSE: readonly number[] = [1, 2, 3];
export const FRLG: readonly number[] = [4, 5];
export const COLOSSEUM: readonly number[] = [15];
const ALL_GAMES = [...RSE, ...FRLG, ...COLOSSEUM];

/** Games that give each ribbon; "contest" covers the five categories. */
export const SOURCES: Readonly<Record<"contest" | FlagKey, readonly number[]>> = {
  contest: RSE,
  champion: [...RSE, ...FRLG],
  winning: RSE,
  victory: RSE,
  artist: RSE,
  effort: RSE,
  marine: [],
  land: [],
  sky: [],
  country: ALL_GAMES,
  national: COLOSSEUM,
  earth: COLOSSEUM,
  world: ALL_GAMES,
};
export const NEVER: readonly string[] = Object.keys(SOURCES).filter((k) => !SOURCES[k as FlagKey].length);

export const NAMES: Readonly<Record<ContestKey | FlagKey, string>> = {
  cool: "Cool", beauty: "Beauty", cute: "Cute", smart: "Smart", tough: "Tough",
  champion: "Champion", winning: "Winning", victory: "Victory", artist: "Artist", effort: "Effort",
  marine: "Marine", land: "Land", sky: "Sky", country: "Country", national: "National", earth: "Earth", world: "World",
};
export const RANKS = ["", "Normal", "Super", "Hyper", "Master"] as const;

export interface Decoded {
  contest: Record<ContestKey, number>;
  flags: FlagKey[];
  unused: number;
}

/** Contest categories (0 to 7), set single-bit ribbons and bits 27 to 30. */
export function decode(bits: number): Decoded {
  return {
    contest: Object.fromEntries(CONTEST.map((k, i) => [k, (bits >>> (CONTEST_BITS * i)) & 7])) as Record<ContestKey, number>,
    flags: FLAGS.filter((_, i) => (bits >>> (FIRST_FLAG + i)) & 1),
    unused: (bits & UNUSED_MASK) >>> 27,
  };
}

/** Ribbons field from the contest categories (0 to 4) and the single-bit ribbons. */
export function encode(contest: Partial<Record<ContestKey, number>> = {}, flags: readonly FlagKey[] = []): number {
  let bits = 0;
  CONTEST.forEach((k, i) => {
    const rank = contest[k] ?? 0;
    if (!(rank >= 0 && rank <= CONTEST_MAX)) throw new Error(`${k}: ${rank}`);
    bits |= rank << (CONTEST_BITS * i);
  });
  for (const name of flags) bits |= 1 << (FIRST_FLAG + FLAGS.indexOf(name));
  return bits >>> 0;
}

export function available(game: number): ("contest" | FlagKey)[] {
  return (Object.keys(SOURCES) as ("contest" | FlagKey)[]).filter((k) => SOURCES[k].includes(game));
}
