import json
import random
from datetime import datetime, timezone

import pytest

from swg3 import cli, recipe
from swg3.gen3 import builder, pk3
from swg3.gen3.pk3 import STATS

NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)


def mon(**fields):
    base = dict(species=64, level=30, ot_name="RED", tid=1, sid=2, ivs=dict.fromkeys(STATS, 20), party=True)
    base.update(fields)
    return builder.build(base, rng=random.Random(5))[0]


def test_trade_recipe_roundtrip():
    kadabra = mon()
    data = recipe.trade(kadabra, save_as="recebido.pk3", now=NOW)
    assert data["created"] == "2026-09-29T12:00:00Z"
    assert data["offer"]["evolves_to"] == "ALAKAZAM"
    assert any("evolui" in s["text"] for s in data["steps"])
    loaded, offered = recipe.load(json.dumps(data))
    assert offered.data == kadabra.to_box().data
    assert loaded["receive"] == {"save_as": "recebido.pk3"}


def test_everstone_blocks_evolution_note():
    data = recipe.trade(mon(held_item=195), now=NOW)
    assert data["offer"]["evolves_to"] is None and data["receive"] is None


def test_refuses_invalid_mon_and_bad_files():
    broken = mon()
    broken.moves = (0, 0, 0, 0)
    with pytest.raises(ValueError, match="move"):
        recipe.trade(broken)
    good = recipe.trade(mon(), now=NOW)
    for change, message in (
        ({"format": "x"}, "não é uma receita"),
        ({"version": 2}, "versão"),
        ({"action": "gift"}, "ação"),
        ({"game": {"title": "emerald", "language": "eng", "revision": 10}}, "jogo"),
        ({"offer": dict(good["offer"], species=1)}, "espécie"),
        ({"offer": dict(good["offer"], data="00" * 80)}, "erro"),
    ):
        with pytest.raises(ValueError, match=message):
            recipe.load(json.dumps(dict(good, **change)))
    with pytest.raises(ValueError, match="JSON"):
        recipe.load("{")


def test_cli_recipe_check(tmp_path, capsys):
    path = tmp_path / "receita.json"
    path.write_text(json.dumps(recipe.trade(mon(), save_as="x.pk3", now=NOW)))
    assert cli.main(["recipe", "check", str(path)]) == 0
    out = capsys.readouterr().out
    assert "KADABRA" in out and "trade" in out
    path.write_text("{}")
    with pytest.raises(SystemExit):
        cli.main(["recipe", "check", str(path)])


def test_steps_use_the_brand_name():
    from swg3 import brand

    text = " ".join(step["text"] for step in recipe.trade_steps("CHARIZARD", None, None))
    assert brand.NAME in text
