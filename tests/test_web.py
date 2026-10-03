import json

import pytest

from swg3 import web
from tests.test_validate import valid_mon


def call(name, params):
    reply = json.loads(web.call(name, json.dumps(params)))
    assert reply["ok"], reply.get("error")
    return reply["result"]


def error(name, params):
    reply = json.loads(web.call(name, json.dumps(params)))
    assert not reply["ok"]
    return reply["error"]


def test_unknown_function_and_rng_left_for_the_site():
    assert "desconhecida" in error("nada", {})
    for name in ("search_static", "calibrate", "seed_table", "iv_calc"):
        assert "desconhecida" in error(name, {})


@pytest.mark.parametrize("encrypted", (True, False))
def test_pk3_inspect_both_formats(encrypted):
    mon = valid_mon()
    data = mon.to_raw() if encrypted else bytes(mon.data)
    info = call("pk3_inspect", {"hex": data.hex(" ")})
    assert info["format"] == ("encrypted" if encrypted else "decrypted")
    assert info["species"]["name"] == "BULBASAUR" and info["species"]["types"] == ["GRASS", "POISON"]
    assert info["nickname"] == "BULBASAUR" and info["ot_name"] == "RED"
    assert info["tid"] == 12345 and info["sid"] == 54321
    assert info["level"] == 7 and len(info["stats"]) == 6
    assert info["moves"][0]["name"] == "TACKLE" and info["moves"][2]["name"] == "-"
    assert info["ball"]["name"] == "POKé BALL" and info["language"]["name"] == "inglês"
    assert info["ability"] == "OVERGROW"
    assert info["issues"] == []
    assert bytes.fromhex(info["files"]["game"]) == mon.to_raw()
    assert bytes.fromhex(info["files"]["plain"]) == bytes(mon.data)


def test_pk3_inspect_party_and_errors():
    party = valid_mon(size=100)
    info = call("pk3_inspect", {"hex": party.to_raw().hex()})
    assert info["party"] and "party_data" in info
    assert any(i["field"] == "level" for i in info["issues"])   # level 0 in the party tail
    assert "tamanho" in error("pk3_inspect", {"hex": "00" * 10})
    assert "hexadecimal" in error("pk3_inspect", {"hex": "xyz"})
    broken = call("pk3_inspect", {"hex": "01" * 80})
    assert not broken["checksum"]["ok"] and "files" not in broken
    assert any(i["field"] == "checksum" for i in broken["issues"])


BUILD = {"species": 6, "level": 36, "nature": "Timid", "ivs": [31] * 6, "evs": [4, 0, 0, 252, 252, 0],
         "ot_name": "RED", "tid": 12345, "sid": 54321, "moves": [53, 19], "shiny": True}


def test_lists_and_species_info():
    lists = call("lists", {})
    assert {"id": 33, "name": "TACKLE"} in lists["moves"]
    assert lists["balls"][3] == {"id": 4, "name": "POKé BALL"}
    assert {"id": 88, "name": "PALLET_TOWN"} in lists["locations"]
    info = call("species_info", {"species": 6, "level": 36})
    assert info["national"] == 6 and info["types"] == ["FIRE", "FLYING"]
    assert info["abilities"] == ["BLAZE"] and len(info["default_moves"]) == 4
    assert any(m["name"] == "FLAMETHROWER" for m in info["learnable"])


def test_pk3_build_create_and_edit():
    created = call("pk3_build", {"fields": BUILD, "seed": 1})
    mon = created["mon"]
    assert mon["species"]["name"] == "CHARIZARD" and mon["nature"] == "Timid" and mon["shiny"]
    assert mon["level"] == 36 and mon["issues"] == [] and created["notes"]
    edited = call("pk3_build", {"base": mon["files"]["game"], "fields": {"nickname": "BLAZE", "evs": [0] * 6}})
    assert edited["mon"]["nickname"] == "BLAZE" and edited["mon"]["pid"] == mon["pid"]
    assert edited["mon"]["evs"] == [0] * 6 and edited["notes"] == []
    assert "OT" in error("pk3_build", {"fields": {"species": 1, "level": 5}})
    assert "sempre" in error("pk3_build", {"fields": dict(BUILD, species=128, gender="F", shiny=None)})


