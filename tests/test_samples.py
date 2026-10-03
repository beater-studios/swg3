"""Checks against real Pokémon when the local files exist (not in git): PKHeX plain exports in pk3-en/, pk3-jp/,
samples/ and MankeyMite's rawpk.txt (game-format hex and Base64 names).
"""

import re
from pathlib import Path

import pytest

from swg3.gen3 import base64box, pk3, validate

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DIRS = [ROOT / name for name in ("pk3-en", "pk3-jp", "samples")]
FILES = sorted(p for d in SAMPLE_DIRS if d.is_dir() for p in d.rglob("*.pk3"))
RAWPK = ROOT / "rawpk.txt"


@pytest.mark.skipif(not FILES, reason="no sample .pk3 files on this machine")
def test_pkhex_files_are_plain_valid_and_roundtrip():
    for path in FILES:
        data = path.read_bytes()
        mon, encrypted = pk3.load(data)
        assert not encrypted, f"{path}: PKHeX .pk3 should be plain"
        assert mon.checksum_ok and bytes(mon.data) == data, path
        assert pk3.Pk3.from_raw(mon.to_raw()).data == mon.data, path
        errors = [i for i in validate.check(mon) if i.level == "error"]
        assert not errors, f"{path}: {errors}"


@pytest.mark.skipif(not FILES, reason="no sample .pk3 files on this machine")
def test_pkhex_files_base64_roundtrip():
    for path in FILES[::25]:
        raw = pk3.load(path.read_bytes())[0].to_raw()
        assert base64box.decode(base64box.encode(raw).boxes) == raw, path


def _rawpk_blocks():
    if not RAWPK.is_file():
        return []
    out = []
    for block in re.split(r"\n_{20,}\n", RAWPK.read_text(encoding="utf-8")):
        match = re.search(r"Hex code:\s*\n(.*?)\n\s*\n", block, re.S)
        boxes = re.findall(r"Box\s+\d+:\s*\(([^)]*)\)", block)
        try:
            data = bytes.fromhex("".join(match.group(1).split())) if match else b""
        except ValueError:
            continue
        if len(data) == 80 and boxes:
            out.append((data, boxes))
    return out


@pytest.mark.skipif(not RAWPK.is_file(), reason="rawpk.txt missing")
def test_rawpk_pokemon():
    blocks = _rawpk_blocks()
    assert len(blocks) > 25
    same = 0
    for data, boxes in blocks:
        mon, encrypted = pk3.load(data)
        if not mon.checksum_ok:
            continue   # the writer's own block is not a Pokémon
        assert encrypted
        assert not [i for i in validate.check(mon) if i.level == "error"]
        same += base64box.decode(boxes) == data
    # One of the Dittos has inconsistent hex and names in the source text (OT area, outside the checksum).
    assert same >= len(blocks) - 2
