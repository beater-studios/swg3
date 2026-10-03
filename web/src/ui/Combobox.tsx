// Search field with a list (WAI-ARIA list combobox: the active option goes in aria-activedescendant).

import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { t } from "../i18n";

export interface ComboOption {
  value: string;
  label: string;
  /** Short text on the left, also searched (e.g. "#025"). */
  hint?: string;
  group?: string;
  icon?: ReactNode;
  detail?: ReactNode;
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Options matching the query: by name, or by the `hint` number when the query is all digits. */
export function filterOptions(options: readonly ComboOption[], query: string): ComboOption[] {
  const q = fold(query.trim());
  if (!q) return [...options];
  const digits = /^#?\d+$/.test(q) ? String(Number(q.replace("#", ""))) : null;
  return options.filter((o) => {
    if (fold(o.label).includes(q)) return true;
    if (!o.hint) return false;
    const number = o.hint.replace(/\D/g, "");
    return digits !== null ? String(Number(number)).startsWith(digits) : fold(o.hint).includes(q);
  });
}

export function Combobox({ value, onChange, options, empty, placeholder, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ComboOption[];
  /** Label of the empty option (e.g. "nenhuma"); without it, the value cannot be cleared. */
  empty?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const all = useMemo(() => (empty !== undefined ? [{ value: "", label: empty }, ...options] : [...options]), [options, empty]);
  const selected = all.find((o) => o.value === value);
  const [query, setQuery] = useState<string | null>(null);   // null: showing the selected option
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  // Right padding of the input: the measured width of `detail`, so the name does not run under it.
  const detail = useRef<HTMLSpanElement>(null);
  const [detailSpace, setDetailSpace] = useState(0);
  const open = query !== null;
  const shown = open ? filterOptions(all, query) : [];

  const choose = (option: ComboOption | undefined) => {
    if (option) onChange(option.value);
    setQuery(null);
  };
  const move = (delta: number) => {
    if (!open) { setQuery(""); setActive(0); return; }
    const next = Math.max(0, Math.min(shown.length - 1, active + delta));
    setActive(next);
    list.current?.querySelector(`[id="${id}-${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  useLayoutEffect(() => {
    setDetailSpace(detail.current ? detail.current.offsetWidth + 16 : 0);
  }, [selected, open]);

  return (
    <div className={["combo", selected?.icon && !open ? "with-icon" : "", selected?.detail && !open ? "with-detail" : ""].filter(Boolean).join(" ")}>
      {selected?.icon && !open && <span className="combo-icon">{selected.icon}</span>}
      {selected?.detail && !open && <span className="combo-detail" ref={detail}>{selected.detail}</span>}
      <input
        role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${id}-${active}` : undefined}
        style={detailSpace && !open ? { paddingRight: detailSpace } : undefined}
        value={open ? query : selected?.label ?? ""} placeholder={placeholder} disabled={disabled} autoComplete="off" spellCheck={false}
        onFocus={(e) => { setQuery(""); setActive(0); e.currentTarget.select(); }}
        onBlur={() => setQuery(null)}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
          else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
          else if (e.key === "Enter" && open) { e.preventDefault(); choose(shown[active]); }
          else if (e.key === "Escape" && open) { e.preventDefault(); setQuery(null); }
        }}
      />
      {open && (
        <ul className="combo-list" id={`${id}-list`} role="listbox" ref={list}>
          {shown.length ? shown.map((o, i) => [
            o.group && o.group !== shown[i - 1]?.group
              ? <li key={`g-${o.group}`} role="presentation" className="combo-group">{o.group}</li> : null,
            <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === value}
              className={i === active ? "active" : undefined}
              // mousedown fires before the input blur, so the pick lands before the list closes.
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}>
              {o.hint && <span className="combo-hint">{o.hint}</span>}{o.icon}{o.label}
              {o.detail && <span className="combo-detail-list">{o.detail}</span>}
            </li>,
          ]) : <li className="combo-none" aria-disabled="true">{t("Nada com esse nome ou número.")}</li>}
        </ul>
      )}
    </div>
  );
}
