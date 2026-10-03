import pytest

from swg3.gen3 import species
from swg3.gen3.pk3 import NATURES, STATS


def test_basic_data():
    assert species.info(25)["name"] == "PIKACHU"
    assert species.info(1)["base"] == [45, 49, 49, 45, 65, 65]
    assert species.move_name(1) == "POUND"
    assert species.species_id("mewtwo") == 150
    with pytest.raises(KeyError):
        species.info(0)


def test_exp_tables_known_values():
    assert species.exp_table(25)[100] == 1_000_000       # medium-fast
    assert species.exp_table(150)[100] == 1_250_000      # slow
    assert species.exp_table(1)[100] == 1_059_860        # medium-slow


def test_level_from_exp():
    table = species.exp_table(25)
    assert species.level_from_exp(25, 0) == 1
    assert species.level_from_exp(25, table[50]) == 50
    assert species.level_from_exp(25, table[50] - 1) == 49
    assert species.level_from_exp(25, 10**9) == 100


def test_nature_modifier_table():
    # Adamant: +Atk -SpA; Timid: +Spe -Atk; Hardy neutral.
    adamant, timid, hardy = NATURES.index("Adamant"), NATURES.index("Timid"), NATURES.index("Hardy")
    assert species.nature_modifier(adamant, "attack") == 1
    assert species.nature_modifier(adamant, "sp_attack") == -1
    assert species.nature_modifier(timid, "speed") == 1
    assert species.nature_modifier(timid, "attack") == -1
    assert all(species.nature_modifier(hardy, s) == 0 for s in STATS)
    assert species.nature_modifier(adamant, "hp") == 0


def test_calc_stats_known_example():
    ivs = dict.fromkeys(STATS, 31)
    evs = dict.fromkeys(STATS, 0)
    stats = species.calc_stats(25, 50, ivs, evs, NATURES.index("Hardy"))
    assert stats == {"hp": 110, "attack": 75, "defense": 50, "speed": 110, "sp_attack": 70, "sp_defense": 60}


def test_calc_stats_nature_and_u16_overflow():
    ivs = dict.fromkeys(STATS, 31)
    evs = dict.fromkeys(STATS, 0)
    adamant = NATURES.index("Adamant")
    neutral = species.calc_stats(25, 50, ivs, evs, NATURES.index("Hardy"))
    boosted = species.calc_stats(25, 50, ivs, evs, adamant)
    assert boosted["attack"] == neutral["attack"] * 110 // 100
    assert boosted["sp_attack"] == neutral["sp_attack"] * 90 // 100
    assert species._apply_nature(600, 1) == ((600 * 110) & 0xFFFF) // 100


def test_shedinja_hp():
    shedinja = species.species_id("SHEDINJA")
    stats = species.calc_stats(shedinja, 50, dict.fromkeys(STATS, 31), dict.fromkeys(STATS, 0), 0)
    assert stats["hp"] == 1


def test_learnable_moves():
    moves = species.learnable_moves(1, 10)
    assert 33 in moves and 22 in moves       # Tackle lv 1, Vine Whip lv 10
    assert 76 in species.learnable_moves(1, 1)     # Solar Beam is TM22: any level
    assert 74 not in species.learnable_moves(1, 31)
    assert 74 in species.learnable_moves(1, 32)    # Growth only by level-up, at 32


def test_evolutions_and_family():
    assert ("trade", 0, 65) in species.evolutions(64)             # Kadabra -> Alakazam
    assert ("trade_item", 199, 208) in species.evolutions(95)     # Onix + Metal Coat -> Steelix
    assert species.pre_evolutions(3) == [2, 1]                    # Venusaur <- Ivysaur <- Bulbasaur
    assert species.pre_evolutions(1) == []
    # Venusaur inherits Bulbasaur's egg moves (Petal Dance, 80).
    assert 80 not in species.own_learnable_moves(3)
    assert 80 in species.learnable_moves(3)


def test_names():
    assert species.type_name(10) == "FIRE"
    assert species.ability_name(65) == "OVERGROW"
    assert species.item_name(4) == "POKé BALL"
    assert species.item_name(9999) == "#9999"


def test_gender():
    assert species.gender(1, 30) == "F" and species.gender(1, 31) == "M"   # Bulbasaur, ratio 31
    assert species.gender(128, 0) == "M"      # Tauros, male only
    assert species.gender(113, 0xFF) == "F"   # Chansey, female only
    assert species.gender(81, 0) == "-"       # Magnemite, genderless


def test_hidden_power():
    all_ivs = lambda v: dict.fromkeys(STATS, v)
    assert species.hidden_power(all_ivs(31)) == (17, 70)   # Dark 70
    assert species.hidden_power(all_ivs(0)) == (1, 30)     # Fighting 30
    fire = dict(all_ivs(31), attack=30, sp_attack=30, speed=30)   # classic HP Fire
    assert species.type_name(species.hidden_power(fire)[0]) == "FIRE"


def test_trade_evolution():
    assert species.trade_evolution(64, 0) == 65          # Kadabra -> Alakazam
    assert species.trade_evolution(64, species.ITEM_EVERSTONE) is None
    assert species.trade_evolution(95, 0) is None        # Onix without Metal Coat
    assert species.trade_evolution(95, 199) == 208       # Onix with Metal Coat -> Steelix
    assert species.trade_evolution(1, 0) is None
