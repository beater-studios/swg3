"""Parity vectors for the "ace" area: word filter, box names, Base64 writer, pk3 building, code plan, trade
recipe and the site services (swg3.web) end to end.

Built from the Python modules with fixed seeds for web/tests/ace.parity.test.ts; bytes hex encoded.
"""

import base64
import json
import random
import re
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

from swg3 import recipe, web
from swg3.gen3 import badwords, base64box, boxnames, builder, codeplan, species, validate
from swg3.gen3.pk3 import NATURES, STATS, Pk3
from swg3.gen3.pk3 import UNOWN, UNOWN_LETTERS, unown_letter
from swg3.i18n import language

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
from tests.test_validate import valid_mon  # noqa: E402

NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)
SPECIES = [s for s in range(1, validate.SPECIES_EGG) if validate.valid_species(s)]
KEYBOARD_CHARS = "".join(boxnames.KEYS)


def both(function, *args, **kwargs) -> dict:
    out = {}
    for lang in ("pt", "en"):
        with language(lang):
            try:
                out[lang] = {"ok": True, "result": function(*args, **kwargs)}
            except ValueError as error:
                out[lang] = {"ok": False, "error": str(error)}
            except KeyError as error:   # str() of a KeyError adds quotes; the message is the argument
                out[lang] = {"ok": False, "error": error.args[0]}
    return out


def _badwords(r: random.Random) -> dict:
    boundary, strong = badwords.terms()
    patterns = [p for p in (ROOT / "src/swg3/data/badwords_switch.txt").read_text(encoding="utf-8").splitlines() if p]
    sample = patterns[::7] + ["^bv$", ".*xxx.*", ".*ass.*", "^jod.*", ".*jod$", "a.*b", "^\\$\\.x\\\\$"]
    classify = [[p, *badwords.parse_pattern(p), badwords.classify(p)[1]] for p in sample]

    texts = ["Rx5XxlIk", "bj", "ebj", "a s s", "mass", "ass", "12ass34", "xassx", "xshitx", "FM.oZ.Bn", "D3n,E?q",
             "AAQU.o", "BULBASAUR", "RED", "", "   ", "A-S-S", "a.s.s", "as s", "a1s2s", "ASS!", "Sa", "sa1", "x x x",
             "hoe", "Hoe'", "shoe", "t i t", "titan", "b j", "BJ", "b1j", "é", "♂♀", "…“”", "12345", "AbCdEfGh",
             "àss", "𠝹", "a𠝹", "ｘｘｘ", "ΣΑΣ", "İass"]
    alphabet = base64box.ALPHABET
    terms = sorted(boundary)[:400:3] + sorted(strong)[::25]
    ascii_terms = [t for t in sorted(boundary | strong) if t.isascii() and t.isalpha()]
    for _ in range(1500):
        texts.append("".join(r.choice(alphabet) for _ in range(r.randrange(1, 9))))
    for _ in range(1200):
        term = r.choice(terms if r.random() < 0.3 else ascii_terms)
        pieces = []
        for char in term:
            pieces.append(char.upper() if r.random() < 0.3 else char)
            if r.random() < 0.2:
                pieces.append(r.choice("0123456789 .-!?♂♀…,'_"))
        before = "".join(r.choice(alphabet + " .") for _ in range(r.randrange(0, 4)))
        after = "".join(r.choice(alphabet + " .") for _ in range(r.randrange(0, 4)))
        texts.append(before + "".join(pieces) + after)
    for _ in range(300):
        texts.append("".join(r.choice(KEYBOARD_CHARS) for _ in range(r.randrange(1, 9))))
    return {
        "boundary": sorted(boundary),
        "strong": sorted(strong),
        "classify": classify,
        "matches": [[text, badwords.matches(text)] for text in texts],
        "is_boundary": [[t, badwords.is_boundary(t)] for t in ["ass", "xxx", "bj", "sa", "nope", "fuck"]],
    }


