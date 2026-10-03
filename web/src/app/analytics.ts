// Google Analytics (GA4), loaded only after consent. ID from VITE_GA_ID at build time; without it, nothing runs.

import { create } from "zustand";
import { storageKey } from "../brand";
import { load, save } from "./prefs";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const GA_ID: string = import.meta.env.VITE_GA_ID ?? "";
export const analyticsEnabled = /^G-[A-Z0-9]+$/.test(GA_ID);

export type Consent = "granted" | "denied" | null;
const KEY = storageKey("consent");

function stored(): Consent {
  const value = load<Consent>(KEY, null);
  return value === "granted" || value === "denied" ? value : null;
}

let started = false;

function start() {
  if (!analyticsEnabled || started) return;
  started = true;
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = false;
  window.dataLayer = window.dataLayer ?? [];
  // gtag must push the `arguments` object, as in the official snippet.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.append(script);
}

function stop() {
  if (!analyticsEnabled) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true;
  started = false;
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (!name.startsWith("_ga")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

interface ConsentState {
  consent: Consent;
  open: boolean;
  decide: (consent: "granted" | "denied") => void;
  reopen: () => void;
}

export const useConsent = create<ConsentState>((set) => ({
  consent: stored(),
  open: false,
  decide: (consent) => {
    save(KEY, consent);
    if (consent === "granted") start();
    else stop();
    set({ consent, open: false });
  },
  reopen: () => set({ open: true }),
}));

if (analyticsEnabled && stored() === "granted") start();

/** GA only counts the first load by itself; client-side navigations are sent here. */
export function pageView(path: string) {
  if (!started || !window.gtag) return;
  window.gtag("event", "page_view", { page_path: path, page_location: location.href, page_title: document.title });
}
