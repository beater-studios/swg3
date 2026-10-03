// Pokémon icon, frame 0 from the FR/LG decomp (sprites © Nintendo/Creatures Inc./GAME FREAK inc.).
// Sheet: tools/gen_mon_sprites.py.

import type { CSSProperties } from "react";
import sheet from "./monIcons.json";

const ICONS: Record<string, number> = sheet.icons;

export const hasMonIcon = (species: number) => ICONS[String(species)] !== undefined;

/** `form`: the gen3/forms.ts key (Unown letter, Deoxys form); without it, the base species drawing. */
export function MonIcon({ species, form }: { species: number; form?: string }) {
  const index = ICONS[form ?? String(species)] ?? ICONS[String(species)];
  if (index === undefined) return null;
  return <span className="mon-icon" aria-hidden="true" style={{ "--x": index % sheet.columns, "--y": Math.floor(index / sheet.columns) } as CSSProperties} />;
}
