import { getLang, t } from "../i18n";
import { CHANGELOG, LATEST_VERSION, changelogDate } from "../content/changelog";
import { Page, Panel, Stack, Tag } from "../ui";

export function ChangelogPage() {
  const lang = getLang();
  return (
    <Page title={t("Changelog")} lead={t("O que mudou em cada versão do site.")}>
      <Stack>
        {CHANGELOG.map((entry) => (
          <Panel as="article" key={entry.version} className="changelog-entry">
            <header className="changelog-head">
              <h2 id={`v${entry.version}`}>v{entry.version}</h2>
              {entry.version === LATEST_VERSION && <Tag tone="ok">{t("atual")}</Tag>}
              <time dateTime={entry.date}>{changelogDate(entry.date, lang)}</time>
            </header>
            <ul className="changelog-list">
              {entry.highlights[lang].map((text) => <li key={text}>{text}</li>)}
            </ul>
          </Panel>
        ))}
      </Stack>
    </Page>
  );
}
