// Timer settings shared by the Timer and Check seed tabs. `check`: only what applies to the check.

import { useState } from "react";
import { t } from "../../i18n";
import { tx } from "../../i18n/rich";
import { Actions, Button, Check, Field, Fields, Group, Key, Note, NumberInput } from "../../ui";
import { DEFAULT_TIMER, type TimerSettings as Settings } from "../../lib/rngflow";
import { useRng } from "./store";

export function TimerSettings({ check = false }: { check?: boolean }) {
  const { timer: settings, setTimer } = useRng();
  const [confirming, setConfirming] = useState<"cal" | "all" | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<keyof Settings, string>>>({});
  const [done, setDone] = useState("");
  const adjusted = settings.cal1 !== 0 || settings.cal2 !== 0 || settings.cal3 !== 0;
  const isDefault = (Object.keys(DEFAULT_TIMER) as (keyof Settings)[]).every((k) => settings[k] === DEFAULT_TIMER[k]);
  const reset = (which: "cal" | "all") => {
    setTimer(which === "cal" ? { cal1: 0, cal2: 0, cal3: 0 } : { ...DEFAULT_TIMER });
    setDrafts({});
    setConfirming(null);
    setDone(which === "cal" ? t("Ajustes das etapas zerados.") : t("Configurações de volta ao padrão."));
  };
  // Text stays as typed while focused and only reaches the store when it is a number.
  const field = (key: keyof Settings, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}>
      <NumberInput {...props} value={drafts[key] ?? String(settings[key])}
        onChange={(e) => {
          const text = e.target.value;
          setDrafts((d) => ({ ...d, [key]: text }));
          if (text !== "" && text !== "-") setTimer({ [key]: Number(text) });
        }}
        onBlur={() => setDrafts((d) => { const next = { ...d }; delete next[key]; return next; })} />
    </Field>
  );
  const notes = check
    ? [t("São as mesmas configurações da aba Timer: mudar aqui muda lá também."), t("Use som com fio: fones Bluetooth atrasam o bipe.")]
    : [
      tx("No mapa, o jogo avança 2 vezes por frame (não verificado) (1 segundo tem uns 60 frames). Se você vai direto do CONTINUE para o Pokémon, deixe um valor pequeno, mas que dê tempo de andar até ele."),
      tx("Depois do CONTINUE, o jogo mostra a reprise \"Previously on your quest\". {b} encerra a reprise ({a} pula uma cena): faça sempre igual, de preferência {b} logo que ela aparece, porque o tempo dela entra na conta.", { a: <Key>A</Key>, b: <Key>B</Key> }),
      t("Use som com fio: fones Bluetooth atrasam o bipe."),
      t("Os ajustes são preenchidos sozinhos na etapa Ajustar."),
      t("São as mesmas configurações da aba Conferir seed: mudar aqui muda lá também."),
    ];
  return (
    <Group title={t("Configurar o timer")} collapsible>
      <Fields>
        {!check && field("overworld", t("Frames no mapa antes de interagir"), { min: 0 })}
        {field("beeps", t("Bipes por etapa"), { min: 1, max: 10 })}
        {field("interval", t("Intervalo dos bipes (ms)"), { min: 100, max: 2000 })}
        <Check label={t("Som")} checked={settings.sound} onChange={(e) => setTimer({ sound: e.target.checked })} />
        <Check label={t("Piscar a tela")} checked={settings.flash} onChange={(e) => setTimer({ flash: e.target.checked })} />
        {field("cal1", t("Ajuste da etapa 1 (ms)"))}
        {!check && field("cal2", t("Ajuste da etapa 2 (ms)"))}
        {!check && field("cal3", t("Ajuste da etapa 3 (ms)"))}
      </Fields>
      <Note items={notes} />
      {confirming ? (
        <Actions>
          <Button size="sm" variant="primary" onClick={() => reset(confirming)}>{confirming === "cal" ? t("Sim, zerar os ajustes") : t("Sim, restaurar o padrão")}</Button>
          <Button size="sm" onClick={() => setConfirming(null)}>{t("Cancelar")}</Button>
        </Actions>
      ) : (
        <Actions>
          <Button size="sm" disabled={!adjusted} onClick={() => { setDone(""); setConfirming("cal"); }}>{t("Zerar ajustes das etapas")}</Button>
          <Button size="sm" disabled={isDefault} onClick={() => { setDone(""); setConfirming("all"); }}>{t("Restaurar o padrão")}</Button>
          {done && <Note inline>{done}</Note>}
        </Actions>
      )}
      <Note items={[
        adjusted
          ? t("Zerar ajustes das etapas: apaga só os ajustes em ms (etapas 1, 2 e 3), que valem para o seu jeito de começar o timer. Use quando mudar esse jeito, e confira a seed de novo.")
          : t("Zerar ajustes das etapas: nada para zerar, os ajustes estão em 0."),
        isDefault
          ? t("Restaurar o padrão: já está tudo no padrão.")
          : t("Restaurar o padrão: volta tudo deste bloco ao padrão do site (bipes, intervalo, som, piscar, frames no mapa e ajustes)."),
        t("Nenhum dos dois mexe no deslocamento das seeds aprendido nas conferências: esse fica na lista de seeds (etapa 1)."),
      ]} />
    </Group>
  );
}
