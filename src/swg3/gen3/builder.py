"""Building and editing pk3 as the game creates a Pokémon (src/pokemon.c: CreateBoxMon, GiveBoxMonInitialMoveset,
CreateMon, CreateEventMon).

The PID matches the requested nature, shiny, gender, ability and Unown letter but follows no RNG method's PID/IV
correlation: legality checkers that check the method will reject it.
"""

import random

from ..i18n import t
from . import encounters
from . import ribbons as ribbon_data
from . import species as species_data
from . import validate
from .pk3 import BOX_SIZE, NATURES, PARTY_SIZE, STATS, UNOWN, UNOWN_LETTERS, Pk3, unown_letter

NUM_NATURES = len(NATURES)

VERSIONS = {"firered": 4, "leafgreen": 5}
MAPSEC_PALLET_TOWN = 0x58   # include/constants/region_map_sections.h
ITEM_POKE_BALL = 4
LANGUAGE_ENGLISH = 2
MAX_EV = 255
MAX_TOTAL_EVS = validate.MAX_TOTAL_EVS
MAX_PID_TRIES = 2_000_000


def initial_moves(species: int, level: int) -> list[int]:
    """GiveBoxMonInitialMoveset (DeleteFirstMoveAndGiveMoveToBoxMon when full)."""
    moves: list[int] = []
    for move_level, move in species_data.info(species)["levelup"]:
        if move_level > level:
            break
        if move in moves:
            continue
        if len(moves) == 4:
            moves.pop(0)
        moves.append(move)
    return moves


def _pid_ok(pid, species, nature, tid, sid, shiny, gender, ability, letter, letters=None) -> bool:
    if nature is not None and pid % NUM_NATURES != nature:
        return False
    is_shiny = (tid ^ sid ^ (pid >> 16) ^ (pid & 0xFFFF)) < 8
    if shiny is not None and is_shiny != shiny:
        return False
    if gender is not None and species_data.gender(species, pid) != gender:
        return False
    if ability is not None and species_data.info(species)["abilities"][1] and pid & 1 != ability:
        return False
    if letter is not None and species == UNOWN and unown_letter(pid) != letter:
        return False
    if letters is not None and species == UNOWN and unown_letter(pid) not in letters:
        return False
    return True


def choose_pid(species: int, tid: int, sid: int, nature=None, shiny=None, gender=None, ability=None,
               letter=None, letters=None, rng: random.Random | None = None) -> int:
    """Random PID meeting the constraints (None = any). `letters`: accepted Unown letters."""
    entry = species_data.info(species)
    ratio = entry["gender_ratio"]
    fixed = {species_data.MON_MALE: "M", species_data.MON_FEMALE: "F", species_data.MON_GENDERLESS: "-"}
    if gender is not None and ratio in fixed and fixed[ratio] != gender:
        raise ValueError(t("gênero {gender} impossível: a espécie é sempre {fixed}", gender=gender, fixed=fixed[ratio]))
    if ability == 1 and not entry["abilities"][1]:
        raise ValueError(t("a espécie só tem uma Ability"))
    rng = rng or random.Random()
    for _ in range(MAX_PID_TRIES):
        low = rng.getrandbits(16)
        if shiny:
            high = (tid ^ sid ^ low ^ rng.randrange(8)) & 0xFFFF
        else:
            high = rng.getrandbits(16)
        pid = (high << 16) | low
        if _pid_ok(pid, species, nature, tid, sid, shiny, gender, ability, letter, letters):
            return pid
    raise ValueError(t("nenhum PID encontrado com essas restrições"))


def _check_ivs(values: dict) -> dict:
    for stat in STATS:
        if not 0 <= int(values[stat]) <= 31:
            raise ValueError(t("IV {stat}={value} fora de 0 a 31", stat=stat, value=values[stat]))
    return {k: int(values[k]) for k in STATS}


def _check_evs(values: dict) -> dict:
    for stat in STATS:
        if not 0 <= int(values[stat]) <= MAX_EV:
            raise ValueError(t("EV {stat}={value} fora de 0 a {max}", stat=stat, value=values[stat], max=MAX_EV))
    total = sum(int(values[k]) for k in STATS)
    if total > MAX_TOTAL_EVS:
        raise ValueError(t("soma dos EVs {total}, máximo {max}", total=total, max=MAX_TOTAL_EVS))
    return {k: int(values[k]) for k in STATS}


def _check_moves(moves) -> list[int]:
    moves = [int(m) for m in moves if m]
    if not moves:
        raise ValueError(t("escolha pelo menos um move"))
    if len(moves) > 4:
        raise ValueError(t("no máximo 4 moves"))
    if len(set(moves)) != len(moves):
        raise ValueError(t("move repetido"))
    for move in moves:
        if not 0 < move < validate.MOVES_COUNT:
            raise ValueError(t("move {move} inexistente", move=move))
    return moves


