import hashlib
import os
import secrets
import stat

import pytest

from swg3 import cli, keys

# Fake values generated in the test: no real key ever enters the repository.
FAKE = {name: secrets.token_hex(16) for name in keys.LDN_KEYS}


def write_prod_keys(path, extra=True, **override):
    values = dict(FAKE, **override)
    lines = ["; file comment", ""]
    if extra:
        lines += [f"header_key = {secrets.token_hex(16)}", f"titlekek_00 = {secrets.token_hex(16)}"]
    lines += [f"{name.upper() if i % 2 else name} = {value}" for i, (name, value) in enumerate(values.items())]
    path.write_text("\n".join(lines) + "\n")
    return path


def test_minimize_keeps_only_ldn_keys_and_original(tmp_path):
    source = write_prod_keys(tmp_path / "prod.keys")
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    target = keys.minimize(source, tmp_path / "out" / "ldn.keys")
    assert hashlib.sha256(source.read_bytes()).hexdigest() == before
    assert stat.S_IMODE(target.stat().st_mode) == 0o600
    assert target.read_text() == "".join(f"{n} = {FAKE[n]}\n" for n in keys.LDN_KEYS)
    loaded = keys.load(target)
    assert loaded == {n: bytes.fromhex(FAKE[n]) for n in keys.LDN_KEYS}


def test_errors_never_leak_values(tmp_path):
    source = write_prod_keys(tmp_path / "prod.keys", master_key_12="abcd")
    with pytest.raises(keys.KeysError) as error:
        keys.minimize(source, tmp_path / "ldn.keys")
    assert "master_key_12" in str(error.value)
    assert all(v not in str(error.value) for v in FAKE.values()) and "abcd" not in str(error.value)
    partial = tmp_path / "partial.keys"
    partial.write_text(f"master_key_00 = {FAKE['master_key_00']}\n")
    with pytest.raises(keys.KeysError, match="missing"):
        keys.minimize(partial, tmp_path / "x.keys")
    with pytest.raises(keys.KeysError, match="same file"):
        keys.minimize(source, source)


def test_load_requires_private_file(tmp_path):
    target = keys.minimize(write_prod_keys(tmp_path / "prod.keys"), tmp_path / "ldn.keys")
    os.chmod(target, 0o644)
    with pytest.raises(keys.KeysError, match="600"):
        keys.load(target)


def test_ensure_generates_once(tmp_path, monkeypatch):
    source = write_prod_keys(tmp_path / "prod.keys")
    monkeypatch.setenv(keys.ENV_KEYS, str(tmp_path / "secrets" / "ldn.keys"))
    monkeypatch.setenv(keys.ENV_SOURCE, str(source))
    path = keys.ensure()
    first = path.stat().st_mtime_ns
    assert keys.ensure() == path and path.stat().st_mtime_ns == first


def test_default_location_is_ignored_by_git():
    assert keys.DEFAULT_MINIMAL.parent.name == ".secrets"
    assert keys.git_ignored(keys.DEFAULT_MINIMAL) in (True, None)


def test_cli(tmp_path, capsys):
    source = write_prod_keys(tmp_path / "prod.keys")
    target = tmp_path / "ldn.keys"
    cli.main(["keys", "minimize", "--from", str(source), "--to", str(target)])
    cli.main(["keys", "check", str(target)])
    out = capsys.readouterr().out
    assert "600" in out and "ok        master_key_00" in out
    assert all(v not in out for v in FAKE.values())
