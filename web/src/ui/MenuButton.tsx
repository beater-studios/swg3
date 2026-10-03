// Icon button that opens a list to pick one option (WAI-ARIA menu with radio items).

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface MenuOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function MenuButton<T extends string>({ label, value, options, onChange, className = "", children }: {
  label: string;
  value: T;
  options: readonly MenuOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const current = Math.max(0, options.findIndex((o) => o.value === value));
    items.current[current]?.focus();
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, options, value]);

  const close = () => { setOpen(false); button.current?.focus(); };
  const move = (from: number, delta: number) => items.current[(from + delta + options.length) % options.length]?.focus();

  return (
    <div className="menu" ref={root}>
      <button ref={button} type="button" className={`icon-btn ${className}`.trim()} aria-label={label} title={label}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined} onClick={() => setOpen(!open)}>
        {children}
      </button>
      {open && (
        <div className="menu-list" id={`${id}-menu`} role="menu" aria-label={label}>
          {options.map((o, i) => (
            <button key={o.value} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" aria-checked={o.value === value}
              tabIndex={-1} onClick={() => { onChange(o.value); close(); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
                else if (e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
                else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); close(); }
              }}>
              {o.icon && <span className="menu-icon">{o.icon}</span>}<span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