def _boxnames(r: random.Random) -> dict:
    parse = ['["FM.oZ.Bn", "____A"]', "Box 1: F M . o Z . B n [FM.oZ.Bn]\nBox 2: _ _ _ _ _ F 9 q [     F9q]\n",
             "AB\nC_D", "Box 1: A\nBox 3: B", "Box 0: A", "Box 0: A\nBox 1: B", "box 2: X\nBOX 1: Y", "Box 1: A\r\nBox 2: B\r\n",
             "Box 1:ABC\nBox 1: DEF", "   ", "", "[1, 2]", '["a", 3]', "[\"x\"", "A\r\nB\r\r\n", "Box1:A B  C",
             "Box 1: A–B’C D", "just one line", "[]", "Box 12: x"]
    parse_raw = ["0xC0, 0xC7 ad", "C0C7ADE3D4ADBCE2FF", "zz", "C0C", "0XC0 0x0x", "", "C0\nC7\tAD"]
    names = [["FM.oZ.Bn", "D3n,E?q", "AAQU.o", "AVH?n"], ["ABC", "   ", "é", "AAAAA AA", "ABCDEFGHI"], ["A"] * 15, [],
             ["Rx5XxlIk"], ["a s s", "mass", "AAAA AAA", "", "é:ü", "xx  x", "ABC_", "Hi’–"], ["AAAA AAA"] * 12,
             [" ", "Z" * 9, "é" * 9]]
    for _ in range(60):
        names.append(["".join(r.choice(KEYBOARD_CHARS + "_é:~") for _ in range(r.randrange(0, 11)))
                      for _ in range(r.randrange(1, 16))])
    example = bytes.fromhex("C0C7ADE3D4ADBCE2FF" "BEA4E2B8BFACE5FFFF" "BBBBCBCFADE3FFFFFF" "BBD0C2ACE2")
    raws = [example, bytes.fromhex("BBFFBB" + "BB" * 5 + "FF"), bytes.fromhex("BB" * 9), bytes.fromhex("01" + "FF" * 8),
            bytes(0), bytes([0xFF] * 9 * 15), bytes.fromhex("F7" + "FF" * 8), bytes.fromhex("00" * 9)]
    for _ in range(20):
        raws.append(bytes(r.randrange(256) for _ in range(r.randrange(0, 60))))
    steps = ["Ab1A", "FM.oZ.Bn", "abc", "…’'–_ ", "", "é", "A:B", "♂♀?!"]
    steps += ["".join(r.choice(KEYBOARD_CHARS) for _ in range(r.randrange(1, 9))) for _ in range(40)]
    cursors = [(page, x, y, saved) for page, columns in enumerate(boxnames.COLUMNS) for x in range(columns + 1)
               for y in range(boxnames.BUTTONS if x == columns else boxnames.ROWS) for saved in range(boxnames.ROWS)]

    def check_names(values):
        boxes, general = boxnames.check_names(values)
        return {"boxes": [{"number": b.number, "name": b.name, "raw": b.raw.hex(), "issues": b.issues} for b in boxes],
                "general": general}

    return {
        "keys": [[c, boxnames.key_of(c)] for c in KEYBOARD_CHARS + "_–‐’ é:~A"],
        "encode_name": [[c, boxnames.encode_name(c).hex()] for c in KEYBOARD_CHARS + "_’"],
        "parse_names": [[text, both(boxnames.parse_names, text)] for text in parse],
        "parse_raw": [[text, both(lambda x: boxnames.parse_raw(x).hex(), text)] for text in parse_raw],
        "check_names": [[values, both(check_names, values)] for values in names],
        "check_raw": [[raw.hex(), both(boxnames.check_raw, raw)] for raw in raws],
        "typing_steps": [[text, both(boxnames.typing_steps, text)] for text in steps],
        "press": [[list(c), key, list(boxnames.press(c, key))] for c in cursors for key in boxnames.MOVES],
    }


def _moves(r: random.Random, species_id: int, level: int) -> list[int]:
    learnable = sorted(species.learnable_moves(species_id, level))
    return r.sample(learnable, r.randrange(1, min(4, len(learnable)) + 1))


