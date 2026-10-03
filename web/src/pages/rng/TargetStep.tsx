// Step 2: find the target (static, wild, egg generation, egg pickup), searched in the worker.

import { useMemo, useRef, useState, type ReactNode } from "react";
import { getLang, t } from "../../i18n";
import { Actions, Button, Check, Combobox, type ComboOption, Details, EmptyState, Field, Fields, Group, Hint, Item, Key, Note, Notice, NumberInput, OptionCard, OptionChip, Panel, PanelForm, SearchProgress, Segmented, TableWrap, TabPanel, Tabs, TypeBadge } from "../../ui";
import { RODS, type Rod } from "./rods";
import { tx } from "../../i18n/rich";
import { compare, download, num, optionalInt, parseHex, pretty, prettyMap, STAT_LABELS, toDisplay, toGame } from "../../components/format";
import * as rng from "../../lib/services/rng";
import { Comlink, newJob, worker } from "../../lib/api";
import type { SearchName } from "../../lib/worker";
import { minAdvanceFor, type Target } from "../../lib/rngflow";
import { emptyFilters, Filters, filterParams, type FilterState } from "./Filters";
import { ResultTable, toCsv, type ResultRow, type SearchKind } from "./ResultTable";
import { useRng } from "./store";
import * as learned from "./learned";
import { fileName } from "../../brand";
import { speciesChoices } from "../../components/speciesChoices";
import * as encounters from "../../lib/gen3/encounters";
import { TownMapPicker } from "../../components/TownMapPicker";
import * as mapSections from "../../lib/gen3/encounters";
import * as speciesData from "../../lib/gen3/species";
import { StepNeeds } from "./StepNeeds";
import { AbilityField, GenderField, validForSpecies } from "./SpeciesFields";

type Meta = rng.Meta;

function SpeciesPicker({ meta, value, onChange, first }: {
  meta: Meta; value: string; onChange: (value: string) => void;
  first?: { group: string; options: ComboOption[] };
}) {
  const choices = useMemo(() => {
    const all = speciesChoices(meta.species);
    if (!first?.options.length) return all;
    const listed = new Set(first.options.map((o) => o.value));
    return [...first.options.map((o) => ({ ...o, group: first.group })),
      ...all.filter((o) => !listed.has(o.value)).map((o) => ({ ...o, group: t("Outras espécies") }))];
  }, [meta, first]);
  return <Combobox value={value} onChange={onChange} options={choices} empty={t("nenhuma")} placeholder={t("nome ou número")} />;
}

const fixedWhere = (e: encounters.FixedEncounter) =>
  e.section === null ? t("rotas de Kanto") : prettyMap(speciesData.mapSection(e.section));

function gameParams() {
  const { game, chosen } = useRng.getState();
  if (!chosen) throw new Error(t("Escolha uma seed na etapa 1."));
  return {
    seed: parseHex(chosen.seed, 8, "seed"),
    // Other values the console may give at the same instant (learned.ts).
    alt_seeds: learned.likelySeeds(chosen),
    tid: optionalInt(game.tid, "TID", 0, 65535),
    sid: optionalInt(game.sid, "SID", 0, 65535),
    version: game.version,
  };
}

