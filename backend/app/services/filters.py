"""Shared handling of the console's property-filter tokens.

The frontend sends every token as a repeated `f=<property>:<text>` query parameter (free text uses
the `all` property) plus `op=and|or`. Each list endpoint declares which properties it understands.
"""
from typing import Callable

from sqlalchemy import and_, func, or_
from sqlalchemy.sql.elements import ColumnElement

Matcher = Callable[[str], ColumnElement]


def contains(column, text: str) -> ColumnElement:
    """Case-insensitive substring match with LIKE wildcards in the user's text escaped."""
    return func.lower(column).contains(text.lower(), autoescape=True)


def parse_filters(raw: list[str], known: set[str]) -> list[tuple[str, str]]:
    parsed = []
    for item in raw:
        key, sep, text = item.partition(":")
        if not sep or key not in known:
            key, text = "all", item  # unknown prefix: the whole thing is free text
        text = text.strip()
        if text:
            parsed.append((key, text))
    return parsed


def build_clause(raw: list[str], op: str, matchers: dict[str, Matcher]) -> ColumnElement | None:
    conditions = []
    for key, text in parse_filters(raw, {"all", *matchers}):
        if key == "all":
            conditions.append(or_(*(match(text) for match in matchers.values())))
        else:
            conditions.append(matchers[key](text))
    if not conditions:
        return None
    return or_(*conditions) if op == "or" else and_(*conditions)
