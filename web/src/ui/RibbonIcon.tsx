// Ribbon icon from PokéSprite (msikma, sprites © Nintendo/Creatures Inc./GAME FREAK inc.).
// Sheet: tools/gen_sprites.py. Contest ranks 1 (Normal) to 4 (Master).

import type { CSSProperties } from "react";
import sheet from "./ribbonIcons.json";

const ICONS: Record<string, number> = sheet.icons;

/** `off`: a ribbon the Pokémon lacks, dimmed (keeps the icon's slot next to a field). */
export function RibbonIcon({ ribbon, rank, off = false }: { ribbon: string; rank?: number; off?: boolean }) {
  const index = ICONS[rank ? `${ribbon}-${rank}` : ribbon];
  if (index === undefined) return null;
  const style = { "--x": index % sheet.columns, "--y": Math.floor(index / sheet.columns) } as CSSProperties;
  return <span className={off ? "ribbon-icon off" : "ribbon-icon"} aria-hidden="true" style={style} />;
}

export interface RibbonEntry {
  ribbon: string;
  rank?: number;
  name: string;
}

export function RibbonList({ ribbons }: { ribbons: RibbonEntry[] }) {
  return (
    <span className="ribbon-list">
      {ribbons.map((r) => <span key={r.ribbon} className="item-name"><RibbonIcon ribbon={r.ribbon} rank={r.rank} />{r.name}</span>)}
    </span>
  );
}
