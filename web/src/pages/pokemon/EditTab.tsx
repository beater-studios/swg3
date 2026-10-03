// Create or edit tab: builds a pk3 following the game's rules (builder) and validates it.

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n";
import { Actions, Button, Check, Combobox, Field, Flag, GenderChoice, Fields, Group, Hint, ItemIcon, Note, Notice, NumberInput, PanelForm, Segmented, Stack, TypeBadge, type Issue } from "../../ui";
import { speciesChoices } from "../../components/speciesChoices";
import { MonCard } from "../../components/MonCard";
import { STAT_LABELS, optionalInt, parseHex, pretty, toDisplay, toGame } from "../../components/format";
import * as svc from "../../lib/services/pokemon";
import * as rng from "../../lib/services/rng";
import { useRng } from "../rng/store";
import { usePokemon, type CurrentMon } from "./store";
import { GamePid } from "./GamePid";
import { TownMapPicker } from "../../components/TownMapPicker";
import { natureChoices } from "../../components/natureChoices";
import { moveOption } from "../../components/moveChoices";
import { PokerusFields, RibbonFields } from "./Extras";
import { EMERALD, FATEFUL_SPECIES } from "../../lib/gen3/validate";
import * as encounters from "../../lib/gen3/encounters";
import { mapSection } from "../../lib/gen3/species";
import { UNOWN, UNOWN_LETTERS, unownLetter } from "../../lib/gen3/wild";

interface Form {
  species: string; level: string;
  nature: string; shiny: string; gender: string; ability: string; letter: string; pid: string;
  ivs: string[]; evs: string[]; moves: string[];
  nickname: string; ot_name: string; ot_gender: string; tid: string; sid: string;
  held_item: string; ball: string; met_level: string; met_location: string; met_game: string; language: string; friendship: string;
  // fateful null: automatic, set only for Mew and Deoxys.
  pokerus: number; ribbons: number; fateful: boolean | null;
}

function blank(): Form {
  const game = useRng.getState().game;
  return {
    species: "1", level: "5", nature: "", shiny: "", gender: "", ability: "", letter: "", pid: "",
    ivs: Array(6).fill("31"), evs: Array(6).fill("0"), moves: ["0", "0", "0", "0"],
    nickname: "", ot_name: game.ot, ot_gender: "0", tid: game.tid, sid: game.sid,
    held_item: "0", ball: "4", met_level: "", met_location: "", met_game: game.version === "leafgreen" ? "5" : "4", language: "2", friendship: "",
    pokerus: 0, ribbons: 0, fateful: null,
  };
}

function fromInfo(info: svc.Pk3Description): Form {
  return {
    species: String(info.species.id), level: String(info.level ?? 5),
    nature: info.nature, shiny: info.shiny ? "1" : "0", gender: info.gender && info.gender !== "-" ? info.gender : "",
    ability: String(info.ability_num), letter: "", pid: "",
    ivs: toDisplay(info.ivs).map(String), evs: toDisplay(info.evs).map(String), moves: info.moves.map((m) => String(m.id)),
    nickname: info.nickname, ot_name: info.ot_name, ot_gender: info.ot_gender === "F" ? "1" : "0", tid: String(info.tid), sid: String(info.sid),
    held_item: String(info.held_item.id), ball: String(info.ball.id), met_level: String(info.met_level),
    met_location: String(info.met_location.id), met_game: String(info.met_game.id), language: String(info.language.id),
    friendship: String(info.friendship),
    pokerus: info.pokerus, ribbons: parseInt(info.ribbons, 16) || 0, fateful: info.fateful,
  };
}

// The game treats the Pokémon as the player's own only when TID, SID (all 32 bits) and OT name match
// (IsOtherTrainer in src/pokemon.c); otherwise traded EXP and disobedience (IsMonDisobedient in src/battle_util.c).
function idWarnings(form: Form): Issue[] {
  const out: Issue[] = [];
  if (!form.tid.trim()) {
    out.push({ level: "warning", field: "TID", message: t("não informado, gravado como 0. O jogo só trata o Pokémon como seu quando TID, SID e nome do OT batem com os seus; com outros, ele conta como de outro treinador: ganha EXP de troca e, sem as 8 insígnias, pode desobedecer.") });
  } else if (!form.sid.trim()) {
    out.push({ level: "warning", field: "SID", message: t("não informado, gravado como 0. O jogo compara TID e SID juntos: sem o seu SID, o Pokémon conta como de outro treinador (EXP de troca e, sem as 8 insígnias, pode desobedecer). O jogo não mostra o SID; o guia Como descobrir o SID explica.") });
  }
  if (out.length && form.shiny === "1") {
    out.push({ level: "note", field: "Shiny", message: t("vale mesmo assim: o shiny depende do TID e do SID gravados no Pokémon, não dos seus.") });
  }
  return out;
}

