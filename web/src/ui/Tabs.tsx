// Tabs. folder: each TabPanel's first child must be a Panel. pills: mode choice inside a card.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  /** Tour marker (data-tour) on the tab. */
  tour?: string;
}

export function Tabs<T extends string>({ tabs, value, onChange, label, variant = "folder", className = "", tour }: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  variant?: "folder" | "pills";
  className?: string;
  /** Tour marker (data-tour) on the tab bar. */
  tour?: string;
}) {
  const id = useId();
  const bar = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = bar.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = bar.current;
    if (!el || variant !== "folder") return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, variant, tabs.length]);

  useEffect(() => {
    const el = bar.current;
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !active) return;
    const pad = 44;
    if (active.offsetLeft - pad < el.scrollLeft) el.scrollTo({ left: active.offsetLeft - pad, behavior: "smooth" });
    else if (active.offsetLeft + active.offsetWidth + pad > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: active.offsetLeft + active.offsetWidth + pad - el.clientWidth, behavior: "smooth" });
    }
  }, [value]);

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    document.getElementById(`${id}-${next.id}`)?.focus();
  };
  const scroll = (direction: 1 | -1) => bar.current?.scrollBy({ left: direction * bar.current.clientWidth * 0.7, behavior: "smooth" });

  const list = (
    <div ref={bar} className={`tabs ${variant === "pills" ? "subtabs" : ""} ${className}`.trim()} role="tablist" aria-label={label}
      onKeyDown={onKey} onScroll={variant === "folder" ? measure : undefined}>
      {tabs.map((tab) => (
        <button key={tab.id} id={`${id}-${tab.id}`} data-tour={tab.tour} role="tab" type="button" aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
  if (variant === "pills") return list;
  // The arrows are for mouse users: keyboard uses arrow keys, and touch drags.
  return (
    <div className="tabs-wrap" data-tour={tour}>
      {list}
      {edges.left && <button type="button" className="tabs-scroll tabs-scroll-left" tabIndex={-1} aria-hidden="true" onClick={() => scroll(-1)}>‹</button>}
      {edges.right && <button type="button" className="tabs-scroll tabs-scroll-right" tabIndex={-1} aria-hidden="true" onClick={() => scroll(1)}>›</button>}
    </div>
  );
}

// keep: stays mounted while hidden (keeps typed input).
export function TabPanel({ active, children, keep = true }: { active: boolean; children: ReactNode; keep?: boolean }) {
  if (!active && !keep) return null;
  return <div className="tab-panel" role="tabpanel" hidden={!active}>{children}</div>;
}
