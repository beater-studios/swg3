// Professor Oak tour entry point (tours/store.ts) at the top of a page.

import { getLang, t } from "../i18n";
import { tour } from "../content";
import { savedStep, useTour } from "../tours/store";
import { Actions, Button } from "../ui";
import head from "../assets/oak/head.png";

export function TourStart({ ids }: { ids: string[] }) {
  const { active, start } = useTour();
  const lang = getLang();
  const guides = ids.map((id) => tour(lang, id)).filter((g) => g !== null);
  if (!guides.length) return null;
  const single = guides.length === 1;
  const face = <img className="tour-start-head" src={head} alt="" width={32} height={32} />;
  return (
    <Actions className="tour-start">
      {!single && <span className="tour-start-label">{face}{t("Guias com o Professor Oak:")}</span>}
      {guides.map((guide) => {
        const saved = active ? null : savedStep(guide.id);
        const resume = saved !== null && saved > 0 && saved < guide.steps.length;
        const label = single ? (resume ? t("Começar o guia do início") : t("Guia com o Professor Oak")) : guide.title;
        return [
          <Button key={guide.id} onClick={() => start(guide.id)}>{single && face}{label}</Button>,
          resume && (
            <Button key={`${guide.id}-resume`} variant="primary" onClick={() => start(guide.id, saved)}>
              {single ? t("Continuar de onde parei ({n} de {total})", { n: saved + 1, total: guide.steps.length })
                : t("Continuar \"{title}\" ({n} de {total})", { title: guide.title, n: saved + 1, total: guide.steps.length })}
            </Button>
          ),
        ];
      })}
    </Actions>
  );
}