// Builder notes. Rebuilding starts from the previous result, so a pick stays valid while its value is unchanged.
interface Pick { kind: string; message: string; still: (info: svc.Pk3Description) => boolean }

function picksFrom(notes: readonly string[], made: svc.Pk3Description): Pick[] {
  const starts = (message: string, template: string) => message.startsWith(t(template).split("{")[0]);
  return notes.map((message) => {
    if (starts(message, "PID sorteado pelo site: {pid} (nature {nature}).") || starts(message, "letra do Unown pelo PID: {letter}")) {
      return { kind: starts(message, "PID sorteado pelo site: {pid} (nature {nature}).") ? "pid" : "unown", message, still: (i) => i.pid === made.pid };
    }
    if (starts(message, "Encontro escolhido pelo site: {location}, nível de encontro {level}, onde o jogo dá {who}.")
      || starts(message, "Nível de encontro escolhido pelo site: {level}, o nível em que o jogo dá {who} em {location}.")
      || starts(message, "Local de encontro escolhido pelo site: {location}, onde o jogo dá {who} no nível {level}.")) {
      return { kind: "met", message, still: (i) => i.met_location.id === made.met_location.id && i.met_level === made.met_level };
    }
    if (starts(message, "Marca de evento ligada pelo site: {name} sai do evento com ela.")) {
      return { kind: "fateful", message, still: (i) => i.fateful };
    }
    return { kind: message, message, still: () => false };
  });
}

// Origin game ids (gen3/builder.ts VERSIONS).
const FRLG = [4, 5];
const RSE = [1, 2, 3];

