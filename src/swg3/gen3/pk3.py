"""Generation 3 pk3 format (80 bytes in the box, 100 in the party): include/pokemon.h `struct BoxPokemon`.

Secure substructures shuffled by `personality % 24` (src/pokemon.c GetSubstruct) and XOR-encrypted with
`personality ^ otId` (EncryptBoxMon). "Plain" means decrypted with substructures in canonical order.
"""

import struct

from . import charset
from ..i18n import t

BOX_SIZE = 80
PARTY_SIZE = 100
SECURE = 0x20
SECURE_SIZE = 48
SUBSTRUCT_SIZE = 12

# ORDER[personality % 24][kind] = stored position of the substructure of that kind.
ORDER = (
    (0, 1, 2, 3), (0, 1, 3, 2), (0, 2, 1, 3), (0, 3, 1, 2), (0, 2, 3, 1), (0, 3, 2, 1),
    (1, 0, 2, 3), (1, 0, 3, 2), (2, 0, 1, 3), (3, 0, 1, 2), (2, 0, 3, 1), (3, 0, 2, 1),
    (1, 2, 0, 3), (1, 3, 0, 2), (2, 1, 0, 3), (3, 1, 0, 2), (2, 3, 0, 1), (3, 2, 0, 1),
    (1, 2, 3, 0), (1, 3, 2, 0), (2, 1, 3, 0), (3, 1, 2, 0), (2, 3, 1, 0), (3, 2, 1, 0),
)

STATS = ("hp", "attack", "defense", "speed", "sp_attack", "sp_defense")

NATURES = (
    "Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed",
    "Impish", "Lax", "Timid", "Hasty", "Serious", "Jolly", "Naive", "Modest", "Mild",
    "Quiet", "Bashful", "Rash", "Calm", "Gentle", "Sassy", "Careful", "Quirky",
)

_PID, _OTID, _NICK, _LANG, _FLAGS, _OT, _MARKS, _CHECKSUM = 0x00, 0x04, 0x08, 0x12, 0x13, 0x14, 0x1B, 0x1C
_S0, _S1, _S2, _S3 = (SECURE + SUBSTRUCT_SIZE * i for i in range(4))
_PARTY = BOX_SIZE
LANGUAGE_JAPANESE = 1   # include/constants/global.h
MAIL_NONE = 0xFF   # include/constants/items.h; written by CreateMon (src/pokemon.c)


def _xor(data: bytes, key: int) -> bytes:
    words = struct.unpack(f"<{len(data) // 4}I", data)
    return struct.pack(f"<{len(words)}I", *(w ^ key for w in words))


def checksum(plain: bytes) -> int:
    """16-bit sum over the 48 decrypted secure bytes (CalculateBoxMonChecksum)."""
    return sum(struct.unpack_from("<24H", plain, SECURE)) & 0xFFFF


def decrypt(raw: bytes) -> bytes:
    if len(raw) not in (BOX_SIZE, PARTY_SIZE):
        raise ValueError(t("tamanho {size}, esperado {box} ou {party}", size=len(raw), box=BOX_SIZE, party=PARTY_SIZE))
    pid, otid = struct.unpack_from("<II", raw)
    secure = _xor(raw[SECURE:SECURE + SECURE_SIZE], pid ^ otid)
    order = ORDER[pid % 24]
    blocks = b"".join(
        secure[order[kind] * SUBSTRUCT_SIZE:(order[kind] + 1) * SUBSTRUCT_SIZE] for kind in range(4)
    )
    return raw[:SECURE] + blocks + raw[SECURE + SECURE_SIZE:]


def encrypt(plain: bytes) -> bytes:
    if len(plain) not in (BOX_SIZE, PARTY_SIZE):
        raise ValueError(t("tamanho {size}, esperado {box} ou {party}", size=len(plain), box=BOX_SIZE, party=PARTY_SIZE))
    plain = bytearray(plain)
    struct.pack_into("<H", plain, _CHECKSUM, checksum(plain))
    pid, otid = struct.unpack_from("<II", plain)
    order = ORDER[pid % 24]
    stored = [b""] * 4
    for kind in range(4):
        start = SECURE + kind * SUBSTRUCT_SIZE
        stored[order[kind]] = bytes(plain[start:start + SUBSTRUCT_SIZE])
    secure = _xor(b"".join(stored), pid ^ otid)
    return bytes(plain[:SECURE]) + secure + bytes(plain[SECURE + SECURE_SIZE:])


