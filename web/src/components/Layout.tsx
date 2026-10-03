import { useEffect, type MouseEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { t } from "../i18n";
import { applyAccent, usePrefs } from "../app/prefs";
import { counterpart, localize, matchRoute, splitLang } from "../app/routes";
import { applyHead } from "../app/head";
import { ENABLED_GAMES } from "../games";
import { FlyingMew, Icon, Mark, MenuButton, TermTips, useHydrated } from "../ui";
import { glossary } from "../content/glossary";
import { BRAND_NAME, REPO_URL } from "../brand";
import { CookieBanner } from "./CookieBanner";
import { LangSuggest } from "./LangSuggest";
import { BrandName } from "./BrandName";
import { ChangelogModal } from "./ChangelogModal";
import { TourHost } from "./TourHost";
import { LATEST_VERSION } from "../content/changelog";
import { analyticsEnabled, pageView, useConsent } from "../app/analytics";

const NAV = [
  { to: "/", label: () => t("Início"), end: true },
  { to: "/rng", label: () => "RNG" },
  { to: "/editor", label: () => "Editor" },
  { to: "/codes", label: () => t("Códigos") },
  { to: "/guides", label: () => t("Guias") },
  { to: "/about", label: () => t("Sobre"), also: ["/credits", "/privacy", "/terms"] },
];

// Prerender and hydration use the default accent (Fire); the stored choice applies right after.
function AccentSwitch() {
  const { accent: saved, setAccent } = usePrefs();
  const accent = useHydrated() ? saved : "fire";
  const current = ENABLED_GAMES.find((g) => g.accent === accent) ?? ENABLED_GAMES[0];
  if (ENABLED_GAMES.length <= 2) {
    const next = ENABLED_GAMES[(ENABLED_GAMES.indexOf(current) + 1) % ENABLED_GAMES.length];
    const label = t("Trocar para o tema {name}", { name: next.name });
    return (
      <button className={`icon-btn accent-btn accent-${accent}`} type="button" onClick={() => setAccent(next.accent)} aria-label={label} title={label}>
        <Icon name={current.icon} />
      </button>
    );
  }
  return (
    <MenuButton label={t("Tema do jogo")} value={accent} onChange={setAccent} className={`accent-btn accent-${accent}`}
      options={ENABLED_GAMES.map((g) => ({ value: g.accent, label: g.name, icon: <span className={`accent-${g.accent}`}><Icon name={g.icon} /></span> }))}>
      <Icon name={current.icon} />
    </MenuButton>
  );
}

const plainClick = (e: MouseEvent | globalThis.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export function Layout() {
  const { lang, setLang, theme, setTheme, accent } = usePrefs();
  const reopenCookies = useConsent((s) => s.reopen);
  const consent = useConsent((s) => s.consent);
  const location = useLocation();
  const navigate = useNavigate();
  const other = lang === "en" ? "pt" : "en";
  // An unknown path leads to the home page.
  const otherHref = counterpart(localize(location.pathname, lang));

  // The design catalog (dev only) is not in the route registry.
  useEffect(() => {
    if (import.meta.env.DEV && location.pathname === "/design") return;
    applyHead(matchRoute(location.pathname, lang));
  }, [location.pathname, lang]);

  // Internal links outside the router (guide Markdown, glossary tips, tours) navigate without reloading.
  useEffect(() => {
    const onClick = (e: globalThis.MouseEvent) => {
      if (e.defaultPrevented || !plainClick(e)) return;
      const a = (e.target as Element | null)?.closest?.("a");
      const href = a?.getAttribute("href");
      if (!a || !href || a.target || a.hasAttribute("download") || !href.startsWith("/") || href.startsWith("//")) return;
      const url = new URL(href, window.location.origin);
      const target = splitLang(url.pathname);
      if (target.lang !== lang) return;
      e.preventDefault();
      navigate(target.path + url.search + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lang, navigate]);

  const switchLang = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!plainClick(e)) return;
    e.preventDefault();
    window.history.pushState(null, "", otherHref + location.search);
    setLang(other);
  };

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  }, [lang]);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Deferred so the title is updated first; counted only with consent.
  useEffect(() => {
    const id = window.setTimeout(() => pageView(window.location.pathname), 0);
    return () => window.clearTimeout(id);
  }, [location.pathname, consent]);

  const toggleTheme = () => {
    const current = theme !== "auto" ? theme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(current === "dark" ? "light" : "dark");
  };
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>{t("Pular para o conteúdo")}</a>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink className="brand" to="/" aria-label={t("{name}, início", { name: BRAND_NAME })}>
            <Mark className="brand-mark" />
            <span><BrandName /></span>
          </NavLink>
          <nav className="nav" aria-label={t("Seções")}>
            {NAV.map((item) => {
              const extra = item.also?.includes(location.pathname);
              return (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => (isActive || extra ? "active" : undefined)}
                  aria-current={extra ? "page" : undefined}>
                  {item.label()}
                </NavLink>
              );
            })}
          </nav>
          <div className="topbar-tools">
            <a className="icon-btn lang-btn" href={otherHref} hrefLang={other === "en" ? "en" : "pt-BR"} onClick={switchLang}
              aria-label={other === "en" ? "Switch to English" : "Mudar para português"}
              title={other === "en" ? "Switch to English" : "Mudar para português"}>
              {other.toUpperCase()}
            </a>
            <AccentSwitch />
            <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={t("Alternar tema claro e escuro")}>
              <Icon name="theme" />
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <LangSuggest href={otherHref} onChoose={switchLang} />
        <Outlet />
      </main>
      <TermTips lookup={(key) => {
        const entry = glossary(lang)[key];
        return entry && { title: entry.title, text: entry.text, href: entry.guide ? localize(`/guides/${entry.guide}`, lang) : undefined };
      }} />
      <footer className="footer">
        <nav className="footer-links" aria-label={t("Rodapé")}>
          <NavLink to="/about">{t("Sobre")}</NavLink>
          <NavLink to="/credits">{t("Créditos")}</NavLink>
          <NavLink to="/privacy">{t("Privacidade")}</NavLink>
          <NavLink to="/terms">{t("Termos de uso")}</NavLink>
          {analyticsEnabled && <button type="button" className="footer-link-btn" onClick={reopenCookies}>{t("Cookies")}</button>}
        </nav>
        <div className="footer-extra">
          <NavLink to="/changelog" className="footer-version" title={t("Changelog")} aria-label={t("Versão {version}: ver o changelog", { version: LATEST_VERSION })}>v{LATEST_VERSION}</NavLink>
          <a className="kofi" href="https://ko-fi.com/beaterstudios" target="_blank" rel="noopener noreferrer">
            <Icon name="coffee" />{t("Apoie no Ko-fi")}
          </a>
          {REPO_URL && (
            <a className="icon-btn footer-repo" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={t("Código-fonte no GitHub")} title={t("Código-fonte no GitHub")}>
              <Icon name="github" />
            </a>
          )}
        </div>
        <p>© 2026 <a href="https://beaterstudios.com/" target="_blank" rel="noopener">Beater Studios</a> · <a href="mailto:studiosbeater@gmail.com">studiosbeater@gmail.com</a></p>
        <p>{t("{name} · projeto de fãs, AGPLv3 · sem ligação com Nintendo, The Pokémon Company ou Game Freak.", { name: BRAND_NAME })}</p>
      </footer>
      <CookieBanner />
      <ChangelogModal />
      <TourHost />
      <FlyingMew />
    </>
  );
}

