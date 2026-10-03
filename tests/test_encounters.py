from swg3.gen3 import builder, encounters, species, validate

FR, LG = 4, 5


def sec(name):
    return next(int(k) for k, v in species.data()["mapsec"].items() if v == name)


def test_wild_static_and_evolved():
    pidgey, pidgeot = species.species_id("PIDGEY"), species.species_id("PIDGEOT")
    assert encounters.check(pidgey, FR, sec("ROUTE_1"), 3) is None
    assert encounters.check(pidgeot, FR, sec("ROUTE_1"), 3) is None          # caught then evolved
    assert encounters.check(pidgey, FR, sec("ROUTE_1"), 30)[0] == "level"
    assert encounters.check(species.species_id("MEWTWO"), LG, sec("CERULEAN_CAVE"), 70) is None
    assert encounters.check(species.species_id("PIKACHU"), FR, sec("PALLET_TOWN"), 5)[0] == "place"


def test_version_exclusives():
    ekans = species.species_id("EKANS")
    assert encounters.check(ekans, FR, sec("ROUTE_4"), 8) is None
    assert encounters.check(ekans, LG, sec("ROUTE_4"), 8)[0] == "place"
    assert encounters.check(ekans, LG, sec("ROUTE_4"), 0) is None            # hatched in LeafGreen


def test_eggs_and_trades():
    assert encounters.hatchable(species.species_id("CHARIZARD"), FR)
    assert encounters.hatchable(species.species_id("PICHU"), FR)
    assert not encounters.hatchable(species.species_id("MEWTWO"), FR)
    assert not encounters.hatchable(species.species_id("DITTO"), FR)
    assert encounters.check(species.species_id("JYNX"), FR, encounters.METLOC_IN_GAME_TRADE, 20) is None
    assert encounters.check(species.species_id("PIKACHU"), FR, encounters.METLOC_IN_GAME_TRADE, 20)[0] == "trade"
    assert encounters.check(species.species_id("TREECKO"), FR, sec("ROUTE_1"), 5) is not None
    assert encounters.check(species.species_id("SCEPTILE"), FR, sec("ROUTE_1"), 0) is None


def test_builder_picks_real_encounter():
    mon, notes = builder.build({"species": species.species_id("CHARIZARD"), "level": 36, "ot_name": "RED"})
    assert (mon.met_location, mon.met_level) == (sec("PALLET_TOWN"), 5)
    assert not [i for i in validate.check(mon) if i.field in ("met_location", "met_level")]
    mon, _ = builder.build({"species": species.species_id("TREECKO"), "level": 10, "ot_name": "RED"})
    assert mon.met_level == 0                                                # only hatched in FR/LG
    mon, notes = builder.build({"species": species.species_id("PIDGEY"), "level": 50, "ot_name": "RED", "met_level": 3})
    assert mon.met_level == 3 and mon.met_location == sec("ROUTE_1")
    assert any(n.startswith("Local de encontro escolhido pelo site: ROUTE 1") for n in notes)
    # No place gives Pidgey at 50: the location stays at the default and validation flags it.
    mon, _ = builder.build({"species": species.species_id("PIDGEY"), "level": 50, "ot_name": "RED", "met_level": 50})
    assert [i for i in validate.check(mon) if i.field in ("met_level", "met_location")]
    mon, notes = builder.build({"species": species.species_id("BULBASAUR"), "level": 6, "ot_name": "RED", "met_location": sec("PALLET_TOWN")})
    assert mon.met_level == 5 and any(n.startswith("Nível de encontro escolhido pelo site: 5") for n in notes)
    # At level 5 the picked level is the current one: not a real choice, no note.
    mon, notes = builder.build({"species": species.species_id("BULBASAUR"), "level": 5, "ot_name": "RED", "met_location": sec("PALLET_TOWN")})
    assert mon.met_level == 5 and not any("escolhido pelo site" in n for n in notes)
    mon, notes = builder.build({"species": species.species_id("BULBASAUR"), "level": 6, "ot_name": "RED",
                                "met_location": sec("PALLET_TOWN"), "auto_met": False})
    assert mon.met_level == 6 and not any("escolhido pelo site" in n for n in notes)
    assert [i for i in validate.check(mon) if i.field == "met_level"]


