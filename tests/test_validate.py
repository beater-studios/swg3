import struct

from swg3.gen3 import pk3, validate
from swg3.gen3.pk3 import Pk3


def valid_mon(size=pk3.BOX_SIZE):
    plain = bytearray(size)
    struct.pack_into("<II", plain, 0, 0x12345678, (54321 << 16) | 12345)
    mon = Pk3(plain)
    mon.nickname = "BULBASAUR"
    mon.ot_name = "RED"
    mon.language = 2
    mon.has_species = True
    mon.species = 1
    mon.moves = (33, 73, 0, 0)   # Tackle lv 1, Leech Seed lv 7
    mon.pp = (35, 10, 0, 0)
    mon.experience = 250           # level 7 (medium-slow)
    mon.ball = 4
    mon.met_level = 5
    return Pk3.from_raw(mon.to_raw())


def fields(mon):
    return {i.field for i in validate.check(mon) if i.level == "error"}


def test_valid_mon_passes():
    mon = valid_mon()
    assert validate.check(mon) == []
    assert validate.is_valid(mon)


def test_species_limits():
    for species in (0, 252, 276, 412, 500):
        mon = valid_mon()
        mon.species = species
        assert "species" in fields(Pk3.from_raw(mon.to_raw())), species
    assert validate.valid_species(251) and validate.valid_species(411)


def test_checksum_mismatch():
    mon = valid_mon()
    mon.data[0x1C] ^= 0xFF
    assert "checksum" in fields(mon)


def test_moves_items_evs_ball_language():
    cases = {
        "moves": lambda m: setattr(m, "moves", (33, 33, 0, 0)),
        "held_item": lambda m: setattr(m, "held_item", 375),
        "evs": lambda m: setattr(m, "evs", dict(zip(pk3.STATS, (255, 255, 1, 0, 0, 0)))),
        "ball": lambda m: setattr(m, "ball", 0),
        "language": lambda m: setattr(m, "language", 6),
    }
    for field, mutate in cases.items():
        mon = valid_mon()
        mutate(mon)
        assert field in fields(Pk3.from_raw(mon.to_raw())), field


def test_no_moves_and_empty_name():
    mon = valid_mon()
    mon.moves = (0, 0, 0, 0)
    mon.data[0x08] = 0xFF
    assert {"moves", "nickname"} <= fields(Pk3.from_raw(mon.to_raw()))


def test_party_checks():
    mon = valid_mon(pk3.PARTY_SIZE)
    assert {"level", "stats"} <= fields(mon)


def test_species_coherence():
    from swg3.gen3 import species

    mon = valid_mon()
    assert species.mon_level(mon) == 7
    mon.experience = 10**7
    assert "experience" in fields(Pk3.from_raw(mon.to_raw()))
    mon = valid_mon()
    mon.moves = (33, 74, 0, 0)   # Growth only at level 32
    warns = [i for i in validate.check(Pk3.from_raw(mon.to_raw())) if i.level == "warning"]
    assert any(i.field == "moves" and "GROWTH" in i.message for i in warns)
    assert all("o que a espécie aprende" in i.message for i in warns if i.field == "moves")


def warnings(mon):
    return {i.field for i in validate.check(mon) if i.level == "warning"}


def test_met_level_and_region():
    mon = valid_mon()
    mon.met_level = 20
    assert "met_level" in warnings(Pk3.from_raw(mon.to_raw()))
    # FireRed with a Hoenn location (0, Littleroot) warns; with a Kanto one (88, Pallet), it does not.
    mon = valid_mon()
    mon.met_game = 4
    mon.met_location = 0
    assert "met_location" in warnings(Pk3.from_raw(mon.to_raw()))
    mon.met_location = 88
    assert "met_location" not in warnings(Pk3.from_raw(mon.to_raw()))
    mon.met_game = 2
    assert "met_location" in warnings(Pk3.from_raw(mon.to_raw()))
    mon.met_location = 0xFE
    assert "met_location" not in warnings(Pk3.from_raw(mon.to_raw()))


def extra_warnings(mon):
    return [i for i in validate.check(Pk3.from_raw(mon.to_raw())) if i.level == "warning"]


