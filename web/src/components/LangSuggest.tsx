// Suggests the same page in the browser's language. No automatic redirect: the URL decides the language.

import { useState, type MouseEvent } from "react";
import { N_, translate, type Lang } from "../i18n";
import { browserLang, chosenLang, save, usePrefs } from "../app/prefs";
import { storageKey } from "../brand";
import { Actions, Button, ButtonLink, Notice, useHydrated } from "../ui";

const TEXT: Record<Lang, { offer: string; go: string; later: string }> = {
  en: { offer: N_("Esta página também tem versão em inglês."), go: N_("Ver em inglês"), later: N_("Agora não") },
  pt: { offer: N_("Esta página também tem versão em português."), go: N_("Ver em português"), later: N_("Agora não") },
};

export function LangSuggest({ href, onChoose }: { href: string; onChoose: (e: MouseEvent<HTMLAnchorElement>) => void }) {
  const { lang } = usePrefs();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);
  if (!hydrated || dismissed || chosenLang() !== null) return null;
  const want = browserLang();
  if (want === lang) return null;
  const text = TEXT[want];
  const dismiss = () => {
    save(storageKey("lang"), lang);
    setDismissed(true);
  };
  return (
    <div className="lang-suggest" lang={want === "en" ? "en" : "pt-BR"}>
      <Notice>
        <p>{translate(want, text.offer)}</p>
        <Actions>
          <ButtonLink variant="primary" size="sm" href={href} hrefLang={want === "en" ? "en" : "pt-BR"} onClick={onChoose}>{translate(want, text.go)}</ButtonLink>
          <Button size="sm" onClick={dismiss}>{translate(want, text.later)}</Button>
        </Actions>
      </Notice>
    </div>
  );
}
