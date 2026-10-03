"""Parity vectors for the "core" area: character table, pk3, species and validation.

Built from the Python modules with fixed seeds for web/tests/core.parity.test.ts; bytes hex encoded. The RNG
vectors are frozen in web/tests/vectors/frozen/.
"""

import random
import struct
import sys
from pathlib import Path

from swg3.gen3 import builder, charset, pk3, species, validate
from swg3.gen3.pk3 import STATS, Pk3
from swg3.i18n import language

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

def _ivs(r: random.Random) -> dict:
    return {k: r.randrange(32) for k in STATS}


def _evs(r: random.Random, limit: int = 510) -> dict:
    out = dict.fromkeys(STATS, 0)
    for _ in range(r.randrange(0, 12)):
        stat = r.choice(STATS)
        room = min(255 - out[stat], limit - sum(out.values()))
        if room > 0:
            out[stat] += r.randrange(room + 1)
    return out


def _charset(r: random.Random) -> dict:
    decode = []
    for japanese in (False, True):
        decode += [[bytes([b]).hex(), japanese, charset.decode(bytes([b]), japanese)] for b in range(256)]
        for _ in range(60):
            data = bytes(r.getrandbits(8) for _ in range(r.randrange(1, 14)))
            decode.append([data.hex(), japanese, charset.decode(data, japanese)])
    _, table = charset._tables()
    chars = sorted(table)
    encode = []
    for _ in range(80):
        text = "".join(r.choice(chars) for _ in range(r.randrange(0, 11)))
        length = r.randrange(len(text), len(text) + 4)
        encode.append([text, length, charset.encode(text, length).hex()])
    errors = [["BULBASAUR", 7], ["A€B", 10], ["あ", 5], ["ABCDEFGHIJK", 10]]
    for text, length in errors:
        try:
            charset.encode(text, length)
            raise AssertionError(f"{text!r} deveria falhar")
        except ValueError:
            pass
    return {"decode": decode, "encode": encode, "encode_errors": errors}


def pk3_fields(mon: Pk3) -> dict:
    out = {
        "personality": mon.personality, "ot_id": mon.ot_id, "tid": mon.tid, "sid": mon.sid,
        "language": mon.language, "is_bad_egg": mon.is_bad_egg, "has_species": mon.has_species,
        "markings": mon.markings, "nickname": mon.nickname, "ot_name": mon.ot_name, "species": mon.species,
        "held_item": mon.held_item, "experience": mon.experience, "pp_bonuses": mon.pp_bonuses,
        "friendship": mon.friendship, "moves": list(mon.moves), "pp": list(mon.pp), "evs": mon.evs,
        "contest": mon.contest, "pokerus": mon.pokerus, "met_location": mon.met_location,
        "met_level": mon.met_level, "met_game": mon.met_game, "ball": mon.ball, "ot_gender": mon.ot_gender,
        "is_egg": mon.is_egg, "ability_num": mon.ability_num, "fateful": mon.fateful, "ribbons": mon.ribbons,
        "ivs": mon.ivs, "nature": mon.nature, "is_shiny": mon.is_shiny, "checksum_ok": mon.checksum_ok,
        "is_party": mon.is_party,
    }
    if mon.is_party:
        out["level"] = mon.level
        out["stats"] = mon.stats
    return out


