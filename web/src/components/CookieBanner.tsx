// Cookie consent, only with Google Analytics (VITE_GA_ID). Not prerendered: the choice lives in the browser.

import { Link } from "react-router";
import { t } from "../i18n";
import { Actions, Button, useHydrated } from "../ui";
import { analyticsEnabled, useConsent } from "../app/analytics";

export function CookieBanner() {
  const { consent, open, decide } = useConsent();
  const hydrated = useHydrated();
  if (!hydrated || !analyticsEnabled || (consent !== null && !open)) return null;
  return (
    <section className="cookie-banner" role="region" aria-label={t("Cookies")}>
      <p>
        {t("Com a sua permissão, usamos o Google Analytics para contar visitas e saber quais páginas são mais usadas. Ele grava cookies no seu navegador. Nada do que você faz nas ferramentas (arquivos, Pokémon, seeds) é enviado.")}{" "}
        <Link to="/privacy">{t("Saiba mais")}</Link>.
      </p>
      <Actions>
        <Button variant="primary" size="sm" onClick={() => decide("granted")}>{t("Aceitar")}</Button>
        <Button size="sm" onClick={() => decide("denied")}>{t("Recusar")}</Button>
      </Actions>
    </section>
  );
}
