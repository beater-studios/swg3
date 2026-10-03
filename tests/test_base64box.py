import base64
import random
from pathlib import Path

import pytest

from swg3.gen3 import badwords, base64box

ROOT = Path(__file__).resolve().parent.parent
ZERO = bytes(80)


def test_plain_encoding_matches_community_format():
    # WISHMKR Jirachi from rawpk.txt (MankeyMite): hex and names published together.
    data = bytes.fromhex(
        "4835057B4B4E0000C4C3CCBBBDC2C3FF04000202D1C3CDC2C7C5CC0006B70000"
        "037B057B037B057B037B057B0384005A0862EF71037B057B9A7AAF7B9F7B057B"
        "031F057B5E7B147A9F7B057B1A710F7B")
    boxes = base64box.encode(data, switch_safe=False).boxes
    assert boxes == ["SDUFe0tO", "AADEw8y7", "vcLD?wQA", "AgLRw83C", "x8XMAAa3", "AAADewV7", "A3sFewN7",
                     "BXsDhABa", "CGLvcQN7", "BXuaeq97", "n3sFewMf", "BXteexR6", "n3sFexpx", "D3s"]
    assert base64box.decode(boxes) == data


def test_manual_conversion_vector():
    original = base64box.encode(ZERO).boxes
    converted = base64box.encode(ZERO, convert=(5,))
    assert converted.manual == {5: 4}
    assert converted.boxes[4] == ".P.A.P.A"                 # vector from the Gen3ACEPokemonBuilder test
    assert converted.boxes[3] == original[3] and converted.boxes[5] == original[5]
    assert base64box.decode(converted.boxes) == ZERO
    both = base64box.encode(ZERO, convert=(7, 5))
    assert both.manual == {5: 4, 7: 4} and both.boxes[6] == ".P.A.P.A"
    assert base64box.decode(both.boxes) == ZERO


def test_xxx_is_split_before_last_letter():
    data = base64.b64decode("Rx5XxlIk") + bytes(74)
    result = base64box.encode(data)
    assert result.boxes[0] == "Rx5X" and 0 in result.shortened
    assert base64box.decode(result.boxes) == data


def test_boundary_term_borrows_previous_letter():
    stream = "A" * 24 + "??AgLO7ebj4tn?AB" + "A" * 67
    data = base64.b64decode(stream.replace("?", "/") + "=")
    result = base64box.encode(data)
    assert result.boxes[3] == "??AgLO7" and result.boxes[4].startswith("ebj")
    assert base64box.decode(result.boxes) == data


def test_random_data_roundtrip_and_clean_boxes():
    rng = random.Random(7)
    for _ in range(200):
        data = rng.randbytes(80)
        result = base64box.encode(data)
        assert base64box.decode(result.boxes) == data
        assert all(len(b) <= 8 for b in result.boxes) and len(result.boxes) == 14
        for number, box in enumerate(result.boxes, 1):
            if number not in result.blocked:
                assert not badwords.blocked(box) or not box


def test_decode_rejects_other_characters():
    with pytest.raises(ValueError):
        base64box.decode(["AB:C"])
    assert base64box.is_base64_code(base64box.encode(ZERO).boxes)
    assert not base64box.is_base64_code(["FM.oZ.Bn"])


def test_decode_accepts_same_byte_aliases():
    data = bytes(80)
    result = base64box.encode(data, convert=(5,))
    boxes = [b.replace("’", "'") for b in result.boxes]
    assert base64box.decode(boxes) == data
    converted = base64box.encode(bytes(range(80)), convert=tuple(range(1, 15)))
    aliased = [b.replace("’", "'").replace("-", "–") for b in converted.boxes]
    assert base64box.decode(aliased) == bytes(range(80))
