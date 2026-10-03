// Game names formatted for reading (components/format.ts).

import { expect, test } from "vitest";
import { pretty } from "../src/components/format";

test("pretty keeps the game's acronyms uppercase", () => {
  const names = ["PP UP", "HP UP", "TM01", "HM08", "TEACHY TV", "VS SEEKER", "S.S. TICKET", "POKé BALL", "HO-OH", "MR. MIME", "UP-GRADE", "EXP. SHARE", "GUARD SPEC."];
  expect(names.map(pretty)).toEqual(["PP Up", "HP Up", "TM01", "HM08", "Teachy TV", "VS Seeker", "S.S. Ticket", "Poké Ball", "Ho-Oh", "Mr. Mime", "Up-Grade", "Exp. Share", "Guard Spec."]);
});
