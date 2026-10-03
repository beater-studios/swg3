// Switch word filter applied to names (svc_BadWordCheck in revision 10). Port of src/swg3/gen3/badwords.py.
// Model from Gen3ACEPokemonBuilder (MankeyMite, GPLv3, `src/lib/profanityFilter.js`), ported with credit: patterns from PKHeX's
// `badwords_switch.txt` (kwsch and contributors, GPLv3), split into boundary and strong terms and tuned by tests on a real Switch.
// A prediction, not a guarantee. Text is compared by code point (like Python's `str`): the list has non-BMP characters.

import listText from "@data/badwords_switch.txt?raw";

const SEPARATORS = /[\s\-.,!?'"‘’“”…♂♀`~@#$%^&*()_+={}[\]|\\:;<>/]+/g;
const LETTER = "a-zÀ-ɏЀ-ӿ぀-ヿ一-鿿가-힯";
const LETTER_RE = new RegExp(`^[${LETTER}]$`, "iu");
const LETTER_RUNS = new RegExp(`[${LETTER}]+`, "giu");
const NON_LETTERS = new RegExp(`[^${LETTER}]`, "giu");
// Python's str.isdigit: decimal digits plus "Digit" type ones (superscript, subscript, circled).
const DIGIT = /^[\p{Nd}¹²³⁰⁴-⁹₀-₉①-⑨⑴-⑼⒈-⒐⓵-⓽⓪❶-❾➀-➈➊-➒]$/u;
const BOUNDARY = "\x00";

// Manual overrides from Gen3ACEPokemonBuilder, confirmed or conservative.
export const MANUAL_BOUNDARY: ReadonlySet<string> = new Set([
  "ass", "sa", "ho", "cum", "tit", "nob", "cox", "cok", "pis", "pee", "pad", "gai", "git", "hoe", "hor",
]);
export const MANUAL_STRONG: ReadonlySet<string> = new Set([
  "dp", "nlq", "xxx", "fag", "sex", "shit", "fuck", "cunt", "dick", "cock", "nigga", "nigger", "niger",
  "niga", "nigg", "porn", "rape", "nazi", "penis", "vagina", "bitch", "whore", "slut", "wank",
]);

/** Python `sorted` order for strings: by code point. */
export function compareCodePoints(a: string, b: string): number {
  const x = [...a], y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}

export function normalize(text: string): string {
  return text.toLowerCase().replace(SEPARATORS, BOUNDARY);
}

const isLetter = (char: string) => LETTER_RE.test(char);

export type PatternKind = "exact" | "substring" | "prefix" | "suffix" | "other";

/** [term, kind] of a PKHeX pattern. */
export function parsePattern(pattern: string): [string, PatternKind] {
  const substring = pattern.startsWith(".*") && pattern.endsWith(".*");
  const exact = pattern.startsWith("^") && pattern.endsWith("$") && !pattern.includes(".*");
  const prefix = pattern.startsWith("^") && pattern.endsWith(".*");
  const suffix = pattern.startsWith(".*") && pattern.endsWith("$") && !substring;
  const kind: PatternKind = exact ? "exact" : substring ? "substring" : prefix ? "prefix" : suffix ? "suffix" : "other";
  let term = pattern.replace(/^\.\*/, "").replace(/\.\*$/, "");
  term = term.replace(/^\^/, "").replace(/\$$/, "");
  term = term.replaceAll("\\$", "$").replaceAll("\\.", ".").replaceAll("\\\\", "\\");
  return [term.toLowerCase(), kind];
}

export function classify(pattern: string): [string, "boundary" | "strong"] {
  const [term, kind] = parsePattern(pattern);
  if (MANUAL_STRONG.has(term)) return [term, "strong"];
  if (MANUAL_BOUNDARY.has(term)) return [term, "boundary"];
  if (kind === "exact" || (kind === "substring" && [...term].length <= 3)) return [term, "boundary"];
  return [term, "strong"];
}

let cached: [boundary: Set<string>, strong: Set<string>] | undefined;

/** [boundary terms, strong terms] from data/badwords_switch.txt. */
export function terms(): [boundary: ReadonlySet<string>, strong: ReadonlySet<string>] {
  if (!cached) {
    const boundary = new Set<string>(), strong = new Set<string>();
    // Same line breaks as Python's str.splitlines.
    for (const pattern of listText.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/)) {
      if (!pattern) continue;
      const [term, kind] = classify(pattern);
      if (term) (kind === "boundary" ? boundary : strong).add(term);
    }
    cached = [boundary, strong];
  }
  return cached;
}

function separatedLetters(normalized: string, term: string): boolean {
  const tokens = [...normalized.replace(/[0-9]+/g, "").matchAll(LETTER_RUNS)].map((m) => m[0].toLowerCase());
  if (tokens.includes(term)) return true;
  if ([...term].length <= 1) return false;
  let singles: string[] = [];
  for (const token of [...tokens, ""]) {
    if ([...token].length === 1) {
      singles.push(token);
      continue;
    }
    if (singles.length >= [...term].length && singles.join("").includes(term)) return true;
    singles = [];
  }
  return false;
}

function boundaryMatch(normalized: string, term: string): boolean {
  const s = [...normalized], word = [...term];
  for (let start = 0; start < s.length; start++) {
    if (s[start] !== word[0]) continue;
    let i = start, j = 0, end = start;
    while (i < s.length && j < word.length) {
      if (DIGIT.test(s[i])) {
        i += 1;
        continue;
      }
      if (s[i] === word[j]) {
        end = i;
        i += 1;
        j += 1;
        continue;
      }
      break;
    }
    if (j !== word.length) continue;
    const before = start > 0 ? s[start - 1] : BOUNDARY;
    const after = end + 1 < s.length ? s[end + 1] : BOUNDARY;
    if (!isLetter(before) && !isLetter(after)) return true;
  }
  return separatedLetters(normalized, term);
}

/** Terms that would block the text: strong first, then boundary. */
export function matches(text: string): string[] {
  const normalized = normalize(text);
  const letters = normalized.replace(NON_LETTERS, "");
  const [boundary, strong] = terms();
  const found = [...strong].filter((t) => letters.includes(t)).sort(compareCodePoints);
  // Every boundary match needs the term contiguous in the letters: a cheap filter before the search.
  found.push(...[...boundary].filter((t) => letters.includes(t) && boundaryMatch(normalized, t)).sort(compareCodePoints));
  return found;
}

export function isBoundary(term: string): boolean {
  return terms()[0].has(term);
}

export function blocked(text: string): boolean {
  return matches(text).length > 0;
}