def _built(r: random.Random, count: int) -> list[Pk3]:
    valid = [s for s in range(1, 412) if validate.valid_species(s)]
    names = ["RED", "BLUE", "ASH", "Gary", "Misty", "Brock", "Ürsula", "A-B.C!", "é'x", "ZZZZZZZ"]
    out = []
    for i in range(count):
        s = r.choice(valid)
        fields = {
            "species": s, "level": r.randrange(1, 101), "ot_name": r.choice(names),
            "tid": r.getrandbits(16), "sid": r.getrandbits(16), "party": i % 2 == 0,
            "nature": r.randrange(25) if r.random() < 0.7 else None,
            "shiny": r.random() < 0.3 or None,
            "ivs": _ivs(r), "evs": _evs(r),
            "held_item": r.choice([0, 0, 13, 195, r.randrange(1, 375)]),
            "ball": r.randrange(1, 13), "ot_gender": r.randrange(2),
            "met_location": r.randrange(0, 0xD5), "friendship": r.randrange(256),
            "nickname": r.choice([None, None, "SPARKY", "Mr.X", "Zé"]),
        }
        mon, _ = builder.build(fields, rng=random.Random(r.getrandbits(32)))
        mon.markings = r.randrange(16)
        mon.pokerus = r.choice([0, 0, 0x11, 0x2F])
        mon.pp_bonuses = r.choice([0, 0xFF, r.randrange(256)])
        if i % 7 == 3:
            mon.language = 1   # Japanese: the nickname is now read with the Japanese table
        mon.update_checksum()
        out.append(mon)
    return out


def _random_mons(r: random.Random, count: int) -> list[bytes]:
    return [bytes(r.getrandbits(8) for _ in range(pk3.PARTY_SIZE if i % 2 else pk3.BOX_SIZE)) for i in range(count)]


def _pk3(r: random.Random, built: list[Pk3]) -> dict:
    mons = []
    for mon in built:
        raw = mon.to_raw()
        mons.append({"plain": bytes(mon.data).hex(), "raw": raw.hex(), "checksum": pk3.checksum(mon.data),
                     "fields": pk3_fields(mon), "box": bytes(mon.to_box().data).hex()})
    for data in _random_mons(r, 40):
        mon = Pk3(data)
        mons.append({"plain": data.hex(), "raw": mon.to_raw().hex(), "checksum": pk3.checksum(data),
                     "fields": pk3_fields(mon), "box": bytes(mon.to_box().data).hex()})

    loads = []
    for mon in built[:20]:
        for data in (mon.to_raw(), bytes(mon.data)):
            loaded, encrypted = pk3.load(data)
            loads.append({"data": data.hex(), "plain": bytes(loaded.data).hex(), "encrypted": encrypted})
    for data in _random_mons(r, 10):
        loaded, encrypted = pk3.load(data)
        loads.append({"data": data.hex(), "plain": bytes(loaded.data).hex(), "encrypted": encrypted})

    edits = []
    for mon in built[:24]:
        before = bytes(mon.data).hex()
        work = Pk3(bytes(mon.data))
        sets = {
            "personality": r.getrandbits(32), "ot_id": r.getrandbits(32), "language": r.randrange(8),
            "has_species": r.random() < 0.5, "markings": r.randrange(256), "species": r.randrange(1, 412),
            "held_item": r.getrandbits(16), "experience": r.getrandbits(32), "pp_bonuses": r.randrange(256),
            "friendship": r.randrange(256), "moves": [r.randrange(355) for _ in range(4)],
            "pp": [r.randrange(64) for _ in range(4)], "evs": _evs(r), "pokerus": r.randrange(256),
            "met_location": r.randrange(256), "met_level": r.randrange(128), "met_game": r.randrange(16),
            "ball": r.randrange(16), "ot_gender": r.randrange(2), "ability_num": r.randrange(2),
            "ivs": _ivs(r), "nickname": r.choice(["PIKACHU", "", "a b"]), "ot_name": r.choice(["RED", "Zé"]),
        }
        for key, value in sets.items():
            setattr(work, key, value)
        entry = {"before": before, "sets": sets}
        if work.is_party:
            stats = {k: r.randrange(1, 500) for k in STATS}
            hp = r.choice([None, r.randrange(0, stats["hp"] + 1)])
            work.set_party(r.randrange(1, 101), stats, hp)
            entry["party"] = {"level": work.level, "stats": stats, "current_hp": hp}
        work.update_checksum()
        entry["after"] = bytes(work.data).hex()
        edits.append(entry)
    return {"mons": mons, "load": loads, "edits": edits}


