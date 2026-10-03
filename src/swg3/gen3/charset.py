"""Generation 3 text encoding (decomp charmap). Japanese Pokémon overlay the Japanese section on the same bytes."""

from functools import cache
from importlib.resources import files
from ..i18n import t

TERMINATOR = 0xFF


def _read(name: str) -> tuple[dict, dict]:
    decode, encode = {}, {}
    text = files("swg3").joinpath("data", name).read_text(encoding="utf-8")
    for line in text.splitlines():
        byte, char = line.split("\t", 1)
        value = int(byte, 16)
        decode.setdefault(value, char)
        encode.setdefault(char, value)
    return decode, encode


@cache
def _tables(japanese: bool = False):
    decode, encode = _read("charmap_en.tsv")
    if japanese:
        jp_decode, jp_encode = _read("charmap_jp.tsv")
        decode = {**decode, **jp_decode}
        encode = {**encode, **jp_encode}
    return decode, encode


def decode(data: bytes, japanese: bool = False) -> str:
    """A byte without a character becomes "\\xNN"."""
    table, _ = _tables(japanese)
    out = []
    for value in data:
        if value == TERMINATOR:
            break
        out.append(table.get(value, f"\\x{value:02X}"))
    return "".join(out)


def encode(text: str, length: int) -> bytes:
    _, table = _tables()
    try:
        raw = bytes(table[char] for char in text)
    except KeyError as missing:
        raise ValueError(t("caractere sem codificação: '{char}'", char=missing.args[0])) from None
    if len(raw) > length:
        raise ValueError(t("texto com {size} bytes, máximo {max}", size=len(raw), max=length))
    return (raw + bytes([TERMINATOR]) * length)[:length]