def test_ribbons_follow_origin_game():
    from swg3.gen3 import ribbons
    mon = valid_mon()
    mon.met_game = 4   # FireRed: Champion only
    mon.met_location = validate.KANTO_MAPSEC_START
    mon.ribbons = ribbons.encode(flags=["champion"])
    assert extra_warnings(mon) == []
    mon.ribbons = ribbons.encode({"cool": 4}, ["effort", "marine"])
    texts = [i.message for i in extra_warnings(mon)]
    assert len(texts) == 3 and any("Marine" in m for m in texts) and any("Effort" in m for m in texts)
    mon.met_game = 3   # Emerald: contest and Effort are fine, Marine was still never distributed
    mon.met_location = 0
    assert [i.message for i in extra_warnings(mon)] == ["Marine Ribbon nunca foi distribuída"]
    mon.ribbons = 5    # Cool with value 5
    assert any("máximo 4" in i.message for i in extra_warnings(mon))
    assert ribbons.decode(ribbons.encode({"tough": 2}, ["world"])) == {
        "contest": {"cool": 0, "beauty": 0, "cute": 0, "smart": 0, "tough": 2}, "flags": ["world"], "unused": 0}


def test_ribbons_setter_keeps_fateful():
    mon = valid_mon()
    mon.fateful = True
    mon.ribbons = 0x7FFFFFFF
    assert mon.fateful and mon.ribbons == 0x7FFFFFFF
    mon.ribbons = 0
    mon.fateful = False
    assert mon.ribbons == 0 and not mon.fateful


def test_pokerus_and_fateful_warnings():
    mon = valid_mon()
    mon.met_game = 4
    mon.met_location = validate.KANTO_MAPSEC_START
    mon.pokerus = 0x12
    assert [i.field for i in extra_warnings(mon)] == ["pokerus"]
    mon.met_game = 3
    mon.met_location = 0
    assert extra_warnings(mon) == []
    mon = valid_mon()
    mon.species = validate.SPECIES_MEW
    assert "fateful" in [i.field for i in extra_warnings(mon)]
    mon.fateful = True
    assert "fateful" not in [i.field for i in extra_warnings(mon)]


def test_pokerus_byte_follows_game_rule():
    mon = valid_mon()
    mon.met_game = 3
    for value in (0, 0x12, 0x11, 0x10, 0x74, 0x7F & 0x70, 0xF4):
        mon.pokerus = value
        assert "pokerus" not in [i.field for i in extra_warnings(mon)], hex(value)
    for value in (0x01, 0x13, 0x85, 0x80 | 1, 0x75):
        mon.pokerus = value
        assert "pokerus" in [i.field for i in extra_warnings(mon)], hex(value)


def test_met_locations_by_game():
    assert validate.met_locations(15) is None
    frlg = validate.met_locations(4)
    assert 88 in frlg and 0 not in frlg and 200 not in frlg and 0xFD in frlg
    assert 200 in validate.met_locations(3) and 200 not in validate.met_locations(1)
    mon = valid_mon()
    mon.met_game, mon.met_location = 1, 201          # Faraway Island in Sapphire
    assert any("só do Emerald" in i.message for i in extra_warnings(mon))
    mon.met_game = 3
    assert not [i for i in extra_warnings(mon) if i.field == "met_location"]
    mon.met_game = 4                                  # 201 in FR/LG
    assert any("não existe no FireRed" in i.message for i in extra_warnings(mon))
    mon.met_game, mon.met_location = 2, 0x3A         # Battle Frontier in Ruby: there it is the Battle Tower
    assert any("Battle Tower" in i.message for i in extra_warnings(mon) if i.field == "met_location")
    mon.met_game = 3
    assert not [i for i in extra_warnings(mon) if i.field == "met_location"]
    from swg3.gen3 import species
    assert species.map_section(201, 3) == "FARAWAY_ISLAND" and species.map_section(88, 3) == "PALLET_TOWN"


def test_held_item_must_be_holdable():
    mon = valid_mon()
    mon.held_item = 68                                # Rare Candy
    assert not [i for i in extra_warnings(mon) if i.field == "held_item"]
    for item in (339, 259):                           # HM01, Mach Bike
        mon.held_item = item
        assert [i for i in extra_warnings(mon) if i.field == "held_item"], item


