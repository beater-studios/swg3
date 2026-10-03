import ast
import json
import string
from collections import Counter
from pathlib import Path

from swg3 import i18n, web
from tests.test_validate import valid_mon

SRC = Path(__file__).resolve().parent.parent / "src" / "swg3"


def templates() -> dict[str, list[str]]:
    """Literals passed to t() and N_() in the code, with where they are used."""
    found: dict[str, list[str]] = {}
    for path in sorted(SRC.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ("t", "N_")):
                continue
            arg = node.args[0] if node.args else None
            assert not isinstance(arg, ast.JoinedStr), f"{path.name}:{node.lineno}: f-string in {node.func.id}()"
            if node.func.id == "N_":
                assert isinstance(arg, ast.Constant), f"{path.name}:{node.lineno}: N_() only with a literal"
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                found.setdefault(arg.value, []).append(f"{path.name}:{node.lineno}")
    return found


def fields(template: str) -> Counter:
    return Counter((name, spec, conv) for _, name, spec, conv in string.Formatter().parse(template)
                   if name is not None)


def call(name, params, lang):
    return json.loads(web.call(name, json.dumps(params), lang))


def test_every_template_is_in_catalog():
    catalog = i18n.catalog()
    missing = {k: v for k, v in templates().items() if k not in catalog}
    assert not missing


def test_catalog_has_no_leftover_keys():
    assert not set(i18n.catalog()) - set(templates())


def test_fields_match():
    for pt, en in i18n.catalog().items():
        assert fields(pt) == fields(en), pt


def test_catalog_style():
    for pt, en in i18n.catalog().items():
        assert en and en != pt or pt in ("Box 10, slot 19", "Box 10, slot 2"), pt
        assert "\u2014" not in en and "\u2013" not in en, en


def test_default_language_is_portuguese():
    assert i18n.current() == "pt"
    assert i18n.t("espécie {species} inexistente", species=252) == "espécie 252 inexistente"
    with i18n.language("en"):
        assert i18n.t("espécie {species} inexistente", species=252) == "species 252 does not exist"
        assert i18n.t("texto sem tradução") == "texto sem tradução"
    with i18n.language("xx"):
        assert i18n.current() == "pt"


def test_errors_in_english():
    assert call("pk3_inspect", {"hex": "zz"}, "en")["error"] == "hex: content is not hexadecimal"
    assert call("pk3_inspect", {"hex": "zz"}, "pt")["error"] == "hex: conteúdo não é hexadecimal"
    assert call("nada", {}, "en")["error"] == "unknown function: nada"
    assert "out of range" in call("pk3_build", {"fields": {"species": 1, "level": 200}}, "en")["error"]


def test_pk3_issues_in_english():
    mon = valid_mon()
    mon.language = 9
    mon.ball = 0
    hex_data = mon.to_raw().hex()
    issues = {i["field"]: i for i in call("pk3_inspect", {"hex": hex_data}, "en")["result"]["issues"]}
    assert issues["language"] == {"level": "error", "field": "language", "message": "language 9 is invalid"}
    assert issues["ball"]["message"] == "ball 0 is invalid"
    info = call("pk3_inspect", {"hex": hex_data}, "en")["result"]
    assert info["language"]["name"] == "?"
    good = call("pk3_inspect", {"hex": valid_mon().to_raw().hex()}, "en")["result"]
    assert good["language"]["name"] == "English"
    pt = call("pk3_inspect", {"hex": hex_data}, "pt")["result"]
    assert {i["message"] for i in pt["issues"]} >= {"idioma 9 inválido", "bola 0 inválida"}


def test_recipe_in_english():
    hex_data = valid_mon().to_raw().hex()
    recipe = call("recipe_trade", {"hex": hex_data, "save_as": "got.pk3"}, "en")["result"]
    texts = [s["text"] for s in recipe["steps"]]
    assert texts[0] == "Save the game before you start."
    assert "The PC saves the Pokémon you sent in got.pk3." in texts
    assert [s["who"] for s in recipe["steps"]][2] == "pc"
    assert recipe["notes"][-1] == "Don't take created or changed Pokémon to Pokémon HOME."
    pt = call("recipe_trade", {"hex": hex_data, "save_as": "got.pk3"}, "pt")["result"]
    assert pt["steps"][0]["text"] == "Salve o jogo antes de começar."


def test_constants_translated_on_use():
    plan = call("code_plan", {"hex": valid_mon().to_raw().hex()}, "en")["result"]
    assert plan["steps"][0]["target"].startswith("talk to the Old Gentleman")
    assert plan["steps"][0]["boxes"] == "about 11"
    assert plan["steps"][0]["code"] == "Start wild battle with any Pokemon"
    boxes = call("box_names", {"names": "Ab"}, "en")["result"]
    assert [s["page"] for s in boxes["boxes"][0]["steps"]] == ["uppercase", "lowercase"]
    languages = call("lists", {}, "en")["result"]["languages"]
    assert {"id": 2, "name": "English"} in languages