def test_code_plan_and_recipe():
    mon = call("pk3_build", {"fields": BUILD, "seed": 1})["mon"]
    plan = call("code_plan", {"hex": mon["files"]["game"], "strategy": "egg"})
    assert plan["steps"][0]["code"] == "Generate egg with any PID"
    assert plan["steps"][-1]["code"] == "Make any Pokémon Shiny"
    data = call("recipe_trade", {"hex": mon["files"]["game"], "save_as": "recebido.pk3"})
    assert data["format"] == "swg3-recipe" and data["receive"]["save_as"] == "recebido.pk3"
    checked = call("recipe_check", {"text": json.dumps(data)})
    assert checked["mon"]["pid"] == mon["pid"]
    assert "receita" in error("recipe_check", {"text": "{}"})


def test_box_names_api():
    result = call("box_names", {"names": '["FM.oZ.Bn", "D3n,E?q"]', "raw": "C0C7ADE3D4ADBCE2FF BEA4E2B8BFACE5FFFF"})
    assert result["ok"] and [b["name"] for b in result["boxes"]] == ["FM.oZ.Bn", "D3n,E?q"]
    # From M (row 3, column 1) to ".": left to BACK, up to PAGE and left to the last column.
    assert result["boxes"][0]["steps"][2] == {"char": ".", "page": "maiúsculas", "page_index": 0, "row": 1, "col": 8, "select": 0,
                                              "moves": [{"key": "left", "count": 1}, {"key": "up", "count": 1}, {"key": "left", "count": 1}]}
    typo = call("box_names", {"names": '["FM.oZ.Bm", "D3n,E?q"]', "raw": "C0C7ADE3D4ADBCE2FF BEA4E2B8BFACE5FFFF"})
    assert not typo["ok"] and "bytes crus" in typo["boxes"][0]["issues"][0]["message"]
    only_raw = call("box_names", {"raw": "C0C7ADE3D4ADBCE2FF"})
    assert only_raw["boxes"][0]["name"] == "FM.oZ.Bn"
    bad = call("box_names", {"names": "ABC\né"})
    assert not bad["ok"] and bad["boxes"][1]["steps"] is None


def test_base64_boxes_and_detection():
    mon = call("pk3_build", {"fields": BUILD, "seed": 1})["mon"]
    result = call("base64_boxes", {"hex": mon["files"]["plain"], "switch_safe": True})
    assert len(result["boxes"]) == 14 and not result["blocked"]
    checked = call("box_names", {"names": json.dumps(result["boxes"])})
    assert checked["code"]["mon"]["pid"] == mon["pid"] and checked["ok"]
    def typo(index):
        boxes = list(result["boxes"])
        boxes[index] = ("B" if boxes[index][0] != "B" else "C") + boxes[index][1:]
        return call("box_names", {"names": json.dumps(boxes)})["code"]
    # Box 3 lands in the nickname (header, outside the checksum): the Pokémon stays valid, with another nickname.
    assert typo(2)["mon"]["nickname"] != mon["nickname"]
    # Box 7 starts at byte 36, inside the encrypted area: the checksum catches it.
    assert "error" in typo(6)
    converted = call("base64_boxes", {"hex": mon["files"]["plain"], "convert": [3]})
    assert "3" in {str(k) for k in converted["manual"]}
    assert "checksum" in error("base64_boxes", {"hex": "01" * 80})


def test_box_names_warns_about_switch_filter():
    result = call("box_names", {"names": '["Rx5XxlIk"]'})
    assert any("filtro" in i["message"] for i in result["boxes"][0]["issues"])


def NATURES_BY_INDEX(index):
    from swg3.gen3.pk3 import NATURES
    return NATURES[index]
