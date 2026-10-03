// Route registry: single source for prerendering (scripts/build.mjs), the sitemap and the <head> (app/head.ts).

import type { Lang } from "../i18n";
import { guides, page } from "../content";
import { BRAND_NAME } from "../brand";
import seoPt from "../content/seo/pt.json";
import seoEn from "../content/seo/en.json";
import { localize, splitLang } from "./paths";

export { basename, localize, splitLang } from "./paths";

export const LANGS: Lang[] = ["pt", "en"];

type SeoText = typeof seoPt;
const SEO: Record<Lang, SeoText> = { pt: seoPt, en: seoEn };

export function seoText(lang: Lang): SeoText {
  return SEO[lang];
}

export interface Crumb {
  name: string;
  path: string;
}

export interface RouteMeta {
  /** "home", "rng", "guide:ace", "page:about", "notfound"... */
  id: string;
  /** Without the language prefix. */
  path: string;
  lang: Lang;
  title: string;
  name: string;
  description: string;
  type: "website" | "article";
  /** Only where it is shown on screen. */
  breadcrumb?: Crumb[];
  noindex?: boolean;
}

function titled(name: string): string {
  return `${name} · ${BRAND_NAME}`;
}

function fixed(lang: Lang, id: keyof SeoText["routes"], path: string): RouteMeta {
  const text = SEO[lang].routes[id];
  const home = id === "home";
  return {
    id, path, lang, type: "website",
    title: home ? `${BRAND_NAME}: ${SEO[lang].site.tagline}` : titled(text.title),
    name: home ? SEO[lang].site.home : text.title,
    description: text.description,
  };
}

const PAGES = ["about", "credits", "privacy", "terms"] as const;

const lists = new Map<Lang, RouteMeta[]>();

/** In sitemap order. */
export function routeList(lang: Lang): RouteMeta[] {
  if (!lists.has(lang)) {
    const guidesRoute = fixed(lang, "guides", "/guides");
    const home = SEO[lang].site.home;
    const list: RouteMeta[] = [
      fixed(lang, "home", "/"),
      fixed(lang, "rng", "/rng"),
      fixed(lang, "editor", "/editor"),
      fixed(lang, "codes", "/codes"),
      guidesRoute,
      ...guides(lang).map((g): RouteMeta => ({
        id: `guide:${g.slug}`, path: `/guides/${g.slug}`, lang, type: "article",
        title: titled(g.title), name: g.title, description: g.summary,
        breadcrumb: [{ name: home, path: "/" }, { name: guidesRoute.name, path: "/guides" }, { name: g.title, path: `/guides/${g.slug}` }],
      })),
      ...PAGES.map((name): RouteMeta => {
        const content = page(lang, name)!;
        return { id: `page:${name}`, path: `/${name}`, lang, type: "website", title: titled(content.title), name: content.title, description: content.lead };
      }),
      fixed(lang, "changelog", "/changelog"),
    ];
    lists.set(lang, list);
  }
  return lists.get(lang)!;
}

export function notFound(lang: Lang): RouteMeta {
  return { ...fixed(lang, "notfound", "/404"), noindex: true };
}

export function matchRoute(path: string, lang: Lang): RouteMeta {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return routeList(lang).find((r) => r.path === clean) ?? notFound(lang);
}

export function routeOf(pathname: string): RouteMeta {
  const { lang, path } = splitLang(pathname);
  return matchRoute(path, lang);
}

/** data-route on #root: the client only hydrates when the route matches. */
export function routeKey(meta: RouteMeta): string {
  return meta.noindex ? `404:${meta.lang}` : localize(meta.path, meta.lang);
}

export function counterpart(pathname: string): string {
  const { lang } = splitLang(pathname);
  const other: Lang = lang === "en" ? "pt" : "en";
  const meta = routeOf(pathname);
  return localize(meta.noindex ? "/" : meta.path, other);
}
