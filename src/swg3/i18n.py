"""Translation of site messages: the Portuguese text is the key, data/i18n_en.json holds the English template.

The language is set per `web.call` (contextvar). Module constants use `N_` at definition and `t` at use.
"""

import json
from contextlib import contextmanager
from contextvars import ContextVar
from functools import cache
from importlib.resources import files

LANGUAGES = ("pt", "en")
_current: ContextVar[str] = ContextVar("lang", default="pt")


@cache
def catalog() -> dict[str, str]:
    return json.loads(files("swg3").joinpath("data", "i18n_en.json").read_text(encoding="utf-8"))


def current() -> str:
    return _current.get()


@contextmanager
def language(lang: str):
    token = _current.set(lang if lang in LANGUAGES else "pt")
    try:
        yield
    finally:
        _current.reset(token)


def N_(template: str) -> str:
    """Marks a module constant for the catalog without translating it."""
    return template


def t(template: str, **values) -> str:
    if _current.get() == "en":
        template = catalog().get(template, template)
    return template.format(**values) if values else template