def test_unown_letter_by_tanoby_chamber():
    from swg3.gen3 import builder, encounters
    from swg3.gen3.pk3 import UNOWN_LETTERS, unown_letter
    import random
    # Letters of each chamber, from sUnownLetterSlots: Monean gives A and ?, Rixy gives B, M, V, W and X.
    assert [UNOWN_LETTERS[i] for i in encounters.unown_letters(4, 188)] == ["A", "?"]
    assert [UNOWN_LETTERS[i] for i in encounters.unown_letters(4, 193)] == ["B", "M", "V", "W", "X"]
    assert encounters.unown_letters(4, 88) is None and encounters.unown_letters(3, 188) is None
    base = {"species": 201, "level": 30, "ot_name": "RED", "tid": 1, "sid": 2, "met_game": 4}
    mon, _ = builder.build({**base, "letter": UNOWN_LETTERS.index("B")}, rng=random.Random(1))
    assert mon.met_location == 193
    for seed in range(20):
        mon, _ = builder.build({**base, "met_location": 194}, rng=random.Random(seed))
        assert UNOWN_LETTERS[unown_letter(mon.personality)] in "Z!"
    assert not [i for i in validate.check(mon) if "Unown" in i.message]
    mon, _ = builder.build({**base, "letter": UNOWN_LETTERS.index("B"), "met_location": 188}, rng=random.Random(2))
    issues = [i for i in validate.check(mon) if i.field == "pid" and "Unown" in i.message]
    assert issues and "lá saem A, ?" in issues[0].message


def _moves_issues(fields):
    import random
    from swg3.gen3 import builder
    mon, _ = builder.build({"ot_name": "RED", "tid": 1, "sid": 2, "met_game": 4, **fields}, rng=random.Random(3))
    return [(i.level, i.message) for i in validate.check(mon) if i.field == "moves"]


def test_moves_by_caught_form():
    mirror, gust = 119, 16   # MOVE_MIRROR_MOVE, MOVE_GUST
    # Pidgeotto caught at 29 (Route 13): never a Pidgey, which learns Mirror Move at 47; Pidgeotto only at 52.
    caught = _moves_issues({"species": 17, "level": 50, "met_location": 113, "met_level": 29, "moves": [mirror, gust]})
    assert any("só a pré-evolução aprende" in m and "PIDGEOTTO" in m for _, m in caught)
    # Caught as Pidgey (Route 1, level 2): could have been a Pidgey at 47.
    as_pidgey = _moves_issues({"species": 17, "level": 50, "met_location": 101, "met_level": 2, "moves": [mirror, gust]})
    assert not as_pidgey
    assert not _moves_issues({"species": 3, "level": 50, "moves": [338, 22]})


def test_xd_tutor_moves():
    nightmare = 171
    issues = _moves_issues({"species": 12, "level": 30, "moves": [nightmare, 93]})
    assert ("note", "NIGHTMARE só vem do tutor do XD: vale se o Pokémon passou pelo XD por troca.") in issues
    issues = _moves_issues({"species": 12, "level": 30, "moves": [nightmare, 93], "met_game": 15, "met_location": 0xFF})
    assert ("note", "NIGHTMARE vem do tutor do XD.") in issues


def test_egg_moves_need_one_father():
    from swg3.gen3 import species
    light_screen, skull_bash, safeguard = 113, 130, 219
    # Hatched Bulbasaur: Light Screen and Skull Bash have no common father (only the Squirtle line learns Skull Bash,
    # and it has no Light Screen); Light Screen and Safeguard do (Chikorita learns both).
    bad = _moves_issues({"species": 1, "level": 5, "met_level": 0, "met_location": 146, "moves": [light_screen, skull_bash, 33]})
    assert any("não saem juntos do mesmo ovo" in m for _, m in bad)
    assert species.egg_father(1, [light_screen, skull_bash]) is None
    good = _moves_issues({"species": 1, "level": 5, "met_level": 0, "met_location": 146, "moves": [light_screen, safeguard, 33]})
    assert not good
    assert species.egg_father(1, [light_screen, safeguard]) is not None
    # A male-only family breeds with Ditto: the father is from the same family (Tyrogue with Hitmon moves).
    assert species.species_id("HITMONLEE") in species._fathers(species.species_id("TYROGUE"))
    assert species.species_id("MACHOP") not in species._fathers(species.species_id("TYROGUE"))
