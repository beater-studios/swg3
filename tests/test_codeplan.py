import random

import pytest

from swg3.gen3 import builder, codeplan
from swg3.gen3.pk3 import STATS


def target(**fields):
    base = dict(species=6, level=50, ot_name="RED", tid=1, sid=2, nature=3, moves=[53, 19, 0, 0],
                ivs=dict.fromkeys(STATS, 31))
    base.update(fields)
    return builder.build(base, rng=random.Random(3))[0]


def codes(result):
    return [s["code"] for s in result["steps"]]


def test_wild_plan_order_and_params():
    result = codeplan.plan(target())
    names = codes(result)
    assert names[0] == "Start wild battle with any Pokemon"
    assert names.index("Read Pokemon PID") < names.index("Change IVs and ability")
    assert names.count("Teach Pokemon Any Move") == 2
    assert "Change EVs" not in names and "Make any Pokémon Shiny" not in names
    ivs = next(s for s in result["steps"] if s["code"] == "Change IVs and ability")
    values = {p["name"]: p["value"] for p in ivs["params"]}
    assert values["new_hp"] == 31 and values["new_ability"] == 0
    exp = next(s for s in result["steps"] if s["code"] == "Change experience")
    assert {p["name"]: p["value"] for p in exp["params"]}["new_exp"] == 117360   # medium-slow lv 50
    assert any("Nature" in n for n in result["not_covered"])


def test_egg_plan_keeps_pid_and_shiny_last():
    mon = target(shiny=True, evs=dict(zip(STATS, (4, 0, 0, 0, 0, 0))), held_item=195)
    result = codeplan.plan(mon, "egg")
    names = codes(result)
    assert names[0] == "Generate egg with any PID"
    first = {p["name"]: p["value"] for p in result["steps"][0]["params"]}
    assert first["pid"] == f"0x{mon.personality:08X}"
    assert "Read EVs field" in names and "Change EVs" in names
    assert names[-2:] == ["Make any Pokémon Shiny", "Get any item"]
    assert not any("Nature" in n for n in result["not_covered"])


def test_bad_strategy():
    with pytest.raises(ValueError):
        codeplan.plan(target(), "mail")