def _species(r: random.Random) -> dict:
    ids = sorted(int(k) for k in species.data()["species"])
    calc = []
    for _ in range(300):
        s = r.choice(ids)
        level = r.randrange(1, 101)
        ivs, evs, nature = _ivs(r), _evs(r), r.randrange(25)
        calc.append({"species": s, "level": level, "ivs": ivs, "evs": evs, "nature": nature,
                     "stats": species.calc_stats(s, level, ivs, evs, nature)})
    # Out-of-game levels push past 595 to overflow 16 bits in the nature multiplier.
    for s, level in ((213, 255), (242, 255), (150, 250), (213, 180)):
        ivs, evs = dict.fromkeys(STATS, 31), dict.fromkeys(STATS, 255)
        for nature in range(25):
            calc.append({"species": s, "level": level, "ivs": ivs, "evs": evs, "nature": nature,
                         "stats": species.calc_stats(s, level, ivs, evs, nature)})

    level_exp = []
    for s in ids[::7] + [1, 10, 129, 292]:
        table = species.exp_table(s)
        exps = [0, 1, table[100], table[100] + 1, 10 ** 7] + [table[lv] + d for lv in (2, 5, 50, 99, 100) for d in (-1, 0, 1)]
        exps += [r.randrange(0, table[100] + 1) for _ in range(5)]
        level_exp += [[s, e, species.level_from_exp(s, e)] for e in exps if e >= 0]

    genders = [[s, pid, species.gender(s, pid)] for s in ids for pid in (0, 0xFF, r.getrandbits(32))]
    hidden = []
    for _ in range(150):
        ivs = _ivs(r)
        hidden.append([ivs, list(species.hidden_power(ivs))])
    for fixed in (0, 31, 30, 1):
        ivs = dict.fromkeys(STATS, fixed)
        hidden.append([ivs, list(species.hidden_power(ivs))])

    trade = []
    items = {0, species.ITEM_EVERSTONE, 1, 200}
    for s in ids:
        for _, param, _ in species.info(s)["evolutions"]:
            items.add(param)
    for s in ids:
        evo = species.evolutions(s)
        tried = sorted(items) if any(m.startswith("trade") for m, _, _ in evo) else [0, species.ITEM_EVERSTONE]
        trade += [[s, item, species.trade_evolution(s, item)] for item in tried]

    learn = []
    for s in r.sample(ids, 60) + [6, 196, 292, 400]:
        level = r.randrange(1, 101)
        learn.append({"species": s, "level": level, "own": sorted(species.own_learnable_moves(s, level)),
                      "all": sorted(species.learnable_moves(s, level)),
                      "all_max": sorted(species.learnable_moves(s))})

    possible = []
    for _ in range(40):
        s, nature = r.choice(ids), r.randrange(25)
        ivs = _ivs(r)
        evs = _evs(r) if r.random() < 0.3 else None
        observations = []
        for level in sorted(r.sample(range(1, 101), r.randrange(1, 4))):
            observations.append([level, species.calc_stats(s, level, ivs, evs or dict.fromkeys(STATS, 0), nature)])
        possible.append({"species": s, "nature": nature, "observations": observations, "evs": evs,
                         "ivs": species.possible_ivs(s, nature, observations, evs)})
    # Separate generator so the following vectors do not change.
    slack_rng = random.Random(4242)
    for _ in range(20):
        s, nature = slack_rng.choice(ids), slack_rng.randrange(25)
        ivs = _ivs(slack_rng)
        slack = slack_rng.choice([4, 12, 20, 40])
        gained = dict.fromkeys(STATS, 0)
        observations = []
        for level in sorted(slack_rng.sample(range(1, 101), slack_rng.randrange(2, 5))):
            observations.append([level, species.calc_stats(s, level, ivs, gained, nature)])
            gained = {k: min(slack, v + slack_rng.randrange(0, 9)) for k, v in gained.items()}
        possible.append({"species": s, "nature": nature, "observations": observations, "evs": None, "ev_slack": slack,
                         "ivs": species.possible_ivs(s, nature, observations, None, slack)})

    names = {
        "moves": [[m, species.move_name(m)] for m in range(0, 360)],
        "types": [[t, species.type_name(t)] for t in range(-1, 20)],
        "abilities": [[a, species.ability_name(a)] for a in range(-1, 80)],
        "items": [[i, species.item_name(i)] for i in range(-1, 380)],
        "mapsec": [[m, species.map_section(m)] for m in range(0, 0x100)],
        "national": [[s, species.national_number(s)] for s in ids],
        "species_id": [[n, species.species_id(n)] for n in ("bulbasaur", "PIKACHU", "Mr. Mime", "unown", "DEOXYS")
                       if n.upper() in {v["name"] for v in species.data()["species"].values()}],
    }
    modifiers = [[n, stat, species.nature_modifier(n, stat)] for n in range(25) for stat in STATS]
    evolutions = [[s, [list(e) for e in species.evolutions(s)], species.pre_evolutions(s)] for s in ids]
    # Separate generator so earlier draws do not change.
    rb = random.Random(0xE66)
    breeders = [s for s in ids if species.info(s)["egg"]]
    egg_father = []
    for _ in range(150):
        s = rb.choice(breeders)
        pool = sorted(species._family_egg(s))
        moves = sorted(rb.sample(pool, min(len(pool), rb.randrange(1, 5))))
        egg_father.append([s, moves, species.egg_father(s, moves)])
    since = []
    for s in ids:
        pre = species.pre_evolutions(s)
        if pre:
            for form in [s, *pre]:
                since.append([s, form, sorted(species.learnable_moves(s, 50, egg=False, since=form)),
                              sorted(species.xd_tutor_moves(s, since=form))])
    return {"ids": ids, "calc_stats": calc, "level_from_exp": level_exp, "gender": genders,
            "hidden_power": hidden, "trade_evolution": trade, "learnable": learn, "possible_ivs": possible,
            "names": names, "nature_modifier": modifiers, "evolutions": evolutions,
            "egg_father": egg_father, "since": since}


