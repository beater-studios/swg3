import { expect, test } from "vitest";
import species from "@data/frlg_species.json";

test("decomp data reachable through the @data alias", () => {
  expect((species as { species: Record<string, { name: string }> }).species["25"].name).toBe("PIKACHU");
});
