// PIDs the game would generate with the entered IVs (pidiv.ts), so the Pokémon passes PID/IV checkers.

import { useState } from "react";
import { t } from "../../i18n";
import { Actions, Button, Gender, Note, Table, Tag } from "../../ui";
import { NATURES } from "../../lib/gen3/pk3";
import * as species from "../../lib/gen3/species";
import { pidsForIvs, type PidIv } from "../../lib/gen3/pidiv";
import { STAT_LABELS, hex, pretty, toGame } from "../../components/format";
import { STATS, type StatValues } from "../../lib/gen3/pk3";

export interface Wanted {
  nature: string;
  gender: string;
  ability: string;
  shiny: string;
}

export function GamePid({ speciesId, ivs, tid, sid, wanted, onUse, current }: {
  speciesId: number; ivs: string[]; tid: number; sid: number; wanted: Wanted; onUse: (pid: string) => void; current: string;
}) {
  const [found, setFound] = useState<PidIv[] | null>(null);
  const [error, setError] = useState("");
  const abilities = species.info(speciesId).abilities.filter(Boolean);
  const search = () => {
    setError("");
    const values = ivs.map(Number);
    if (values.some((v, d) => !Number.isInteger(v) || v < 0 || v > 31 || ivs[d] === "")) {
      setError(t("Preencha os 6 IVs (0 a 31): o {stat} está vazio ou fora da faixa.", { stat: STAT_LABELS[values.findIndex((v, d) => !Number.isInteger(v) || v < 0 || v > 31 || ivs[d] === "")] }));
      return;
    }
    const game = toGame(values);
    setFound(pidsForIvs(Object.fromEntries(STATS.map((k, i) => [k, game[i]])) as StatValues));
  };
  const describe = (pid: number) => {
    const nature = NATURES[pid % 25];
    const gender = species.gender(speciesId, pid);
    const ability = pid & 1 && abilities[1] ? 1 : 0;
    const shiny = ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) >>> 0) < 8;
    const matches = (!wanted.nature || wanted.nature === nature) && (!wanted.gender || wanted.gender === gender)
      && (wanted.ability === "" || Number(wanted.ability) === ability) && (wanted.shiny === "" || (wanted.shiny === "1") === shiny);
    return { nature, gender, ability, shiny, matches };
  };
  const rows = (found ?? []).map((f) => ({ ...f, ...describe(f.pid) })).sort((a, b) => Number(b.matches) - Number(a.matches));
  return (
    <>
      <Note>{t("No jogo, o PID e os IVs saem em sequência do mesmo gerador. Aqui o site acha os PIDs que o jogo geraria junto com os IVs acima (métodos M1, M2 e M4): com um deles, o Pokémon passa na conferência de PID e IVs de verificadores como o do PKHeX. Costumam ser poucos, então a nature nem sempre é a que você quer.")}</Note>
      <Actions><Button size="sm" onClick={search}>{t("Achar PIDs do jogo para estes IVs")}</Button></Actions>
      {error && <Note>{error}</Note>}
      {found && (rows.length ? (
        <Table>
          <thead><tr><th>PID</th><th>{t("método")}</th><th>Nature</th><th>{t("Gênero")}</th><th>Ability</th><th>Shiny</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.pid}-${r.method}`} className={r.matches ? "row-chosen" : undefined}>
                <td className="mono">{hex(r.pid, 8)}</td><td>M{r.method}</td><td>{r.nature}</td>
                <td><Gender value={r.gender} /></td>
                <td>{abilities.length > 1 ? `${pretty(species.abilityName(abilities[r.ability]))} (${r.ability ? t("2ª") : t("1ª")})` : pretty(species.abilityName(abilities[0]))}</td>
                <td>{r.shiny ? <Tag tone="shiny">shiny</Tag> : ""}</td>
                <td>{current.trim().toUpperCase() === hex(r.pid, 8)
                  ? <Tag>{t("em uso")}</Tag>
                  : <Button size="sm" onClick={() => onUse(hex(r.pid, 8))}>{t("Usar este PID")}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <Note>{t("Nenhum PID do jogo dá exatamente esses IVs. Mude um IV (em geral, basta um ponto) e procure de novo.")}</Note>)}
      {found && rows.length > 0 && !rows.some((r) => r.matches) && (
        <Note>{t("Nenhum bate com a nature, o gênero, a Ability ou o shiny que você pediu. Ou escolha um da lista (o PID manda nesses campos), ou mude um IV e procure de novo.")}</Note>
      )}
    </>
  );
}
