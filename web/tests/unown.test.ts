// Unown letter per Tanoby chamber (encounters.unownLetters): the builder picks a matching chamber and PID, and
// the validator flags a letter the encounter location's chamber cannot give. Same rule as Python (test_validate.py).
import { describe, expect, it } from "vitest";
import { build } from "../src/lib/gen3/builder";
import * as encounters from "../src/lib/gen3/encounters";
import { check } from "../src/lib/gen3/validate";
import { UNOWN_LETTERS, unownLetter } from "../src/lib/gen3/wild";

const base = { species: 201, level: 30, ot_name: "RED", tid: 1, sid: 2, met_game: 4 };
const letters = (section: number) => encounters.unownLetters(4, section)?.map((i) => UNOWN_LETTERS[i]);

describe("Unown per Tanoby chamber", () => {
  it("each chamber gives the letters of its slots", () => {
    expect(letters(188)).toEqual(["A", "?"]);
    expect(letters(193)).toEqual(["B", "M", "V", "W", "X"]);
    expect(encounters.unownLetters(4, 88)).toBeNull();
    expect(encounters.unownLetters(3, 188)).toBeNull();
  });

  it("requested letter: the automatic location is the chamber that gives it", () => {
    const [mon] = build({ ...base, letter: UNOWN_LETTERS.indexOf("B") });
    expect(mon.metLocation).toBe(193);
  });

  it("requested chamber: the PID comes out with one of its letters, and validation does not complain", () => {
    for (let i = 0; i < 20; i++) {
      const [mon] = build({ ...base, met_location: 194 });
      expect("Z!").toContain(UNOWN_LETTERS[unownLetter(mon.personality)]);
      expect(check(mon).filter((issue) => issue.message.includes("Unown"))).toEqual([]);
    }
  });

  it("letter outside the chamber: warning on the PID", () => {
    const [mon] = build({ ...base, letter: UNOWN_LETTERS.indexOf("B"), met_location: 188 });
    const issue = check(mon).find((i) => i.field === "pid" && i.message.includes("Unown"));
    expect(issue?.message).toContain("lá saem A, ?");
  });
});