def random_fields(r: random.Random, with_pid: bool = False) -> dict:
    species_id = r.choice(SPECIES)
    level = r.randrange(1, 101)
    fields = {"species": species_id, "level": level, "ot_name": r.choice(["RED", "Ash", "BLUE", "May", "LEAF"]),
              "tid": r.randrange(65536), "sid": r.randrange(65536)}
    if with_pid:
        fields["pid"] = r.getrandbits(32)
    else:
        if r.random() < 0.6:
            fields["nature"] = r.randrange(25)
        if r.random() < 0.3:
            fields["shiny"] = r.random() < 0.5
        ratio = species.info(species_id)["gender_ratio"]
        if r.random() < 0.4 and ratio not in (0, 254, 255):
            fields["gender"] = r.choice("MF")
        if r.random() < 0.3 and species.info(species_id)["abilities"][1]:
            fields["ability"] = r.randrange(2)
        if species_id == UNOWN and r.random() < 0.7:
            fields["letter"] = r.randrange(28)
    if r.random() < 0.7:
        fields["ivs"] = {k: r.randrange(32) for k in STATS}
    if r.random() < 0.5:
        evs = dict.fromkeys(STATS, 0)
        for stat in r.sample(STATS, 3):
            evs[stat] = r.randrange(0, 171)
        fields["evs"] = evs
    if r.random() < 0.5:
        fields["moves"] = _moves(r, species_id, level)
    for key, choices in (("held_item", [0, 0, 139, 195, 13, 211, 339, 259]), ("ball", [1, 4, 12]), ("friendship", [0, 70, 255]),
                         ("met_location", [0x58, 0x10, 0xFE, 201, 0xD0]), ("ot_gender", [0, 1]), ("language", [2, 1, 5]),
                         ("met_game", [4, 5, 3])):
        if r.random() < 0.3:
            fields[key] = r.choice(choices)
    if r.random() < 0.3:
        fields["nickname"] = r.choice(["SPARKY", "Bob", "x", "ABCDEFGHIJ"])
    if r.random() < 0.3:
        fields["party"] = True
    if r.random() < 0.1:
        fields["version"] = "leafgreen"
    if r.random() < 0.2:
        fields["pokerus"] = r.choice([0, 0x12, 0x10, 0xFF])
    if r.random() < 0.2:
        fields["ribbons"] = r.choice([0, 1 << 15, 0x7FFF, (1 << 27) - 1])
    if r.random() < 0.2:
        fields["fateful"] = r.random() < 0.5
    if r.random() < 0.15:
        fields["auto_met"] = False
    return fields


def built_mons(r: random.Random, count: int) -> list[Pk3]:
    out = []
    while len(out) < count:
        try:
            out.append(builder.build(random_fields(r, with_pid=r.random() < 0.5), rng=random.Random(r.getrandbits(32)))[0])
        except ValueError:
            continue
    return out