function SearchRunner({ kind, name, build, action, hint, children, speciesId = null }: {
  kind: SearchKind;
  name: SearchName;
  build: () => rng.Params;
  action?: (row: ResultRow) => ReactNode;
  hint: string;
  children: ReactNode;
  /** So the Ability column knows whether the species has one or two. */
  speciesId?: number | null;
}) {
  // Default range: the minimum time to reach CONTINUE up to 5,000 (about one minute of waiting there).
  const overworld = useRng((s) => s.timer.overworld);
  const [first, setFirst] = useState(() => String(minAdvanceFor(overworld)));
  const [last, setLast] = useState("5000");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [likelyFirst, setLikelyFirst] = useState(false);
  const [status, setStatus] = useState<{ done: number; total: number; count: number; stopped?: boolean; finished?: boolean } | null>(null);
  const [error, setError] = useState("");
  const job = useRef(0);

  const run = async () => {
    setError("");
    let params: rng.Params;
    try {
      const a = optionalInt(first, t("Do avanço de frame"), 0, 2 ** 32 - 1) ?? 0;
      const b = optionalInt(last, t("Até o avanço de frame"), 0, 2 ** 32 - 1) ?? a;
      if (b < a) throw new Error(t("O avanço de frame final é menor que o inicial"));
      params = { ...build(), first: a, last: b };
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const id = newJob();
    job.current = id;
    setRunning(true);
    setRows([]);
    setStatus({ done: 0, total: (params.last as number) - (params.first as number) + 1, count: 0 });
    try {
      const result = await worker().search(id, name, params, getLang(), Comlink.proxy((p) => {
        setRows((current) => current.concat(p.results as ResultRow[]));
        setStatus({ done: p.done, total: p.total, count: p.count });
      }));
      setStatus((s) => s && { ...s, count: result.count, stopped: result.stopped, finished: true });
    } catch (e) {
      setError((e as Error).message);
      setStatus(null);
    } finally {
      setRunning(false);
    }
  };

  const stop = () => worker().cancel(job.current);
  const shown = likelyFirst ? [...rows].sort((a, b) => (b.tolerance ?? 0) - (a.tolerance ?? 0) || a.advance - b.advance) : rows;

  return (
    <>
      <PanelForm variant="plain" className="search-form" onSubmit={() => void run()}>
        <Hint>{hint}</Hint>
        {children}
        <Fields>
          <Field label={t("Do avanço de frame")}><NumberInput min={0} required value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <Field label={t("Até o avanço de frame")}><NumberInput min={0} required value={last} onChange={(e) => setLast(e.target.value)} /></Field>
          <Actions>
            <Button variant="primary" type="submit" disabled={running}>{t("Buscar")}</Button>
            {running && <Button onClick={stop}>{t("Parar")}</Button>}
          </Actions>
        </Fields>
        <Group title={t("O que é avanço de frame?")} collapsible>
          <Note items={[
            tx("É quantas vezes o gerador sorteou desde o PRESS START (no ten-lines e no PokeFinder, advance). Cada avanço de frame é um instante diferente para agir, e cada instante dá um Pokémon diferente."),
            tx("A busca percorre a faixa e lista os avanços de frame em que sai um Pokémon que passa nos filtros. Em Mirar, o timer calcula quando apertar cada botão para chegar nele."),
            tx("Avanço de frame maior é mais espera, quase toda parada no menu CONTINUE, onde o jogo avança 1 vez por frame (uns 60 por segundo): 3.000 dão menos de 1 minuto; 20.000, uns 5 minutos."),
            tx("Abaixo de 2 × os frames no mapa + 450 não dá tempo de chegar ao menu CONTINUE: a coluna Espera no CONTINUE avisa com \"curta demais\"."),
          ]} />
        </Group>
      </PanelForm>
      {error && <Notice tone="error">{error}</Notice>}
      {status && !error && (
        <div className="results">
          <div className="results-bar">
            <span className="count" aria-live="polite">
              {running && !status.done ? t("Buscando...") : t("{found} resultado(s) em {done} avanço(s) de frame", { found: num(status.count), done: num(status.done) })}
              {status.stopped ? t(" (parado)") : ""}
              {status.count > rows.length ? t(", mostrando os {n} primeiros", { n: num(rows.length) }) : ""}
            </span>
            {rows.some((r) => r.tolerance_of) && (
              <Check label={t("Mais prováveis primeiro")} checked={likelyFirst} onChange={(e) => setLikelyFirst(e.target.checked)} />
            )}
            {status.finished && rows.length > 0 && (
              <Button size="sm" onClick={() => download(fileName(`${kind}.csv`), toCsv(kind, shown, overworld, speciesId), "text/csv")}>{t("Baixar CSV")}</Button>
            )}
          </div>
          <SearchProgress value={status.done / Math.max(1, status.total)} label={t("Busca")} running={running && !status.finished} />
          {status.finished && !status.count ? <EmptyState>{t("Nenhum avanço de frame passou nos filtros. Aumente o intervalo ou afrouxe os filtros.")}</EmptyState> : rows.length > 0 && (
            <TableWrap><ResultTable kind={kind} rows={shown} action={action} overworld={overworld} speciesId={speciesId} /></TableWrap>
          )}
        </div>
      )}
    </>
  );
}

// Methods 1, 2 and 4 (lib/gen3/rng.ts): VBlank can steal an RNG call in the middle of Pokémon generation.
function MethodField({ value, onChange, prefix }: { value: string; onChange: (v: string) => void; prefix: "H" | "M" }) {
  return (
    <Field label={t("Método")}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="1">{t("{name}1 (normal)", { name: prefix })}</option>
        <option value="2">{t("{name}2 (sorteio extra antes dos IVs)", { name: prefix })}</option>
        <option value="4">{t("{name}4 (sorteio extra entre os IVs)", { name: prefix })}</option>
      </select>
    </Field>
  );
}

function MethodHint({ prefix }: { prefix: "H" | "M" }) {
  return <Hint>{t("Método: quase sempre o Pokémon sai no {name}1. De vez em quando a tela do jogo gasta um sorteio no meio da criação e os IVs saem como no {name}2 ou no {name}4. Deixe no {name}1; se não bater mesmo com o timer certo, tente os outros.", { name: prefix })}</Hint>;
}

function AimButton({ target }: { target: Target }) {
  const aim = useRng((s) => s.aim);
  return <Button size="sm" onClick={() => aim(target)}>{t("Mirar")}</Button>;
}

// Starters: givemon runs after the message following the yes (PalletTown_ProfessorOaksLab_EventScript_ChoseStarter).
const STARTERS = [1, 4, 7];

function StaticSearch({ meta }: { meta: Meta }) {
  const [species, setSpecies] = useState("");
  const version = useRng((s) => s.game.version);
  const game = version === "leafgreen" ? 5 : 4;
  const fixed = useMemo(() => encounters.fixedEncounters(game), [game]);
  const first = useMemo(() => {
    const bySpecies = new Map<number, encounters.FixedEncounter[]>();
    for (const e of fixed) bySpecies.set(e.species, [...(bySpecies.get(e.species) ?? []), e]);
    const options = speciesChoices(meta.species).filter((o) => bySpecies.has(Number(o.value))).map((o) => ({
      ...o, label: `${o.label} (${bySpecies.get(Number(o.value))!.map((e) => t("{where}, nível {level}", { where: fixedWhere(e), level: e.level })).join("; ")})`,
    }));
    return { group: t("Fixos, presentes e eventos do {game}", { game: version === "leafgreen" ? "LeafGreen" : "FireRed" }), options };
  }, [fixed, meta, version]);
  const here = fixed.filter((e) => String(e.species) === species);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [method, setMethod] = useState("1");
  const name = species ? pretty(meta.species.find((s) => String(s.id) === species)?.name ?? "") : "Pokémon";
  const build = () => {
    const g = gameParams();
    const params: rng.Params = { seed: g.seed, alt_seeds: g.alt_seeds, tid: g.tid, sid: g.sid, ...filterParams(filters) };
    if (species) params.species = Number(species);
    if (method !== "1") params.method = Number(method);
    validForSpecies(params, species);
    return params;
  };
  return (
    <SearchRunner kind="static" name="search_static" build={build} speciesId={species ? Number(species) : null}
      hint={t("Iniciais, presentes e lendários parados no mapa. O jogo sorteia o PID e depois os IVs.")}
      action={(r) => <AimButton target={{ kind: "static", advance: r.advance, species: species ? Number(species) : null, wild: null,
        label: `${name}, ${r.nature}, IVs ${toDisplay(r.ivs ?? []).join("/")}` }} />}>
      <Fields>
        <Field label={t("Espécie (opcional, para gênero e Ability)")}>
          <SpeciesPicker meta={meta} value={species} onChange={setSpecies} first={first} />
        </Field>
        <MethodField value={method} onChange={setMethod} prefix="M" />
      </Fields>
      <MethodHint prefix="M" />
      {here.length > 0 && <Note>{t("Onde: {places}.", { places: here.map((e) => t("{where}, nível {level}", { where: fixedWhere(e), level: e.level })).join("; ") })}</Note>}
      {STARTERS.includes(Number(species)) && (
        <Notice tone="tip" title={tx("Inicial: qual {a} conta", { a: <Key>A</Key> })}>
          {tx("Depois do sim, o Oak diz \"This POKéMON is really quite energetic!\". O Pokémon é criado quando você fecha essa mensagem com {a}, e é esse {a} que vai no último bipe do timer. Comece a busca por volta do avanço 2000, para dar tempo das falas.", { a: <Key>A</Key> })}
        </Notice>
      )}
      <Filters value={filters} onChange={setFilters} natures={meta.natures} hpTypes={meta.hp_types} speciesId={species} />
    </SearchRunner>
  );
}

const AREA_ORDER = ["land", "water", "rock_smash", "fishing"];
const areaName = (a: string) => ({ land: t("Grama ou caverna"), water: t("Surf"), rock_smash: t("Rock Smash"), fishing: t("Pesca") })[a] ?? a;
const areaLabel = (a: string): ReactNode => ({
  water: <Item id={341}>{t("Surf")}</Item>, fishing: <Item id={262}>{t("Pesca")}</Item>, rock_smash: <Item id={344}>{t("Rock Smash")}</Item>,
})[a] ?? areaName(a);

interface SpeciesGroup {
  id: number;
  name: string;
  chance: number;
  /** A single level or a range (fishing), with the summed slot chance. */
  levels: { min: number; max: number; chance: number }[];
  letters: { letter: string; chance: number }[];
}

function speciesGroups(slots: ReturnType<typeof rng.area>["slots"]): SpeciesGroup[] {
  const groups = new Map<number, SpeciesGroup>();
  for (const slot of slots) {
    const g = groups.get(slot.species_id) ?? { id: slot.species_id, name: slot.species, chance: 0, levels: [], letters: [] };
    g.chance += slot.chance;
    const level = g.levels.find((l) => l.min === slot.min_level && l.max === slot.max_level);
    if (level) level.chance += slot.chance;
    else g.levels.push({ min: slot.min_level, max: slot.max_level, chance: slot.chance });
    if (slot.letter) {
      const letter = g.letters.find((l) => l.letter === slot.letter);
      if (letter) letter.chance += slot.chance;
      else g.letters.push({ letter: slot.letter, chance: slot.chance });
    }
    groups.set(slot.species_id, g);
  }
  for (const g of groups.values()) {
    g.levels.sort((a, b) => a.min - b.min || a.max - b.max);
    g.letters.sort((a, b) => b.chance - a.chance || a.letter.localeCompare(b.letter));
  }
  return [...groups.values()].sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name));
}

