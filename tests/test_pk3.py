import struct

import pytest

from swg3.gen3 import pk3
from swg3.gen3.pk3 import Pk3


def make_plain(pid=0x12345678, otid=(54321 << 16) | 12345, size=pk3.PARTY_SIZE):
    plain = bytearray(size)
    struct.pack_into("<II", plain, 0, pid, otid)
    mon = Pk3(plain)
    mon.nickname = "PIKACHU"
    mon.ot_name = "RED"
    mon.language = 2
    mon.species = 25
    mon.held_item = 139
    mon.experience = 1000
    mon.friendship = 70
    mon.moves = (84, 45, 86, 98)
    mon.pp = (30, 40, 20, 30)
    mon.evs = dict(zip(pk3.STATS, (1, 2, 3, 4, 5, 6)))
    mon.ivs = dict(zip(pk3.STATS, (31, 30, 29, 28, 27, 26)))
    return mon


def test_order_is_permutation():
    assert len(pk3.ORDER) == 24
    assert len(set(pk3.ORDER)) == 24
    for order in pk3.ORDER:
        assert sorted(order) == [0, 1, 2, 3]


@pytest.mark.parametrize("pid", range(24))
def test_roundtrip_every_order(pid):
    mon = make_plain(pid=pid * 0x01010101 + pid)
    raw = mon.to_raw()
    back = Pk3.from_raw(raw)
    assert back.checksum_ok
    assert back.data[:0x1C] == mon.data[:0x1C]
    assert back.data[0x1E:] == mon.data[0x1E:]
    assert back.species == 25
    assert back.moves == (84, 45, 86, 98)
    assert back.ivs == mon.ivs
    assert back.evs == mon.evs


def test_raw_is_encrypted_and_header_clear():
    mon = make_plain()
    raw = mon.to_raw()
    assert raw[:0x1C] == bytes(mon.data[:0x1C])
    assert struct.unpack_from("<H", raw, 0x1C)[0] == pk3.checksum(mon.data)
    assert raw[pk3.SECURE:pk3.SECURE + pk3.SECURE_SIZE] != bytes(mon.data[pk3.SECURE:pk3.SECURE + pk3.SECURE_SIZE])


def test_checksum_written_on_encrypt():
    mon = make_plain()
    back = Pk3.from_raw(mon.to_raw())
    assert back.checksum_ok
    assert struct.unpack_from("<H", back.data, 0x1C)[0] == pk3.checksum(back.data)


def test_substruct_placement_follows_decomp_order():
    # pid % 24 == 1: kinds 0,1,2,3 stored at positions 0,1,3,2 (GetSubstruct, case 1).
    mon = make_plain(pid=1, otid=0)
    raw = mon.to_raw()
    stored_type2 = raw[pk3.SECURE + 3 * 12:pk3.SECURE + 4 * 12]
    key = 1 ^ 0
    words = struct.unpack("<3I", stored_type2)
    decrypted = struct.pack("<3I", *(w ^ key for w in words))
    assert decrypted[:6] == bytes((1, 2, 3, 4, 5, 6))


def test_text_fields():
    mon = make_plain()
    assert mon.nickname == "PIKACHU"
    assert mon.ot_name == "RED"
    with pytest.raises(ValueError):
        mon.ot_name = "TOOLONGNAME"


def test_ids_nature_shiny():
    mon = make_plain(pid=0x12345678, otid=(54321 << 16) | 12345)
    assert (mon.tid, mon.sid) == (12345, 54321)
    assert mon.nature == pk3.NATURES[0x12345678 % 25]
    tid, sid = 12345, 54321
    shiny_pid = ((tid ^ sid) << 16) | 0
    assert make_plain(pid=shiny_pid, otid=(sid << 16) | tid).is_shiny
    assert not mon.is_shiny


def test_iv_range():
    mon = make_plain()
    with pytest.raises(ValueError):
        mon.ivs = dict(zip(pk3.STATS, (32, 0, 0, 0, 0, 0)))


def test_box_size_and_party_only_fields():
    mon = make_plain(size=pk3.BOX_SIZE)
    assert Pk3.from_raw(mon.to_raw()).species == 25
    with pytest.raises(ValueError):
        mon.level
    assert len(make_plain().to_box().data) == pk3.BOX_SIZE


def test_bad_size():
    with pytest.raises(ValueError):
        pk3.decrypt(bytes(10))


@pytest.mark.parametrize("size", (pk3.BOX_SIZE, pk3.PARTY_SIZE))
def test_load_detects_format(size):
    raw = make_plain(size=size).to_raw()
    plain = bytes(Pk3.from_raw(raw).data)   # plain data with the checksum written
    game, encrypted = pk3.load(raw)
    assert encrypted and game.checksum_ok
    flat, encrypted = pk3.load(plain)
    assert not encrypted and flat.data == game.data
    broken, encrypted = pk3.load(b"\x01" * size)
    assert encrypted and not broken.checksum_ok