def _builder(r: random.Random) -> dict:
    initial = [[s, lv, builder.initial_moves(s, lv)] for s in r.sample(SPECIES, 40) for lv in (1, 5, 36, 100)]

    def run(fields, base, seed):
        mon, notes = builder.build(fields, base=Pk3(bytes.fromhex(base)) if base else None,
                                   rng=random.Random(seed) if seed is not None else None)
        return {"data": bytes(mon.data).hex(), "notes": notes}

    explicit = []
    for _ in range(150):
        fields = random_fields(r, with_pid=True)
        explicit.append({"fields": fields, "base": None, "seed": None, **both(run, fields, None, None)})
    seeded = []
    for _ in range(120):
        fields = random_fields(r)
        seed = r.getrandbits(r.choice([8, 32, 53]))   # JS JSON holds integers up to 2^53
        seeded.append({"fields": fields, "base": None, "seed": seed, **both(run, fields, None, seed)})
    edits = []
    for base in built_mons(r, 60):
        change = r.choice([
            {"evs": dict.fromkeys(STATS, 10)}, {"nature": r.randrange(25)}, {"level": r.randrange(1, 101)},
            {"species": r.choice(SPECIES)}, {"party": True}, {"party": False}, {"nickname": "EDITED"},
            {"moves": [33]}, {"shiny": True}, {"pid": r.getrandbits(32)}, {"tid": 1, "sid": 2}, {"held_item": 0},
            {"ability": 1}, {"gender": "F"}, {"species": 151}, {"species": 410, "fateful": False},
            {"pokerus": 0x12}, {"ribbons": 1 << 15}, {"fateful": True},
            {"species": 1, "met_location": 0x58}, {"met_location": 0x65}, {"species": 263},
            {"species": 4, "auto_met": False}, {"species": 16, "met_level": 3},
        ])
        seed = r.getrandbits(32)
        edits.append({"fields": change, "base": bytes(base.data).hex(), "seed": seed,
                      **both(run, change, bytes(base.data).hex(), seed)})
    bad_base = bytes(valid_mon().data)
    bad_base = bytearray(bad_base)
    struct.pack_into("<H", bad_base, 0x20, 0)
    errors = [dict(species=1, level=5), dict(species=1, level=5, ot_name="RED", ability=1),
              dict(species=128, level=5, ot_name="RED", gender="F"), dict(species=0, level=5, ot_name="RED"),
              dict(species=412, level=5, ot_name="RED"), dict(species=252, level=5, ot_name="RED"),
              dict(species=1, ot_name="RED"), dict(species=1, level=0, ot_name="RED"), dict(species=1, level=101, ot_name="RED"),
              dict(species=1, level=5, ot_name="RED", tid=70000), dict(species=1, level=5, ot_name="RED", sid=-1),
              dict(species=1, level=5, ot_name="RED", nature=25), dict(species=1, level=5, ot_name="RED", ivs=dict.fromkeys(STATS, 32)),
              dict(species=1, level=5, ot_name="RED", ivs={**dict.fromkeys(STATS, 3), "speed": "40"}),
              dict(species=1, level=5, ot_name="RED", evs=dict.fromkeys(STATS, 256)),
              dict(species=1, level=5, ot_name="RED", evs=dict.fromkeys(STATS, 100)),
              dict(species=1, level=5, ot_name="RED", moves=[33, 33]), dict(species=1, level=5, ot_name="RED", moves=[0, None]),
              dict(species=1, level=5, ot_name="RED", moves=[1, 2, 3, 4, 5]), dict(species=1, level=5, ot_name="RED", moves=[400]),
              dict(species=1, level=5, ot_name="RED", moves=["0"]), dict(species=1, level=5, ot_name="RED", nickname="é~"),
              dict(species=1, level=5, ot_name="ABCDEFGH"), dict(species=132, level=5, ot_name="RED", gender="M"),
              dict(species=1, level=5, ot_name="RED", pokerus=256), dict(species=1, level=5, ot_name="RED", pokerus=-1),
              dict(species=1, level=5, ot_name="RED", ribbons=1 << 27), dict(species=151, level=5, ot_name="RED"),
              dict(species=410, level=5, ot_name="RED", fateful=0)]
    error_cases = [{"fields": f, "base": None, "seed": 1, **both(run, f, None, 1)} for f in errors]
    edit_errors = [{"fields": {"level": 3}, "base": bad_base.hex(), "seed": 1, **both(run, {"level": 3}, bad_base.hex(), 1)},
                   {"fields": {"species": 4}, "base": bad_base.hex(), "seed": 1, **both(run, {"species": 4}, bad_base.hex(), 1)}]

    # The TS side only checks the requested properties.
    properties = []
    while len(properties) < 150:
        fields = random_fields(r)
        try:
            mon, _ = builder.build(fields, rng=random.Random(r.getrandbits(32)))
        except ValueError:
            continue
        want = {k: fields[k] for k in ("nature", "shiny", "gender", "ability", "letter") if k in fields}
        properties.append({"fields": fields, "want": want, "got": {
            "nature": mon.personality % 25, "shiny": mon.is_shiny, "gender": species.gender(mon.species, mon.personality),
            "ability": mon.ability_num, "letter": unown_letter(mon.personality)}})

    choose = []
    for _ in range(80):
        s = r.choice(SPECIES + [UNOWN] * 10)
        wanted = {"nature": r.choice([None, r.randrange(25)]), "shiny": r.choice([None, True, False]),
                  "gender": r.choice([None, "M", "F"]), "ability": r.choice([None, 0, 1]),
                  "letter": r.choice([None, r.randrange(28)])}
        tid, sid, seed = r.randrange(65536), r.randrange(65536), r.getrandbits(32)
        choose.append({"species": s, "tid": tid, "sid": sid, "want": wanted, "seed": seed,
                       **both(lambda: builder.choose_pid(s, tid, sid, rng=random.Random(seed), **wanted))})
    streams = []
    for seed in [0, 1, 2, 42, 2**32 - 1, 2**32, 2**40 + 7, 2**53 - 1, 123456789]:
        g = random.Random(seed)
        streams.append({"seed": seed, "bits16": [g.getrandbits(16) for _ in range(1300)]})
    return {"initial_moves": initial, "explicit": explicit, "seeded": seeded, "edits": edits, "errors": error_cases + edit_errors,
            "properties": properties, "choose_pid": choose, "streams": streams}


def _rawpk() -> list[bytes]:
    path = ROOT / "rawpk.txt"
    if not path.is_file():
        return []
    out = []
    for block in re.split(r"\n_{20,}\n", path.read_text(encoding="utf-8")):
        match = re.search(r"Hex code:\s*\n(.*?)\n\s*\n", block, re.S)
        try:
            data = bytes.fromhex("".join(match.group(1).split())) if match else b""
        except ValueError:
            continue
        if len(data) == 80:
            out.append(data)
    return out


