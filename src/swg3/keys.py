"""Minimal LDN key file in .secrets/ (the four `prod.keys` entries read by references/pokeldn/vendor/LDN/ldn/__init__.py).

No key value is ever printed, logged or included in an error message.
"""

import os
import re
import stat
import subprocess
from pathlib import Path

from . import brand

LDN_KEYS = ("master_key_00", "master_key_12", "aes_kek_generation_source", "aes_key_generation_source")
KEY_HEX_LENGTH = 32

ROOT = Path(__file__).resolve().parents[2]
SECRETS_DIR = ROOT / ".secrets"
DEFAULT_MINIMAL = SECRETS_DIR / "ldn.keys"
DEFAULT_SOURCE = Path("~/.switch/prod.keys")
ENV_KEYS = f"{brand.SLUG.upper()}_KEYS"          # alternative path of the minimal file
ENV_SOURCE = f"{brand.SLUG.upper()}_PROD_KEYS"   # alternative path of prod.keys

_LINE = re.compile(r"^\s*([A-Za-z0-9_]+)\s*=\s*([0-9A-Fa-f]+)\s*$")


class KeysError(ValueError):
    """The message never contains key values."""


def minimal_path() -> Path:
    return Path(os.environ.get(ENV_KEYS) or DEFAULT_MINIMAL).expanduser()


def source_path() -> Path:
    return Path(os.environ.get(ENV_SOURCE) or DEFAULT_SOURCE).expanduser()


def parse(text: str) -> dict[str, str]:
    """`name = hex` per line; comments (`;` or `#`) and blank lines ignored. Names lowercased."""
    keys = {}
    for number, line in enumerate(text.splitlines(), 1):
        line = line.split(";", 1)[0].split("#", 1)[0].strip()
        if not line:
            continue
        match = _LINE.match(line)
        if not match:
            raise KeysError(f"line {number} is not in the `name = hex` format")
        keys[match.group(1).lower()] = match.group(2).lower()
    return keys


def select(keys: dict[str, str]) -> dict[str, str]:
    missing = [name for name in LDN_KEYS if name not in keys]
    if missing:
        raise KeysError(f"missing from the file: {', '.join(missing)}")
    wrong = [name for name in LDN_KEYS if len(keys[name]) != KEY_HEX_LENGTH]
    if wrong:
        raise KeysError(f"unexpected length (expected {KEY_HEX_LENGTH} hex digits): {', '.join(wrong)}")
    return {name: keys[name] for name in LDN_KEYS}


def _check_private(path: Path):
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & 0o077:
        raise KeysError(f"{path}: mode {mode:o}; use chmod 600 (readable only by the owner)")


def minimize(source: Path | None = None, target: Path | None = None) -> Path:
    source = (source or source_path()).expanduser()
    target = (target or minimal_path()).expanduser()
    if source.resolve() == target.resolve():
        raise KeysError("source and target are the same file: the original is never changed")
    if not source.is_file():
        raise KeysError(f"prod.keys not found at {source}")
    chosen = select(parse(source.read_text(encoding="utf-8", errors="strict")))
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.parent == SECRETS_DIR:
        os.chmod(target.parent, 0o700)
    body = "".join(f"{name} = {value}\n" for name, value in chosen.items())
    # Create with 600 from the start, with no window where others could read the file.
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(body)
    os.chmod(target, 0o600)
    return target


def load(path: Path | None = None) -> dict[str, bytes]:
    path = (path or minimal_path()).expanduser()
    if not path.is_file():
        raise KeysError(f"key file not found at {path}; run `swg3 keys minimize`")
    _check_private(path)
    chosen = select(parse(path.read_text(encoding="utf-8")))
    return {name: bytes.fromhex(value) for name, value in chosen.items()}


def ensure(source: Path | None = None) -> Path:
    target = minimal_path()
    if not target.is_file():
        minimize(source, target)
    load(target)
    return target


def git_ignored(path: Path) -> bool | None:
    """None outside a git repository."""
    try:
        result = subprocess.run(["git", "-C", str(ROOT), "check-ignore", "-q", str(path)],
                                capture_output=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode == 128:
        return None
    return result.returncode == 0


def status(path: Path | None = None) -> dict:
    path = (path or minimal_path()).expanduser()
    out = {"path": str(path), "exists": path.is_file(), "ignored": git_ignored(path)}
    if out["exists"]:
        out["mode"] = f"{stat.S_IMODE(path.stat().st_mode):o}"
        try:
            present = parse(path.read_text(encoding="utf-8"))
            out["keys"] = {name: name in present for name in LDN_KEYS}
            out["extra"] = sorted(set(present) - set(LDN_KEYS))
        except KeysError as error:
            out["error"] = str(error)
    return out
