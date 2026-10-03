import { usePrefs } from "../app/prefs";
import { page } from "../content";
import { Page, Panel } from "../ui";

export function ContentPage({ name }: { name: string }) {
  const { lang } = usePrefs();
  const content = page(lang, name);
  if (!content) return null;
  return (
    <Page title={content.title} lead={content.lead}>
      <Panel variant="prose" className="doc-panel">
        <div className="md" dangerouslySetInnerHTML={{ __html: content.html }} />
      </Panel>
    </Page>
  );
}