def _base64box(r: random.Random, mons: list[Pk3]) -> dict:
    zero = bytes(80)
    datas = [zero, bytes(range(80)), bytes([0xFF] * 80),
             bytes.fromhex("4835057B4B4E0000C4C3CCBBBDC2C3FF04000202D1C3CDC2C7C5CC0006B70000"
                           "037B057B037B057B037B057B0384005A0862EF71037B057B9A7AAF7B9F7B057B"
                           "031F057B5E7B147A9F7B057B1A710F7B"),
             base64.b64decode("Rx5XxlIk") + bytes(74),
             base64.b64decode(("A" * 24 + "??AgLO7ebj4tn?AB" + "A" * 67).replace("?", "/") + "=")]
    datas += _rawpk()
    datas += [m.to_box().to_raw() for m in mons]
    rng7 = random.Random(7)
    datas += [rng7.randbytes(80) for _ in range(200)]
    datas += [r.randbytes(80) for _ in range(100)]
    encode = []
    for index, data in enumerate(datas):
        encode.append([data.hex(), True, [], base64box.encode(data).as_dict()])
        if index % 4 == 0:
            encode.append([data.hex(), False, [], base64box.encode(data, switch_safe=False).as_dict()])
        if index % 2 == 0:
            convert = r.sample(range(1, 15), r.randrange(1, 6))
            encode.append([data.hex(), True, convert, base64box.encode(data, convert=tuple(convert)).as_dict()])
        if index % 9 == 0:
            convert = list(range(1, 15))
            encode.append([data.hex(), index % 2 == 0, convert,
                           base64box.encode(data, switch_safe=index % 2 == 0, convert=tuple(convert)).as_dict()])
    errors = [[bytes(79).hex(), True, []], [bytes(81).hex(), True, []], [zero.hex(), True, [15]], [zero.hex(), True, [0]],
              [zero.hex(), True, [3, 20]]]
    error_cases = [[d, s, c, both(lambda d=d, s=s, c=c: base64box.encode(bytes.fromhex(d), s, tuple(c)).as_dict())]
                   for d, s, c in errors]
    decode = []
    for data, _, _, result in encode[::6]:
        decode.append([result["boxes"], data])
        aliased = [b.replace("’", "'").replace("-", "–") for b in result["boxes"]]
        decode.append([aliased, data])
    decode_extra = [["AB:C"], ["A"], ["AB"], ["ABC"], ["ABCDE"], [], ["", ""], ["..-…", "“”‘’", "♂♀,/"], ["𠝹"], ["a b"]]
    decode_cases = [[boxes, both(lambda b=boxes: base64box.decode(b).hex())] for boxes in decode_extra]
    is_code = [[b, base64box.is_base64_code(b)] for b in
               [base64box.encode(zero).boxes, ["FM.oZ.Bn"], [], ["A" * 107], ["A" * 106], ["A" * 107 + ":"],
                ["A" * 8] * 13 + ["A" * 3], ["A" * 8] * 13 + ["AA’"], ["A" * 7] * 15 + ["AA"]]]
    return {"encode": encode, "errors": error_cases, "decode": decode, "decode_cases": decode_cases, "is_code": is_code}


def _codeplan(mons: list[Pk3]) -> list:
    out = []
    for index, mon in enumerate(mons):
        if not validate.valid_species(mon.species):
            continue
        for strategy in ("wild", "egg"):
            entry = {"data": bytes(mon.data).hex(), "strategy": strategy}
            if index % 3 == 0:
                entry.update(both(codeplan.plan, mon, strategy))
            else:
                entry["pt"] = {"ok": True, "result": codeplan.plan(mon, strategy)}
            out.append(entry)
    mon = mons[0]
    for strategy in ("x", None, 3):
        out.append({"data": bytes(mon.data).hex(), "strategy": strategy, **both(codeplan.plan, mon, strategy)})
    return out


