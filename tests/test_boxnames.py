import pytest

from swg3.gen3 import boxnames

# Example from the generator analysis (docs/research/codegenerator.md): boxes 1 to 4 of a code.
EXAMPLE_NAMES = ["FM.oZ.Bn", "D3n,E?q", "AAQU.o", "AVH?n"]
EXAMPLE_RAW = bytes.fromhex(
    "C0C7ADE3" "D4ADBCE2" "FF"          # Box 1: FM.oZ.Bn + terminator
    "BEA4E2" "B8BFACE5" "FFFF"          # Box 2: D3n,E?q + end of name + terminator
    "BBBB" "CBCFADE3" "FFFFFF"          # Box 3: AAQU.o
    "BB" "D0C2ACE2"                     # Box 4: AVH?n (incomplete in the example)
)


def test_keyboard_matches_decomp():
    assert boxnames.key_of("A") == (0, 0, 0)
    assert boxnames.key_of(" ") == (0, 0, 6)
    assert boxnames.key_of("z") == (1, 3, 6)
    assert boxnames.key_of("♀") == (2, 2, 3)
    assert boxnames.key_of("’") == boxnames.key_of("'") == (2, 3, 4)
    assert boxnames.key_of("–") == boxnames.key_of("-")
    assert boxnames.key_of("é") is None and boxnames.key_of(":") is None
    for char in boxnames.KEYS:
        assert len(boxnames.encode_name(char)) == 9


def test_example_names_match_raw():
    boxes, general = boxnames.check_names(EXAMPLE_NAMES)
    assert general == [] and all(not b.issues for b in boxes)
    stream = b"".join(b.raw for b in boxes)
    assert stream[:len(EXAMPLE_RAW)] == EXAMPLE_RAW
    names, issues = boxnames.check_raw(EXAMPLE_RAW)
    assert names == EXAMPLE_NAMES
    assert [level for level, _ in issues] == ["warning"]   # only box 4 is incomplete


def test_raw_errors():
    names, issues = boxnames.check_raw(bytes.fromhex("BBFFBB" + "BB" * 5 + "FF"))
    assert any("meio do nome" in m for _, m in issues)
    names, issues = boxnames.check_raw(bytes.fromhex("BB" * 9))
    assert any("terminador" in m for _, m in issues)
    names, issues = boxnames.check_raw(bytes.fromhex("01" + "FF" * 8))
    assert any("0x01" in m for _, m in issues)


def test_name_checks():
    boxes, general = boxnames.check_names(["ABC", "   ", "é", "AAAAA AA", "ABCDEFGHI"])
    assert boxes[0].issues == []
    assert "espaços" in boxes[1].issues[0][1]
    assert "fora do teclado" in boxes[2].issues[0][1]
    assert boxes[3].issues[0][0] == "warning"   # Box 4 with a space in the last three
    assert "máximo" in boxes[4].issues[0][1]
    _, general = boxnames.check_names(["A"] * 15)
    assert "14" in general[0][1]


def test_parse_forms():
    assert boxnames.parse_names('["FM.oZ.Bn", "____A"]') == ["FM.oZ.Bn", "    A"]
    report = "Box 1: F M . o Z . B n [FM.oZ.Bn]\nBox 2: _ _ _ _ _ F 9 q [     F9q]\n"
    assert boxnames.parse_names(report) == ["FM.oZ.Bn", "     F9q"]
    assert boxnames.parse_names("AB\nC_D") == ["AB", "C D"]
    with pytest.raises(ValueError):
        boxnames.parse_names("Box 1: A\nBox 3: B")
    assert boxnames.parse_raw("0xC0, 0xC7 ad") == bytes.fromhex("C0C7AD")


def test_typing_steps():
    steps = boxnames.typing_steps("Ab1A")
    assert [s["select"] for s in steps] == [0, 1, 1, 1]
    assert [s["page"] for s in steps] == ["maiúsculas", "minúsculas", "símbolos", "maiúsculas"]
    assert steps[2]["row"] == 1 and steps[2]["col"] == 2


def test_cursor_wraps_through_button_column():
    # src/naming_screen.c, HandleDpadMovement: left of the first column is the button column.
    assert boxnames.press(boxnames.START, "left") == (0, 8, 0, 1)        # on PAGE
    assert boxnames.press((0, 8, 0, 1), "left") == (0, 7, 0, 1)          # back to the last column, row 1
    assert boxnames.press((0, 7, 2, 0), "right") == (0, 8, 1, 2)         # row 3 enters BACK and saves the row
    assert boxnames.press((0, 8, 1, 2), "right") == (0, 0, 2, 2)         # leaves BACK on the saved row
    assert boxnames.press((0, 0, 0, 0), "up") == (0, 0, 3, 0)            # wraps vertically
    assert boxnames.press((0, 8, 2, 2), "down") == (0, 8, 0, 1)          # from OK to PAGE


def test_select_clamps_column():
    # MainState_WaitPageSwap: from symbols (6 columns) the column stays; from letters it clamps to the last one.
    assert boxnames.press((1, 7, 0, 0), "select") == (2, 5, 0, 0)
    assert boxnames.press((1, 8, 1, 0), "select") == (2, 6, 1, 0)        # stays on the button column


def test_shortest_path():
    steps = boxnames.typing_steps("FM")
    assert steps[0]["moves"] == [{"key": "left", "count": 4}]            # 4 to the left instead of 5 to the right
    assert sum(m["count"] for m in steps[1]["moves"]) == 6
    assert [s["page_index"] for s in boxnames.typing_steps("a ")] == [1, 1]