const percent = (n: number) => `${Math.round(n * 10) / 10}%`;

function activeFilters(f: FilterState, method: string): number {
  return [f.min.some(Boolean) || f.max.some(Boolean), f.natures.length > 0, !!f.ability, !!f.gender, !!f.hpType, f.shiny, method !== "1"].filter(Boolean).length;
}

function WildSearch({ meta }: { meta: Meta }) {
  const version = useRng((s) => s.game.version);
  const maps = useMemo(() => Object.keys(meta.maps[version]).sort((a, b) => compare(prettyMap(a), prettyMap(b))), [meta, version]);
  const [map, setMap] = useState("ROUTE1");
  const currentMap = maps.includes(map) ? map : maps[0];
  const mapChoices = useMemo(() => maps.map((m) => ({ value: m, label: prettyMap(m) })), [maps]);
  const areas = [...meta.maps[version][currentMap]].sort((a, b) => AREA_ORDER.indexOf(a) - AREA_ORDER.indexOf(b));
  const [areaChoice, setArea] = useState("land");
  const areaKey = areas.includes(areaChoice) ? areaChoice : areas[0];
  const [rod, setRod] = useState("old");
  const table = useMemo(() => rng.area({ version, map: currentMap, area: areaKey, rod }), [version, currentMap, areaKey, rod]);
  const groups = useMemo(() => speciesGroups(table.slots), [table]);
  const [species, setSpecies] = useState("");
  const [level, setLevel] = useState("");
  const [letter, setLetter] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [method, setMethod] = useState("1");
  const chosen = groups.find((g) => String(g.id) === species) ?? null;
  const pick = (id: string) => {
    setSpecies(species === id ? "" : id);
    setLevel("");
    setLetter("");
  };
  const pickRefine = (id: number, change: () => void) => {
    if (species !== String(id)) {
      setSpecies(String(id));
      setLevel("");
      setLetter("");
    }
    change();
  };
  const active = activeFilters(filters, method);

  const build = () => {
    const g = gameParams();
    const params: rng.Params = { seed: g.seed, alt_seeds: g.alt_seeds, tid: g.tid, sid: g.sid, ...filterParams(filters), version, map: currentMap, area: areaKey };
    if (areaKey === "fishing") params.rod = rod;
    if (chosen) params.species = chosen.id;
    const lv = chosen ? optionalInt(level, t("Nível"), 1, 100) : null;
    if (lv !== null) params.level = lv;
    if (chosen && letter && chosen.letters.length) params.letter = letter;
    if (method !== "1") params.method = Number(method);
    return params;
  };
  return (
    <SearchRunner kind="wild" name="search_wild" build={build}
      hint={t("Escolha o mapa, a área e, se quiser, o Pokémon. O avanço de frame que conta é o do início da batalha.")}
      action={(r) => <AimButton target={{ kind: "wild", advance: r.advance, species: r.species_id ?? null,
        wild: { version, map: currentMap, area: areaKey, rod: areaKey === "fishing" ? rod : undefined },
        label: t("{species} nível {level}, {nature}", { species: pretty(r.species ?? ""), level: r.level ?? 0, nature: r.nature ?? "" }) }} />}>
      <Fields>
        <Field label={t("Mapa")} width="wide">
          <Combobox value={currentMap} onChange={setMap} options={mapChoices} placeholder={t("nome do mapa")} />
        </Field>
        <TownMapPicker value={mapSections.sectionOfMap(currentMap)} onPick={setMap}
          choices={(section) => mapSections.mapsInSection(section, maps).map((m) => ({ value: m, label: prettyMap(m) }))} />
      </Fields>
      <Fields>
        <Segmented label={t("Área")} name="wild-area" value={areaKey} onChange={setArea} wrap
          options={areas.map((a) => ({ value: a, label: areaLabel(a), icon: a === "land" ? "leaf" : undefined }))} />
        {areaKey === "fishing" && (
          <Segmented label={t("Vara")} name="target-rod" value={rod as Rod} options={RODS} onChange={setRod} wrap />
        )}
      </Fields>
      <div className="wild-pick">
        <div className="wild-pick-head">
          <h2>{t("Qual Pokémon?")}</h2>
          <span className="muted">{chosen ? t("Só {name}", { name: pretty(chosen.name) }) : t("Qualquer um da área")}</span>
        </div>
        <div className="option-cards">
          <OptionCard selected={!chosen} onSelect={() => pick("")} title={t("Qualquer")} aside="100%"
            meta={<span className="muted">{t("Todos os Pokémon da área")}</span>} />
          {groups.map((g) => {
            const types = [...new Set(speciesData.info(g.id).types)].map(speciesData.typeName);
            const isChosen = chosen?.id === g.id;
            const ranged = g.levels.some((l) => l.min !== l.max);
            return (
              <OptionCard key={g.id} selected={isChosen} onSelect={() => pick(String(g.id))} title={pretty(g.name)} aside={percent(g.chance)}
                meta={types.map((type) => <TypeBadge key={type} type={type} />)}>
                {g.levels.map((l) => l.min === l.max ? (
                  <OptionChip key={`${l.min}`} selected={isChosen && level === String(l.min)} label={t("Nível {n}, {chance}", { n: l.min, chance: percent(l.chance) })}
                    onClick={() => pickRefine(g.id, () => setLevel(isChosen && level === String(l.min) ? "" : String(l.min)))}>
                    {t("Nv. {n}", { n: l.min })} <small>{percent(l.chance)}</small>
                  </OptionChip>
                ) : (
                  <OptionChip key={`${l.min}-${l.max}`}>{t("Nv. {min} a {max}", { min: l.min, max: l.max })} <small>{percent(l.chance)}</small></OptionChip>
                ))}
                {g.letters.map((l) => (
                  <OptionChip key={l.letter} selected={isChosen && letter === l.letter} label={t("Letra {letter}, {chance}", { letter: l.letter, chance: percent(l.chance) })}
                    onClick={() => pickRefine(g.id, () => setLetter(isChosen && letter === l.letter ? "" : l.letter))}>
                    {l.letter} <small>{percent(l.chance)}</small>
                  </OptionChip>
                ))}
                {isChosen && ranged && (
                  <Field label={t("Nível")}><NumberInput min={1} max={100} placeholder={t("qualquer")} value={level} onChange={(e) => setLevel(e.target.value)} /></Field>
                )}
              </OptionCard>
            );
          })}
        </div>
      </div>
      <Details className="wild-filters" summary={<>{t("Filtros e método")} <span className="muted">{active ? t("{n} ligado(s)", { n: active }) : t("nenhum")}</span></>}>
        <Fields>
          <MethodField value={method} onChange={setMethod} prefix="H" />
        </Fields>
        <MethodHint prefix="H" />
        <Filters value={filters} onChange={setFilters} natures={meta.natures} hpTypes={meta.hp_types} speciesId={chosen ? String(chosen.id) : null} />
      </Details>
    </SearchRunner>
  );
}

