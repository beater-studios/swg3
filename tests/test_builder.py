import random

import pytest

from swg3.gen3 import builder, species, validate
from swg3.gen3.pk3 import NATURES, STATS, Pk3

IVS = dict(zip(STATS, (31, 30, 29, 28, 27, 26)))


def create(**fields):
    base = dict(species=1, level=5, ot_name="RED", tid=12345, sid=54321)
    base.update(fields)
    return builder.build(base, rng=random.Random(1))


def test_initial_moves_follow_game_rule():
    assert builder.initial_moves(1, 5) == [33, 45]            # Tackle, Growl
    assert builder.initial_moves(1, 100)[-1] == 76            # Solar Beam last
    assert len(builder.initial_moves(1, 100)) == 4
    moves = builder.initial_moves(6, 36)
    assert len(moves) == 4 and moves == builder.initial_moves(6, 36)


def test_create_default_matches_create_box_mon():
    mon, notes = create(nature=NATURES.index("Adamant"), ivs=IVS)
    assert validate.check(mon) == []
    assert mon.nature == "Adamant" and mon.ivs == IVS
    assert mon.experience == species.exp_table(1)[5] and species.mon_level(mon) == 5
    assert mon.friendship == 70 and mon.ball == 4 and mon.met_level == 5 and mon.met_game == 4
    assert mon.nickname == "BULBASAUR" and mon.ot_name == "RED" and mon.tid == 12345
    assert mon.moves == (33, 45, 0, 0) and mon.pp == (35, 40, 0, 0)
    assert mon.ability_num == 0
    assert any("PID" in n for n in notes)
    back = Pk3.from_raw(mon.to_raw())
    assert back.checksum_ok and back.data == mon.data


@pytest.mark.parametrize("shiny", (True, False))
def test_pid_constraints(shiny):
    mon, _ = create(species=6, nature=3, shiny=shiny, gender="F")
    assert mon.is_shiny == shiny and mon.personality % 25 == 3
    assert species.gender(6, mon.personality) == "F"


def test_ability_and_gender_errors():
    with pytest.raises(ValueError, match="uma Ability"):
        create(ability=1)
    with pytest.raises(ValueError, match="sempre"):
        create(species=128, gender="F")   # Tauros
    mon, _ = create(species=54, ability=1)   # Psyduck: Damp and Cloud Nine
    assert mon.ability_num == 1 and mon.personality & 1 == 1


def test_party_and_validation():
    mon, _ = create(level=50, party=True, ivs=IVS, evs=dict(zip(STATS, (252, 252, 0, 6, 0, 0))), moves=[76, 22])
    assert mon.is_party and mon.level == 50
    assert {k: mon.stats[k] for k in STATS} == species.mon_stats(mon, 50)
    assert [i.level for i in validate.check(mon)] == []
    with pytest.raises(ValueError, match="soma"):
        create(evs=dict.fromkeys(STATS, 100))
    with pytest.raises(ValueError, match="repetido"):
        create(moves=[33, 33])
    with pytest.raises(ValueError, match="OT"):
        builder.build({"species": 1, "level": 5})


def test_edit_keeps_what_is_not_changed():
    mon, _ = create(nature=0, ivs=IVS, held_item=139)
    edited, notes = builder.build({"evs": dict.fromkeys(STATS, 10)}, base=mon)
    assert edited.personality == mon.personality and notes == []
    assert edited.ivs == IVS and edited.held_item == 139 and edited.evs["hp"] == 10
    edited, notes = builder.build({"nature": 5}, base=mon, rng=random.Random(2))
    assert edited.nature == "Bold" and edited.ivs == IVS and notes
    evolved, _ = builder.build({"species": 2}, base=mon)
    assert evolved.nickname == "IVYSAUR" and species.mon_level(evolved) == 5
    party, _ = builder.build({"level": 30, "party": True}, base=mon)
    assert party.is_party and party.level == 30 and species.mon_level(party) == 30


def test_unown_letter():
    mon, notes = create(species=201, letter=2, nature=None)
    from swg3.gen3.pk3 import unown_letter
    assert unown_letter(mon.personality) == 2 and any("letra" in n for n in notes)


def test_pokerus_fateful_and_ribbons():
    mon, notes = create(species=validate.SPECIES_MEW)
    assert mon.fateful and any("Mew" in n.upper() or "MEW" in n for n in notes)
    mon, _ = create(species=validate.SPECIES_MEW, fateful=False)
    assert not mon.fateful
    mon, _ = create(pokerus=0x12, ribbons=1 << 15, fateful=True)
    assert (mon.pokerus, mon.ribbons, mon.fateful) == (0x12, 1 << 15, True)
    edited, _ = builder.build({"level": 6}, base=mon)
    assert (edited.pokerus, edited.ribbons, edited.fateful) == (0x12, 1 << 15, True)
    with pytest.raises(ValueError):
        create(ribbons=1 << 27)
    with pytest.raises(ValueError):
        create(pokerus=256)
