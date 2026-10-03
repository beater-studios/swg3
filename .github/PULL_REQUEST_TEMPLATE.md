## What and why

<!-- What this changes and why. Link the issue, if there is one. -->

## How it was tested

<!-- Commands you ran, browsers or devices, and anything tested on a real console. -->

## Checklist

- [ ] `uv run --group dev pytest -q`, `npm test` and `npm run e2e` (in `web/`) pass.
- [ ] Logic shared by Python and TypeScript keeps parity (`uv run python tools/gen_parity_vectors.py`).
- [ ] New interface text has its English translation.
- [ ] Formats, addresses and game rules cite the decomp; anything unconfirmed on the console is marked "not verified".
- [ ] Docs in `docs/` updated, if behavior or decisions changed.
- [ ] No keys, passphrases or personal files (saves, pk3 of others) in the change.
