// RNG in four steps (seed, target, timer, adjust) plus the calculator, with no external program.

import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import { t } from "../../i18n";
import { tx } from "../../i18n/rich";
import { Button, Check, Details, Field, Fields, Group, Hint, Key, Note, Notice, NumberInput, PanelForm, Segmented, Stack, Steps, TabPanel, Tabs } from "../../ui";
import * as learned from "./learned";
import * as rng from "../../lib/services/rng";
import { useRng, type Step } from "./store";
import { TourStart } from "../../components/TourStart";
import { SeedStep } from "./SeedStep";
import { TargetStep } from "./TargetStep";
import { TimerStep } from "./TimerStep";
import { AdjustStep } from "./AdjustStep";
import { CalcStep } from "./CalcStep";
import { CheckStep } from "./CheckStep";

const LABELS: Record<string, string> = { mono: "MONO", stereo: "STEREO", help: "HELP", lr: "LR", "l=a": "L=A", a: "A", start: "START", l: "L" };
// L only leaves the title screen in L=A mode.
const ALL = ["mono", "stereo"].flatMap((s) => ["help", "lr", "l=a"].flatMap((m) => ["a", "start", ...(m === "l=a" ? ["l"] : [])].map((b) => [s, m, b])));

const choices = (combos: string[][], level: number, prefix: string[]) =>
  [...new Set(combos.filter((o) => prefix.every((v, i) => o[i] === v)).map((o) => o[level]))];

function fit(combos: string[][], wanted: string[]): string {
  let options = combos;
  for (let i = 0; i < 3; i++) {
    const same = options.filter((o) => o[i] === wanted[i]);
    options = same.length ? same : options.filter((o) => o[i] === options[0][i]);
  }
  return options[0].join("/");
}

function GameForm() {
  const { game, setGame } = useRng();
  const combos = useMemo(() => (game.strict ? learned.measuredSettings(game.version).map((k) => k.split("/")) : ALL),
    [game.strict, game.version]);
  const valid = combos.some((o) => o.join("/") === game.setting);
  useEffect(() => {
    if (!valid) setGame({ setting: fit(combos, game.setting.split("/")) });
  });
  const [sound, mode, button] = (valid ? game.setting : fit(combos, game.setting.split("/"))).split("/");
  const measured = learned.isMeasured(game.version, game.setting);
  const known = measured ? 0 : learned.points(game.version, game.setting, game.console).length;
  const choose = (level: number, value: string) => {
    const wanted = [sound, mode, button];
    wanted[level] = value;
    setGame({ setting: fit(combos, wanted) });
  };
  const select = (level: number, label: React.ReactNode, value: string, prefix: string[]) => {
    const options = choices(combos, level, prefix);
    return (
      <Field label={label}>
        <select value={value} disabled={options.length < 2} onChange={(e) => choose(level, e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{LABELS[o] ?? o}</option>)}
        </select>
      </Field>
    );
  };

  return (
    <PanelForm className="game-params" tour="rng-game" onSubmit={() => undefined}>
      <h2>{t("Seu jogo")}</h2>
      <Fields>
        <Segmented label={t("Versão")} name="version" value={game.version} options={[
          { value: "firered", label: "FireRed", icon: "flame", tone: "fire" },
          { value: "leafgreen", label: "LeafGreen", icon: "leaf", tone: "leaf" },
        ]} onChange={(version) => setGame({ version, setting: game.strict ? learned.closest(version, [sound, mode, button]) : game.setting })} />
        <Segmented label={t("Console")} name="console" value={game.console} onChange={(value) => setGame({ console: value })} options={[
          { value: "switch1", label: "Switch" },
          { value: "switch2", label: "Switch 2" },
        ]} />
        <Field label={t("TID (Trainer ID)")}><NumberInput min={0} max={65535} placeholder={t("0 a 65535")} value={game.tid} onChange={(e) => setGame({ tid: e.target.value })} /></Field>
        <Field label={t("SID (Secret ID)")}><NumberInput min={0} max={65535} placeholder={t("para shiny")} value={game.sid} onChange={(e) => setGame({ sid: e.target.value })} /></Field>
      </Fields>
      <Note>{t("O SID só importa para shiny, e o jogo não mostra.")} <Link to="/guides/sid">{t("Como descobrir o SID")}</Link></Note>
      <Group title={tx("Menu OPTION do jogo")} tour="rng-option">
        <Hint>{tx("SOUND, BUTTON MODE e o botão que você aperta no PRESS START mudam a tabela de seeds: apertando no mesmo tempo, cada combinação dá uma seed diferente. Por isso precisam ser iguais às do seu jogo.")}</Hint>
        <Check label={t("Só combinações medidas pela comunidade")} checked={game.strict}
          onChange={(e) => setGame({ strict: e.target.checked, ...(e.target.checked ? { setting: learned.closest(game.version, [sound, mode, button]) } : {}) })} />
        <Note>{game.strict
          ? t("Ligado, só aparecem as combinações que a comunidade já mediu, com tempos confiáveis. Desligue para escolher qualquer combinação do jogo; as que ninguém mediu usam tempos estimados.")
          : t("Desligado, dá para escolher qualquer combinação do jogo. As que ninguém mediu usam tempos estimados a partir da combinação medida mais parecida.")}</Note>
        <Fields>
          {select(0, "SOUND", sound, [])}
          {select(1, "BUTTON MODE", mode, [sound])}
          {select(2, tx("Botão que você aperta no PRESS START"), button, [sound, mode])}
        </Fields>
        {!measured && (
          <Notice tone="warn" title={t("Combinação não medida pela comunidade: tempos estimados.")}>
            {t("O site usa {ref} como referência. A seed real costuma ficar a poucas dezenas de valores da prevista, então nas primeiras tentativas a chance de errar o alvo é alta. Cada resultado que você confirmar na etapa Ajustar fica guardado neste navegador e deixa as próximas previsões mais precisas.", {
              ref: learned.reference(game.version, game.setting).split("/").map((p) => LABELS[p] ?? p).join(" + "),
            })} {t("Acertos guardados nesta combinação: {n}.", { n: known })}
          </Notice>
        )}
      </Group>
      {game.console === "switch2" && (
        <Note>{t("No Switch 2, cada seed sai 0,75 s mais cedo do que no Switch 1 (medição do ten-lines, ainda não confirmada aqui). Os tempos da lista já descontam isso.")}</Note>
      )}
    </PanelForm>
  );
}