function HeldSearch({ meta, onUse }: { meta: Meta; onUse: (low: string, species: string) => void }) {
  const [compatibility, setCompatibility] = useState("50");
  const [species, setSpecies] = useState("");
  const [gender, setGender] = useState("");
  const [ability, setAbility] = useState("");
  const build = () => {
    const g = gameParams();
    const params: rng.Params = { seed: g.seed, compatibility: Number(compatibility) };
    if (species) params.species = Number(species);
    if (gender) params.gender = gender;
    if (ability) params.ability = Number(ability);
    validForSpecies(params, species);
    return params;
  };
  return (
    <SearchRunner kind="held" name="search_egg_held" build={build} speciesId={species ? Number(species) : null}
      hint={t("Etapa 1 de 2 do ovo. A cada 256 passos, a Day Care decide se aparece um ovo, com a chance da compatibilidade (70%, 50% ou 20%, pelo que o senhor da Day Care diz), e já sorteia a 1ª parte do PID, que define gênero e Ability. Escolha um resultado e clique em Usar na coleta para ir à etapa 2.")}
      action={(r) => <Button size="sm" onClick={() => onUse(r.low ?? "", species)}>{t("Usar na coleta")}</Button>}>
      <Fields>
        <Field label={t("Compatibilidade (o que o senhor da Day Care diz)")} width="wide">
          <select value={compatibility} onChange={(e) => setCompatibility(e.target.value)}>
            <option value="70">"The two seem to get along very well." (70%)</option>
            <option value="50">"The two seem to get along." (50%)</option>
            <option value="20">"The two don't seem to like each other much." (20%)</option>
          </select>
        </Field>
        <Field label={t("Espécie do ovo (opcional)")}><SpeciesPicker meta={meta} value={species} onChange={setSpecies} /></Field>
        <GenderField speciesId={species} value={gender} onChange={setGender} />
        <AbilityField speciesId={species} value={ability} onChange={setAbility} />
      </Fields>
    </SearchRunner>
  );
}

