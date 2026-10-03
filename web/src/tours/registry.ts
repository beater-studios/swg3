// Tour actions (`go`) and conditions (`wait`) named in content/tours; tests/tours.test.ts checks every name exists.

import { getLang } from "../i18n";
import { useCodes } from "../pages/codes/store";
import { usePokemon } from "../pages/pokemon/store";
import { useRng } from "../pages/rng/store";

const present = (selector: string) => document.querySelector(selector) !== null;

export const ACTIONS: Record<string, () => void> = {
  "rng:seed": () => useRng.getState().setStep("seed"),
  "rng:target": () => useRng.getState().setStep("target"),
  "rng:timer": () => useRng.getState().setStep("timer"),
  "rng:check": () => useRng.getState().setStep("check"),
  // Practice names that do nothing in game.
  "codes:example": () => useCodes.getState().suggest(getLang() === "en" ? '["Practice", "Oak 123"]' : '["Treino", "Oak 123"]'),
  "editor:read": () => usePokemon.getState().setTab("read"),
  "editor:edit": () => usePokemon.getState().setTab("edit"),
  "editor:send": () => usePokemon.getState().setTab("send"),
};

export const CONDITIONS: Record<string, () => boolean> = {
  "rng:seed-chosen": () => useRng.getState().chosen !== null,
  "rng:target-aimed": () => useRng.getState().target !== null,
  "codes:checked": () => present('[data-tour="codes-typing"]'),
  "editor:created": () => present("#editor-result .mon-card"),
  "editor:sent": () => usePokemon.getState().tab === "send",
};

/** Page of each tour; a tour only runs there. */
export const TOUR_PAGES: Record<string, string> = {
  "rng-first-seed": "/rng",
  "rng-calibrate": "/rng",
  "codes-typing": "/codes",
  "editor-create": "/editor",
};