def _recipe(r: random.Random, mons: list[Pk3]) -> dict:
    trades = []
    for index, mon in enumerate(mons):
        game = r.choice(["firered", "leafgreen"])
        save_as = r.choice([None, "recebido.pk3", "x.pk3"])
        trades.append({"data": bytes(mon.data).hex(), "game": game, "save_as": save_as,
                       **both(recipe.trade, mon, game, save_as, NOW)})
    specials = []
    for species_id, item in ((64, 0), (64, 195), (95, 0), (95, 199), (123, 199), (61, 187), (366, 0), (366, 192), (75, 0), (93, 0)):
        mon, _ = builder.build({"species": species_id, "level": 30, "ot_name": "RED", "held_item": item, "party": True},
                               rng=random.Random(species_id))
        specials.append(mon)
        trades.append({"data": bytes(mon.data).hex(), "game": "firered", "save_as": "recebido.pk3",
                       **both(recipe.trade, mon, "firered", "recebido.pk3", NOW)})
    broken = Pk3(bytes(mons[0].data))
    broken.moves = (0, 0, 0, 0)
    for mon, game in ((broken, "firered"), (mons[1], "emerald"), (mons[1], None)):
        trades.append({"data": bytes(mon.data).hex(), "game": game, "save_as": None, **both(recipe.trade, mon, game, None, NOW)})

    good = recipe.trade(specials[0], save_as="recebido.pk3", now=NOW)
    def variant(**changes):
        data = json.loads(json.dumps(good))
        for path, value in changes.items():
            target = data
            keys = path.split("__")
            for key in keys[:-1]:
                target = target[key]
            if value is KeyError:
                del target[keys[-1]]
            else:
                target[keys[-1]] = value
        return json.dumps(data)
    other = Pk3(bytes(specials[1].to_box().data))
    texts = [json.dumps(good), json.dumps(recipe.trade(specials[2], now=NOW)), variant(receive=None), variant(receive=KeyError),
             "{}", "[]", "null", "x", "{\"a\": 1,}", "{\n\"format\": \n}", variant(version=2), variant(version=True),
             variant(version="1"), variant(version=KeyError), variant(action="swap"), variant(action=KeyError),
             variant(game__title="emerald"), variant(game__revision=9), variant(game__language="jpn"), variant(game=None),
             variant(game=[]), variant(offer__format="pk4"), variant(offer=None), variant(offer__data="zz"),
             variant(offer__data="00" * 10), variant(offer__data=KeyError), variant(offer__species=65),
             variant(offer__species=True), variant(offer__data=other.to_raw().hex()),
             variant(offer__data=other.to_raw().hex(), offer__species=other.species), variant(receive={"save_as": 3}),
             variant(receive="a.pk3"), variant(receive={}), variant(offer__data=("01" * 80)),
             variant(offer__data=" ".join(bytes.fromhex(good["offer"]["data"]).hex()[i:i + 2] for i in range(0, 160, 2)))]

    def load(text):
        data, mon = recipe.load(text)
        return {"recipe": data, "mon": bytes(mon.data).hex()}

    loads = [{"text": text, "json_error": _json_error(text), **both(load, text)} for text in texts]
    return {"trade": trades, "load": loads}


def _json_error(text: str) -> bool:
    try:
        json.loads(text)
        return False
    except json.JSONDecodeError:
        return True


def _call(name: str, params: dict, lang: str) -> dict:
    reply = json.loads(web.call(name, json.dumps(params, ensure_ascii=False), lang))
    if reply["ok"] and name == "recipe_trade":
        reply["result"]["created"] = None   # wall clock date; the TS test equalizes the field
    return reply


def _json_failure(name: str, reply: dict) -> bool:
    """JSON syntax error: the detail comes from the parser (Python or JavaScript) and is not compared."""
    return not reply["ok"] and name in ("box_names", "recipe_check") and "JSON" in reply["error"]


def _broken_mons(mons: list[Pk3]) -> list[tuple[bytes, str]]:
    """(bytes, form) pairs."""
    out = []
    base = Pk3(bytes(mons[0].to_box().data))
    changes = [
        lambda m: setattr(m, "species", 0), lambda m: setattr(m, "species", 500), lambda m: setattr(m, "moves", (0, 0, 0, 0)),
        lambda m: setattr(m, "moves", (33, 33, 0, 0)), lambda m: setattr(m, "ball", 0), lambda m: setattr(m, "language", 9),
        lambda m: setattr(m, "evs", dict.fromkeys(STATS, 200)), lambda m: setattr(m, "held_item", 400),
        lambda m: setattr(m, "experience", 99_999_999), lambda m: m.data.__setitem__(0x13, m.data[0x13] | 1),
        lambda m: setattr(m, "ability_num", 1), lambda m: m.data.__setitem__(slice(8, 18), bytes([0xFF] * 10)),
        lambda m: setattr(m, "species", 252),
    ]
    for change in changes:
        mon = Pk3(bytes(base.data))
        change(mon)
        mon.update_checksum()
        out.append((mon.to_raw(), "game"))
        out.append((bytes(mon.data), "plain"))
    bad_checksum = Pk3(bytes(base.data))
    bad_checksum.data[0x20] ^= 0xFF
    out.append((bad_checksum.to_raw()[:0x1C] + b"\x00\x00" + bad_checksum.to_raw()[0x1E:], "game"))
    out.append((bytes([1] * 80), "?"))
    out.append((bytes(80), "?"))
    out.append((bytes([1] * 100), "?"))
    party = valid_mon(size=100)
    out.append((party.to_raw(), "game"))
    return out