def load(data: bytes) -> tuple["Pk3", bool]:
    """Returns (Pokémon, encrypted), deciding by checksum; if neither reading matches, the decrypted one."""
    decrypted = Pk3.from_raw(data)
    if decrypted.checksum_ok:
        return decrypted, True
    plain = Pk3(data)
    if plain.checksum_ok:
        return plain, False
    return decrypted, True


class Pk3:

    def __init__(self, plain: bytes):
        if len(plain) not in (BOX_SIZE, PARTY_SIZE):
            raise ValueError(t("tamanho {size}, esperado {box} ou {party}", size=len(plain), box=BOX_SIZE, party=PARTY_SIZE))
        self.data = bytearray(plain)

    @classmethod
    def from_raw(cls, raw: bytes) -> "Pk3":
        return cls(decrypt(raw))

    def to_raw(self) -> bytes:
        return encrypt(self.data)

    def to_box(self) -> "Pk3":
        return Pk3(self.data[:BOX_SIZE])

    @property
    def is_party(self) -> bool:
        return len(self.data) == PARTY_SIZE

    def update_checksum(self):
        self._set_u16(_CHECKSUM, checksum(self.data))

    @property
    def checksum_ok(self) -> bool:
        return self._u16(_CHECKSUM) == checksum(self.data)

    def _u8(self, off): return self.data[off]
    def _u16(self, off): return struct.unpack_from("<H", self.data, off)[0]
    def _u32(self, off): return struct.unpack_from("<I", self.data, off)[0]
    def _set_u8(self, off, v): self.data[off] = v & 0xFF
    def _set_u16(self, off, v): struct.pack_into("<H", self.data, off, v & 0xFFFF)
    def _set_u32(self, off, v): struct.pack_into("<I", self.data, off, v & 0xFFFFFFFF)

    def _bits(self, off, shift, width):
        return (self._u32(off) >> shift) & ((1 << width) - 1)

    def _set_bits(self, off, shift, width, value):
        mask = ((1 << width) - 1) << shift
        self._set_u32(off, (self._u32(off) & ~mask) | ((value << shift) & mask))

    personality = property(lambda s: s._u32(_PID), lambda s, v: s._set_u32(_PID, v))
    ot_id = property(lambda s: s._u32(_OTID), lambda s, v: s._set_u32(_OTID, v))
    tid = property(lambda s: s.ot_id & 0xFFFF)
    sid = property(lambda s: s.ot_id >> 16)
    language = property(lambda s: s._u8(_LANG), lambda s, v: s._set_u8(_LANG, v))
    is_bad_egg = property(lambda s: bool(s._u8(_FLAGS) & 1))
    has_species = property(lambda s: bool(s._u8(_FLAGS) & 2),
                           lambda s, v: s._set_u8(_FLAGS, (s._u8(_FLAGS) & ~2) | (2 if v else 0)))
    markings = property(lambda s: s._u8(_MARKS), lambda s, v: s._set_u8(_MARKS, v))

    @property
    def nickname(self) -> str:
        return charset.decode(self.data[_NICK:_NICK + 10], self.language == LANGUAGE_JAPANESE)

    @nickname.setter
    def nickname(self, text: str):
        self.data[_NICK:_NICK + 10] = charset.encode(text, 10)

    @property
    def ot_name(self) -> str:
        return charset.decode(self.data[_OT:_OT + 7], self.language == LANGUAGE_JAPANESE)

    @ot_name.setter
    def ot_name(self, text: str):
        self.data[_OT:_OT + 7] = charset.encode(text, 7)

    # Substructure 0: growth.
    species = property(lambda s: s._u16(_S0), lambda s, v: s._set_u16(_S0, v))
    held_item = property(lambda s: s._u16(_S0 + 2), lambda s, v: s._set_u16(_S0 + 2, v))
    experience = property(lambda s: s._u32(_S0 + 4), lambda s, v: s._set_u32(_S0 + 4, v))
    pp_bonuses = property(lambda s: s._u8(_S0 + 8), lambda s, v: s._set_u8(_S0 + 8, v))
    friendship = property(lambda s: s._u8(_S0 + 9), lambda s, v: s._set_u8(_S0 + 9, v))

    # Substructure 1: attacks.
    @property
    def moves(self) -> tuple[int, ...]:
        return struct.unpack_from("<4H", self.data, _S1)

    @moves.setter
    def moves(self, values):
        struct.pack_into("<4H", self.data, _S1, *values)

    @property
    def pp(self) -> tuple[int, ...]:
        return tuple(self.data[_S1 + 8:_S1 + 12])

    @pp.setter
    def pp(self, values):
        self.data[_S1 + 8:_S1 + 12] = bytes(values)

    # Substructure 2: EVs and condition.
    @property
    def evs(self) -> dict[str, int]:
        return dict(zip(STATS, self.data[_S2:_S2 + 6]))

    @evs.setter
    def evs(self, values: dict[str, int]):
        self.data[_S2:_S2 + 6] = bytes(values[k] for k in STATS)

    @property
    def contest(self) -> dict[str, int]:
        keys = ("cool", "beauty", "cute", "smart", "tough", "sheen")
        return dict(zip(keys, self.data[_S2 + 6:_S2 + 12]))

    # Substructure 3: misc.
    pokerus = property(lambda s: s._u8(_S3), lambda s, v: s._set_u8(_S3, v))
    met_location = property(lambda s: s._u8(_S3 + 1), lambda s, v: s._set_u8(_S3 + 1, v))
    def _set_origin(self, shift, width, value):
        mask = ((1 << width) - 1) << shift
        self._set_u16(_S3 + 2, (self._u16(_S3 + 2) & ~mask) | ((value << shift) & mask))

    met_level = property(lambda s: s._u16(_S3 + 2) & 0x7F, lambda s, v: s._set_origin(0, 7, v))
    met_game = property(lambda s: (s._u16(_S3 + 2) >> 7) & 0xF, lambda s, v: s._set_origin(7, 4, v))
    ball = property(lambda s: (s._u16(_S3 + 2) >> 11) & 0xF, lambda s, v: s._set_origin(11, 4, v))
    ot_gender = property(lambda s: s._u16(_S3 + 2) >> 15, lambda s, v: s._set_origin(15, 1, v))
    is_egg = property(lambda s: bool(s._bits(_S3 + 4, 30, 1)))
    ability_num = property(lambda s: s._bits(_S3 + 4, 31, 1), lambda s, v: s._set_bits(_S3 + 4, 31, 1, v))
    fateful = property(lambda s: bool(s._bits(_S3 + 8, 31, 1)), lambda s, v: s._set_bits(_S3 + 8, 31, 1, int(bool(v))))
    # Bits 0 to 30 of PokemonSubstruct3 (ribbons); bit 31 is the fateful flag (include/pokemon.h).
    ribbons = property(lambda s: s._u32(_S3 + 8) & 0x7FFFFFFF, lambda s, v: s._set_bits(_S3 + 8, 0, 31, v))

    @property
    def ivs(self) -> dict[str, int]:
        return {k: self._bits(_S3 + 4, 5 * i, 5) for i, k in enumerate(STATS)}

    @ivs.setter
    def ivs(self, values: dict[str, int]):
        for i, k in enumerate(STATS):
            if not 0 <= values[k] <= 31:
                raise ValueError(t("IV {stat}={value} fora de 0..31", stat=k, value=values[k]))
            self._set_bits(_S3 + 4, 5 * i, 5, values[k])

    @property
    def nature(self) -> str:
        return NATURES[self.personality % 25]

    @property
    def is_shiny(self) -> bool:
        pid = self.personality
        return (self.tid ^ self.sid ^ (pid >> 16) ^ (pid & 0xFFFF)) < 8

    # Party tail (100-byte format only).
    def _party(self):
        if not self.is_party:
            raise ValueError(t("campo só existe no formato de party (100 bytes)"))

    @property
    def level(self) -> int:
        self._party()
        return self._u8(_PARTY + 4)

    def set_party(self, level: int, stats: dict[str, int], current_hp: int | None = None):
        """struct Pokemon tail, as CreateMon writes it."""
        self._party()
        struct.pack_into("<IBB", self.data, _PARTY, 0, level, MAIL_NONE)
        hp = stats["hp"] if current_hp is None else current_hp
        struct.pack_into("<7H", self.data, _PARTY + 6, hp, stats["hp"], stats["attack"], stats["defense"],
                         stats["speed"], stats["sp_attack"], stats["sp_defense"])

    @property
    def stats(self) -> dict[str, int]:
        self._party()
        hp, max_hp, atk, dfn, spe, spa, spd = struct.unpack_from("<7H", self.data, _PARTY + 6)
        return {"hp": max_hp, "attack": atk, "defense": dfn, "speed": spe,
                "sp_attack": spa, "sp_defense": spd, "current_hp": hp}


UNOWN = 201
NUM_UNOWN_FORMS = 28
UNOWN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!?"


def unown_letter(pid: int) -> int:
    """GET_UNOWN_LETTER (include/pokemon.h)."""
    value = ((pid & 0x03000000) >> 18) | ((pid & 0x00030000) >> 12) | ((pid & 0x00000300) >> 6) | (pid & 3)
    return value % NUM_UNOWN_FORMS