function PickupSearch({ meta, low, setLow, species, setSpecies }: {
  meta: Meta; low: string; setLow: (v: string) => void; species: string; setSpecies: (v: string) => void;
}) {
  const [useParents, setUseParents] = useState(false);
  const [method, setMethod] = useState("all");
  const [parents, setParents] = useState<string[][]>([Array(6).fill(""), Array(6).fill("")]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const build = () => {
    const g = gameParams();
    const params: rng.Params = { seed: g.seed, alt_seeds: g.alt_seeds, tid: g.tid, sid: g.sid, ...filterParams(filters, { gender: false }), low: parseHex(low, 4, t("1ª parte do PID")), method };
    if (species) params.species = Number(species);
    validForSpecies(params, species);
    if (useParents) {
      parents.forEach((values, p) => {
        const parsed = values.map((v, d) => optionalInt(v, t("Slot {n}, {stat}", { n: p + 1, stat: STAT_LABELS[d] }), 0, 31));
        if (parsed.some((v) => v === null)) throw new Error(t("Preencha os 6 IVs do pai no slot {n}", { n: p + 1 }));
        params[`parent${p}`] = toGame(parsed as number[]);
      });
    }
    return params;
  };
  const setParent = (p: number, d: number, v: string) => setParents(parents.map((row, i) => (i === p ? row.map((x, j) => (j === d ? v : x)) : row)));
  return (
    <SearchRunner kind="pickup" name="search_egg_pickup" build={build} speciesId={species ? Number(species) : null}
      hint={t("Etapa 2 de 2 do ovo. Quando você pega o ovo, o jogo sorteia a 2ª parte do PID, os IVs e quais 3 IVs vêm dos pais. A 1ª parte vem da etapa 1 (Ovo 1: aparecer): o botão Usar na coleta preenche o campo abaixo.")}
      action={(r) => <AimButton target={{ kind: "pickup", advance: r.advance, species: species ? Number(species) : null, wild: null,
        label: t("ovo, {nature}, IVs {ivs}", { nature: r.nature ?? "", ivs: toDisplay(r.ivs ?? []).join("/") }) }} />}>
      <Fields>
        <Field label={t("1ª parte do PID (da etapa 1, hex)")}><input className="mono" maxLength={4} placeholder={t("ex.: 1A2B")} required value={low} onChange={(e) => setLow(e.target.value)} /></Field>
        <Field label={t("Espécie do ovo (opcional)")}><SpeciesPicker meta={meta} value={species} onChange={setSpecies} /></Field>
        <Field label={t("Método da coleta")}>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="all">{t("todos (compara os quatro)")}</option>
            <option value="bred">Bred</option><option value="split">Split</option><option value="alternate">Alternate</option><option value="mixed">Mixed</option>
          </select>
        </Field>
      </Fields>
      <Hint>{t("Método da coleta: o jogo cria o ovo tirando vários números do gerador, um atrás do outro (nature e shiny, IVs, herança). A cada quadro da tela ele também tira um número por conta própria; se isso cai no meio da criação, os números seguintes do ovo andam um lugar e o ovo sai diferente. O ponto em que cai varia: são os quatro métodos (Bred, Split, Alternate e Mixed, os do PokeFinder; não verificado no Switch). Com \"todos\", a busca compara os quatro e mostra o método de cada ovo.")}</Hint>
      <fieldset className={`parents ${useParents ? "on" : ""}`}>
        <legend><Check label={t("Aplicar os IVs dos pais")} checked={useParents} onChange={(e) => setUseParents(e.target.checked)} /></legend>
        <div className="parents-grid">
          <span />{STAT_LABELS.map((l) => <span key={l} className="ph">{l}</span>)}
          {parents.map((row, p) => [
            <span key={`s${p}`}>{t("Slot {n}", { n: p + 1 })}</span>,
            ...row.map((v, d) => (
              <NumberInput key={`${p}-${d}`} min={0} max={31} disabled={!useParents} value={v}
                aria-label={t("Slot {n}, {stat}", { n: p + 1, stat: STAT_LABELS[d] })} onChange={(e) => setParent(p, d, e.target.value)} />
            )),
          ])}
        </div>
      </fieldset>
      <Filters value={filters} onChange={setFilters} natures={meta.natures} hpTypes={meta.hp_types} showGender={false} speciesId={species} />
    </SearchRunner>
  );
}

type Kind = "static" | "wild" | "held" | "pickup";

export function TargetStep({ meta }: { meta: Meta }) {
  const [kind, setKind] = useState<Kind>("static");
  const [low, setLow] = useState("");
  const [pickupSpecies, setPickupSpecies] = useState("");
  const tabs = [
    { id: "static" as const, label: t("Fixo") },
    { id: "wild" as const, label: t("Selvagem") },
    { id: "held" as const, label: <><span className="n">1</span> {t("Ovo: aparecer")}</> },
    { id: "pickup" as const, label: <><span className="n">2</span> {t("Ovo: pegar")}</> },
  ];
  return (
    <Panel className="searches" tour="rng-target">
      <StepNeeds needs={["seed"]} />
      <Tabs tabs={tabs} value={kind} onChange={setKind} label={t("Tipo de encontro")} variant="pills" />
      <TabPanel active={kind === "static"}><StaticSearch meta={meta} /></TabPanel>
      <TabPanel active={kind === "wild"}><WildSearch meta={meta} /></TabPanel>
      <TabPanel active={kind === "held"}>
        <HeldSearch meta={meta} onUse={(l, s) => { setLow(l); setPickupSpecies(s); setKind("pickup"); }} />
      </TabPanel>
      <TabPanel active={kind === "pickup"}>
        <PickupSearch meta={meta} low={low} setLow={setLow} species={pickupSpecies} setSpecies={setPickupSpecies} />
      </TabPanel>
    </Panel>
  );
}
