import { useEffect, useRef } from "react";
import { t } from "../../i18n";
import { Stack, TabPanel, Tabs } from "../../ui";
import { TourStart } from "../../components/TourStart";
import { usePokemon, type PokemonTab } from "./store";
import { ReadTab } from "./ReadTab";
import { EditTab } from "./EditTab";
import { SendTab } from "./SendTab";

// Browser only; title and intro live in the shell (pages/tools.tsx).
export function EditorTool() {
  const { tab, setTab } = usePokemon();
  // Buttons that switch tabs sit at the end of a long tab: scroll back so the new tab opens from the top.
  const tabsRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if ((tabsRef.current?.getBoundingClientRect().top ?? 0) < 0) window.scrollTo(0, 0);
  }, [tab]);
  const tabs: { id: PokemonTab; label: string }[] = [
    { id: "read", label: t("Abrir") },
    { id: "edit", label: t("Criar ou editar") },
    { id: "send", label: t("Colocar no jogo") },
  ];
  return (
    <>
      <TourStart ids={["editor-create"]} />
      <Stack>
        <div ref={tabsRef}><Tabs tabs={tabs} value={tab} onChange={setTab} label={"Editor"} tour="editor-tabs" /></div>
        {/* Tabs stay mounted so typed input is not lost. */}
        <TabPanel active={tab === "read"}><ReadTab /></TabPanel>
        <TabPanel active={tab === "edit"}><EditTab /></TabPanel>
        <TabPanel active={tab === "send"}><SendTab /></TabPanel>
      </Stack>
    </>
  );
}