def test_hatched_default_is_explained_and_needs_poke_ball():
    mon, notes = builder.build({"species": species.species_id("ZIGZAGOON"), "level": 5, "ot_name": "RED"})
    assert mon.met_level == 0 and any("ovo chocado" in n for n in notes)
    issues = validate.check(mon)
    assert [i.level for i in issues] == ["note"] and "marcado como chocado" in issues[0].message and "não aparece no FireRed" in issues[0].message
    mon, _ = builder.build({"species": species.species_id("ZIGZAGOON"), "level": 5, "ot_name": "RED", "ball": 1})
    assert [i for i in validate.check(mon) if i.field == "ball"]


def test_event_flag_follows_encounter():
    lugia = species.species_id("LUGIA")
    mon, notes = builder.build({"species": lugia, "level": 70, "ot_name": "RED"})
    assert mon.met_location == sec("NAVEL_ROCK") and mon.fateful and not validate.check(mon)
    mon, _ = builder.build({"species": lugia, "level": 70, "ot_name": "RED", "met_location": sec("NAVEL_ROCK"), "met_level": 70, "fateful": False})
    assert [i for i in validate.check(mon) if i.field == "fateful"]
    mon, _ = builder.build({"species": lugia, "level": 70, "ot_name": "RED", "met_location": sec("NAVEL_ROCK"), "met_level": 70, "fateful": True})
    assert not [i for i in validate.check(mon) if i.field == "fateful"]
    mon, _ = builder.build({"species": species.species_id("PIDGEY"), "level": 3, "ot_name": "RED", "met_location": sec("ROUTE_1"), "met_level": 3, "fateful": True})
    assert [i for i in validate.check(mon) if i.field == "fateful"]


def test_egg_moves_only_when_hatched():
    bulba = species.species_id("BULBASAUR")
    petal_dance = 80                       # Bulbasaur egg move, not by level-up, TM or tutor
    assert petal_dance in species.egg_only_moves(bulba, 5)
    assert 33 not in species.egg_only_moves(bulba, 5)      # Tackle is a level-up move
    mon, _ = builder.build({"species": bulba, "level": 5, "ot_name": "RED", "moves": [33, petal_dance]})
    assert mon.met_level == 0 and not [i for i in validate.check(mon) if i.field == "moves"]
    mon, _ = builder.build({"species": bulba, "level": 5, "ot_name": "RED", "moves": [33, petal_dance],
                            "met_location": sec("PALLET_TOWN"), "met_level": 5})
    assert any("só vem de ovo" in i.message for i in validate.check(mon) if i.field == "moves")


def test_editing_repicks_encounter_when_species_or_location_changes():
    zig, _ = builder.build({"species": species.species_id("ZIGZAGOON"), "level": 5, "ot_name": "RED"})
    assert zig.met_level == 0
    bulba, notes = builder.build({"species": species.species_id("BULBASAUR"), "met_location": sec("PALLET_TOWN")}, base=zig)
    assert (bulba.met_location, bulba.met_level) == (sec("PALLET_TOWN"), 5)
    same, _ = builder.build({"level": 6}, base=bulba)
    assert (same.met_location, same.met_level) == (sec("PALLET_TOWN"), 5)


def test_emerald_tutor_moves_are_a_note():
    fury_cutter = 210                      # Emerald tutor, not in Bulbasaur's FR/LG learnset
    bulba = species.species_id("BULBASAUR")
    assert fury_cutter in species.emerald_tutor_moves(bulba)
    assert fury_cutter not in species.learnable_moves(bulba)
    mon, _ = builder.build({"species": bulba, "level": 5, "ot_name": "RED", "moves": [33, fury_cutter]})
    moves = [i for i in validate.check(mon) if i.field == "moves"]
    assert [i.level for i in moves] == ["note"] and "tutor do Emerald" in moves[0].message