def _issues(mon: Pk3) -> dict:
    out = {"pt": [[i.level, i.field, i.message] for i in validate.check(mon)], "valid": validate.is_valid(mon)}
    with language("en"):
        out["en"] = [[i.level, i.field, i.message] for i in validate.check(mon)]
    return out


def _validate(r: random.Random, built: list[Pk3]) -> dict:
    cases = []

    def add(name: str, mon: Pk3):
        cases.append({"name": name, "data": bytes(mon.data).hex(), **_issues(mon)})

    for i, mon in enumerate(built):
        add(f"built {i}", mon)

    base = built[0] if built[0].is_party else built[1]
    box = base.to_box()

    def broken(name: str, change, source: Pk3 = box, fix_checksum: bool = True):
        mon = Pk3(bytes(source.data))
        change(mon)
        if fix_checksum:
            mon.update_checksum()
        add(name, mon)

    broken("wrong checksum", lambda m: m.data.__setitem__(0x1C, m.data[0x1C] ^ 0xFF), fix_checksum=False)
    for s in (0, 252, 276, 412, 413, 500, 0xFFFF):
        broken(f"species {s}", lambda m, s=s: setattr(m, "species", s))
    broken("repeated move", lambda m: setattr(m, "moves", (33, 33, 0, 0)))
    broken("nonexistent move", lambda m: setattr(m, "moves", (33, 400, 0, 0)))
    broken("no moves", lambda m: setattr(m, "moves", (0, 0, 0, 0)))
    broken("first slot empty", lambda m: setattr(m, "moves", (0, 33, 0, 0)))
    broken("unlearnable move", lambda m: setattr(m, "moves", (33, 74, 76, 0)))
    broken("too many EVs", lambda m: setattr(m, "evs", dict(zip(STATS, (255, 255, 1, 0, 0, 0)))))
    broken("nonexistent item", lambda m: setattr(m, "held_item", 375))
    broken("ball 0", lambda m: setattr(m, "ball", 0))
    broken("ball 13", lambda m: setattr(m, "ball", 13))
    broken("language 6", lambda m: setattr(m, "language", 6))
    broken("language 0", lambda m: setattr(m, "language", 0))
    broken("met level", lambda m: setattr(m, "met_level", 120))
    broken("empty nickname", lambda m: m.data.__setitem__(0x08, 0xFF))
    broken("OT outside the table", lambda m: m.data.__setitem__(0x14, 0x0A))
    broken("Bad Egg", lambda m: m.data.__setitem__(0x13, m.data[0x13] | 1))
    broken("hasSpecies", lambda m: setattr(m, "has_species", False))
    broken("too much experience", lambda m: setattr(m, "experience", 10 ** 7))
    broken("ability from PID", lambda m: setattr(m, "ability_num", 1 - m.ability_num))
    broken("egg with unlearnable move", lambda m: (setattr(m, "moves", (33, 74, 76, 0)),
                                               m._set_bits(0x20 + 36 + 4, 30, 1, 1)))
    party = Pk3(bytes(base.data))
    lv = party.level
    broken("party wrong level", lambda m: m.data.__setitem__(pk3.BOX_SIZE + 4, lv % 100 + 1), party)
    broken("party level 0", lambda m: m.data.__setitem__(pk3.BOX_SIZE + 4, 0), party)
    broken("party zero stat", lambda m: struct.pack_into("<H", m.data, pk3.BOX_SIZE + 10, 0), party)
    broken("party current HP too high", lambda m: struct.pack_into("<H", m.data, pk3.BOX_SIZE + 6, 999), party)
    broken("party stats differ", lambda m: struct.pack_into("<H", m.data, pk3.BOX_SIZE + 12, 777), party)
    broken("party empty", lambda m: m.data.__setitem__(slice(pk3.BOX_SIZE, pk3.PARTY_SIZE), bytes(20)), party)

    single = next(m for m in built if not species.info(m.species)["abilities"][1])
    broken("second ability", lambda m: setattr(m, "ability_num", 1), single.to_box())

    def built_moves(name: str, fields: dict):
        mon, _ = builder.build({"ot_name": "RED", "tid": 1, "sid": 2, "met_game": 4, **fields}, rng=random.Random(3))
        add(name, mon)
    built_moves("Pidgeotto caught at 29 with Mirror Move", {"species": 17, "level": 50, "met_location": 113, "met_level": 29, "moves": [119, 16]})
    built_moves("Pidgeotto caught as Pidgey with Mirror Move", {"species": 17, "level": 50, "met_location": 101, "met_level": 2, "moves": [119, 16]})
    built_moves("Butterfree with Nightmare", {"species": 12, "level": 30, "moves": [171, 93]})
    built_moves("XD Butterfree with Nightmare", {"species": 12, "level": 30, "moves": [171, 93], "met_game": 15, "met_location": 0xFF})
    built_moves("Venusaur with Frenzy Plant", {"species": 3, "level": 50, "moves": [338, 22]})
    built_moves("hatched Bulbasaur, impossible egg", {"species": 1, "level": 5, "met_level": 0, "met_location": 146, "moves": [113, 130, 33]})
    built_moves("hatched Bulbasaur, possible egg", {"species": 1, "level": 5, "met_level": 0, "met_location": 146, "moves": [113, 219, 33]})

    # Monean gives A and ?, Viapois gives Z and !.
    for letter, section in ((0, 188), (27, 188), (1, 188), (25, 194), (26, 194), (0, 194)):
        pid = builder.choose_pid(201, 1, 2, letter=letter, rng=random.Random(letter * 1000 + section))
        mon, _ = builder.build({"species": 201, "level": 30, "ot_name": "RED", "tid": 1, "sid": 2, "met_game": 4,
                                "met_location": section, "pid": pid}, rng=random.Random(section))
        add(f"Unown {pk3.UNOWN_LETTERS[letter]} in section {section}", mon)

    for data in _random_mons(r, 30):
        add("random", Pk3(data))

    valid_species = [s for s in range(0, 0x10000) if validate.valid_species(s)]
    return {"cases": cases, "valid_species": valid_species}


def build() -> dict:
    r = random.Random(0x5EED)
    built = _built(r, 60)
    return {
        "charset": _charset(r),
        "pk3": _pk3(r, built),
        "species": _species(r),
        "validate": _validate(r, built),
    }
