// Conversions with Python semantics, so TS messages and validations match Python's (the source of truth, checked by
// the parity vectors): repr, str, int, bool, == and fromhex.

/** str.isprintable: non-printable are categories C (control, format...) and Z, except the space. */
const NON_PRINTABLE = /[\p{C}\p{Z}]/u;

function reprString(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let out = quote;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (char === quote || char === "\\") out += `\\${char}`;
    else if (char === "\n") out += "\\n";
    else if (char === "\r") out += "\\r";
    else if (char === "\t") out += "\\t";
    else if (char !== " " && NON_PRINTABLE.test(char)) {
      if (code < 0x100) out += `\\x${code.toString(16).padStart(2, "0")}`;
      else if (code < 0x10000) out += `\\u${code.toString(16).padStart(4, "0")}`;
      else out += `\\U${code.toString(16).padStart(8, "0")}`;
    } else out += char;
  }
  return out + quote;
}

function reprNumber(value: number): string {
  if (Number.isNaN(value)) return "nan";
  if (!Number.isFinite(value)) return value > 0 ? "inf" : "-inf";
  return String(value);
}

/** Python repr() for JSON values (string, number, bool, null, list, object). */
export function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "string") return reprString(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return reprNumber(value);
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value).map(([k, v]) => `${reprString(k)}: ${pyRepr(v)}`).join(", ")}}`;
  }
  return String(value);
}

export function pyStr(value: unknown): string {
  return typeof value === "string" ? value : pyRepr(value);
}

export function pyTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

/** Python == between JSON values: True == 1 and False == 0. */
export function pyEq(a: unknown, b: unknown): boolean {
  const num = (v: unknown) => (typeof v === "boolean" ? Number(v) : v);
  return num(a) === num(b);
}

const INT_TEXT = /^[+-]?[0-9]+(?:_[0-9]+)*$/;

/** Python int(): TypeError for types Python rejects, Error (ValueError) for invalid text; non-ASCII digits are rejected. */
export function pyInt(value: unknown): number {
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number") {
    if (Number.isNaN(value)) throw new Error("cannot convert float NaN to integer");
    if (!Number.isFinite(value)) throw new Error("cannot convert float infinity to integer");
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (INT_TEXT.test(text)) return Number(text.replaceAll("_", ""));
    throw new Error(`invalid literal for int() with base 10: ${pyRepr(value)}`);
  }
  const type = value === null || value === undefined ? "NoneType" : Array.isArray(value) ? "list" : typeof value === "object" ? "dict" : typeof value;
  throw new TypeError(`int() argument must be a string, a bytes-like object or a real number, not '${type}'`);
}

/** Python bytes.fromhex: hex pairs, whitespace allowed only between pairs. Returns null if the text is not hex. */
export function fromHex(text: string): Uint8Array | null {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i += 1;
      continue;
    }
    const pair = text.slice(i, i + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) return null;
    out.push(parseInt(pair, 16));
    i += 2;
  }
  return Uint8Array.from(out);
}

export function toHex(data: ArrayLike<number>, sep = ""): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join(sep);
}

/** Integer to zero-padded uppercase hex ({value:08X}). */
export const hexUpper = (value: number, width: number) => (value >>> 0).toString(16).toUpperCase().padStart(width, "0");
