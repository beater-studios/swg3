// Natures for the Combobox. Nature n raises stat n / 5 and lowers n % 5 (sNatureStatTable); equal means neutral.

import { StatChange, type ComboOption } from "../ui";
import { NATURE_LABELS } from "./format";

export function natureChoices(natures: readonly string[]): ComboOption[] {
  return natures.map((name, i) => ({
    value: name, label: name, detail: <StatChange up={NATURE_LABELS[Math.floor(i / 5)]} down={NATURE_LABELS[i % 5]} />,
  }));
}
