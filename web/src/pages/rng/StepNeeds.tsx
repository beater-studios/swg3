// What is missing before an RNG step (chosen seed, target).

import { t } from "../../i18n";
import { Button, Prereq } from "../../ui";
import { useRng } from "./store";

export function StepNeeds({ needs }: { needs: ("seed" | "target")[] }) {
  const { chosen, target, setStep } = useRng();
  const items = [];
  if (needs.includes("seed") && !chosen) {
    items.push({ text: t("Escolher uma seed na etapa 1 (Seed)."), action: <Button size="sm" onClick={() => setStep("seed")}>{t("Ir para a etapa 1")}</Button> });
  }
  if (needs.includes("target") && !target) {
    items.push({ text: t("Escolher o alvo na etapa 2 (Alvo): clique em Mirar num resultado."), action: <Button size="sm" onClick={() => setStep("target")}>{t("Ir para a etapa 2")}</Button> });
  }
  return <Prereq items={items} />;
}