def _met_note(species: int, species_name: str, game: int, level: int, location: int, met_level: int,
              picked: str, egg: bool) -> str:
    """picked: "both", "level" (location given) or "location" (level given)."""
    place = species_data.map_section(location).replace("_", " ")
    names = {"location": place, "species": species_name, "game": validate.GAME_NAMES.get(game, str(game)), "level": level}
    if met_level == 0:
        if picked == "location":
            return t("Local de encontro escolhido pelo site: {location}, onde fica a única Day Care do FR/LG que gera ovos.", **names)
        if egg:
            reason = t("porque um dos moves só vem de ovo")
        elif not encounters.sightings(species, game):
            reason = t("porque {species} não aparece no {game}: só chega por ovo, de pais trazidos de outro jogo para a Day Care", **names)
        elif picked == "level":
            reason = t("porque {species} não aparece em {location} de outro jeito até o nível {level}", **names)
        else:
            reason = t("porque no {game} {species} só aparece acima do nível {level}", **names)
        if picked == "level":
            return t("Nível de encontro escolhido pelo site: 0, como ovo chocado em {location}, {reason}.", reason=reason, **names)
        return t("Encontro escolhido pelo site: ovo chocado em {location} (nível de encontro 0), {reason}.", reason=reason, **names)
    member = encounters.who(species, game, location, met_level)
    who = species_name if member is None or member == species else t("{member} (antes de evoluir)", member=species_data.info(member)["name"])
    found = {**names, "level": met_level, "who": who}
    if picked == "level":
        return t("Nível de encontro escolhido pelo site: {level}, o nível em que o jogo dá {who} em {location}.", **found)
    if picked == "location":
        return t("Local de encontro escolhido pelo site: {location}, onde o jogo dá {who} no nível {level}.", **found)
    return t("Encontro escolhido pelo site: {location}, nível de encontro {level}, onde o jogo dá {who}.", **found)


