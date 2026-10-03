// Option card: the whole card selects (aria-pressed); small buttons below refine the choice.

import type { ReactNode } from "react";

export function OptionCard({ selected, onSelect, title, aside, meta, children }: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={selected ? "option-card selected" : "option-card"}>
      <button type="button" className="option-card-main" aria-pressed={selected} onClick={onSelect}>
        <span className="option-card-head"><span className="option-card-title">{title}</span>{aside !== undefined && <span className="option-card-aside">{aside}</span>}</span>
        {meta && <span className="option-card-meta">{meta}</span>}
      </button>
      {children && <div className="option-card-extra">{children}</div>}
    </div>
  );
}

/** Small button inside an OptionCard; without onClick it is display only (e.g. a level range). */
export function OptionChip({ selected = false, onClick, children, label }: {
  selected?: boolean; onClick?: () => void; children: ReactNode; label?: string;
}) {
  if (!onClick) return <span className="option-chip static">{children}</span>;
  return <button type="button" className={selected ? "option-chip on" : "option-chip"} aria-pressed={selected} aria-label={label} onClick={onClick}>{children}</button>;
}
