// Browser-stored preferences, failing silently without storage. The language comes from the URL; the stored value
// only records that the visitor already picked one.

import { useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";
import { setLang, type Lang } from "../i18n";
import { storageKey } from "../brand";
import { splitLang } from "./paths";
import { ENABLED_GAMES, type Accent } from "../games";

export type Theme = "light" | "dark" | "auto";
export type { Accent };

function initialAccent(): Accent {
  const saved = load<string>(storageKey("accent"), "fire");
  return ENABLED_GAMES.find((g) => g.accent === saved)?.accent ?? "fire";
}

export function applyAccent(accent: Accent) {
  if (accent === "fire") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no storage: applies to this visit only
  }
}

function langOfUrl(): Lang {
  return typeof location === "undefined" ? "pt" : splitLang(location.pathname).lang;
}

export function chosenLang(): Lang | null {
  const saved = load<Lang | null>(storageKey("lang"), null);
  return saved === "pt" || saved === "en" ? saved : null;
}

export function browserLang(): Lang {
  return typeof navigator !== "undefined" && (navigator.language || "pt").toLowerCase().startsWith("pt") ? "pt" : "en";
}

interface Prefs {
  lang: Lang;
  theme: Theme;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
}

const startLang = langOfUrl();
setLang(startLang);

const store = createStore<Prefs>((set) => ({
  lang: startLang,
  theme: load<Theme>(storageKey("theme"), "auto"),
  accent: initialAccent(),
  setAccent: (accent) => {
    save(storageKey("accent"), accent);
    set({ accent });
  },
  setLang: (lang) => {
    setLang(lang);
    save(storageKey("lang"), lang);
    set({ lang });
  },
  setTheme: (theme) => {
    save(storageKey("theme"), theme);
    set({ theme });
  },
}));

// The server snapshot is the current state (not the initial one, as in zustand's create) because prerendering
// switches language per page.
export const usePrefs = Object.assign(
  (): Prefs => useSyncExternalStore(store.subscribe, store.getState, store.getState),
  { getState: store.getState, setState: store.setState },
);

export function followLang(lang: Lang) {
  if (usePrefs.getState().lang === lang) return;
  setLang(lang);
  usePrefs.setState({ lang });
}

if (typeof window !== "undefined") window.addEventListener("popstate", () => followLang(langOfUrl()));

try {
  applyAccent(usePrefs.getState().accent);
} catch {
  // outside the browser (tests): nothing to apply
}