function HowItWorks({ onStep }: { onStep: (step: Step) => void }) {
  const go = (step: Step, label: string) => <Button size="sm" onClick={() => onStep(step)}>{label}</Button>;
  return (
    <Details summary={t("Como funciona: do jogo fechado ao Pokémon que você quer")}>
      <Steps>
        <li>{tx("Uma vez só, calibre: na aba Conferir seed, um bipe no PRESS START e dois Pokémon selvagens mostram quanto o seu aperto cai antes ou depois. O site corrige o timer.")} {go("check", t("Conferir seed"))}</li>
        <li>{t("Escolha uma seed da lista (etapa 1).")} {go("seed", t("Ir para a etapa 1"))}</li>
        <li>{t("Ache o Pokémon que você quer e clique em Mirar (etapa 2).")} {go("target", t("Ir para a etapa 2"))}</li>
        <li>{tx("Salve na frente do alvo e feche o jogo. Rode o timer (etapa 3): {a} no PRESS START, {a} no CONTINUE e, no último bipe, fale com o Pokémon ou comece o encontro.", { a: <Key>A</Key> })} {go("timer", t("Ir para a etapa 3"))}</li>
        <li>{t("Saiu outro? Conte o que saiu na etapa 4: o site acha onde você caiu e corrige o timer se precisar. Reinicie sem salvar e repita a etapa 3.")} {go("adjust", t("Ir para a etapa 4"))}</li>
        <li>{t("Saiu o que você queria: salve. As correções ficam guardadas para os próximos alvos.")}</li>
      </Steps>
    </Details>
  );
}

// Browser only; title and intro live in the shell (pages/tools.tsx).
export function RngTool() {
  const { step, setStep } = useRng();
  const meta = useMemo(() => rng.meta(), []);
  const tabs: { id: Step; label: React.ReactNode; tour?: string }[] = [
    { id: "seed", label: <><span className="n">1</span> Seed</> },
    { id: "target", label: <><span className="n">2</span> {t("Alvo")}</> },
    { id: "timer", label: <><span className="n">3</span> Timer</> },
    { id: "adjust", label: <><span className="n">4</span> {t("Ajustar")}</>, tour: "rng-adjust-tab" },
    { id: "check", label: t("Conferir seed"), tour: "rng-check-tab" },
    { id: "calc", label: t("Calculadora (avançado)") },
  ];
  return (
    <>
      <TourStart ids={["rng-first-seed", "rng-calibrate"]} />
      <HowItWorks onStep={setStep} />
      <GameForm />
      <Stack>
        <Tabs tabs={tabs} value={step} onChange={setStep} label={t("Etapas")} className="steps-tabs" tour="rng-steps" />
        {/* Steps stay mounted so input survives tab switches. */}
        <TabPanel active={step === "seed"}><SeedStep /></TabPanel>
        <TabPanel active={step === "target"}><TargetStep meta={meta} /></TabPanel>
        <TabPanel active={step === "timer"}><TimerStep active={step === "timer"} /></TabPanel>
        <TabPanel active={step === "adjust"}><AdjustStep meta={meta} /></TabPanel>
        <TabPanel active={step === "check"}><CheckStep meta={meta} active={step === "check"} /></TabPanel>
        <TabPanel active={step === "calc"}><CalcStep /></TabPanel>
      </Stack>
    </>
  );
}
