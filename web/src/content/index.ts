// Markdown loader for guides, pages and Professor Oak tours (content/{guides,pages,tours}/<lang>/*.md).
// Syntax (frontmatter, `:::` blocks, `:::screen`, `{{name}}`, tour steps): CONTRIBUTING.md.

import { marked } from "marked";
import type { Lang } from "../i18n";
import { glossary, markGameWords, markTerms } from "./glossary";
import { BRAND_NAME, REPO_URL } from "../brand";
import { analyticsEnabled } from "../app/analytics";
import { localize } from "../app/paths";

const guideFiles = import.meta.glob<string>("./guides/*/*.md", { query: "?raw", import: "default", eager: true });
const pageFiles = import.meta.glob<string>("./pages/*/*.md", { query: "?raw", import: "default", eager: true });
const tourFiles = import.meta.glob<string>("./tours/*/*.md", { query: "?raw", import: "default", eager: true });

export interface Guide {
  slug: string;
  order: number;
  group: string;
  title: string;
  summary: string;
  needs: string;
  level: string;
  html: string;
}

export interface Page {
  title: string;
  lead: string;
  html: string;
}

// {{#analytics}}...{{/analytics}} only with Google Analytics configured; {{^analytics}}...{{/analytics}} only without.
export function withAnalytics(text: string, enabled: boolean): string {
  return text.replace(/\{\{([#^])analytics\}\}\n?([\s\S]*?)\{\{\/analytics\}\}\n?/g, (_all, kind: string, inner: string) => ((kind === "#") === enabled ? inner : ""));
}

function parse(source: string): { meta: Record<string, string>; body: string } {
  const raw = withAnalytics(source.replaceAll("{{name}}", BRAND_NAME).replaceAll("{{repo}}", REPO_URL), analyticsEnabled);
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    const value = line.slice(at + 1).trim();
    meta[line.slice(0, at).trim()] = /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
  }
  return { meta, body: match[2] };
}

const BLOCK = /^:::(warn|tip|note|source)[ \t]*(.*)\n([\s\S]*?)\n:::[ \t]*$/gm;
const SCREEN = /^:::screen[ \t]+([\w-]+)[ \t]*$/gm;
export const SCREEN_MARK = /<div data-screen="([\w-]+)"><\/div>/;

// Internal links get the language prefix so they work without JS.
function render(body: string, lang: Lang): string {
  const withScreens = body.replace(SCREEN, (_all, name: string) => `\n<div data-screen="${name}"></div>\n`);
  const withBlocks = withScreens.replace(BLOCK, (_all, kind: string, title: string, inner: string) => {
    const content = marked.parse(inner, { async: false });
    if (kind === "source") return `<div class="source">${content}</div>`;
    const cls = kind === "note" ? "notice" : `notice notice-${kind}`;
    return `<div class="${cls}">${title ? `<b class="notice-title">${marked.parseInline(title, { async: false })}</b>` : ""}${content}</div>`;
  });
  return (marked.parse(withBlocks, { async: false, gfm: true }))
    // Numbers come from a CSS counter, so `start` alone would not continue a list after a `:::screen`.
    .replace(/<ol start="(\d+)">/g, (_all, start: string) => `<ol start="${start}" style="counter-reset: step ${Number(start) - 1}">`)
    .replace(/<table>/g, '<div class="table-wrap"><table class="grid-table">')
    .replace(/<\/table>/g, "</table></div>")
    .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"')
    .replace(/<a href="(\/[^"]*)"/g, (_all, href: string) => `<a href="${localize(href, lang)}"`);
}

function byLang(files: Record<string, string>, folder: string, lang: Lang) {
  const out = new Map<string, string>();
  for (const fallback of ["pt", lang]) {
    for (const [path, raw] of Object.entries(files)) {
      const match = path.match(new RegExp(`^\\./${folder}/${fallback}/([\\w-]+)\\.md$`));
      if (match) out.set(match[1], raw);
    }
  }
  return out;
}

const cache = new Map<string, unknown>();

export function guides(lang: Lang): Guide[] {
  const key = `guides:${lang}`;
  if (!cache.has(key)) {
    const list = [...byLang(guideFiles, "guides", lang)].map(([slug, raw]) => {
      const { meta, body } = parse(raw);
      return {
        slug: meta.slug || slug, order: Number(meta.order) || 99, group: meta.group ?? "", title: meta.title ?? slug,
        summary: meta.summary ?? "", needs: meta.needs ?? "", level: meta.level ?? "", html: markTerms(markGameWords(render(body, lang)), glossary(lang)),
      };
    }).sort((a, b) => a.order - b.order);
    cache.set(key, list);
  }
  return cache.get(key) as Guide[];
}

export function page(lang: Lang, name: string): Page | null {
  const raw = byLang(pageFiles, "pages", lang).get(name);
  if (!raw) return null;
  const { meta, body } = parse(raw);
  return { title: meta.title ?? name, lead: meta.lead ?? "", html: markGameWords(render(body, lang)) };
}

export interface TourStep {
  /** data-tour marker of the highlighted element; null for a step centered on screen. */
  target: string | null;
  go?: string;
  wait?: string;
  html: string;
}

export interface Tour {
  id: string;
  title: string;
  summary: string;
  steps: TourStep[];
}

const STEP = /^##[ \t]+(\S+)([^\n]*)\n([\s\S]*?)(?=^##[ \t]|(?![\s\S]))/gm;

export function tours(lang: Lang): Tour[] {
  const key = `tours:${lang}`;
  if (!cache.has(key)) {
    const list = [...byLang(tourFiles, "tours", lang)].map(([id, raw]) => {
      const { meta, body } = parse(raw);
      const steps = [...body.matchAll(STEP)].map(([, target, attrs, text]) => {
        const options = Object.fromEntries([...attrs.matchAll(/(\w+)=(\S+)/g)].map(([, k, v]) => [k, v]));
        const html = markGameWords(render(text.trim().replace(/\[\[([^\]]+)\]\]/g, '<kbd class="pad-key">$1</kbd>'), lang));
        return { target: target === "-" ? null : target, go: options.go, wait: options.wait, html };
      });
      return { id, title: meta.title ?? id, summary: meta.summary ?? "", steps };
    });
    cache.set(key, list);
  }
  return cache.get(key) as Tour[];
}

export function tour(lang: Lang, id: string): Tour | null {
  return tours(lang).find((t) => t.id === id) ?? null;
}
