// Glossary tooltips for guides. Data per language in content/glossary/<lang>.json, same keys.

import type { Lang } from "../i18n";
import pt from "./glossary/pt.json";
import en from "./glossary/en.json";
import { ITEM_WORDS, isItemWord, wordsPattern } from "../i18n/gameWords";
import { itemHtml } from "../ui/ItemIcon";

export interface GlossaryEntry {
  terms: string[];
  title: string;
  text: string;
  guide?: string;
}

export type Glossary = Record<string, GlossaryEntry>;

const DATA: Record<Lang, Glossary> = { pt, en };

export function glossary(lang: Lang): Glossary {
  return DATA[lang] ?? DATA.pt;
}

// Never mark inside these: links already go somewhere, code is literal, headings stay clean.
const SKIP = new Set(["a", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "button"]);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Aliases with capitals (ACE, TID, Bad Egg) match exactly; all lowercase ones (nature, seed) ignore case.
function aliasPattern(alias: string) {
  const exact = /\p{Lu}/u.test(alias);
  return new RegExp(`(?<![\\p{L}\\p{N}_.])${escape(alias)}(?![\\p{L}\\p{N}_])`, exact ? "u" : "iu");
}

interface Segment {
  text: string;
  key?: string;
}

export function markTerms(html: string, entries: Glossary): string {
  const keys = Object.entries(entries).map(([key, entry]) => ({ key, patterns: entry.terms.map(aliasPattern) }));
  const used = new Set<string>();
  let skip = 0;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<")) {
      const name = part.match(/^<\/?([a-zA-Z0-9]+)/)?.[1]?.toLowerCase();
      if (name && SKIP.has(name) && !part.endsWith("/>")) skip += part.startsWith("</") ? -1 : 1;
      return part;
    }
    if (skip > 0 || !part.trim()) return part;
    let segments: Segment[] = [{ text: part }];
    for (const { key, patterns } of keys) {
      if (used.has(key)) continue;
      // Earliest occurrence among the term's aliases; on a tie, the longest.
      let best: { index: number; length: number; at: number } | null = null;
      segments.forEach((segment, at) => {
        if (segment.key) return;
        for (const pattern of patterns) {
          const match = pattern.exec(segment.text);
          if (!match) continue;
          const better = !best || at < best.at || (at === best.at && (match.index < best.index || (match.index === best.index && match[0].length > best.length)));
          if (better) best = { index: match.index, length: match[0].length, at };
        }
      });
      if (!best) continue;
      const { index, length, at } = best as { index: number; length: number; at: number };
      const text = segments[at].text;
      segments = [
        ...segments.slice(0, at),
        { text: text.slice(0, index) },
        { text: text.slice(index, index + length), key },
        { text: text.slice(index + length) },
        ...segments.slice(at + 1),
      ];
      used.add(key);
    }
    return segments.map((s) => (s.key ? `<button type="button" class="term" data-term="${s.key}">${s.text}</button>` : s.text)).join("");
  }).join("");
}

// Same markup as the InGame and Item components.
export function markGameWords(html: string): string {
  let skip = 0;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<")) {
      const name = part.match(/^<\/?([a-zA-Z0-9]+)/)?.[1]?.toLowerCase();
      if (name && SKIP.has(name) && !part.endsWith("/>")) skip += part.startsWith("</") ? -1 : 1;
      return part;
    }
    if (skip > 0 || !part.trim()) return part;
    return part.split(wordsPattern()).map((piece, i) => (i % 2 === 0 ? piece
      : isItemWord(piece) ? itemHtml(ITEM_WORDS[piece], piece)
      : `<span class="game-text">${piece}</span>`)).join("");
  }).join("");
}

