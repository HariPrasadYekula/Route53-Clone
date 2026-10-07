"""Minimal BIND zone file parser used by 'Import zone file' (mirrors Route 53's documented behaviour).

- SOA records and apex NS records are ignored.
- $GENERATE / $INCLUDE make the import fail.
- Names without a trailing dot are relative to $ORIGIN (default: the hosted zone).
- Split TXT strings are joined.
"""
import shlex

from ..errors import AppError
from .validators import RECORD_TYPES

_CLASSES = {"IN", "CH", "HS"}


def _scan(raw: str) -> tuple[str, int]:
    """Drop the trailing comment and turn parentheses (outside quotes) into spaces.

    Returns the cleaned line and how many parentheses it opened minus closed.
    """
    out, quoted, depth = [], False, 0
    for ch in raw:
        if ch == '"':
            quoted = not quoted
        elif not quoted:
            if ch == ";":
                break
            if ch in "()":
                depth += 1 if ch == "(" else -1
                out.append(" ")
                continue
        out.append(ch)
    return "".join(out).rstrip(), depth


def _logical_lines(text: str) -> list[str]:
    """Join records that span several lines using parentheses."""
    lines, buf, depth = [], "", 0
    for raw in text.splitlines():
        line, delta = _scan(raw)
        if not line.strip() and not buf:
            continue
        depth += delta
        buf = f"{buf} {line.strip()}" if buf else line
        if depth <= 0:
            lines.append(buf)
            buf, depth = "", 0
    if buf:
        lines.append(buf)
    return lines


def _absolute(name: str, origin: str) -> str:
    if name == "@":
        return origin
    if name.endswith("."):
        return name.rstrip(".").lower()
    return f"{name}.{origin}".lower()


def parse_zone_file(text: str, zone_name: str) -> list[dict]:
    origin, default_ttl, last_name = zone_name, 300, zone_name
    grouped: dict[tuple[str, str], dict] = {}
    for line in _logical_lines(text):
        stripped = line.strip()
        upper = stripped.upper()
        if upper.startswith(("$GENERATE", "$INCLUDE")):
            raise AppError("The zone file contains $GENERATE or $INCLUDE, which Route 53 doesn't support.", field="zone_file")
        if upper.startswith("$ORIGIN"):
            parts = stripped.split()
            if len(parts) < 2:
                raise AppError(f"Invalid $ORIGIN directive: {stripped}", field="zone_file")
            origin = parts[1].rstrip(".").lower()
            continue
        if upper.startswith("$TTL"):
            try:
                default_ttl = int(stripped.split()[1])
            except (IndexError, ValueError):
                raise AppError(f"Invalid $TTL directive: {stripped}", field="zone_file")
            continue
        try:
            tokens = shlex.split(line, posix=False)
        except ValueError:
            raise AppError(f"Could not parse line: {stripped}", field="zone_file")
        if not tokens:
            continue
        starts_blank = line[0] in " \t"
        idx = 0
        if starts_blank:
            name = last_name
        else:
            name = _absolute(tokens[0], origin)
            last_name = name
            idx = 1
        ttl = default_ttl
        while idx < len(tokens) and (tokens[idx].upper() in _CLASSES or tokens[idx].isdigit()):
            if tokens[idx].isdigit():
                ttl = int(tokens[idx])
            idx += 1
        if idx >= len(tokens):
            raise AppError(f"Missing record type: {stripped}", field="zone_file")
        rtype, rdata = tokens[idx].upper(), tokens[idx + 1:]
        if rtype == "SOA" or (rtype == "NS" and name == zone_name):
            continue
        if rtype not in RECORD_TYPES:
            raise AppError(f"Record type {rtype} is not supported for import.", field="zone_file")
        if name != zone_name and not name.endswith("." + zone_name):
            raise AppError(f"The record {name} is outside the hosted zone {zone_name}.", field="zone_file")
        if rtype == "TXT":
            value = "".join(p[1:-1] if p.startswith('"') and p.endswith('"') else p for p in rdata)
        elif rtype == "CAA":
            value = " ".join(rdata)
        else:
            value = " ".join(rdata)
            if rtype in ("CNAME", "NS", "PTR"):
                value = _absolute(value, origin)
            elif rtype == "MX" and len(rdata) == 2:
                value = f"{rdata[0]} {_absolute(rdata[1], origin)}"
            elif rtype == "SRV" and len(rdata) == 4:
                value = f"{' '.join(rdata[:3])} {_absolute(rdata[3], origin)}"
        entry = grouped.setdefault((name, rtype), {"name": name, "type": rtype, "ttl": ttl, "values": []})
        entry["values"].append(value)
    if not grouped:
        raise AppError("No importable records were found in the zone file.", field="zone_file")
    return list(grouped.values())
