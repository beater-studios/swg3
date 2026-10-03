// Browser-only part of a page: prerender and hydration show a placeholder, then the content mounts.

import { Suspense, useSyncExternalStore, type ReactNode } from "react";
import { t } from "../i18n";

const subscribe = () => () => {};

/** false during prerender and hydration; true right after (and immediately on client navigation). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function ClientOnly({ children, minHeight = "60vh" }: { children: ReactNode; minHeight?: string }) {
  const hydrated = useHydrated();
  const placeholder = (
    <div className="client-only" data-client-pending="" aria-busy="true" style={{ minHeight }}>
      <p className="muted">{t("Carregando a ferramenta...")}</p>
      <noscript><p>{t("Esta ferramenta roda no navegador e precisa de JavaScript ligado.")}</p></noscript>
    </div>
  );
  if (!hydrated) return placeholder;
  return <Suspense fallback={placeholder}>{children}</Suspense>;
}
