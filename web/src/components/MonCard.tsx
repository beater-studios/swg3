// Gen 3 Pokémon card: the result of pk3Inspect or pk3Build.

import { useMemo, useState, type ReactNode } from "react";
import { N_, t } from "../i18n";
import { Actions, Button, Flag, Gender, IssueLegend, IssueList, Item, KV, MonIcon, MoveLabel, Note, type Issue, RibbonList, type RibbonEntry, Panel, Table, Tabs, Tag, Term, TypeBadge } from "../ui";
import { DISPLAY, NATURE_STATS, STAT_LABELS, download, hex, hexToBytes, num, pretty, toDisplay } from "./format";

import type { Pk3Description } from "../lib/services/pokemon";
import * as speciesData from "../lib/gen3/species";
import { Pk3, STATS, type StatValues } from "../lib/gen3/pk3";
import { pidIvMethod } from "../lib/gen3/pidiv";
import { SummaryScreen } from "./SummaryScreen";
import { formKey } from "../lib/gen3/forms";
import { build } from "../lib/gen3/builder";
import * as ribbons from "../lib/gen3/ribbons";

export type MonInfo = Pk3Description;

function named(value: { id: number; name: string }, format: (name: string) => string = (n) => n): string {
  return value.name && value.name !== "?" ? format(value.name) : `#${value.id}`;
}

// The game stores the uppercase species name when there is no nickname.
function nicknameText(nickname: string, speciesName: string): string {
  if (!nickname) return t("(vazio)");
  return nickname.toUpperCase() === speciesName.toUpperCase() ? t("{name} (nome da espécie)", { name: nickname }) : nickname;
}

// Pokérus: strain in the high 4 bits, days in the low 4.
// FR/LG never lowers the days: UpdatePartyPokerusTime (src/pokemon.c) is never called.
function pokerusText(value: number): string {
  if (!value) return t("não");
  return value & 0xf ? t("ativo") : t("curado");
}

function ribbonEntries(hexValue: string): RibbonEntry[] {
  const { contest, flags } = ribbons.decode(parseInt(hexValue, 16) || 0);
  return [
    ...ribbons.CONTEST.filter((k) => contest[k]).map((k) => {
      const rank = Math.min(contest[k], ribbons.CONTEST_MAX);
      return { ribbon: k, rank, name: `${ribbons.NAMES[k]} ${ribbons.RANKS[rank]}` };
    }),
    ...flags.map((k) => ({ ribbon: k, name: ribbons.NAMES[k] })),
  ];
}

const FIELD_LABELS: Record<string, string> = {
  species: N_("Espécie"), level: N_("Nível"), experience: N_("Experiência"), ability: "Ability", moves: "Moves",
  evs: "EVs", stats: "Stats", held_item: N_("Item"), ball: N_("Bola"), met_level: N_("Nível de encontro"),
  met_location: N_("Local de encontro"), language: N_("Idioma"), nickname: N_("Apelido"), ot_name: N_("Nome do OT"),
  fateful: N_("Marca de evento"), pokerus: "Pokérus", ribbons: "Ribbons", checksum: "Checksum", flags: "Flags",
};
const fieldLabel = (field?: string) => (field ? t(FIELD_LABELS[field] ?? field) : field);

// PID and IV method check (pidiv.ts, as PKHeX), GBA catches only.
// Roaming dogs excluded (half-stored IVs, not verified).
const ROAMERS = [243, 244, 245];
function pidIvIssue(info: MonInfo): Issue | null {
  if (info.is_egg || info.met_level === 0 || info.met_location.id >= 0xfe || !(info.met_game.id >= 1 && info.met_game.id <= 5)) return null;
  if (ROAMERS.includes(info.species.id) || !/^[0-9A-F]{8}$/.test(info.pid)) return null;
  const ivs = Object.fromEntries(STATS.map((k, i) => [k, info.ivs[i]])) as StatValues;
  const method = pidIvMethod(parseInt(info.pid, 16), ivs);
  return method
    ? { level: "note", field: "PID", message: t("bate com os IVs no método {n} do jogo, como num Pokémon gerado de verdade.", { n: method }) }
    : { level: "warning", field: "PID", message: t("não bate com os IVs em nenhum método do jogo (1, 2 ou 4). No jogo, PID e IVs saem juntos do mesmo sorteio, então um Pokémon capturado ou recebido assim não existe, e verificadores como o do PKHeX apontam. Para um que o jogo gera, use \"PID do jogo\" no editor.") };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mon-section"><h3>{title}</h3>{children}</section>;
}

// Box format (80 bytes) to party format (100 bytes), stats as the game computes them (gen3/builder.ts, CreateMon).
function partyBytes(plain: string): Uint8Array<ArrayBuffer> | null {
  try {
    const box = new Pk3(hexToBytes(plain));
    return box.isParty ? null : new Uint8Array(build({ party: true }, box)[0].data);
  } catch {
    return null;
  }
}

