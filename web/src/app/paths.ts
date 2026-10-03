// Language in the URL: Portuguese at the root (/rng), English under /en (/en/rng).

import type { Lang } from "../i18n";

export function splitLang(pathname: string): { lang: Lang; path: string } {
  if (pathname === "/en" || pathname.startsWith("/en/")) return { lang: "en", path: pathname.slice(3) || "/" };
  return { lang: "pt", path: pathname || "/" };
}

/** Accepts ?query and #anchor. */
export function localize(path: string, lang: Lang): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (lang === "pt") return p;
  return /^\/(?:[?#]|$)/.test(p) ? `/en${p.slice(1)}` : `/en${p}`;
}

export function basename(lang: Lang): string | undefined {
  return lang === "en" ? "/en" : undefined;
}
