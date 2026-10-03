# Console keys

The LDN host needs console keys to derive the advertisement and data keys (see [LDN](../research/ldn.md)). Code in `src/swg3/keys.py`.

## Where they live

- Minimal file: `.secrets/ldn.keys`, inside the project, ignored by git (`.gitignore`), permission 600 and folder 700.
- Only four entries: `master_key_00`, `master_key_12`, `aes_kek_generation_source`, `aes_key_generation_source` (the ones the LDN library reads, `references/pokeldn/vendor/LDN/ldn/__init__.py`).
- The full `prod.keys` does not enter the project. It is read once to generate the minimal file and is not modified: the original is its own backup.
- Alternative paths: `SWG3_KEYS` (minimal file) and `SWG3_PROD_KEYS` (source, default `~/.switch/prod.keys`).

## Commands

- `uv run swg3 keys minimize [--from PATH] [--to PATH]`: generates the minimal file. Warns and exits with an error if the destination is not ignored by git.
- `uv run swg3 keys check`: shows the path, the permission, whether git ignores it and which keys are present. Never shows values.

## On the host

Before running, the host calls `keys.ensure()`: if `.secrets/ldn.keys` does not exist, it generates it from `prod.keys`; then it reads it with `keys.load()`, which requires permission 600 and the four keys.

## Rules

- No key value in docs, logs, captures, tests, error messages or commits. Tests use random values generated on the fly.
- Only keys from your own console.
