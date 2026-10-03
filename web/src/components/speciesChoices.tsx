// Species for the Combobox in National Pokédex order (internal numbers differ from Treecko on).

import { MonIcon, type ComboOption } from "../ui";
import { formKey } from "../lib/gen3/forms";
import { nationalNumber } from "../lib/gen3/species";
import { pretty } from "./format";

/** `form`: what changes the icon (Unown letter from PID or text, Deoxys game), when known. */
export function speciesChoices(list: readonly { id: number; name: string }[], form: Parameters<typeof formKey>[1] = {}): ComboOption[] {
  return list
    .map((s) => ({ national: nationalNumber(s.id), option: { value: String(s.id), label: pretty(s.name), icon: <MonIcon species={s.id} form={formKey(s.id, form)} /> } }))
    .sort((a, b) => a.national - b.national)
    .map(({ national, option }) => ({ ...option, hint: `#${String(national).padStart(3, "0")}` }));
}
