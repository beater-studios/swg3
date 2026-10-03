// Move category icons, original drawings. In Gen 3 the category comes from the type (lib/gen3/species.ts, moveCategory).

import type { ReactNode } from "react";
import { t } from "../i18n";
import { TypeBadge } from "./feedback";

export type Category = "physical" | "special" | "status";

const SYMBOLS: Record<Category, ReactNode> = {
  physical: <path d="M10 1.8 11.4 4.6 14.2 3.4 13.6 6.4 16.6 7 14.4 9 16.6 11 13.6 11.6 14.2 14.6 11.4 13.4 10 16.2 8.6 13.4 5.8 14.6 6.4 11.6 3.4 11 5.6 9 3.4 7 6.4 6.4 5.8 3.4 8.6 4.6z" fill="#fff" />,
  special: (
    <>
      <circle cx="10" cy="9" r="6.2" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="10" cy="9" r="3.4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="10" cy="9" r="1.1" fill="#fff" />
    </>
  ),
  status: (
    <>
      <circle cx="10" cy="9" r="6.2" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M10 2.8a3.1 3.1 0 0 1 0 6.2 3.1 3.1 0 0 0 0 6.2" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="10" cy="5.9" r="1" fill="#fff" /><circle cx="10" cy="12.1" r="1" fill="#fff" />
    </>
  ),
};

const NAMES: Record<Category, () => string> = { physical: () => t("físico"), special: () => t("especial"), status: () => "status" };

export function MoveCategoryIcon({ category }: { category: Category }) {
  const name = NAMES[category]();
  return (
    <svg className={`move-category move-${category}`} viewBox="0 0 20 18" role="img" aria-label={name}>
      <title>{name}</title>
      <rect width="20" height="18" rx="4" />
      {SYMBOLS[category]}
    </svg>
  );
}

export function MoveLabel({ category, type, children }: { category: Category | null; type: string | null; children: ReactNode }) {
  return (
    <span className="move-label">
      {category && <MoveCategoryIcon category={category} />}
      <span className="move-name">{children}</span>
      {type && <TypeBadge type={type} />}
    </span>
  );
}
