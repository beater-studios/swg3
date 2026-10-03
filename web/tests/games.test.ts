// Games feature flag (src/games.ts).
import { expect, test } from "vitest";
import { DEFAULT_GAMES, enabledGames } from "../src/games";

test("without the flag only FireRed and LeafGreen; with it, the requested list in site order, always with FireRed", () => {
  expect(enabledGames(undefined).map((g) => g.id)).toEqual([...DEFAULT_GAMES]);
  expect(enabledGames("").map((g) => g.id)).toEqual([...DEFAULT_GAMES]);
  expect(enabledGames("emerald, Ruby").map((g) => g.id)).toEqual(["firered", "ruby", "emerald"]);
  expect(enabledGames("leafgreen,xd").map((g) => g.id)).toEqual(["firered", "leafgreen"]);
});
