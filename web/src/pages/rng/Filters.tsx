// Common search filters, in the search functions' format: IVs in game order, natures by name.

import { t } from "../../i18n";
import { Button, Check, Field, Fields, NumberInput } from "../../ui";
import { NATURE_LABELS, STAT_LABELS, optionalInt, pretty, toGame } from "../../components/format";
import { AbilityField, GenderField } from "./SpeciesFields";

export interface FilterState {
  min: string[];        // display order
  max: string[];
  natures: string[];
  ability: string;
  gender: string;
  hpType: string;
  hpPower: string;
  shiny: boolean;
}

export const emptyFilters = (): FilterState => ({
  min: Array(6).fill(""), max: Array(6).fill(""), natures: [], ability: "", gender: "", hpType: "", hpPower: "30", shiny: false,
});

export interface FilterParams {
  min_ivs?: number[];
  max_ivs?: number[];
  natures?: string[];
  ability?: number;
  gender?: string;
  hp_type?: string;
  hp_power?: number;
  shiny?: boolean;
}

export function filterParams(state: FilterState, { gender = true } = {}): FilterParams {
  const out: FilterParams = {};
  const read = (values: string[], fallback: number) => {
    const parsed = values.map((v, d) => optionalInt(v, `IV ${STAT_LABELS[d]}`, 0, 31));
    if (parsed.every((v) => v === null)) return undefined;
    return toGame(parsed.map((v) => v ?? fallback));
  };
  out.min_ivs = read(state.min, 0);
  out.max_ivs = read(state.max, 31);
  if (state.natures.length) out.natures = state.natures;
  if (state.ability) out.ability = Number(state.ability);
  if (gender && state.gender) out.gender = state.gender;
  if (state.hpType) out.hp_type = state.hpType;
  const power = optionalInt(state.hpPower, t("Poder mínimo"), 30, 70);
  if (power !== null && power > 30) out.hp_power = power;
  if (state.shiny) out.shiny = true;
  for (const key of Object.keys(out) as Array<keyof FilterParams>) if (out[key] === undefined) delete out[key];
  return out;
}

export function Filters({ value, onChange, natures, hpTypes, showGender = true, speciesId = null }: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  natures: readonly string[];
  hpTypes: readonly string[];
  showGender?: boolean;
  /** null when the search has no single species. */
  speciesId?: string | null;
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const setIv = (which: "min" | "max", d: number, v: string) => {
    const list = [...value[which]];
    list[d] = v;
    set({ [which]: list });
  };
  const toggleNature = (name: string) =>
    set({ natures: value.natures.includes(name) ? value.natures.filter((n) => n !== name) : [...value.natures, name] });

  return (
    <fieldset className="filters">
      <legend>{t("Filtros")}</legend>
      <div className="iv-filter">
        <div className="iv-head">
          <span>IVs</span>
          <Button size="sm" onClick={() => set({ min: Array(6).fill("31"), max: Array(6).fill("") })}>{t("todos 31")}</Button>
          <Button size="sm" onClick={() => set({ min: Array(6).fill(""), max: Array(6).fill("") })}>{t("limpar")}</Button>
        </div>
        <div className="iv-grid">
          <span /><span className="iv-col">{t("mín")}</span><span className="iv-col">{t("máx")}</span>
          {STAT_LABELS.map((label, d) => [
            <span key={`l${d}`} className="iv-label">{label}</span>,
            <NumberInput key={`n${d}`} min={0} max={31} placeholder="0" aria-label={t("{label} mínimo", { label })}
              value={value.min[d]} onChange={(e) => setIv("min", d, e.target.value)} />,
            <NumberInput key={`x${d}`} min={0} max={31} placeholder="31" aria-label={t("{label} máximo", { label })}
              value={value.max[d]} onChange={(e) => setIv("max", d, e.target.value)} />,
          ])}
        </div>
      </div>
      <div className="nature-filter">
        <div className="iv-head">
          <span>{t("Nature")}</span>
          <Button size="sm" onClick={() => set({ natures: [] })}>{t("qualquer")}</Button>
        </div>
        <div className="nature-grid">
          <span />
          {NATURE_LABELS.map((l) => <span key={l} className="nh">-{l}</span>)}
          {NATURE_LABELS.map((up, u) => [
            <span key={`r${u}`} className="nr">+{up}</span>,
            ...NATURE_LABELS.map((down, d) => {
              const name = natures[u * 5 + d];
              return (
                <button key={name} type="button" aria-pressed={value.natures.includes(name)} className={u === d ? "neutral" : undefined}
                  title={u === d ? t("{name} (neutra)", { name }) : `${name}: +${up}, -${down}`} onClick={() => toggleNature(name)}>
                  {name}
                </button>
              );
            }),
          ])}
        </div>
      </div>
      <Fields>
        <AbilityField speciesId={speciesId ?? ""} value={value.ability} onChange={(ability) => set({ ability })} anyWithout />
        {showGender && (speciesId !== null
          ? <GenderField speciesId={speciesId} value={value.gender} onChange={(gender) => set({ gender })} />
          : (
            <Field label={t("Gênero")}>
              <select value={value.gender} onChange={(e) => set({ gender: e.target.value })}>
                <option value="">{t("qualquer")}</option><option value="M">{t("macho")}</option><option value="F">{t("fêmea")}</option>
              </select>
            </Field>
          ))}
        <Field label="Hidden Power">
          <select value={value.hpType} onChange={(e) => set({ hpType: e.target.value })}>
            <option value="">{t("qualquer tipo")}</option>
            {hpTypes.map((type) => <option key={type} value={type}>{pretty(type)}</option>)}
          </select>
        </Field>
        <Field label={t("Poder mínimo")}>
          <NumberInput min={30} max={70} value={value.hpPower} onChange={(e) => set({ hpPower: e.target.value })} />
        </Field>
        <Check label={t("Só shiny (usa TID e SID)")} checked={value.shiny} onChange={(e) => set({ shiny: e.target.checked })} />
      </Fields>
    </fieldset>
  );
}
