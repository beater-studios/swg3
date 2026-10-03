// Step 3: timer with beeps per phase (title screen, CONTINUE, interaction).

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n";
import { Actions, Button, Note, Notice, Panel, Progress } from "../../ui";
import { withKeys } from "../../i18n/rich";
import { num, seconds } from "../../components/format";
import { buildPhases, FlowError } from "../../lib/rngflow";
import { Timer, type TimerFrame } from "../../lib/timer";
import { useRng } from "./store";
import { SameWay } from "./SameWay";

const BUTTON: Record<string, string> = { a: "A", start: "START", l: "L" };
import { TimerSettings } from "./TimerSettings";
import { StepNeeds } from "./StepNeeds";

// `active`: the tab is visible (the space bar shortcut only works there).
export function TimerStep({ active }: { active: boolean }) {
  const { chosen, target, timer: settings } = useRng();
  const [frame, setFrame] = useState<TimerFrame | null>(null);
  const [state, setState] = useState<"idle" | "running" | "done" | "stopped">("idle");
  const timerRef = useRef<Timer | null>(null);

  const plan = useMemo(() => {
    try {
      return { phases: buildPhases(chosen, target, settings), error: "" };
    } catch (e) {
      if (e instanceof FlowError) return { phases: [], error: e.message };
      throw e;
    }
  }, [chosen, target, settings]);

  useEffect(() => {
    timerRef.current = new Timer((f) => setFrame(f), (completed) => { setState(completed ? "done" : "stopped"); setFrame(null); });
    return () => timerRef.current?.stop();
  }, []);

  const toggle = async () => {
    const timer = timerRef.current!;
    if (timer.running) {
      timer.stop();
      return;
    }
    if (!plan.phases.length) return;
    setState("running");
    await timer.start(plan.phases, settings);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active || event.code !== "Space") return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
      event.preventDefault();
      void toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const keys = [BUTTON[chosen?.setting.split("/")[2] ?? "a"] ?? "A", "A"];
  const label = (text: string) => withKeys(text, keys);
  const current = frame ? plan.phases[frame.index]?.label : undefined;
  const phaseLabel = frame && current ? <>{`${frame.index + 1}. `}{label(current)}</>
    : state === "done" ? t("Pronto! Deu certo? Se não, vá em Ajustar.") : state === "stopped" ? t("Parado") : t("Pronto");

  return (
    <Panel className="timer-panel" tour="rng-timer">
      <StepNeeds needs={["seed", "target"]} />
      <SameWay />
      {!chosen || !target ? null : plan.error ? <Notice tone="warn">{plan.error}</Notice> : (
        <p className="chosen">
          Seed <b className="mono">{chosen!.seed}</b>{t(" · alvo: ")}<b>{target!.label}</b>{t(" no avanço de frame {frame}", { frame: num(target!.advance) })}
        </p>
      )}
      {frame && timerRef.current?.muted && <Notice tone="warn">{t("Sem som: o navegador não liberou o áudio nesta rodada. Siga pela tela, que pisca nos bipes, ou pare e comece de novo.")}</Notice>}
      <div className={`timer-display ${frame?.flashing ? "flash" : ""}`}>
        <div className="timer-phase">{phaseLabel}</div>
        <div className="timer-clock mono">{seconds(Math.max(0, Math.round(frame?.remaining ?? plan.phases[0]?.ms ?? 0)))}</div>
        <Progress value={frame?.fraction ?? 0} />
        <ol className="timer-phases">
          {plan.phases.map((p, i) => (
            <li key={i} className={(frame && i < frame.index) || state === "done" ? "done" : undefined}>
              <span>{label(p.label)}</span><span className="mono">{seconds(p.ms)}</span>
            </li>
          ))}
        </ol>
      </div>
      <Actions>
        <Button variant="primary" size="lg" disabled={!plan.phases.length} onClick={() => void toggle()}>
          {state === "running" ? t("Parar") : t("Começar")}
        </Button>
        <Note inline>{t("Atalho: barra de espaço")}</Note>
      </Actions>
      <TimerSettings />
    </Panel>
  );
}
