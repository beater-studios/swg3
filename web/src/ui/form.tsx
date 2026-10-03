// Form fields. Controls are native (input, select, textarea), styled in base.css.

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Gender } from "./feedback";
import { Icon } from "./Icon";

export function Fields({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`fields ${className}`.trim()}>{children}</div>;
}

// width: normal (up to 280 px), wide (up to 460 px) or full.
export function Field({ label, children, width = "normal", className = "" }: {
  label: ReactNode; children: ReactNode; width?: "normal" | "wide" | "full"; className?: string;
}) {
  const size = width === "wide" ? "field-wide" : width === "full" ? "field-full" : "";
  return (
    <label className={["field", size, className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Check({ label, ...input }: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="check">
      <input type="checkbox" {...input} /> <span>{label}</span>
    </label>
  );
}

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Radios<T extends string>({ legend, name, value, options, onChange }: {
  legend: ReactNode; name: string; value: T; options: RadioOption<T>[]; onChange: (value: T) => void;
}) {
  return (
    <fieldset className="radios">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} /> {option.label}
        </label>
      ))}
    </fieldset>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: string;
  /** Fixed icon color when selected (fire or leaf, the game colors; shiny, gold); without tone, the theme accent. */
  tone?: "fire" | "leaf" | "shiny";
}

export function Segmented<T extends string>({ label, name, value, options, onChange, disabled = false, wrap = false }: {
  label: ReactNode; name: string; value: T; options: SegmentOption<T>[]; onChange: (value: T) => void; disabled?: boolean;
  wrap?: boolean;
}) {
  return (
    <fieldset className={wrap ? "field segmented wrap" : "field segmented"} disabled={disabled}>
      <legend>{label}</legend>
      <div className="segments">
        {options.map((option) => (
          <label key={option.value} className={[option.value === value ? "on" : "", option.tone ? `tone-${option.tone}` : ""].filter(Boolean).join(" ") || undefined}>
            <input type="radio" name={name} checked={option.value === value} onChange={() => onChange(option.value)} />
            {option.icon && <Icon name={option.icon} />}
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface GenderOption<T extends string> {
  value: T;
  label: string;
  /** Symbol before the name: M (blue ♂), F (pink ♀), - (genderless); null for "any". */
  gender: "M" | "F" | "-" | null;
}

// disabled: single-gender species or no species yet; pass only the valid option.
export function GenderChoice<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: ReactNode; value: T; options: GenderOption<T>[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  const name = useId();
  return (
    <Segmented label={label} name={name} value={value} disabled={disabled} onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: <>{o.gender && <Gender value={o.gender} decorative />}{o.label}</> }))} />
  );
}

export function FileDrop({ title, detail, hint, accept, multiple = false, onFiles }: {
  title: ReactNode; detail?: ReactNode; hint?: ReactNode; accept?: string; multiple?: boolean; onFiles: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label className={`dropzone ${over ? "over" : ""}`.trim()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}>
      <input type="file" accept={accept} multiple={multiple} onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <Icon name="file" />
      <span><b>{title}</b>{detail ? <> {detail}</> : null}</span>
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** Digits only, a leading "-" if `negative`, one separator if `decimal`, no leading zeros ("0" and "0,5" stay). */
export function cleanNumber(text: string, negative: boolean, decimal: boolean): string {
  let out = "";
  let separator = false;
  for (const [i, ch] of [...text].entries()) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "-" && negative && i === 0) out += ch;
    else if ((ch === "," || ch === ".") && decimal && !separator) { out += ch; separator = true; }
  }
  const sign = out.startsWith("-") ? "-" : "";
  const body = out.slice(sign.length).replace(/^0+(?=\d)/, "");
  return sign + body;
}

const numberOf = (text: string) => Number(text.replace(",", "."));

// Text field with a numeric keyboard: type="number" lets Firefox and Safari accept letters.
// Clamps to the max while typing, to the min on blur.
export function NumberInput({ decimal = false, min, max, onChange, onBlur, ...input }: { decimal?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const negative = min === undefined || Number(min) < 0;
  return (
    <input {...input} type="text" inputMode={decimal ? "decimal" : "numeric"} autoComplete="off"
      onChange={(e) => {
        let clean = cleanNumber(e.target.value, negative, decimal);
        if (max !== undefined && clean !== "" && clean !== "-" && numberOf(clean) > Number(max)) clean = String(max);
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }}
      onBlur={(e) => {
        const value = e.target.value;
        if (min !== undefined && value !== "" && value !== "-" && numberOf(value) < Number(min)) {
          e.target.value = String(min);
          onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
        }
        onBlur?.(e);
      }} />
  );
}