export function EditTab() {
  const meta = useMemo(() => rng.meta(), []);
  const lists = useMemo(() => svc.lists(), []);
  const { editing, editRevision, setEditing, setCurrent, send } = usePokemon();
  const [form, setForm] = useState<Form>(() => (editing ? fromInfo(editing.info) : blank()));
  const fixedPid = /^[0-9a-f]{1,8}$/i.test(form.pid.trim()) ? parseInt(form.pid.trim(), 16) : null;
  const speciesList = useMemo(() => speciesChoices(meta.species, { pid: fixedPid, letter: form.letter, game: Number(form.met_game) }),
    [meta, fixedPid, form.letter, form.met_game]);
  const [movesTouched, setMovesTouched] = useState(Boolean(editing));
  const [result, setResult] = useState<{ label: string; info: svc.Pk3Description; extra: Issue[] } | null>(null);
  const picks = useRef<Pick[]>([]);
  const [error, setError] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const lastRevision = useRef(editRevision);
  useEffect(() => {
    if (editRevision === lastRevision.current) return;
    lastRevision.current = editRevision;
    setForm(editing ? fromInfo(editing.info) : blank());
    setMovesTouched(Boolean(editing));
    setResult(null);
    picks.current = [];
    setError("");
  }, [editRevision, editing]);

  // When creating, TID, SID and OT name are the player's and are stored; an opened file's values are not.
  const own = !editing || Boolean(editing.own);
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (!own) return;
    const trainer = { tid: patch.tid, sid: patch.sid, ot: patch.ot_name };
    const changed = Object.fromEntries(Object.entries(trainer).filter(([, v]) => v !== undefined));
    if (Object.keys(changed).length) useRng.getState().setGame(changed);
  };
  const info = useMemo(() => {
    try {
      return svc.speciesInfo({ species: Number(form.species), level: Number(form.level) || 100 });
    } catch {
      return null;
    }
  }, [form.species, form.level]);

  useEffect(() => {
    if (!info || movesTouched || editing) return;
    setForm((f) => ({ ...f, moves: [0, 1, 2, 3].map((i) => String(info.default_moves[i] ?? 0)) }));
  }, [info, movesTouched, editing]);

  const fixedGender = info ? [0, 254, 255].includes(info.gender_ratio) : false;
  const [onlyLearnable, setOnlyLearnable] = useState(true);
  const [autoMet, setAutoMet] = useState(true);
  const moveChoices = useMemo(() => {
    const known = new Set([...(info?.learnable ?? []), ...(info?.egg_moves ?? []), ...(info?.emerald_tutor ?? []), ...(info?.xd_tutor ?? [])].map((m) => m.id));
    const chosen = new Set(form.moves.map(Number));
    return [
      ...(info?.learnable ?? []).map((m) => moveOption(m.id, m.name, t("Aprende no nível {n} (nível, TM, tutor, família)", { n: form.level || 100 }))),
      ...(info?.egg_moves ?? []).map((m) => moveOption(m.id, m.name, t("De ovo (só num Pokémon chocado, nível de encontro 0)"))),
      ...(info?.emerald_tutor ?? []).map((m) => moveOption(m.id, m.name, t("Tutor do Emerald (só se o Pokémon passou pelo Emerald)"))),
      ...(info?.xd_tutor ?? []).map((m) => moveOption(m.id, m.name, t("Tutor do XD (só se o Pokémon é do XD ou passou por ele)"))),
      ...lists.moves.filter((m) => !known.has(m.id) && (!onlyLearnable || chosen.has(m.id)))
        .map((m) => moveOption(m.id, m.name, onlyLearnable ? t("Já escolhido, fora do aprendizado") : t("Outros (validação avisa)"))),
    ];
  }, [info, lists, onlyLearnable, form.moves, form.level]);
  const itemChoices = useMemo(() => lists.items.map((i) => ({ value: String(i.id), label: pretty(i.name), icon: <ItemIcon id={i.id} /> })), [lists]);
  // A known Unown letter limits the Tanoby chambers that count (encounters.unownLetters).
  const knownLetter = Number(form.species) !== UNOWN ? null
    : fixedPid !== null ? unownLetter(fixedPid)
    : form.letter ? UNOWN_LETTERS.indexOf(form.letter)
    : editing ? unownLetter(parseInt(editing.info.pid, 16)) : null;
  const letterFits = (game: number, section: number) =>
    knownLetter === null || (encounters.unownLetters(game, section)?.includes(knownLetter) ?? true);
  const sightingSections = useMemo(() => new Set(encounters.sightings(Number(form.species), Number(form.met_game))
    .filter((s) => letterFits(Number(form.met_game), s[0])).map((s) => s[0])), [form.species, form.met_game, knownLetter]);   // eslint-disable-line react-hooks/exhaustive-deps
  const languageChoices = useMemo(() => lists.languages.map((l) => ({ value: String(l.id), label: l.name, icon: <Flag language={l.id} /> })), [lists]);
  const natures = useMemo(() => natureChoices(meta.natures), [meta]);
  const ballChoices = useMemo(() => lists.balls.map((b) => ({ value: String(b.id), label: pretty(b.name), icon: <ItemIcon id={b.id} /> })), [lists]);
  // validate.metLocations: in Emerald, sections 197 and up are its own. A foreign location from an opened file stays
  // listed with a warning so it can be changed.
  const locationChoices = useMemo(() => {
    const game = Number(form.met_game);
    const names = new Map(lists.locations.map((l) => [l.id, l.name]));
    if (game === EMERALD) lists.locations_emerald.forEach((l) => names.set(l.id, l.name));
    const allowed = lists.game_locations[String(game)] ?? lists.locations.map((l) => l.id);
    const current = form.met_location === "" ? null : Number(form.met_location);
    const ids = current === null || allowed.includes(current) ? allowed : [...allowed, current];
    const found = encounters.sightings(Number(form.species), game).filter((s) => letterFits(game, s[0]));
    const here = new Map<number, encounters.Sighting[]>();
    for (const s of found) here.set(s[0], [...(here.get(s[0]) ?? []), s]);
    const name = (id: number) => (names.get(id) ?? `#${id}`).replaceAll("_", " ");
    const groups = here.size ? { yes: t("Onde a espécie aparece (nível de encontro)"), no: t("Outros locais") } : null;
    return [
      ...[...here.keys()].filter((id) => allowed.includes(id)).map((id) => ({
        value: String(id), hint: String(id), group: groups?.yes,
        label: `${name(id)} (${encounters.levelsText(here.get(id)!)})`,
      })),
      ...ids.filter((id) => !here.has(id)).map((id) => ({
        value: String(id), hint: String(id), group: groups?.no,
        label: name(id) + (!allowed.includes(id) ? ` (${t("não existe nesse jogo")})`
          : knownLetter !== null && !letterFits(game, id) ? ` (${t("não dá a letra {letter}", { letter: UNOWN_LETTERS[knownLetter] })})` : ""),
      })),
    ];
  }, [lists, form.met_game, form.met_location, form.species, knownLetter]);   // eslint-disable-line react-hooks/exhaustive-deps
  const setGame = (value: string) => {
    const allowed = lists.game_locations[value];
    const keep = !allowed || form.met_location === "" || allowed.includes(Number(form.met_location));
    set({ met_game: value, ...(keep ? {} : { met_location: String(allowed[0]) }) });
  };
  // A location missing from the origin game switches the game to the map default. Value: "game:location".
  const mapChoices = (section: number, region: "frlg" | "rse") => {
    const current = Number(form.met_game);
    const family = region === "rse" ? RSE : FRLG;
    const game = family.includes(current) && lists.game_locations[String(current)]?.includes(section) ? current : family === RSE ? EMERALD : FRLG[0];
    return lists.game_locations[String(game)]?.includes(section)
      ? [{ value: `${game}:${section}`, label: mapSection(section, game).replaceAll("_", " ") }] : [];
  };
  const pickOnMap = (value: string) => {
    const [game, section] = value.split(":");
    set({ met_game: game, met_location: section });
  };
  const evTotal = form.evs.reduce((sum, v) => sum + (Number(v) || 0), 0);

  const reset = () => {
    setEditing(null);
    setForm(blank());
    setMovesTouched(false);
    setResult(null);
    picks.current = [];
    setError("");
  };

  const submit = () => {
    setError("");
    try {
      const num = (value: string, label: string, lo: number, hi: number) => optionalInt(value, label, lo, hi);
      const fields: Record<string, unknown> = {
        species: Number(form.species),
        level: num(form.level, t("Nível"), 1, 100),
        // Box format (80 bytes) serves codes, Base64 and the board trade; the PC builds the party form on the fly.
        party: false,
        ivs: toGame(form.ivs.map((v, d) => num(v, `IV ${STAT_LABELS[d]}`, 0, 31) ?? 0)),
        evs: toGame(form.evs.map((v, d) => num(v, `EV ${STAT_LABELS[d]}`, 0, 255) ?? 0)),
        moves: form.moves.map(Number).filter(Boolean),
        ot_name: form.ot_name,
        ot_gender: Number(form.ot_gender),
        tid: num(form.tid, "TID", 0, 65535) ?? 0,
        sid: num(form.sid, "SID", 0, 65535) ?? 0,
        held_item: Number(form.held_item), ball: Number(form.ball),
        met_game: Number(form.met_game), language: Number(form.language),
        pokerus: form.pokerus, ribbons: form.ribbons,
      };
      if (form.fateful !== null) fields.fateful = form.fateful;
      if (form.nature) fields.nature = form.nature;
      if (form.shiny) fields.shiny = form.shiny === "1";
      if (form.gender && !fixedGender) fields.gender = form.gender;
      if (form.ability !== "") fields.ability = Number(form.ability);
      if (Number(form.species) === 201 && form.letter) fields.letter = form.letter;
      if (form.nickname) fields.nickname = form.nickname;
      if (form.met_location !== "") fields.met_location = Number(form.met_location);
      if (!autoMet) fields.auto_met = false;
      const metLevel = num(form.met_level, t("Nível de encontro"), 0, 100);
      if (metLevel !== null) fields.met_level = metLevel;
      const friendship = num(form.friendship, t("Amizade"), 0, 255);
      if (friendship !== null) fields.friendship = friendship;
      if (form.pid.trim()) fields.pid = parseHex(form.pid, 8, "PID");
      if (!fields.ot_name) throw new Error(t("Informe o nome do treinador (OT)"));
      const built = svc.pk3Build({ fields, ...(editing ? { base: editing.info.files?.game } : {}) });
      const label = editing?.label ?? `${built.mon.species.name.toLowerCase()}-${built.mon.pid.toLowerCase()}`;
      const fresh = picksFrom(built.notes, built.mon);
      const kept = (editing ? picks.current : []).filter((p) => p.still(built.mon) && !fresh.some((f) => f.kind === p.kind));
      picks.current = [...kept, ...fresh];
      setResult({ label, info: built.mon, extra: [...idWarnings(form), ...picks.current.map((p) => ({ level: "choice", message: p.message }))] });
      if (built.mon.files) {
        const mon: CurrentMon = { label, info: built.mon, own };
        setEditing(mon);        // keeps the PID on further edits
        setCurrent(mon);
      }
      requestAnimationFrame(() => document.getElementById("editor-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const modeText = editing
    ? (result ? t("Editando o que você acabou de criar ({label}). Para outro, clique em \"Começar do zero\".", { label: editing.label })
      : t("Editando {label}. O que você não mexer fica como está.", { label: editing.label }))
    : t("Criando um Pokémon do zero.");

  return (
    <>
      <PanelForm className="editor" onSubmit={submit}>
        <div className="editor-head" ref={top}>
          <Hint role="status">{modeText}</Hint>
          <Button size="sm" onClick={reset}>{t("Começar do zero")}</Button>
        </div>

        <Group title={t("Espécie")} tour="editor-species">
          <Fields>
            <Field label={t("Espécie")} width="wide">
              <Combobox value={form.species} options={speciesList} placeholder={t("nome ou número")}
                onChange={(value) => { set({ species: value }); if (!editing) setMovesTouched(false); }} />
            </Field>
            <Field label={t("Nível")}><NumberInput min={1} max={100} required value={form.level} onChange={(e) => set({ level: e.target.value })} /></Field>
          </Fields>
          {info && <Note>{info.types.map((type) => <TypeBadge key={type} type={type} />)} {t("stats base {base}", { base: toDisplay(info.base).join("/") })}</Note>}
        </Group>

        <Group title={t("Nature, shiny, gênero e Ability")} tour="editor-nature">
          <Fields>
            <Field label={t("Nature")}>
              <Combobox value={form.nature} options={natures} empty={t("sortear")} placeholder={t("nome da nature")} onChange={(nature) => set({ nature })} />
            </Field>
            <Segmented label="Shiny" name="editor-shiny" value={form.shiny} onChange={(shiny) => set({ shiny })} options={[
              { value: "", label: t("tanto faz") }, { value: "1", label: t("sim"), icon: "sparkle", tone: "shiny" }, { value: "0", label: t("não") },
            ]} />
            {fixedGender && info ? (
              <GenderChoice label={t("Gênero")} value="fixed" disabled onChange={() => undefined} options={[
                info.gender_ratio === 255 ? { value: "fixed", label: t("sem gênero"), gender: "-" }
                  : info.gender_ratio === 0 ? { value: "fixed", label: t("sempre macho"), gender: "M" } : { value: "fixed", label: t("sempre fêmea"), gender: "F" },
              ]} />
            ) : (
              <GenderChoice label={t("Gênero")} value={form.gender} onChange={(gender) => set({ gender })} options={[
                { value: "", label: t("tanto faz"), gender: null }, { value: "M", label: t("macho"), gender: "M" }, { value: "F", label: t("fêmea"), gender: "F" },
              ]} />
            )}
            <Field label={"Ability"}>
              <select value={form.ability} onChange={(e) => set({ ability: e.target.value })}>
                <option value="">{t("pelo PID")}</option>
                {(info?.abilities ?? []).map((a, i, all) => <option key={a} value={i}>{all.length > 1 ? `${pretty(a)} (${i ? t("2ª") : t("1ª")})` : pretty(a)}</option>)}
              </select>
            </Field>
            {Number(form.species) === 201 && (
              <Field label={t("Letra do Unown")}>
                <select value={form.letter} onChange={(e) => set({ letter: e.target.value })}>
                  <option value="">{t("qualquer")}</option>{[...meta.unown_letters].map((l) => <option key={l}>{l}</option>)}
                </select>
              </Field>
            )}
            <Field label={t("PID fixo (hex, opcional)")}><input className="mono" maxLength={8} placeholder={t("sorteado")} value={form.pid} onChange={(e) => set({ pid: e.target.value })} /></Field>
          </Fields>
          <Note>{t("O PID é escolhido para dar a nature, o gênero, a Ability e o shiny que você pediu, e os IVs são os que você digitou. No jogo, PID e IVs saem em sequência do mesmo gerador, então só algumas combinações existem; esta provavelmente não é uma delas. Dentro do jogo não faz diferença, mas verificadores como o do PKHeX apontam \"PID e IVs não batem\". Para uma combinação que o jogo geraria, use \"PID do jogo\", depois dos IVs.")}</Note>
        </Group>

        <Group title={t("IVs e EVs")}>
          <div className="iv-head">
            <span>IVs</span>
            <Button size="sm" onClick={() => set({ ivs: Array(6).fill("31") })}>{t("todos 31")}</Button>
            <Button size="sm" onClick={() => set({ ivs: Array.from({ length: 6 }, () => String(Math.floor(Math.random() * 32))) })}>{t("aleatórios")}</Button>
          </div>
          <div className="stat-row">
            {STAT_LABELS.map((label, d) => (
              <label key={label} className="stat-input"><span>{label}</span>
                <NumberInput min={0} max={31} required value={form.ivs[d]} onChange={(e) => set({ ivs: form.ivs.map((v, i) => (i === d ? e.target.value : v)) })} />
              </label>
            ))}
          </div>
          <div className="iv-head"><span>EVs</span><output className={`ev-total ${evTotal > 510 ? "bad" : ""}`}>{t("total {n} de 510", { n: evTotal })}</output></div>
          <div className="stat-row">
            {STAT_LABELS.map((label, d) => (
              <label key={label} className="stat-input"><span>{label}</span>
                <NumberInput min={0} max={255} required value={form.evs[d]} onChange={(e) => set({ evs: form.evs.map((v, i) => (i === d ? e.target.value : v)) })} />
              </label>
            ))}
          </div>
        </Group>

        <Group title={t("PID do jogo")} collapsible>
          <GamePid speciesId={Number(form.species)} ivs={form.ivs} tid={Number(form.tid) || 0} sid={Number(form.sid) || 0}
            wanted={{ nature: form.nature, gender: form.gender, ability: form.ability, shiny: form.shiny }}
            onUse={(pid) => set({ pid, nature: "", gender: "", ability: "", shiny: "" })} current={form.pid} />
        </Group>

        <Group title={t("Moves")}>
          <Fields>
            {form.moves.map((move, i) => (
              <Field key={i} label={t("Move {n}", { n: i + 1 })}>
                <Combobox value={move === "0" ? "" : move} options={moveChoices} empty={t("nenhum")} placeholder={t("nome do move")}
                  onChange={(value) => { setMovesTouched(true); set({ moves: form.moves.map((m, j) => (j === i ? value || "0" : m)) }); }} />
              </Field>
            ))}
          </Fields>
          <Actions>
            <Button size="sm" onClick={() => info && set({ moves: [0, 1, 2, 3].map((i) => String(info.default_moves[i] ?? 0)) })}>
              {t("Moves que o jogo daria nesse nível")}
            </Button>
            <Check label={t("Só moves que a espécie aprende")} checked={onlyLearnable} onChange={(e) => setOnlyLearnable(e.target.checked)} />
          </Actions>
          <Note>{t("Moves de ovo só valem num Pokémon chocado: com um deles e o encontro em automático, o site cria o Pokémon como ovo chocado. Desligue a opção para escolher moves de evento ou de outros jogos; a validação avisa.")}</Note>
        </Group>

        <Group title={t("Treinador e apelido")} tour="editor-trainer">
          <Fields>
            <Field label={t("Apelido (vazio: nome da espécie)")}><input maxLength={10} value={form.nickname} onChange={(e) => set({ nickname: e.target.value })} /></Field>
            <Field label={t("Nome do OT")}><input maxLength={7} required value={form.ot_name} onChange={(e) => set({ ot_name: e.target.value })} /></Field>
            <GenderChoice label={t("Gênero do OT")} value={form.ot_gender} onChange={(ot_gender) => set({ ot_gender })} options={[
              { value: "0", label: t("menino"), gender: "M" }, { value: "1", label: t("menina"), gender: "F" },
            ]} />
            <Field label={t("TID (Trainer ID)")}><NumberInput min={0} max={65535} value={form.tid} onChange={(e) => set({ tid: e.target.value })} /></Field>
            <Field label={t("SID (Secret ID)")}><NumberInput min={0} max={65535} value={form.sid} onChange={(e) => set({ sid: e.target.value })} /></Field>
          </Fields>
        </Group>

        <Group title={t("Item, origem e outros")} collapsible>
          <Hint>{t("Escolha primeiro o jogo de origem: o local de encontro mostra só os locais dele, começando por onde a espécie aparece.")}</Hint>
          <Check label={t("Escolher local e nível de encontro que o jogo daria")} checked={autoMet} onChange={(e) => setAutoMet(e.target.checked)} />
          <Note>{autoMet
            ? t("Ligado, o que ficar em branco o site preenche com um encontro que o jogo daria: a captura de uma pré-evolução, um presente ou um ovo chocado (nível 0). O que você preencher fica como está.")
            : t("Desligado, vale exatamente o que você preencher: local em branco é o primeiro local do jogo, e nível em branco é o nível atual. A validação aponta o que não bater com o jogo.")}</Note>
          <Fields>
            <Field label={t("Jogo de origem")}>
              <select value={form.met_game} onChange={(e) => setGame(e.target.value)}>
                {/* FireRed and LeafGreen first: on Switch there is no way to receive Pokémon from other Gen 3 games. */}
                {lists.games.filter((g) => FRLG.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                <optgroup label={t("Outros jogos da Gen 3 (ainda não chegam ao Switch)")}>
                  {lists.games.filter((g) => !FRLG.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </optgroup>
              </select>
            </Field>
            <Field label={t("Local de encontro")} width="wide">
              <Combobox value={form.met_location} options={locationChoices} placeholder={t("nome ou número")}
                empty={autoMet ? t("automático") : t("primeiro local do jogo")} onChange={(value) => set({ met_location: value })} />
            </Field>
            <TownMapPicker games={["frlg", "rse"]} game={Number(form.met_game)} value={form.met_location === "" ? null : Number(form.met_location)} marked={sightingSections}
              title={t("Local de encontro")} onPick={pickOnMap} choices={mapChoices} />
            <Field label={autoMet ? t("Nível de encontro (vazio: automático)") : t("Nível de encontro (vazio: o nível atual)")}><NumberInput min={0} max={100} value={form.met_level} onChange={(e) => set({ met_level: e.target.value })} /></Field>
            <Field label={t("Bola")}>
              <Combobox value={form.ball} options={ballChoices} placeholder={t("nome da bola")} onChange={(value) => set({ ball: value || "4" })} />
            </Field>
            <Field label={t("Item segurado")}>
              <Combobox value={form.held_item === "0" ? "" : form.held_item} options={itemChoices} empty={t("nenhum")} placeholder={t("nome do item")}
                onChange={(value) => set({ held_item: value || "0" })} />
            </Field>
            <Field label={t("Idioma")}>
              <Combobox value={form.language} options={languageChoices} placeholder={t("idioma")} onChange={(value) => set({ language: value || "2" })} />
            </Field>
            <Field label={t("Amizade (vazio: base da espécie)")}><NumberInput min={0} max={255} value={form.friendship} onChange={(e) => set({ friendship: e.target.value })} /></Field>
          </Fields>
          {!lists.game_locations[form.met_game] && <Note>{t("O site não tem a lista de locais do Colosseum e do XD, então o local de encontro mostra todos, sem filtro.")}</Note>}
        </Group>

        <Group title={t("Pokérus e marca de evento")} collapsible>
          <PokerusFields game={Number(form.met_game)} pokerus={form.pokerus}
            fateful={form.fateful ?? FATEFUL_SPECIES.includes(Number(form.species))} onChange={set} />
        </Group>
        <Group title={t("Ribbons")} collapsible>
          <RibbonFields game={Number(form.met_game)} ribbons={form.ribbons} onChange={set} />
        </Group>

        <Actions><Button variant="primary" type="submit" data-tour="editor-create">{t("Criar e conferir")}</Button></Actions>
      </PanelForm>
      <Stack id="editor-result" tour="editor-result">
        {error && <Notice tone="error">{error}</Notice>}
        {result && (
          <MonCard label={result.label} info={result.info} natures={meta.natures} extra={result.extra} actions={result.info.files ? (
            <Actions>
              <Button size="sm" variant="primary" data-tour="editor-send" onClick={() => send({ label: result.label, info: result.info })}>{t("Colocar no jogo")}</Button>
            </Actions>
          ) : undefined} />
        )}
      </Stack>
    </>
  );
}