def build(fields: dict, base: Pk3 | None = None, rng: random.Random | None = None) -> tuple[Pk3, list[str]]:
    """Creates (without `base`) or edits a Pokémon; missing fields keep the base value or the game default.

    Returns the decrypted Pokémon and notes. Fields beyond the pk3 ones: nature (index), gender ('M'/'F'), ability
    (0/1), letter (Unown, 0 to 27), auto_met (default true: picks an encounter the game would give), party (bool).
    """
    get = lambda key: fields.get(key)
    notes = []
    creating = base is None
    old = base
    mon = Pk3(bytes(PARTY_SIZE if get("party") else BOX_SIZE)) if creating else Pk3(bytes(base.data))
    if get("party") is not None and not creating:
        if get("party") and not mon.is_party:
            mon = Pk3(bytes(mon.data) + bytes(PARTY_SIZE - BOX_SIZE))
        elif not get("party") and mon.is_party:
            mon = mon.to_box()

    species = get("species") if get("species") is not None else (None if creating else mon.species)
    if species is None or not validate.valid_species(species) or species == validate.SPECIES_EGG:
        raise ValueError(t("espécie {species} inexistente", species=species))
    old_level = None if creating or not validate.valid_species(old.species) else species_data.mon_level(old)
    level = get("level") if get("level") is not None else old_level
    if level is None:
        raise ValueError(t("informe o nível"))
    if not 1 <= level <= 100:
        raise ValueError(t("nível {level} fora de 1 a 100", level=level))

    tid = get("tid") if get("tid") is not None else (0 if creating else mon.tid)
    sid = get("sid") if get("sid") is not None else (0 if creating else mon.sid)
    for name, value in (("TID", tid), ("SID", sid)):
        if not 0 <= value <= 0xFFFF:
            raise ValueError(t("{name} {value} fora de 0 a 65535", name=name, value=value))

    if get("met_game") is not None:
        met_game = get("met_game")
    else:
        met_game = VERSIONS.get(get("version"), VERSIONS["firered"]) if creating else mon.met_game

    wanted = dict(nature=get("nature"), shiny=get("shiny"), gender=get("gender"), ability=get("ability"),
                  letter=get("letter"))
    if species == UNOWN and get("letter") is None and get("met_location") is not None:
        wanted["letters"] = encounters.unown_letters(int(met_game), int(get("met_location")))
    if wanted["nature"] is not None and not 0 <= wanted["nature"] < NUM_NATURES:
        raise ValueError(t("nature {nature} inexistente", nature=wanted["nature"]))
    if get("pid") is not None:
        pid = get("pid") & 0xFFFFFFFF
    elif not creating and _pid_ok(mon.personality, species, tid=tid, sid=sid, **wanted):
        pid = mon.personality
    else:
        pid = choose_pid(species, tid, sid, rng=rng, **wanted)
        notes.append(t("PID sorteado pelo site: {pid:08X} (nature {nature}).", pid=pid, nature=NATURES[pid % NUM_NATURES]))
    mon.personality = pid
    mon.ot_id = (sid << 16) | tid

    mon.has_species = True
    species_changed = not creating and species != old.species
    mon.species = species
    if creating or level != old_level or species_changed:
        mon.experience = species_data.exp_table(species)[level]

    entry = species_data.info(species)
    if entry["abilities"][1]:
        mon.ability_num = pid & 1 if get("ability") is None else get("ability")
    else:
        mon.ability_num = 0

    if get("ivs") is not None:
        mon.ivs = _check_ivs(get("ivs"))
    if get("evs") is not None:
        mon.evs = _check_evs(get("evs"))

    moves = get("moves")
    if moves is None and (creating or species_changed):
        moves = initial_moves(species, level)
    if moves is not None:
        moves = _check_moves(moves)
        previous = dict(zip(mon.moves, mon.pp)) if not creating else {}
        padded = moves + [0] * (4 - len(moves))
        mon.moves = padded
        mon.pp = [previous.get(m, species_data.data()["move_pp"][m]) if m else 0 for m in padded]

    species_name = entry["name"]
    if get("nickname"):
        mon.nickname = get("nickname")
    elif creating or (species_changed and mon.nickname == species_data.info(old.species)["name"]):
        mon.nickname = species_name
    if get("ot_name"):
        mon.ot_name = get("ot_name")
    elif creating:
        raise ValueError(t("informe o nome do treinador (OT)"))

    met_location, met_level = MAPSEC_PALLET_TOWN, level
    auto_met = get("auto_met") is None or bool(get("auto_met"))
    if not auto_met:
        met_location = (validate.met_locations(int(met_game)) or [MAPSEC_PALLET_TOWN])[0]
    repick = creating or species_changed or get("met_location") is not None
    auto = None
    if auto_met and repick and (get("met_location") is None or get("met_level") is None):
        egg = any(m in species_data.egg_only_moves(species, level) for m in mon.moves if m)
        given_location = None if get("met_location") is None else int(get("met_location"))
        given_level = None if get("met_level") is None else int(get("met_level"))
        letter = unown_letter(pid) if species == UNOWN else None
        auto = encounters.default_met(species, int(met_game), level, given_location, egg, given_level, letter)
        if auto is not None:
            met_location, met_level = auto
            picked = "both" if given_location is None and given_level is None else "level" if given_level is None else "location"
            # A picked level equal to the current one is not a real choice: no note.
            if not (picked == "level" and met_level == level):
                notes.append(_met_note(species, species_name, int(met_game), level, met_location, met_level, picked=picked, egg=egg))
    defaults = {
        "ot_gender": 0, "held_item": 0, "ball": ITEM_POKE_BALL, "met_level": met_level,
        "met_location": met_location, "met_game": VERSIONS["firered"], "language": LANGUAGE_ENGLISH,
        "friendship": entry["friendship"],
    }
    for key, default in defaults.items():
        value = get(key)
        if value is None and (creating or (auto is not None and key in ("met_location", "met_level"))):
            value = default
        if value is not None:
            setattr(mon, key, int(value))
    if creating and get("version") in VERSIONS and get("met_game") is None:
        mon.met_game = VERSIONS[get("version")]

    if get("pokerus") is not None:
        if not 0 <= int(get("pokerus")) <= 0xFF:
            raise ValueError(t("Pokérus {value} fora de 0 a 255", value=get("pokerus")))
        mon.pokerus = int(get("pokerus"))
    if get("ribbons") is not None:
        ribbons = int(get("ribbons"))
        if not 0 <= ribbons <= ribbon_data.MASK:
            raise ValueError(t("ribbons {value} fora do campo", value=ribbons))
        mon.ribbons = ribbons
    if get("fateful") is not None:
        mon.fateful = bool(get("fateful"))
    elif (creating or species_changed) and species in validate.FATEFUL_SPECIES and not mon.fateful:
        mon.fateful = True
        notes.append(t("Marca de evento ligada pelo site: sem ela, {name} não obedece nem pode ser trocado.", name=species_name))
    elif creating and not mon.fateful and any(s[0] == mon.met_location and s[3] == "event"
                                              for s in encounters.sightings(species, mon.met_game)):
        # Lugia, Ho-Oh and Deoxys on the islands (CreateEventMon).
        mon.fateful = True
        notes.append(t("Marca de evento ligada pelo site: {name} sai do evento com ela.", name=species_name))

    if mon.is_party:
        stats = species_data.mon_stats(mon, level)
        keep_hp = not creating and old.is_party and old.stats["hp"] == stats["hp"]
        mon.set_party(level, stats, old.stats["current_hp"] if keep_hp else None)

    mon.update_checksum()
    if species == UNOWN:
        notes.append(t("letra do Unown pelo PID: {letter}", letter=UNOWN_LETTERS[unown_letter(pid)]))
    return mon, notes
