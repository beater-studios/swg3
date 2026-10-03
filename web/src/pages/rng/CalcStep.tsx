// Calculator: advance the state, distance between states and advances as time.

import { useState } from "react";
import { t } from "../../i18n";
import { Button, Field, Fields, Hint, Note, NumberInput, Panel, PanelForm } from "../../ui";
import { num, optionalInt, parseHex } from "../../components/format";
import * as rng from "../../lib/services/rng";
import { GBA_FPS } from "../../lib/rngflow";

function useResult() {
  const [out, setOut] = useState("");
  const run = (fn: () => string) => {
    try {
      setOut(fn());
    } catch (e) {
      setOut((e as Error).message);
    }
  };
  return [out, run] as const;
}

export function CalcStep() {
  const [seed, setSeed] = useState("0");
  const [advances, setAdvances] = useState("1000");
  const [advanceOut, runAdvance] = useResult();
  const [origin, setOrigin] = useState("0");
  const [targetState, setTarget] = useState("");
  const [distanceOut, runDistance] = useResult();
  const [timeAdvances, setTimeAdvances] = useState("1000");
  const [perFrame, setPerFrame] = useState("2");

  const frames = Number(timeAdvances) / Number(perFrame);
  const secondsTotal = frames / GBA_FPS;
  const minutes = Math.floor(secondsTotal / 60);
  const rest = (secondsTotal - minutes * 60).toFixed(3).padStart(6, "0");

  return (
    <Panel className="calc-card">
      <Hint>{t("Contas avulsas com o gerador, para quem já trabalha com ele (por exemplo, para comparar com o ten-lines ou o PokeFinder). O caminho normal (Seed, Alvo, Timer e Ajustar) não precisa delas.")}</Hint>
      <div className="calc-grid">
        <PanelForm variant="plain" onSubmit={() => {
          runAdvance(() => {
            const r = rng.rngAdvance({ seed: parseHex(seed, 8, t("Estado")), advances: optionalInt(advances, t("Avanços de frame"), -(2 ** 32), 2 ** 32) ?? 0 });
            return t("Estado {state} · Random() = {random}", r);
          });
        }}>
          <h2>{t("Avançar")}</h2>
          <Fields>
            <Field label={t("Estado (hex)")}><input className="mono" maxLength={8} required value={seed} onChange={(e) => setSeed(e.target.value)} /></Field>
            <Field label={t("Avanços de frame (negativo volta)")}><NumberInput required value={advances} onChange={(e) => setAdvances(e.target.value)} /></Field>
          </Fields>
          <Button variant="primary" type="submit">{t("Calcular")}</Button>
          <output className="calc-out mono">{advanceOut}</output>
        </PanelForm>
        <PanelForm variant="plain" onSubmit={() => {
          runDistance(() => t("{n} avanço(s) de frame", { n: num(rng.rngDistance({ origin: parseHex(origin, 8, t("Origem")), target: parseHex(targetState, 8, t("Destino")) }).advances) }));
        }}>
          <h2>{t("Distância")}</h2>
          <Fields>
            <Field label={t("Origem (hex)")}><input className="mono" maxLength={8} required value={origin} onChange={(e) => setOrigin(e.target.value)} /></Field>
            <Field label={t("Destino (hex)")}><input className="mono" maxLength={8} required value={targetState} onChange={(e) => setTarget(e.target.value)} /></Field>
          </Fields>
          <Button variant="primary" type="submit">{t("Calcular")}</Button>
          <output className="calc-out mono">{distanceOut}</output>
        </PanelForm>
        <PanelForm variant="plain" onSubmit={() => undefined}>
          <h2>{t("Avanços de frame em tempo")}</h2>
          <Fields>
            <Field label={t("Avanços de frame")}><NumberInput min={0} required value={timeAdvances} onChange={(e) => setTimeAdvances(e.target.value)} /></Field>
            <Field label={t("Avanços por frame")}>
              <select value={perFrame} onChange={(e) => setPerFrame(e.target.value)}>
                <option value="1">{t("1 por frame (menus)")}</option><option value="2">{t("2 por frame (mapa)")}</option>
              </select>
            </Field>
          </Fields>
          <output className="calc-out">{Number.isFinite(frames) && frames >= 0 ? `${num(Math.ceil(frames))} frames · ${minutes}:${rest} (${num(Math.round(secondsTotal * 1000))} ms)` : ""}</output>
          <Note>{t("O jogo roda a cerca de 59,73 frames por segundo. É uma estimativa: diferenças no seu jeito de apertar entram no ajuste do timer.")}</Note>
        </PanelForm>
      </div>
    </Panel>
  );
}
