// Gen 3 move category: by type (include/battle.h), status when the move has no power.
import { expect, test } from "vitest";
import { moveCategory, moveTypeName } from "../src/lib/gen3/species";

test("category comes from the type, not the move", () => {
  // 247 Shadow Ball (Ghost): physical in Gen 3, special from Gen 4 on.
  expect([moveCategory(247), moveTypeName(247)]).toEqual(["physical", "GHOST"]);
  expect(moveCategory(89)).toBe("physical");   // Earthquake
  expect(moveCategory(53)).toBe("special");    // Flamethrower
  expect(moveCategory(94)).toBe("special");    // Psychic
  expect(moveCategory(45)).toBe("status");     // Growl
  expect(moveCategory(14)).toBe("status");     // Swords Dance
});
