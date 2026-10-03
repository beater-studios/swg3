import { Link, NavLink, useParams } from "react-router";
import { t } from "../i18n";
import { usePrefs } from "../app/prefs";
import { guides, type Guide } from "../content";
import { CardGrid, Chip, Chips, LinkCard, Page, Panel } from "../ui";
import { GuideBody } from "../components/GuideBody";
import { NotFound } from "./NotFound";

const PATH = [
  { slug: "safety", title: () => t("Proteja o seu save"), hint: () => t("o que salvar e o que deixar vazio") },
  { slug: "ace", title: () => t("Libere a ACE"), hint: () => t("a rota com o Mail glitch") },
  { slug: "base64", title: () => t("Instale o Base64 writer"), hint: () => t("para criar Pokémon com um código") },
  { slug: "put-in-game", title: () => t("Coloque seu Pokémon"), hint: () => t("do site para o jogo") },
];

function Meta({ guide }: { guide: Guide }) {
  return (
    <Chips>
      <Chip><b>{t("precisa de ")}</b>{guide.needs}</Chip>
      <Chip>{guide.level}</Chip>
    </Chips>
  );
}

function groups(list: Guide[]) {
  const out = new Map<string, Guide[]>();
  for (const guide of list) out.set(guide.group, [...(out.get(guide.group) ?? []), guide]);
  return [...out];
}

export function GuidesIndex() {
  const { lang } = usePrefs();
  const list = guides(lang);
  return (
    <Page title={t("Guias")} lead={t("Passo a passo para cada coisa que dá para fazer no seu jogo, com os cuidados para não perder o save.")}>
      <Panel className="path">
        <h2>{t("Primeira vez? Siga nesta ordem")}</h2>
        <ol className="path-steps">
          {PATH.map((step) => (
            <li key={step.slug}>
              <Link to={`/guides/${step.slug}`}><b>{step.title()}</b><span>{step.hint()}</span></Link>
            </li>
          ))}
        </ol>
      </Panel>
      {groups(list).map(([name, items]) => (
        <section className="guide-group" key={name}>
          <h2>{name}</h2>
          <CardGrid className="guide-cards">
            {items.map((guide) => (
              <LinkCard className="guide-card" to={`/guides/${guide.slug}`} key={guide.slug}>
                <h3>{guide.title}</h3>
                <p>{guide.summary}</p>
                <Meta guide={guide} />
              </LinkCard>
            ))}
          </CardGrid>
        </section>
      ))}
    </Page>
  );
}

export function GuidePage() {
  const { slug } = useParams();
  const { lang } = usePrefs();
  const list = guides(lang);
  const index = list.findIndex((g) => g.slug === slug);
  const guide = list[index];
  if (!guide) return <NotFound />;
  const prev = list[index - 1];
  const next = list[index + 1];
  return (
    <Page title={guide.title} header={false} className="guide-view">
      <nav className="breadcrumb" aria-label={t("Você está em")}>
        <Link to="/guides">{t("Guias")}</Link> <span aria-hidden="true">/</span> <span>{guide.title}</span>
      </nav>
      <div className="guide-layout">
        <aside className="guide-side" aria-label={t("Todos os guias")}>
          {groups(list).map(([name, items]) => (
            <div className="side-group" key={name}>
              <p className="side-title">{name}</p>
              <ul>
                {items.map((g) => <li key={g.slug}><NavLink to={`/guides/${g.slug}`}>{g.title}</NavLink></li>)}
              </ul>
            </div>
          ))}
        </aside>
        <div className="guide-main">
          <Panel className="guide">
            <h1>{guide.title}</h1>
            <Meta guide={guide} />
            <GuideBody html={guide.html} />
          </Panel>
          <nav className="guide-pager" aria-label={t("Guia anterior e próximo")}>
            {prev ? <Link className="pager prev" to={`/guides/${prev.slug}`}><small>{t("anterior")}</small><span>{prev.title}</span></Link> : <span />}
            {next ? <Link className="pager next" to={`/guides/${next.slug}`}><small>{t("próximo")}</small><span>{next.title}</span></Link> : <span />}
          </nav>
        </div>
      </div>
    </Page>
  );
}
