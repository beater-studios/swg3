// What's new modal: the current version's highlights, shown once per version (not on a first visit).

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { getLang, t } from "../i18n";
import { load, save } from "../app/prefs";
import { storageKey } from "../brand";
import { CHANGELOG, LATEST_VERSION, changelogDate, isVersionNewer } from "../content/changelog";
import { Actions, Button, Dialog } from "../ui";

const KEY = storageKey("changelog-seen");

export function ChangelogModal() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const seen = load<string | null>(KEY, null);
    if (seen && !isVersionNewer(LATEST_VERSION, seen)) return;
    if (!seen || pathname === "/changelog") save(KEY, LATEST_VERSION);
    else setOpen(true);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => {
    save(KEY, LATEST_VERSION);
    setOpen(false);
  };
  const entry = CHANGELOG[0];
  const lang = getLang();
  return (
    <Dialog open={open} onClose={close} title={t("Novidades da versão {version}", { version: entry.version })} className="changelog-dialog">
      <p className="muted">{changelogDate(entry.date, lang)}</p>
      <ul className="changelog-list">
        {entry.highlights[lang].map((text) => <li key={text}>{text}</li>)}
      </ul>
      <Actions>
        <Button variant="primary" onClick={close}>{t("Entendi")}</Button>
        <Button onClick={() => { close(); navigate("/changelog"); }}>{t("Ver todas as versões")}</Button>
      </Actions>
    </Dialog>
  );
}
