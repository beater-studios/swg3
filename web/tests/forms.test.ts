// Sprite forms (gen3/forms.ts): Unown's letter, Deoxys's form per game, and a generated picture and icon for every key.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deoxysForm, formKey, unownId } from "../src/lib/gen3/forms";
import icons from "../src/ui/monIcons.json";

const palettes = JSON.parse(readFileSync(new URL("../public/mon/palettes.json", import.meta.url), "utf8"));
const front = (key: string) => existsSync(new URL(`../public/mon/front/${key}.png`, import.meta.url));

describe("forms", () => {
  it("Deoxys: normal in R/S, Colosseum and XD; attack in FireRed, defense in LeafGreen, speed in Emerald", () => {
    expect([1, 2, 3, 4, 5, 15, null].map(deoxysForm)).toEqual(["normal", "normal", "speed", "attack", "defense", "normal", "normal"]);
    expect(formKey(410, { game: 4 })).toBe("410-attack");
    expect(formKey(410, { game: 1 })).toBe("410");
  });

  it("Unown: A is Unown itself; the other letters come after the Egg ID, from the PID or the written letter", () => {
    expect(unownId(0)).toBe(201);
    expect(unownId(1)).toBe(413);
    expect(unownId(27)).toBe(439);
    expect(formKey(201, { pid: 0x03000302 })).toBe(String(unownId(10)));   // K
    expect(formKey(201, { letter: "?" })).toBe("439");
    expect(formKey(201)).toBe("201");
    expect(formKey(25, { pid: 0x03000302, game: 4 })).toBe("25");
  });

  it("every form has a picture and an icon", () => {
    const keys = ["410", "410-attack", "410-defense", "410-speed", ...Array.from({ length: 28 }, (_, i) => String(unownId(i))), "412"];
    for (const key of keys) {
      expect(front(key), key).toBe(true);
      expect((icons.icons as Record<string, number>)[key], key).toBeTypeOf("number");
    }
    expect(palettes.palettes["410"]).toHaveLength(2);
  });
});
