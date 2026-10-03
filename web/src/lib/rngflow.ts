// RNG flow math (seed, target, timer, adjustment). ten-lines' model for the Switch: from the seed to CONTINUE, 1 advance
// per frame; on the map, 2 per frame. GBA frames: 16777216 / 280896 per second.

import { t } from "../i18n";
import type { Phase } from "./timer";

export const GBA_FPS = 16777216 / 280896;
export const framesToMs = (frames: number) => Math.round((frames * 1000) / GBA_FPS);

export type TargetKind = "static" | "wild" | "pickup";

export interface ChosenSeed {
  index: number;
  seed: string;      // hex
  ms: number;
  game: string;
  setting: string;   // sound/mode/button, e.g. "mono/help/a"
  console: string;
}

export interface Target {
  kind: TargetKind;
  advance: number;
  label: string;
  species: number | null;
  wild: { version: string; map: string; area: string; rod?: string } | null;
}

export interface TimerSettings {
  overworld: number;
  beeps: number;
  interval: number;
  sound: boolean;
  flash: boolean;
  cal1: number;
  cal2: number;
  cal3: number;
}

export const DEFAULT_TIMER: TimerSettings = { overworld: 600, beeps: 5, interval: 500, sound: true, flash: true, cal1: 0, cal2: 0, cal3: 0 };

const BUTTON: Record<string, string> = { a: "A", start: "START", l: "L" };

export class FlowError extends Error {}

export function buildPhases(chosen: ChosenSeed | null, target: Target | null, settings: TimerSettings): Phase[] {
  if (!chosen) throw new FlowError(t("Escolha uma seed na etapa 1."));
  if (!target) throw new FlowError(t("Escolha o alvo na etapa 2: clique em \"Mirar\" num resultado."));
  const button = BUTTON[chosen.setting.split("/")[2]] ?? "A";
  const overworld = Math.max(0, Math.round(settings.overworld));
  const continueFrames = target.advance - 2 * overworld;
  if (continueFrames < 0) {
    throw new FlowError(t("O alvo (avanço de frame {frame}) chega antes de dar tempo no mapa. Diminua os frames no mapa ou escolha um alvo mais adiante.", { frame: target.advance }));
  }
  const final = target.kind === "pickup" ? t("Pegue o ovo com o senhor da Day Care")
    : target.kind === "wild" ? t("Comece o encontro (Sweet Scent ou passo na grama)") : t("Fale com o Pokémon (A)");
  const phases: Phase[] = [{ label: t("Aperte {button} no PRESS START", { button }), ms: chosen.ms + settings.cal1 }];
  if (overworld > 0) {
    phases.push({ label: t("Aperte A em CONTINUE"), ms: framesToMs(continueFrames) + settings.cal2 });
    phases.push({ label: final, ms: framesToMs(overworld) + settings.cal3 });
  } else {
    phases.push({ label: final, ms: framesToMs(continueFrames) + settings.cal2 });
  }
  return phases;
}

// Minimum wait on CONTINUE: a few seconds pass between the title screen and the CONTINUE menu, so below about
// 450 frames (7.5 s) there is no time to get there and press (tip from ten-lines users, not verified here).
export const MIN_CONTINUE_FRAMES = 450;

/** Wait frames on CONTINUE for a frame advance, given the timer's map frames (2 advances per frame there). */
export const continueFramesFor = (advance: number, overworld: number) => advance - 2 * Math.max(0, Math.round(overworld));

export const minAdvanceFor = (overworld: number) => 2 * Math.max(0, Math.round(overworld)) + MIN_CONTINUE_FRAMES;

// Random error: up to about 2 frames on PRESS START (table rows are 16 to 18 ms apart) and 2 advances on CONTINUE. Within
// that the timer is left alone (correcting chance trades one error for another); beyond it the error tends to repeat.
export const CHANCE_MS = 40;
export const CHANCE_FRAMES = 2;
export function withinChance(dms: number, dadv: number): boolean {
  return Math.abs(dms) <= CHANCE_MS && Math.abs(dadv) <= CHANCE_FRAMES;
}

// Correction after an attempt: landing later (positive difference) means the press was late, so the phase gets
// shorter. dms: seed time difference; dadv: advance difference.
export function correction(dms: number, dadv: number) {
  return { cal1: -dms, cal2: -framesToMs(dadv) };
}
