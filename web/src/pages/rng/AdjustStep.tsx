// Step 4: find which seed and frame the player hit from the Pokémon's stats, and correct the timer.

import { useMemo, useState } from "react";
import { getLang, t } from "../../i18n";
import { Actions, Button, Check, Combobox, EmptyState, Field, Fields, Hint, Note, Notice, NumberInput, Panel, PanelForm, SearchProgress, Table } from "../../ui";
import { STAT_LABELS, num, optionalInt, toDisplay, toGame } from "../../components/format";
import * as rng from "../../lib/services/rng";
import { Comlink, worker } from "../../lib/api";
import { correction, framesToMs, withinChance } from "../../lib/rngflow";
import { natureChoices } from "../../components/natureChoices";
import { useRng } from "./store";
import * as learned from "./learned";
import { speciesChoices } from "../../components/speciesChoices";
import { tx } from "../../i18n/rich";
import { StepNeeds } from "./StepNeeds";

// Methods 1, 2 and 4 (lib/gen3/rng.ts), as in the Check seed tab.
const METHODS = [1, 2, 4];
const EV_SLACK = 20;

const signed = (n: number, unit: string) => (n === 0 ? `0 ${unit}` : `${n > 0 ? "+" : "-"}${num(Math.abs(n))} ${unit}`);

