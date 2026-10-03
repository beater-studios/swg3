// Game item icon. Art from PokéSprite (msikma, sprites © Nintendo/Creatures Inc./GAME FREAK inc.).
// Sheet: tools/gen_sprites.py.

import type { CSSProperties, ReactNode } from "react";
import sheet from "./itemIcons.json";

const ICONS: Record<string, number> = sheet.icons;

/** Icon position in the sheet as CSS variables (.item-icon uses --x and --y), or null without an icon. */
function position(id: number): { x: number; y: number } | null {
  const index = ICONS[String(id)];
  if (index === undefined) return null;
  return { x: index % sheet.columns, y: Math.floor(index / sheet.columns) };
}

export const hasItemIcon = (id: number) => position(id) !== null;

export function ItemIcon({ id }: { id: number }) {
  const at = position(id);
  if (!at) return null;
  return <span className="item-icon" aria-hidden="true" style={{ "--x": at.x, "--y": at.y } as CSSProperties} />;
}

/** Item name quoted in text, as HTML for guide Markdown: icon and highlight, like Item with `text`. */
export function itemHtml(id: number, name: string): string {
  const at = position(id);
  const icon = at ? `<span class="item-icon" aria-hidden="true" style="--x:${at.x};--y:${at.y}"></span>` : "";
  return `<span class="item-name game-text">${icon}${name}</span>`;
}

/** `text`: quoted inside prose, with the InGame highlight; without it, a plain value. */
export function Item({ id, text = false, children }: { id: number; text?: boolean; children: ReactNode }) {
  const className = text ? "item-name game-text" : "item-name";
  if (!hasItemIcon(id)) return text ? <span className={className}>{children}</span> : <>{children}</>;
  return <span className={className}><ItemIcon id={id} />{children}</span>;
}
