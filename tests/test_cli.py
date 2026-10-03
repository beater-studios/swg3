import pytest

from swg3 import cli
from tests.test_validate import valid_mon


def test_pk3_show_and_check(tmp_path, capsys):
    path = tmp_path / "bulba.pk3"
    path.write_bytes(valid_mon().to_raw())
    assert cli.main(["pk3", "show", str(path)]) == 0
    assert "BULBASAUR" in capsys.readouterr().out
    assert cli.main(["pk3", "check", str(path)]) == 0
    bad = valid_mon()
    bad.species = 260
    path.write_bytes(bad.to_raw())
    assert cli.main(["pk3", "check", str(path)]) == 1


def test_rng_left_for_the_site():
    with pytest.raises(SystemExit):
        cli.main(["rng", "distance", "0", "1"])