export function AdjustStep({ meta }: { meta: rng.Meta }) {
  const { chosen, target, game, timer, setTimer, setStep, choose } = useRng();
  const [species, setSpecies] = useState(String(target?.species ?? 1));
  const choices = useMemo(() => speciesChoices(meta.species), [meta]);
  const [nature, setNature] = useState(meta.natures[0]);
  const [leeway, setLeeway] = useState("10");
  const [windowSize, setWindow] = useState("300");
  const [rows, setRows] = useState<string[][]>([Array(7).fill("")]);
  const [battled, setBattled] = useState(true);
  const [result, setResult] = useState<{ ivs: string; data: rng.CalibrateResult } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [manual, setManual] = useState("");
  // Small difference (likely chance): kept for the "correct anyway" button.
  const [pending, setPending] = useState<{ dms: number; dadv: number } | null>(null);

  const apply = (dms: number, dadv: number, hit?: { index: number; dseed?: number }, force = false) => {
    let text: string;
    setPending(null);
    if (!force && dms === 0 && dadv === 0) {
      text = t("Você apertou no tempo certo nas duas etapas: o Pokémon saiu diferente pelo método (H2 ou H4) ou porque o console deu a seed alguns números fora da tabela. O timer ficou como estava: reinicie sem salvar e tente de novo.");
    } else if (!force && withinChance(dms, dadv)) {
      text = t("Diferença pequena (até 2 frames): é o acaso do aperto, que muda um pouco a cada tentativa. O timer ficou como estava: reinicie sem salvar e tente de novo. Se errar de novo para o mesmo lado, aí vale corrigir.");
      setPending({ dms, dadv });
    } else {
      const delta = correction(dms, dadv);
      setTimer({ cal1: timer.cal1 + delta.cal1, cal2: timer.cal2 + delta.cal2 });
      text = t("Timer corrigido: etapa 1 {d1}, etapa 2 {d2}. Reinicie o jogo sem salvar e tente outra vez.", { d1: signed(delta.cal1, "ms"), d2: signed(delta.cal2, "ms") });
    }
    if (chosen && hit && hit.dseed !== undefined && !force) {
      const total = learned.record(chosen.game, chosen.setting, chosen.console, { index: hit.index, dseed: hit.dseed });
      text += " " + t("Acerto guardado para esta combinação ({n} no total): a lista de seeds já usa ele.", { n: total });
      choose(learned.refreshed(chosen));
    }
    setMessage(text);
  };

  const discover = async () => {
    setError("");
    setMessage("");
    setResult(null);
    try {
      if (!chosen || !target) throw new Error(t("Escolha a seed (etapa 1) e o alvo (etapa 2) antes de ajustar."));
      if (target.kind !== "static" && target.kind !== "wild") throw new Error(t("Para ovos, use o campo \"Avanço de frame que saiu\" logo abaixo."));
      const observations = rows.filter((r) => r[0] && r.slice(1).every(Boolean))
        .map((r) => ({ level: Number(r[0]), stats: toGame(r.slice(1).map(Number)) }));
      if (!observations.length) throw new Error(t("Preencha o nível e os 6 stats de pelo menos uma linha."));
      const calc = rng.ivCalc({ species: Number(species), nature, observations, ev_slack: battled ? EV_SLACK : 0 });
      if (calc.impossible) throw new Error(t("Nenhum IV explica esses stats com essa espécie e nature. Confira os números e a nature."));
      setBusy(true);
      // The console may give a seed slightly off from the table (learned.ts).
      const estimate = learned.estimate(chosen.game, chosen.setting, chosen.console);
      const data = await worker().calibrate({
        game: chosen.game, console: chosen.console, target_index: chosen.index, target_advance: target.advance, ...estimate, methods: METHODS,
        leeway: optionalInt(leeway, t("Seeds vizinhas a testar"), 0, 50) ?? 10, window: optionalInt(windowSize, t("Avanços de frame para cada lado"), 0, 5000) ?? 300,
        nature, iv_options: calc.options, kind: target.kind, ...(target.wild ?? {}),
        ...(target.kind === "wild" ? { species: Number(species) } : {}),
      }, getLang(), Comlink.proxy((done: number, total: number) => setProgress(done / total)));
      const ivs = toDisplay(calc.options).map((o) => (o.length === 1 ? String(o[0]) : `${o[0]}-${o[o.length - 1]}`)).join("/");
      setResult({ ivs, data });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const setCell = (r: number, c: number, v: string) => setRows(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));

  return (
    <>
      <PanelForm onSubmit={() => void discover()}>
        <StepNeeds needs={["seed", "target"]} />
        <Hint>{tx("Use quando você escolheu um Pokémon na aba Alvo, seguiu o timer e saiu outro. Conte o que saiu e o site descobre em que seed e em que avanço de frame você caiu, perto dos que tinha escolhido: a diferença na seed corrige o aperto no PRESS START (etapa 1), e a do avanço de frame corrige o aperto no CONTINUE (etapa 2). Para calibrar sem alvo, use a aba Conferir seed.")}</Hint>
        <Fields>
          <Field label={t("Espécie")} width="wide">
            <Combobox value={species} onChange={setSpecies} options={choices} placeholder={t("nome ou número")} />
          </Field>
          <Field label={t("Nature")}>
            <Combobox value={nature} options={natureChoices(meta.natures)} placeholder={t("nome da nature")} onChange={(value) => setNature(value || nature)} />
          </Field>
          <Field label={t("Seeds vizinhas a testar")}><NumberInput min={0} max={50} value={leeway} onChange={(e) => setLeeway(e.target.value)} /></Field>
          <Field label={t("Avanços de frame para cada lado")}><NumberInput min={0} max={5000} value={windowSize} onChange={(e) => setWindow(e.target.value)} /></Field>
        </Fields>
        <Table className="stats-entry">
            <thead><tr><th>{t("nível")}</th>{STAT_LABELS.map((l) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((v, c) => (
                    <td key={c}><NumberInput min={1} max={c ? 999 : 100} value={v} aria-label={c ? STAT_LABELS[c - 1] : t("Nível")}
                      onChange={(e) => setCell(r, c, e.target.value)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
        </Table>
        {rows.length > 1 && (
          <Check label={t("Subiu de nível batalhando (conta com alguns EVs ganhos depois da captura)")} checked={battled} onChange={(e) => setBattled(e.target.checked)} />
        )}
        {progress !== null && <SearchProgress value={progress} label={t("Busca")} running={busy} />}
        <Actions>
          <Button variant="primary" type="submit" disabled={busy}>{t("Descobrir")}</Button>
          <Button size="sm" onClick={() => setRows([...rows, Array(7).fill("")])}>{t("Mais um nível")}</Button>
        </Actions>
        <Note>{tx("Use os stats da tela de resumo, a primeira linha logo depois da captura. Com o Pokémon em outro nível, acrescente uma linha: o resultado fica mais preciso. Com Rare Candy os stats saem exatos; batalhando, marque a opção acima, porque cada nocaute dá EVs que mexem um pouco nos stats.")}</Note>
      </PanelForm>
      {error && <Notice tone="error">{error}</Notice>}
      {message && (
        <Notice tone="tip">
          <p>{message}</p>
          <Actions>
            <Button size="sm" onClick={() => setStep("timer")}>{t("Ir para o timer")}</Button>
            {pending && <Button size="sm" onClick={() => apply(pending.dms, pending.dadv, undefined, true)}>{t("Corrigir mesmo assim")}</Button>}
          </Actions>
        </Notice>
      )}
      {result && !message && (result.data.results.length ? (
        <Panel>
          <p>{t("IVs possíveis: {ivs}. {n} candidato(s); os mais perto do alvo primeiro.", { ivs: result.ivs, n: num(result.data.count) })}</p>
          <Table>
              <thead><tr><th>seed</th><th>{t("diferença")}</th><th>{t("avanço de frame")}</th><th>{t("diferença")}</th><th>{t("método")}</th><th>{t("valor")}</th><th>nature</th><th>IVs</th><th /></tr></thead>
              <tbody>
                {result.data.results.slice(0, 50).map((r) => (
                  <tr key={`${r.seed_index}-${r.advance}-${r.method}`} className={r.dms === 0 && r.dadv === 0 ? "row-chosen" : undefined}>
                    <td className="mono">{r.seed}</td><td>{signed(r.dms, "ms")}</td>
                    <td>{num(r.advance)}</td><td>{r.dadv > 0 ? `+${num(r.dadv)}` : num(r.dadv)}</td><td>{`${target?.kind === "wild" ? "H" : "M"}${r.method ?? 1}`}</td>
                    <td>{r.dseed ? (r.dseed > 0 ? `+${r.dseed}` : r.dseed) : "0"}</td>
                    <td>{r.nature}</td><td className="mono">{toDisplay(r.ivs).join("/")}</td>
                    <td><Button size="sm" onClick={() => apply(r.dms, r.dadv, { index: r.seed_index, dseed: r.dseed })}>{t("Foi este")}</Button></td>
                  </tr>
                ))}
              </tbody>
          </Table>
          <Note>{t("Diferença de até 2 frames é o acaso do aperto: nesses casos o site não mexe no timer, e o certo é só tentar de novo.")}</Note>
        </Panel>
      ) : <EmptyState>{t("IVs possíveis: {ivs}. Nenhuma seed ou avanço de frame perto do alvo bate. Aumente as seeds vizinhas ou os avanços de frame para cada lado. Se seguir sem bater, confira a seed na aba Conferir seed com dois Pokémon: o seu console pode dar a seed um pouco diferente da tabela, e o site aprende essa diferença.", { ivs: result.ivs })}</EmptyState>)}
      <PanelForm onSubmit={() => {
        const hit = optionalInt(manual, t("Avanço de frame"), 0, 2 ** 32 - 1);
        if (hit !== null && target) apply(0, hit - target.advance);
      }}>
        <h2>{t("Já sabe o avanço de frame em que caiu?")}</h2>
        <Hint>{tx("Atalho para quando você já sabe o avanço de frame em que caiu, sem o site descobrir pelos stats: ovos, ou um resultado de outra ferramenta (no ten-lines e no PokeFinder ele se chama advance). Corrige só a etapa 2 (CONTINUE), supondo que a seed saiu certa.")}</Hint>
        <Fields>
          <Field label={t("Avanço de frame que saiu")}><NumberInput min={0} required value={manual} onChange={(e) => setManual(e.target.value)} /></Field>
          <Actions><Button type="submit">{t("Corrigir o timer")}</Button></Actions>
        </Fields>
      </PanelForm>
      <Note>{t("Etapa 2 ajustada em {ms} ms por avanço de frame de diferença.", { ms: framesToMs(1) })} {game.console === "switch2" ? t("No Switch 2, os tempos já saem 0,75 s mais cedo que no Switch 1.") : ""}</Note>
    </>
  );
}
