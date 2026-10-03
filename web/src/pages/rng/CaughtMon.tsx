// Form for a caught wild Pokémon (Check seed tab).

import { useMemo } from "react";
import { t } from "../../i18n";
import { Check, Combobox, Field, Fields, NumberInput, Table, Segmented } from "../../ui";
import { RODS, type Rod } from "./rods";
import { natureChoices } from "../../components/natureChoices";
import { STAT_LABELS, pretty, prettyMap, toDisplay, toGame } from "../../components/format";
import * as rng from "../../lib/services/rng";
import * as speciesData from "../../lib/gen3/species";
import * as encounters from "../../lib/gen3/encounters";
import { TownMapPicker } from "../../components/TownMapPicker";

// EVs a Pokémon gains leveling up a few times in battle (1 or 2 per knockout in each stat).
const EV_SLACK = 20;
const AREA_ORDER = ["land", "water", "rock_smash", "fishing"];

export interface MonInput {
  map: string;
  area: string;
  rod: string;
  species: string;
  nature: string;
  gender: string;
  rows: string[][];
  battled: boolean;
}

export const emptyMon = (): MonInput => ({ map: "", area: "land", rod: "old", species: "", nature: "", gender: "", rows: [Array(7).fill("")], battled: true });

/** "-" genderless, "M" or "F" when always the same, null when it varies. */
export function fixedGender(species: string): speciesData.Gender | null {
  if (!species) return null;
  const low = speciesData.gender(Number(species), 0), high = speciesData.gender(Number(species), 0xff);
  return low === high ? low : null;
}

const areaName = (a: string) => ({ land: t("Grama ou caverna"), water: t("Surf"), rock_smash: t("Rock Smash"), fishing: t("Pesca") })[a] ?? a;

function useChoices(meta: rng.Meta, version: string, value: MonInput, fallbackMap: string) {
  const maps = useMemo(() => Object.keys(meta.maps[version]).sort((a, b) => prettyMap(a).localeCompare(prettyMap(b))), [meta, version]);
  const map = maps.includes(value.map) ? value.map : maps.includes(fallbackMap) ? fallbackMap : "";
  const areas = map ? [...meta.maps[version][map]].sort((a, b) => AREA_ORDER.indexOf(a) - AREA_ORDER.indexOf(b)) : [];
  const area = areas.includes(value.area) ? value.area : areas[0] ?? "";
  const slots = useMemo(() => (map ? rng.area({ version, map, area, rod: value.rod }).slots : []), [version, map, area, value.rod]);
  const species = [...new Map(slots.map((s) => [s.species_id, s.species])).entries()];
  const currentSpecies = species.some(([id]) => String(id) === value.species) ? value.species : "";
  return { maps, map, areas, area, species, currentSpecies };
}

