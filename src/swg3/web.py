"""JSON services for the site (pk3, builder, recipe, codes): the reference that tools/parity/ checks the TS against.

Conventions: PID in hex (unprefixed text or integer); IVs as 6 values in `STATS` order; natures by name.
"""

import json
import random

from . import recipe
from .i18n import N_, language, t
from .gen3 import base64box, boxnames, builder, codeplan, pk3, species, validate
from .gen3.pk3 import NATURES, STATS


# include/constants/global.h: LANGUAGE_* and VERSION_*.
LANGUAGES = {1: N_("japonês"), 2: N_("inglês"), 3: N_("francês"), 4: N_("italiano"), 5: N_("alemão"),
             7: N_("espanhol")}
GAMES = {1: "Sapphire", 2: "Ruby", 3: "Emerald", 4: "FireRed", 5: "LeafGreen", 15: "Colosseum/XD"}


class ParamError(ValueError):
    pass


def _hex(params: dict, key: str, bits: int = 32, default=None) -> int:
    value = params.get(key, default)
    if value is None or value == "":
        raise ParamError(t("{key}: obrigatório", key=key))
    if isinstance(value, str):
        try:
            value = int(value.strip().removeprefix("0x").removeprefix("0X"), 16)
        except ValueError:
            raise ParamError(t("{key}: {value!r} não é hexadecimal", key=key, value=params[key])) from None
    if not 0 <= value < 1 << bits:
        raise ParamError(t("{key}: fora de 0 a {max:X}", key=key, max=(1 << bits) - 1))
    return value


def _int(params: dict, key: str, lo: int, hi: int, default=None) -> int | None:
    value = params.get(key, default)
    if value is None or value == "":
        return default
    try:
        value = int(value)
    except (TypeError, ValueError):
        raise ParamError(t("{key}: {value!r} não é número", key=key, value=value)) from None
    if not lo <= value <= hi:
        raise ParamError(t("{key}: fora de {lo} a {hi}", key=key, lo=lo, hi=hi))
    return value


def _species_id(params: dict, key: str = "species") -> int | None:
    value = _int(params, key, 0, validate.SPECIES_EGG, None)
    if value in (None, 0):
        return None
    if not validate.valid_species(value):
        raise ParamError(t("{key}: espécie {species} inexistente", key=key, species=value))
    return value


def _nature_set(names) -> set[int]:
    lowered = [n.lower() for n in NATURES]
    out = set()
    for name in names or []:
        if name.lower() not in lowered:
            raise ParamError(t("nature desconhecida: {name}", name=name))
        out.add(lowered.index(name.lower()))
    return out


def _ability(species_id: int, pid_bit: int) -> str:
    first, second = species.info(species_id)["abilities"]
    return species.ability_name(second if pid_bit and second else first)


def _named(value: int, name: str) -> dict:
    return {"id": value, "name": name}


def _bytes(params: dict, key: str = "hex") -> bytes:
    text = "".join(str(params.get(key, "")).split())
    try:
        return bytes.fromhex(text)
    except ValueError:
        raise ParamError(t("{key}: conteúdo não é hexadecimal", key=key)) from None


def _load_pk3(params: dict, key: str = "hex") -> tuple[pk3.Pk3, bool]:
    data = _bytes(params, key)
    if len(data) not in (pk3.BOX_SIZE, pk3.PARTY_SIZE):
        raise ParamError(t("tamanho {size} bytes, esperado {box} (box) ou {party} (party)",
                             size=len(data), box=pk3.BOX_SIZE, party=pk3.PARTY_SIZE))
    return pk3.load(data)


def pk3_inspect(params: dict) -> dict:
    return describe(*_load_pk3(params))