export function Downloads({ base, files }: { base: string; files: { game: string; plain: string } }) {
  const party = partyBytes(files.plain);
  return (
    <Actions>
      <Button size="sm" onClick={() => download(`${base}.pk3`, hexToBytes(files.plain), "application/octet-stream")}>{t("Baixar texto plano (.pk3)")}</Button>
      <Button size="sm" onClick={() => download(`${base}.ek3`, hexToBytes(files.game), "application/octet-stream")}>{t("Baixar formato do jogo (.ek3)")}</Button>
      {party && <Button size="sm" onClick={() => download(`${base}-party.pk3`, party, "application/octet-stream")}>{t("Baixar no formato de party (.pk3, 100 bytes)")}</Button>}
    </Actions>
  );
}

function abilityText(speciesId: number, name: string | undefined, num: number): string {
  const nth = num === 1 ? t("2ª") : t("1ª");
  if (!name) return nth;
  const two = Boolean(speciesData.info(speciesId)?.abilities?.[1]);
  return two ? `${pretty(name)} (${nth})` : pretty(name);
}

/** `extra`: form warnings and what the builder chose on its own (level "choice"). */
export function MonCard({ label, info, natures, actions, extra = [] }: {
  label: string; info: MonInfo; natures: readonly string[]; actions?: ReactNode; extra?: readonly Issue[];
}) {
  // Searches up to 65,536 states: once per Pokémon, not on every render.
  const pidIssue = useMemo(() => pidIvIssue(info), [info]);
  const speciesName = info.species.known ? pretty(info.species.name) : t("espécie {id}", { id: info.species.id });
  const errors = info.issues.filter((i) => i.level === "error").length;
  const natureIndex = natures.indexOf(info.nature);
  const upStat = NATURE_STATS[Math.floor(natureIndex / 5)];
  const downStat = NATURE_STATS[natureIndex % 5];
  const neutral = upStat === downStat;
  const base = info.species.base ? toDisplay(info.species.base) : null;
  const ivs = toDisplay(info.ivs);
  const evs = toDisplay(info.evs);
  const calc = info.stats ? toDisplay(info.stats) : null;
  const party = info.party_data ? toDisplay(info.party_data.stats) : null;
  const baseName = label.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "pokemon";
  const [asGame, setAsGame] = useState(false);
  const canShowGame = info.species.known && !info.is_egg && !info.is_bad_egg;

  return (
    <Panel as="article" className="mon-card">
      <div className="mon-head">
        <h2>{info.nickname || speciesName}</h2>
        <span className="sub">{[speciesName, info.level ? t("nível {n}", { n: info.level }) : null, info.party ? "party" : "box"].filter(Boolean).join(" · ")}</span>
        <div className="mon-badges">
          {(info.species.types ?? []).map((type) => <TypeBadge key={type} type={type} />)}
          {info.shiny && <Tag tone="shiny">shiny</Tag>}
          {info.is_egg && <Tag tone="warn">{t("ovo")}</Tag>}
          {info.is_bad_egg && <Tag tone="bad">Bad Egg</Tag>}
          <Tag tone={errors ? "bad" : "ok"}>{errors ? t("{n} erro(s)", { n: errors }) : t("válido")}</Tag>
        </div>
      </div>
      {actions}
      {canShowGame && (
        <Tabs variant="pills" label={t("Vista do Pokémon")} value={asGame ? "game" : "card"} onChange={(v) => setAsGame(v === "game")}
          tabs={[{ id: "card", label: t("Cartão") }, { id: "game", label: <><MonIcon species={info.species.id} form={formKey(info.species.id, { pid: parseInt(info.pid, 16), game: info.met_game.id })} />{t("Como no jogo")}</> }]} />
      )}
      {asGame && canShowGame ? <SummaryScreen info={info} /> : (
      <div className="mon-grid">
        <Section title={t("Identidade")}>
          <KV rows={[
            // National Pokédex number; species outside the Pokédex (glitch, like 0x0351) show the internal number.
            [t("Espécie"), info.species.national ? `#${String(info.species.national).padStart(3, "0")} ${speciesName}` : t("{name} (número interno {id})", { name: speciesName, id: info.species.id })],
            [t("Apelido"), nicknameText(info.nickname, info.species.name)],
            ["PID", <span className="mono">{info.pid}</span>],
            [t("Nature"), info.nature],
            ["Ability", abilityText(info.species.id, info.ability, info.ability_num)],
            info.gender ? [t("Gênero"), <Gender value={info.gender} />] : null,
            [t("Treinador"), <>{info.ot_name || t("(vazio)")} <Gender value={info.ot_gender === "F" ? "F" : "M"} trainer /></>],
            ["TID / SID", `${info.tid} / ${info.sid}`],
            [t("Idioma"), info.language.name && info.language.name !== "?"
              ? <Flag language={info.language.id}>{info.language.name}</Flag> : `#${info.language.id}`],
          ]} />
        </Section>
        <Section title={t("Stats")}>
          <Table variant="stat">
              <thead><tr><th></th><th>{t("base")}</th><th>IV</th><th>EV</th><th>{t("calc.")}</th>{party && <th>party</th>}</tr></thead>
              <tbody>
                {STAT_LABELS.map((label, d) => {
                  const g = DISPLAY[d];
                  const mark = neutral ? undefined : g === upStat ? "up" : g === downStat ? "down" : undefined;
                  return (
                    <tr key={label}>
                      <td className={mark}>{label}{mark === "up" ? " +" : mark === "down" ? " -" : ""}</td>
                      <td>{base ? base[d] : "?"}</td><td>{ivs[d]}</td><td>{evs[d]}</td><td>{calc ? calc[d] : "?"}</td>
                      {party && <td className={calc && party[d] !== calc[d] ? "down" : undefined}>{party[d]}</td>}
                    </tr>
                  );
                })}
              </tbody>
          </Table>
          <KV rows={[
            [<Term k="hiddenpower">Hidden Power</Term>, <><TypeBadge type={info.hidden_power.type} /> {t("poder {n}", { n: info.hidden_power.power })}</>],
            [t("EVs no total"), String(info.evs.reduce((a, b) => a + b, 0))],
            info.party_data ? [t("HP atual"), t("{hp} de {max}", { hp: info.party_data.current_hp, max: info.party_data.stats[0] })] : null,
          ]} />
        </Section>
        <Section title={t("Moves")}>
          <Table variant="stat">
            <thead><tr><th>{t("move")}</th><th>PP</th><th><Term k="ppup">PP Up</Term></th></tr></thead>
            <tbody>{info.moves.map((m, i) => (
              <tr key={i}><td>{m.id ? <MoveLabel category={speciesData.moveCategory(m.id)} type={speciesData.moveTypeName(m.id)}>{named(m, pretty)}</MoveLabel> : "-"}</td><td>{m.id ? m.pp : ""}</td><td>{m.id ? (info.pp_bonuses >> (2 * i)) & 3 : ""}</td></tr>
            ))}</tbody>
          </Table>
        </Section>
        <Section title={t("Origem e outros")}>
          <KV rows={[
            [t("Item"), info.held_item.id ? <Item id={info.held_item.id}>{named(info.held_item, pretty)}</Item> : t("nenhum")],
            [t("Bola"), <Item id={info.ball.id}>{named(info.ball, pretty)}</Item>],
            [t("Jogo de origem"), named(info.met_game)],
            [t("Nível de encontro"), info.met_level === 0 ? t("0 (ovo chocado)") : String(info.met_level)],
            [t("Local de encontro"), named(info.met_location, (n) => pretty(n.replaceAll("_", " ")))],
            [t("Experiência"), num(info.experience)],
            [t("Amizade"), String(info.friendship)],
            [<Term k="pokerus">Pokérus</Term>, pokerusText(info.pokerus)],
            [<Term k="fateful">{t("Evento")}</Term>, info.fateful ? t("sim") : t("não")],
            [<Term k="ribbons">{t("Ribbons")}</Term>, (ribbonEntries(info.ribbons).length ? <RibbonList ribbons={ribbonEntries(info.ribbons)} /> : t("nenhuma"))],
          ]} />
        </Section>

        <Section title={t("Arquivo")}>
          <KV rows={[
            [t("Origem"), label],
            [t("Formato"), info.format === "encrypted" ? t("do jogo (cifrado)") : t("texto plano")],
            [t("Tamanho"), `${info.size} bytes (${info.party ? "party" : "box"})`],
            ["Checksum", t("{stored} gravado, {computed} calculado", { stored: hex(info.checksum.stored), computed: hex(info.checksum.computed) })],
          ]} />
          {info.files ? <Downloads base={baseName} files={info.files} /> : <Note>{t("Conversão indisponível: o checksum não bate.")}</Note>}
        </Section>
      </div>
      )}
      <section className="mon-section mon-validation">
        <h3>{t("Validação")}</h3>
        {(() => {
          const order = ["error", "warning", "note", "choice"];
          const all = [...info.issues, ...(pidIssue ? [pidIssue] : []), ...extra].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
          const problems = all.some((i) => i.level === "error" || i.level === "warning");
          const shown = all.map((i) => ({ ...i, field: fieldLabel(i.field) }));
          return (
            <>
              {!problems && <p>{t("Nenhum problema encontrado.")}</p>}
              {all.length > 0 && <IssueList issues={shown} />}
              <IssueLegend levels={all.map((i) => i.level)} />
            </>
          );
        })()}
      </section>
    </Panel>
  );
}
