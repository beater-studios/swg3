import pytest

from swg3.gen3 import charset, symbols


def test_charset_letters_and_digits():
    assert charset.encode("A", 1) == bytes([0xBB])
    assert charset.encode("a", 1) == bytes([0xD5])
    assert charset.encode("0", 1) == bytes([0xA1])
    assert charset.decode(bytes([0xBB, 0xD5, 0xA1, 0xFF, 0xBB])) == "Aa0"


def test_charset_padding_and_errors():
    assert charset.encode("AB", 4) == bytes([0xBB, 0xBC, 0xFF, 0xFF])
    with pytest.raises(ValueError):
        charset.encode("ABCDE", 4)
    with pytest.raises(ValueError):
        charset.encode("あ", 4)


def test_symbols_match_known_english_addresses():
    # Also checked independently against references/pokeldn/docs/frlg_rom_map.md.
    assert symbols.lookup("gRngValue").address == 0x030042D0
    assert symbols.lookup("gSaveBlock1Ptr").address == 0x030042D8
    assert symbols.lookup("gSaveBlock2Ptr").address == 0x030042DC
    assert symbols.lookup("gIntrTable").address + 4 * 4 == 0x030027E0


def test_thumb_call_address():
    create_mon = symbols.lookup("CreateMon")
    assert create_mon.is_thumb_code
    assert create_mon.call_address == create_mon.address | 1


def test_missing_symbol():
    with pytest.raises(KeyError):
        symbols.lookup("NaoExiste")


def test_japanese_table():
    from swg3.gen3 import charset
    assert charset.decode(bytes([0x01, 0x02, 0xFF])) != "あい"
    assert charset.decode(bytes([0x01, 0x02, 0xFF]), japanese=True) == "あい"
    assert charset.decode(bytes([0xBB, 0xA1, 0xFF]), japanese=True) == "A0"   # letters and digits are shared
