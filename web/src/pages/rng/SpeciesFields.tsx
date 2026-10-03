// Gender and Ability fields limited to the options valid for the chosen species.

import { t } from "../../i18n";
import { Field, GenderChoice } from "../../ui";
import { pretty } from "../../components/format";
import * as species from "../../lib/gen3/species";
import { fixedGender } from "./CaughtMon";

export function GenderField({ speciesId, value, onChange }: { speciesId: string; value: string; onChange: (value: string) => void }) {
  const fixed = fixedGender(speciesId);
  if (!speciesId) return <GenderChoice label={t("Gênero")} value="" disabled onChange={onChange} options={[{ value: "", label: t("escolha a espécie"), gender: null }]} />;
  if (fixed) {
    const label = fixed === "-" ? t("sem gênero") : fixed === "M" ? t("sempre macho") : t("sempre fêmea");
    return <GenderChoice label={t("Gênero")} value={fixed} disabled onChange={onChange} options={[{ value: fixed, label, gender: fixed }]} />;
  }
  return (
    <GenderChoice label={t("Gênero")} value={value} onChange={onChange} options={[
      { value: "", label: t("qualquer"), gender: null }, { value: "M", label: t("macho"), gender: "M" }, { value: "F", label: t("fêmea"), gender: "F" },
    ]} />
  );
}

/** `anyWithout`: without a species, offers "1st" and "2nd" instead of disabling. */
export function AbilityField({ speciesId, value, onChange, anyWithout = false }: {
  speciesId: string; value: string; onChange: (value: string) => void; anyWithout?: boolean;
}) {
  const names = speciesId ? species.info(Number(speciesId)).abilities.filter(Boolean).map((a) => pretty(species.abilityName(a))) : [];
  return (
    <Field label="Ability">
      {!speciesId && !anyWithout ? (
        <select value="" disabled><option value="">{t("escolha a espécie")}</option></select>
      ) : speciesId && names.length === 1 ? (
        <select value="" disabled><option value="">{names[0]}</option></select>
      ) : (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("qualquer")}</option>
          <option value="0">{names[0] ? `${names[0]} (${t("1ª")})` : t("1ª Ability")}</option>
          <option value="1">{names[1] ? `${names[1]} (${t("2ª")})` : t("2ª Ability")}</option>
        </select>
      )}
    </Field>
  );
}

export function validForSpecies(params: Record<string, unknown>, speciesId: string): void {
  if (!speciesId || fixedGender(speciesId)) delete params.gender;
  if (speciesId && species.info(Number(speciesId)).abilities.filter(Boolean).length < 2) delete params.ability;
}