def describe(mon: pk3.Pk3, encrypted: bool = True) -> dict:
    data = mon.data
    known = validate.valid_species(mon.species)
    name = validate.species_names().get(mon.species, "?")
    out = {
        "format": "encrypted" if encrypted else "decrypted",
        "size": len(data),
        "party": mon.is_party,
        "checksum": {"stored": mon._u16(0x1C), "computed": pk3.checksum(mon.data), "ok": mon.checksum_ok},
        "species": {"id": mon.species, "name": name, "known": known},
        "nickname": mon.nickname,
        "ot_name": mon.ot_name,
        "ot_gender": "F" if mon.ot_gender else "M",
        "nature_index": mon.personality % 25,
        "tid": mon.tid,
        "sid": mon.sid,
        "pid": f"{mon.personality:08X}",
        "nature": mon.nature,
        "shiny": mon.is_shiny,
        "ivs": [mon.ivs[k] for k in STATS],
        "evs": [mon.evs[k] for k in STATS],
        "moves": [{"id": m, "name": species.move_name(m) if m else "-", "pp": pp}
                  for m, pp in zip(mon.moves, mon.pp)],
        "pp_bonuses": mon.pp_bonuses,
        "held_item": _named(mon.held_item, species.item_name(mon.held_item) if mon.held_item else "-"),
        "ball": _named(mon.ball, species.item_name(mon.ball) if mon.ball else "-"),
        "met_level": mon.met_level,
        "met_location": _named(mon.met_location, species.map_section(mon.met_location, mon.met_game)),
        "met_game": _named(mon.met_game, GAMES.get(mon.met_game, "?")),
        "language": _named(mon.language, t(LANGUAGES.get(mon.language, "?"))),
        "friendship": mon.friendship,
        "experience": mon.experience,
        "pokerus": mon.pokerus,
        "is_egg": mon.is_egg,
        "is_bad_egg": mon.is_bad_egg,
        "fateful": mon.fateful,
        "ribbons": f"{mon.ribbons:08X}",
        "markings": mon.markings,
        "contest": mon.contest,
        "ability_num": mon.ability_num,
    }
    move_type, power = species.hidden_power(mon.ivs)
    out["hidden_power"] = {"type": species.type_name(move_type), "power": power}
    if known:
        entry = species.info(mon.species)
        level = species.mon_level(mon)
        stats = species.mon_stats(mon, level)
        types = list(dict.fromkeys(species.type_name(t) for t in entry["types"]))   # single type is listed twice
        out["species"].update(types=types, base=entry["base"], national=entry["national"])
        out["gender"] = species.gender(mon.species, mon.personality)
        out["ability"] = _ability(mon.species, mon.ability_num)
        out["level"] = level
        out["stats"] = [stats[k] for k in STATS]
    if mon.is_party:
        party = mon.stats
        out["party_data"] = {"level": mon.level, "stats": [party[k] for k in STATS],
                             "current_hp": party["current_hp"]}
    out["issues"] = [{"level": i.level, "field": i.field, "message": i.message} for i in validate.check(mon)]
    if mon.checksum_ok:
        out["files"] = {"game": mon.to_raw().hex(), "plain": bytes(mon.data).hex()}
    return out


def _names(table) -> list[dict]:
    return [{"id": i, "name": n} for i, n in enumerate(table) if i and n and not n.startswith("?")]


def lists(_params: dict | None = None) -> dict:
    """Emerald met locations come apart because they reuse FR/LG numbers."""
    d = species.data()
    moves = [{"id": int(k), "name": v} for k, v in d["moves"].items() if int(k)]
    return {
        "moves": sorted(moves, key=lambda m: m["id"]),
        "items": [i for i in _names(d["items"]) if species.holdable(i["id"])],
        "balls": [{"id": i, "name": species.item_name(i)} for i in range(1, validate.MAX_BALL + 1)],
        "locations": [{"id": int(k), "name": v} for k, v in sorted(d["mapsec"].items(), key=lambda kv: int(kv[0]))],
        "locations_emerald": [{"id": int(k), "name": v} for k, v in sorted(d["mapsec_emerald"].items(), key=lambda kv: int(kv[0]))],
        "game_locations": {str(k): validate.met_locations(k) for k in GAMES},
        "languages": [{"id": k, "name": t(v)} for k, v in LANGUAGES.items()],
        "games": [{"id": k, "name": v} for k, v in GAMES.items()],
    }


def species_info(params: dict) -> dict:
    species_id = _species_id(params)
    if species_id is None:
        raise ParamError(t("{key}: obrigatório", key="species"))
    level = _int(params, "level", 1, 100, 100)
    entry = species.info(species_id)
    # Egg moves come separately: only a hatched Pokémon can have them.
    learnable = sorted(species.learnable_moves(species_id, level, egg=False))
    egg_moves = sorted(species.egg_only_moves(species_id, level))
    emerald = sorted(species.emerald_tutor_moves(species_id) - set(learnable) - set(egg_moves))
    xd = sorted(species.xd_tutor_moves(species_id) - set(learnable) - set(egg_moves) - set(emerald))
    return {
        "id": species_id, "name": entry["name"], "national": entry["national"],
        "types": list(dict.fromkeys(species.type_name(t) for t in entry["types"])),
        "base": entry["base"], "friendship": entry["friendship"], "gender_ratio": entry["gender_ratio"],
        "abilities": [species.ability_name(a) for a in entry["abilities"] if a],
        "default_moves": builder.initial_moves(species_id, level),
        "learnable": [{"id": m, "name": species.move_name(m)} for m in learnable],
        "egg_moves": [{"id": m, "name": species.move_name(m)} for m in egg_moves],
        "emerald_tutor": [{"id": m, "name": species.move_name(m)} for m in emerald],
        "xd_tutor": [{"id": m, "name": species.move_name(m)} for m in xd],
        "evolutions": [{"method": m, "param": p, "target": species.info(t)["name"]}
                       for m, p, t in species.evolutions(species_id)],
    }


def _build_fields(params: dict) -> dict:
    fields = dict(params.get("fields") or {})
    if isinstance(fields.get("nature"), str):
        natures = _nature_set([fields["nature"]])
        fields["nature"] = natures.pop()
    if isinstance(fields.get("pid"), str):
        fields["pid"] = _hex(fields, "pid")
    for key in ("ivs", "evs"):
        if isinstance(fields.get(key), list):
            if len(fields[key]) != len(STATS):
                raise ParamError(t("{key}: esperados {count} valores", key=key, count=len(STATS)))
            fields[key] = dict(zip(STATS, fields[key]))
    if isinstance(fields.get("letter"), str):
        if fields["letter"] not in pk3.UNOWN_LETTERS:
            raise ParamError(f"letter: {fields['letter']!r}")
        fields["letter"] = pk3.UNOWN_LETTERS.index(fields["letter"])
    return fields


