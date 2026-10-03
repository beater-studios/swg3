// Moves for the Combobox. In Gen 3 the category comes from the type (species.moveCategory).

import { MoveCategoryIcon, TypeBadge, type ComboOption } from "../ui";
import * as species from "../lib/gen3/species";
import { pretty } from "./format";

export function moveOption(id: number, name: string, group?: string): ComboOption {
  const category = species.moveCategory(id);
  return {
    value: String(id), label: pretty(name), group,
    icon: category ? <MoveCategoryIcon category={category} /> : undefined,
    detail: <TypeBadge type={species.moveTypeName(id)} />,
  };
}