/** `fallbackMap`: used while this one has none (the first Pokémon's). */
export function CaughtMon({ meta, version, value, onChange, fallbackMap = "" }: {
  meta: rng.Meta; version: string; value: MonInput; onChange: (value: MonInput) => void; fallbackMap?: string;
}) {
  const { maps, map, areas, area, species, currentSpecies } = useChoices(meta, version, value, fallbackMap);
  const mapChoices = useMemo(() => maps.map((m) => ({ value: m, label: prettyMap(m) })), [maps]);
  const set = (patch: Partial<MonInput>) => onChange({ ...value, ...patch });
  const fixed = fixedGender(currentSpecies);
  const rows = value.rows;
  return (
    <>
      <Fields>
        <Field label={t("Mapa")} width="wide">
          <Combobox value={map} onChange={(value) => set({ map: value })} options={mapChoices} placeholder={t("Escolha o mapa")} />
        </Field>
        <TownMapPicker value={map ? encounters.sectionOfMap(map) : null} onPick={(value) => set({ map: value })}
          choices={(section) => encounters.mapsInSection(section, maps).map((m) => ({ value: m, label: prettyMap(m) }))} />
        <Field label={t("Área")}>
          <select value={area} disabled={!map} onChange={(e) => set({ area: e.target.value })}>{areas.map((a) => <option key={a} value={a}>{areaName(a)}</option>)}</select>
        </Field>
        {area === "fishing" && (
          <Segmented label={t("Vara")} name="caught-rod" value={value.rod as Rod} options={RODS} onChange={(rod) => set({ rod })} />
        )}
      </Fields>
      <Fields>
        <Field label={t("Espécie")}>
          <select value={currentSpecies} disabled={!map} onChange={(e) => set({ species: e.target.value })}>
            <option value="" disabled>{t("Escolha")}</option>
            {species.map(([id, name]) => <option key={id} value={id}>{pretty(name)}</option>)}
          </select>
        </Field>
        <Field label={t("Nature")}>
          <Combobox value={value.nature} options={natureChoices(meta.natures)} placeholder={t("Escolha")} onChange={(nature) => set({ nature })} />
        </Field>
        <Field label={t("Gênero")}>
          {fixed ? (
            <select value={fixed} disabled>
              <option value="-">{t("sem gênero")}</option><option value="M">{t("sempre macho")}</option><option value="F">{t("sempre fêmea")}</option>
            </select>
          ) : (
            <select value={value.gender} onChange={(e) => set({ gender: e.target.value })}>
              <option value="">{t("não anotei")}</option><option value="M">{t("macho")}</option><option value="F">{t("fêmea")}</option>
            </select>
          )}
        </Field>
      </Fields>
      <Table className="stats-entry">
        <thead><tr><th>{t("nível")}</th>{STAT_LABELS.map((l) => <th key={l}>{l}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={c}><NumberInput min={1} max={c ? 999 : 100} value={v} aria-label={c ? STAT_LABELS[c - 1] : t("Nível")}
                  onChange={(e) => set({ rows: rows.map((x, i) => (i === r ? x.map((y, j) => (j === c ? e.target.value : y)) : x)) })} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length > 1 && (
        <Check label={t("Subiu de nível batalhando (conta com alguns EVs ganhos depois da captura)")} checked={value.battled} onChange={(e) => set({ battled: e.target.checked })} />
      )}
    </>
  );
}

export const addLevel = (value: MonInput): MonInput => ({ ...value, rows: [...value.rows, Array(7).fill("")] });

/** Throws Error with a user facing message. */
export function monParams(meta: rng.Meta, version: string, value: MonInput, fallbackMap = "") {
  const maps = Object.keys(meta.maps[version]);
  const map = maps.includes(value.map) ? value.map : maps.includes(fallbackMap) ? fallbackMap : "";
  if (!map) throw new Error(t("Escolha o mapa onde você capturou o Pokémon."));
  const areas = meta.maps[version][map];
  const area = areas.includes(value.area) ? value.area : areas[0];
  const slots = rng.area({ version, map, area, rod: value.rod }).slots;
  if (!value.species || !slots.some((s) => String(s.species_id) === value.species) || !value.nature) {
    throw new Error(t("Escolha a espécie e a nature do Pokémon."));
  }
  const filled = value.rows.filter((r) => r.some(Boolean));
  if (!filled.length || filled.some((r) => !r[0] || r.slice(1).some((v) => !v))) throw new Error(t("Preencha o nível e os 6 stats."));
  const observations = filled.map((r) => ({ level: Number(r[0]), stats: toGame(r.slice(1).map(Number)) }));
  const calc = rng.ivCalc({ species: Number(value.species), nature: value.nature, observations, ev_slack: value.battled ? EV_SLACK : 0 });
  if (calc.impossible) throw new Error(t("Nenhum IV explica esses stats com essa espécie e nature. Confira os números e a nature."));
  const params: rng.Params = {
    version, map, area, ...(area === "fishing" ? { rod: value.rod } : {}), species: Number(value.species),
    level: Math.min(...observations.map((o) => o.level)), nature: value.nature, iv_options: calc.options,
    ...(value.gender && !fixedGender(value.species) ? { gender: value.gender } : {}),
  };
  const ivs = toDisplay(calc.options).map((o) => (o.length === 1 ? String(o[0]) : `${o[0]}-${o[o.length - 1]}`)).join("/");
  return { params, ivs };
}
