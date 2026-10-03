"""Recipe JSON for the ESP32 trade host: the site generates it, the host reads it with `load` (docs/project/recipe.md).

An offered Pokémon with a validation error is rejected: it can corrupt the save.
"""

import json
from datetime import datetime, timezone

from . import brand
from .gen3 import pk3, species, validate
from .i18n import t

FORMAT = f"{brand.SLUG}-recipe"
VERSION = 1
ACTIONS = ("trade",)
GAMES = ("firered", "leafgreen")
LANGUAGE = "eng"
REVISION = 10


def _check_offer(mon: pk3.Pk3):
    errors = [i for i in validate.check(mon) if i.level == "error"]
    if errors:
        raise ValueError(t("Pokémon com erro, não dá para oferecer: {errors}",
                           errors="; ".join(f"{i.field}: {i.message}" for i in errors)))


def trade_steps(offer_name: str, save_as: str | None, evolves_to: str | None) -> list[dict]:
    """In-game entry point follows pokeldn (trade through the Union Room); not verified."""
    steps = [
        {"who": "player", "text": t("Salve o jogo antes de começar.")},
        {"who": "player", "text": t("Deixe na party o Pokémon que você vai mandar.")},
        {"who": "pc", "text": t("Conecte a placa ESP32 e abra esta receita no programa de troca do {name}.", name=brand.NAME)},
        {"who": "player", "text": t("Suba ao 2º andar de qualquer Centro Pokémon, fale com a recepcionista do meio "
                                     "e entre na Union Room.")},
        {"who": "player", "text": t("Fale com o treinador que aparecer na sala (é o PC) e escolha trocar.")},
        {"who": "player", "text": t("Ofereça o seu Pokémon e aceite {name}.", name=offer_name)},
        {"who": "player", "text": t("Espere a animação e o jogo salvar. Não desligue nem saia no meio.")},
    ]
    if save_as:
        steps.append({"who": "pc", "text": t("O PC guarda o Pokémon que você mandou em {file}.", file=save_as)})
    if evolves_to:
        steps.append({"who": "player", "text": t("Ao chegar, {name} evolui para {target} (evolução por troca).", name=offer_name, target=evolves_to)})
    return steps


def trade(mon: pk3.Pk3, game: str = "firered", save_as: str | None = None, now: datetime | None = None) -> dict:
    if game not in GAMES:
        raise ValueError(t("jogo {game!r}, esperado {options}", game=game, options=t(" ou ").join(GAMES)))
    box = mon.to_box() if mon.is_party else pk3.Pk3(bytes(mon.data))
    box.update_checksum()
    _check_offer(box)
    name = species.info(box.species)["name"]
    target = species.trade_evolution(box.species, box.held_item)
    evolves_to = species.info(target)["name"] if target else None
    notes = [t("O PC recalcula nível e stats ao montar a troca (a receita leva o formato da box).")]
    if target and target > species.KANTO_SPECIES_END:
        notes.append(t("Evolução para espécie de fora de Kanto: sem a Pokédex Nacional o comportamento "
                       "não está confirmado (não verificado)."))
    created = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "format": FORMAT,
        "version": VERSION,
        "created": created,
        "game": {"title": game, "language": LANGUAGE, "revision": REVISION},
        "action": "trade",
        "offer": {"format": "pk3", "data": box.to_raw().hex(), "species": box.species, "species_name": name,
                  "nickname": box.nickname, "evolves_to": evolves_to},
        "receive": {"save_as": save_as} if save_as else None,
        "steps": trade_steps(box.nickname or name, save_as, evolves_to),
        "notes": notes + [t("Não leve ao Pokémon HOME Pokémon criados ou alterados.")],
    }


def load(text: str) -> tuple[dict, pk3.Pk3]:
    """Returns (recipe, offered Pokémon)."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(t("JSON inválido: {error} (linha {line})", error=error.msg, line=error.lineno)) from None
    if not isinstance(data, dict) or data.get("format") != FORMAT:
        raise ValueError(t("não é uma receita do {name}", name=brand.NAME))
    if data.get("version") != VERSION:
        raise ValueError(t("versão {version!r} não suportada (esperado {expected})", version=data.get("version"), expected=VERSION))
    if data.get("action") not in ACTIONS:
        raise ValueError(t("ação {action!r} desconhecida", action=data.get("action")))
    game = data.get("game") or {}
    if game.get("title") not in GAMES or game.get("language") != LANGUAGE or game.get("revision") != REVISION:
        raise ValueError(t("jogo não suportado: {game}", game=game))
    offer = data.get("offer") or {}
    if offer.get("format") != "pk3":
        raise ValueError(t("oferta: esperado pk3"))
    try:
        raw = bytes.fromhex(offer.get("data", ""))
    except ValueError:
        raise ValueError(t("oferta: dados não são hexadecimais")) from None
    if len(raw) != pk3.BOX_SIZE:
        raise ValueError(t("oferta: {size} bytes, esperado {expected}", size=len(raw), expected=pk3.BOX_SIZE))
    mon = pk3.Pk3.from_raw(raw)
    _check_offer(mon)
    if offer.get("species") != mon.species:
        raise ValueError(t("oferta: a espécie declarada não bate com os dados"))
    receive = data.get("receive")
    if receive is not None and not (isinstance(receive, dict) and isinstance(receive.get("save_as"), str)):
        raise ValueError(t("receive: esperado {example} ou null", example='{"save_as": "' + t("arquivo.pk3") + '"}'))
    return data, mon