def pk3_build(params: dict) -> dict:
    base = _load_pk3(params, "base")[0] if params.get("base") else None
    seed = params.get("seed")
    rng_source = random.Random(seed) if seed is not None else None
    mon, notes = builder.build(_build_fields(params), base=base, rng=rng_source)
    return {"mon": describe(mon), "notes": notes}


def code_plan(params: dict) -> dict:
    mon, _ = _load_pk3(params)
    if not validate.valid_species(mon.species):
        raise ParamError(t("espécie inválida"))
    return codeplan.plan(mon, params.get("strategy", "wild"))


def recipe_trade(params: dict) -> dict:
    mon, _ = _load_pk3(params)
    save_as = (params.get("save_as") or "").strip() or None
    return recipe.trade(mon, params.get("game", "firered"), save_as)


def recipe_check(params: dict) -> dict:
    data, mon = recipe.load(str(params.get("text", "")))
    return {"recipe": data, "mon": describe(mon)}


def box_names(params: dict) -> dict:
    names = boxnames.parse_names(str(params.get("names", "")))
    raw_text = str(params.get("raw", "")).strip()
    general = []
    raw_names = None
    if raw_text:
        raw_names, raw_issues = boxnames.check_raw(boxnames.parse_raw(raw_text))
        general += raw_issues
        if not names:
            names = raw_names
    boxes, name_issues = boxnames.check_names(names)
    general = name_issues + general
    out = []
    for box in boxes:
        entry = {"number": box.number, "name": box.name, "length": len(box.name),
                 "issues": [{"level": l, "message": m} for l, m in box.issues], "steps": None,
                 "bytes": box.raw.hex(" ").upper() if box.raw else None}
        if not any(l == "error" for l, _ in box.issues):
            entry["steps"] = boxnames.typing_steps(box.name)
        if raw_names is not None and box.number <= len(raw_names) and raw_names[box.number - 1] != box.name:
            entry["issues"].append({"level": "error", "message": t("diferente dos bytes crus: {name!r}", name=raw_names[box.number - 1])})
        out.append(entry)
    if raw_names is not None and len(raw_names) != len(names):
        general.append(("error", t("{names} nomes, mas os bytes crus têm {boxes} boxes", names=len(names), boxes=len(raw_names))))
    code = None
    if base64box.is_base64_code(names):
        try:
            data = base64box.decode(names)
            mon, _ = pk3.load(data)
            code = {"kind": "base64", "mon": describe(mon)} if mon.checksum_ok else \
                {"kind": "base64", "error": t("os bytes decodificados não formam um Pokémon válido (checksum): confira a digitação")}
        except ValueError as error:
            code = {"kind": "base64", "error": str(error)}
    return {"boxes": out, "code": code, "issues": [{"level": l, "message": m} for l, m in general],
            "ok": not any(l == "error" for l, _ in general) and all(
                not any(i["level"] == "error" for i in b["issues"]) for b in out)}


def base64_boxes(params: dict) -> dict:
    mon, _ = _load_pk3(params)
    if not mon.checksum_ok:
        raise ParamError(t("checksum inválido: o writer gravaria um Bad Egg"))
    errors = [i for i in validate.check(mon) if i.level == "error"]
    if errors:
        raise ParamError(t("Pokémon com erro, corrija antes: {errors}",
                             errors="; ".join(f"{i.field}: {i.message}" for i in errors)))
    convert = tuple(int(n) for n in params.get("convert") or ())
    result = base64box.encode(mon.to_box().to_raw(), bool(params.get("switch_safe", True)), convert)
    if base64box.decode(result.boxes) != mon.to_box().to_raw():
        raise ParamError(t("conferência interna falhou: os nomes não reproduzem os bytes"))
    return result.as_dict()


FUNCTIONS = {
    "pk3_inspect": pk3_inspect,
    "lists": lists,
    "species_info": species_info,
    "pk3_build": pk3_build,
    "code_plan": code_plan,
    "recipe_trade": recipe_trade,
    "recipe_check": recipe_check,
    "box_names": box_names,
    "base64_boxes": base64_boxes,
}


def call(name: str, payload: str = "{}", lang: str = "pt") -> str:
    """Returns {"ok": true, "result": ...} or {"ok": false, "error": ...}."""
    with language(lang):
        function = FUNCTIONS.get(name)
        if function is None:
            return json.dumps({"ok": False, "error": t("função desconhecida: {name}", name=name)})
        try:
            result = function(json.loads(payload or "{}"))
        except (KeyError, ValueError) as error:
            # str(KeyError) quotes the message; the message is the first argument.
            message = error.args[0] if isinstance(error, KeyError) and error.args else str(error)
            return json.dumps({"ok": False, "error": str(message)}, ensure_ascii=False)
        return json.dumps({"ok": True, "result": result}, ensure_ascii=False)
