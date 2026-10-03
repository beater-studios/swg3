// Editor Pokérus, fateful encounter flag and ribbons, following the origin game (gen3/ribbons.ts).

import { N_, t } from "../../i18n";
import { Check, Field, Fields, Note, RibbonIcon, Term } from "../../ui";
import * as ribbons from "../../lib/gen3/ribbons";

// Pokérus byte: strain in the high 4 bits, days left in the low 4. On infection days = strain % 4 + 1 (pokeemerald,
// RandomlyGivePartyPokerus); cured keeps only the strain.
const POKERUS_ACTIVE = 0x12;
const POKERUS_CURED = 0x10;

// Where each ribbon is obtained, from the PokemonSubstruct3 comments (include/pokemon.h). Translated at use.
const WHERE: Record<ribbons.FlagKey, string> = {
  champion: N_("Hall of Fame"),
  winning: N_("Battle Tower, nível 50"),
  victory: N_("Battle Tower, nível 100"),
  artist: N_("retrato no museu, concurso Master"),
  effort: N_("EVs no máximo, em Slateport"),
  marine: N_("nunca distribuída"),
  land: N_("nunca distribuída"),
  sky: N_("nunca distribuída"),
  country: N_("distribuição na Pokémon Festa"),
  national: N_("Shadow purificado"),
  earth: N_("Mt. Battle, 100 vitórias"),
  world: N_("distribuição na Pokémon Festa"),
};

export function pokerusLabel(value: number): string {
  if (!value) return t("não");
  return value & 0xf ? t("ativo") : t("curado");
}

export function PokerusFields({ game, pokerus, fateful, onChange }: {
  game: number; pokerus: number; fateful: boolean;
  onChange: (patch: { pokerus?: number; fateful?: boolean }) => void;
}) {
  // Pokérus only spreads in Ruby, Sapphire and Emerald; in FR/LG its functions are empty (src/pokemon.c).
  const pokerusGame = ribbons.RSE.includes(game);
  const options = [0, ...(pokerusGame ? [POKERUS_ACTIVE, POKERUS_CURED] : [])];
  if (!options.includes(pokerus)) options.push(pokerus);
  return (
    <>
      <Fields>
        <Field label={<Term k="pokerus">Pokérus</Term>}>
          <select value={pokerus} disabled={options.length < 2} onChange={(e) => onChange({ pokerus: Number(e.target.value) })}>
            {options.map((v) => <option key={v} value={v}>{pokerusLabel(v)}</option>)}
          </select>
        </Field>
      </Fields>
      {!pokerusGame && <Note>{t("O Pokérus só pega em Ruby, Sapphire e Emerald. No FR/LG ele não aparece nem passa de um Pokémon para outro.")}</Note>}
      <Check label={<><Term k="fateful">{t("Marca de evento")}</Term> (fateful encounter)</>} checked={fateful}
        onChange={(e) => onChange({ fateful: e.target.checked })} />
      <Note>{t("Pokémon de evento saem com ela. Mew e Deoxys precisam dela: sem ela, não obedecem e o jogo não deixa trocar.")}</Note>
    </>
  );
}

/** Plus already set ribbons that are not obtainable, so they can be removed. */
export function RibbonFields({ game, ribbons: bits, onChange }: {
  game: number; ribbons: number; onChange: (patch: { ribbons: number }) => void;
}) {
  const allowed = ribbons.available(game);
  const decoded = ribbons.decode(bits);
  const contest = allowed.includes("contest") || Object.values(decoded.contest).some(Boolean);
  const flags = ribbons.FLAGS.filter((k) => allowed.includes(k) || decoded.flags.includes(k));
  const unused = bits & ribbons.UNUSED_MASK;
  const setContest = (key: ribbons.ContestKey, rank: number) =>
    onChange({ ribbons: ribbons.encode({ ...decoded.contest, [key]: rank }, decoded.flags) | unused });
  const setFlag = (key: ribbons.FlagKey, on: boolean) =>
    onChange({ ribbons: ribbons.encode(decoded.contest, on ? [...decoded.flags, key] : decoded.flags.filter((k) => k !== key)) | unused });

  return (
    <>
      {contest && (
        <Fields>
          {ribbons.CONTEST.map((k) => (
            <Field key={k} label={<><RibbonIcon ribbon={k} rank={Math.max(1, Math.min(decoded.contest[k], ribbons.CONTEST_MAX))} off={!decoded.contest[k]} />{ribbons.NAMES[k]} Ribbon</>}>
              <select value={Math.min(decoded.contest[k], ribbons.CONTEST_MAX)} onChange={(e) => setContest(k, Number(e.target.value))}>
                {ribbons.RANKS.map((rank, i) => <option key={i} value={i}>{i ? rank : t("nenhuma")}</option>)}
              </select>
            </Field>
          ))}
        </Fields>
      )}
      {flags.map((k) => (
        <Check key={k} checked={decoded.flags.includes(k)} onChange={(e) => setFlag(k, e.target.checked)}
          label={<><RibbonIcon ribbon={k} off={!decoded.flags.includes(k)} />{ribbons.NAMES[k]} Ribbon <span className="muted">({t(WHERE[k])}{allowed.includes(k) ? "" : `, ${t("não sai nesse jogo")}`})</span></>} />
      ))}
      <Note>{ribbons.FRLG.includes(game)
        ? t("Só aparecem as ribbons que saem no jogo de origem. No FR/LG, só a Champion Ribbon, do Hall of Fame.")
        : t("Só aparecem as ribbons que saem no jogo de origem. As de concurso guardam a maior categoria vencida (Normal, Super, Hyper ou Master).")}</Note>
    </>
  );
}