def _services(r: random.Random, mons: list[Pk3]) -> list:
    cases = []

    def add(name, params, langs=("pt",)):
        for lang in langs:
            reply = _call(name, params, lang)
            cases.append([name, params, lang, reply, _json_failure(name, reply)])

    for index, mon in enumerate(mons[:30]):
        raw, plain = mon.to_raw(), bytes(mon.data)
        add("pk3_inspect", {"hex": raw.hex(" ") if index % 2 else raw.hex().upper()}, ("pt", "en") if index % 5 == 0 else ("pt",))
        if index % 3 == 0:
            add("pk3_inspect", {"hex": plain.hex()})
    for data, _ in _broken_mons(mons):
        add("pk3_inspect", {"hex": data.hex()}, ("pt", "en"))
    add("pk3_inspect", {"hex": valid_mon().to_raw().hex("\n")}, ("pt", "en"))
    for params in ({"hex": "00" * 10}, {"hex": "xyz"}, {}, {"hex": None}, {"hex": "0"}, {"hex": 5}, {"hex": "00 0"}):
        add("pk3_inspect", params, ("pt", "en"))

    add("lists", {}, ("pt", "en"))
    for s in r.sample(SPECIES, 25) + [1, 6, 64, 133, 201, 292, 386, 411]:
        add("species_info", {"species": s, "level": r.choice([None, 1, 36, 100, "50"])}, ("pt",))
    for params in ({}, {"species": 0}, {"species": 252}, {"species": 412}, {"species": 413}, {"species": "abc"},
                   {"species": 1, "level": 0}, {"species": 1, "level": "x"}, {"species": " 25 "}, {"species": 1.7},
                   {"species": True}, {"species": [1]}, {"species": ""}):
        add("species_info", params, ("pt", "en"))

    build = {"species": 6, "level": 36, "nature": "Timid", "ivs": [31] * 6, "evs": [4, 0, 0, 252, 252, 0],
             "ot_name": "RED", "tid": 12345, "sid": 54321, "moves": [53, 19], "shiny": True}
    created = _call("pk3_build", {"fields": build, "seed": 1}, "pt")["result"]["mon"]
    add("pk3_build", {"fields": build, "seed": 1}, ("pt", "en"))
    add("pk3_build", {"base": created["files"]["game"], "fields": {"nickname": "BLAZE", "evs": [0] * 6}})
    add("pk3_build", {"base": created["files"]["plain"], "fields": {"nature": "adamant"}, "seed": 9})
    add("pk3_build", {"base": created["files"]["plain"], "fields": {"party": True, "level": 50}, "seed": 9})
    for _ in range(40):
        fields = random_fields(r, with_pid=r.random() < 0.3)
        if "nature" in fields and r.random() < 0.5:
            fields["nature"] = NATURES[fields["nature"]]
        if "pid" in fields and r.random() < 0.5:
            fields["pid"] = r.choice(["{:08X}", "0x{:x}", " {:x} "]).format(fields["pid"])
        for key in ("ivs", "evs"):
            if key in fields and r.random() < 0.5:
                fields[key] = [fields[key][k] for k in STATS]
        if "letter" in fields and r.random() < 0.5:
            fields["letter"] = UNOWN_LETTERS[fields["letter"]]
        add("pk3_build", {"fields": fields, "seed": r.getrandbits(32)}, ("pt", "en") if r.random() < 0.2 else ("pt",))
    for params in ({"fields": {"species": 1, "level": 5}}, {"fields": dict(build, species=128, gender="F", shiny=None)},
                   {"fields": dict(build, nature="Bogus")}, {"fields": dict(build, pid="xyz")}, {"fields": dict(build, pid="1FFFFFFFF")},
                   {"fields": dict(build, ivs=[1, 2])}, {"fields": dict(build, evs=[255] * 6)}, {"fields": dict(build, letter="AB", species=201)},
                   {"fields": dict(build, letter="#", species=201)}, {"fields": dict(build, letter="?", species=201), "seed": 3},
                   {"fields": dict(build, species=412)}, {"fields": dict(build, level=0)}, {"fields": None},
                   {"fields": dict(build, moves=[33, 33])}, {"base": "00" * 80, "fields": {}}, {"base": "zz", "fields": {}},
                   {"fields": dict(build, pid=-1)}, {"fields": dict(build, pid="-1")}, {"fields": dict(build, pid="0x_1f")},
                   {"fields": dict(build, pid=True)}, {"fields": dict(build, pid="")}, {"fields": dict(build, ivs=[31] * 5 + ["x"])}):
        add("pk3_build", {"seed": 5, **params}, ("pt", "en"))

    for index, mon in enumerate(mons[:30]):
        add("code_plan", {"hex": mon.to_raw().hex(), "strategy": "wild" if index % 2 else "egg"}, ("pt", "en") if index % 6 == 0 else ("pt",))
    add("code_plan", {"hex": mons[0].to_raw().hex()})
    for params in ({"hex": bytes(80).hex()}, {"hex": mons[0].to_raw().hex(), "strategy": "boat"}, {"hex": mons[0].to_raw().hex(), "strategy": None},
                   {"hex": "00"}):
        add("code_plan", params, ("pt", "en"))

    for index, mon in enumerate(mons[:20]):
        add("recipe_trade", {"hex": mon.to_raw().hex(), "save_as": r.choice(["", "  recebido.pk3 ", None, "out.pk3"]),
                             "game": r.choice(["firered", "leafgreen"])}, ("pt", "en") if index % 5 == 0 else ("pt",))
    trade_text = json.dumps(recipe.trade(mons[0], save_as="recebido.pk3", now=NOW))
    add("recipe_check", {"text": trade_text}, ("pt", "en"))
    for params in ({"text": "{}"}, {}, {"text": None}, {"text": json.dumps(dict(json.loads(trade_text), version=3))},
                   {"hex": mons[0].to_raw().hex(), "game": "ruby"}):
        name = "recipe_trade" if "hex" in params else "recipe_check"
        add(name, params, ("pt", "en"))
    broken = Pk3(bytes(mons[0].data))
    broken.moves = (0, 0, 0, 0)
    add("recipe_trade", {"hex": broken.to_raw().hex()}, ("pt", "en"))

    raw = "C0C7ADE3D4ADBCE2FF BEA4E2B8BFACE5FFFF"
    for params in ({"names": '["FM.oZ.Bn", "D3n,E?q"]', "raw": raw}, {"names": '["FM.oZ.Bm", "D3n,E?q"]', "raw": raw},
                   {"raw": "C0C7ADE3D4ADBCE2FF"}, {"names": "ABC\né"}, {"names": '["Rx5XxlIk"]'}, {"names": ""},
                   {"names": "Box 1: A\nBox 3: B"}, {"names": "[1]"}, {"names": "[\"x\""}, {"raw": "zz"}, {"names": "A\nB\nC", "raw": raw},
                   {"names": "Box 1: F M . o Z . B n [FM.oZ.Bn]\nBox 2: _ _ _ _ _ F 9 q"}, {"raw": "01" + "FF" * 8},
                   {"names": "\n".join(["AAAA AAA"] * 15)}, {"names": None}, {"names": 12}):
        add("box_names", params, ("pt", "en"))
    for index, mon in enumerate(mons[:15]):
        result = base64box.encode(mon.to_box().to_raw()).as_dict()
        boxes = list(result["boxes"])
        add("box_names", {"names": json.dumps(boxes, ensure_ascii=False)}, ("pt", "en") if index % 5 == 0 else ("pt",))
        box = r.randrange(13)
        typo = list(boxes)
        typo[box] = ("B" if typo[box][0] != "B" else "C") + typo[box][1:]
        add("box_names", {"names": "\n".join(typo)})
    add("box_names", {"names": json.dumps(["A" * 8] * 13 + ["AA’"], ensure_ascii=False)})
    add("box_names", {"names": json.dumps(["A" * 8] * 13 + ["AAA"])}, ("pt", "en"))

    for index, mon in enumerate(mons[:40]):
        params = {"hex": mon.to_raw().hex() if index % 2 else bytes(mon.data).hex()}
        if index % 3 == 0:
            params["switch_safe"] = index % 2 == 0
        if index % 4 == 0:
            params["convert"] = r.sample(range(1, 15), r.randrange(1, 4))
        add("base64_boxes", params, ("pt", "en") if index % 8 == 0 else ("pt",))
    for params in ({"hex": "01" * 80}, {"hex": mons[0].to_raw().hex(), "convert": [15]}, {"hex": mons[0].to_raw().hex(), "convert": "35"},
                   {"hex": mons[0].to_raw().hex(), "convert": ["x"]}, {"hex": mons[0].to_raw().hex(), "switch_safe": None},
                   {"hex": mons[0].to_raw().hex(), "switch_safe": 0, "convert": []}, {"hex": _broken_mons(mons)[4][0].hex()}):
        add("base64_boxes", params, ("pt", "en"))
    return cases


def build() -> dict:
    r = random.Random(20260929)
    mons = built_mons(r, 90)
    return {
        "badwords": _badwords(r),
        "boxnames": _boxnames(r),
        "base64box": _base64box(r, mons),
        "builder": _builder(r),
        "codeplan": _codeplan(mons[:20]),
        "recipe": _recipe(r, mons[:30]),
        "services": _services(r, mons),
    }
