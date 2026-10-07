"""Per-record-type value validation, modelled on Route 53's documented value formats."""
import ipaddress
import re

from ..errors import AppError

RECORD_TYPES = ["A", "AAAA", "CAA", "CNAME", "MX", "NS", "PTR", "SRV", "TXT"]
SYSTEM_TYPES = {"NS", "SOA"}
ALIAS_TYPES = {"A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA"}

_LABEL = r"(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)"
HOST_RE = re.compile(rf"^(?:\*\.)?{_LABEL}(?:\.{_LABEL})*\.?$")
ZONE_RE = re.compile(rf"^{_LABEL}(?:\.{_LABEL})+$")


def normalize_zone_name(raw: str) -> str:
    name = (raw or "").strip().lower().rstrip(".")
    if not name:
        raise AppError("Domain name is required.", field="name")
    if "." not in name:
        raise AppError(
            "Route 53 doesn't support hosting top-level domains (TLD) such as .com. "
            "Enter a domain or subdomain, for example example.com.",
            field="name",
        )
    if len(name) > 253 or not ZONE_RE.match(name):
        raise AppError("Domain name is not valid. Use letters, numbers and hyphens, e.g. example.com.", field="name")
    return name


def full_record_name(raw: str, zone_name: str) -> str:
    """'' or '@' -> apex, 'www' -> www.<zone>, 'www.<zone>' stays as is."""
    name = (raw or "").strip().lower().rstrip(".")
    if name in ("", "@"):
        return zone_name
    if name == zone_name or name.endswith("." + zone_name):
        full = name
    elif name.endswith(zone_name):
        raise AppError(f"The record name must end with the hosted zone name {zone_name}.", field="name")
    else:
        full = f"{name}.{zone_name}"
    if len(full) > 253 or not HOST_RE.match(full):
        raise AppError("Record name is not valid.", field="name")
    return full


def _host(value: str) -> str:
    v = value.strip().lower()
    if not HOST_RE.match(v):
        raise AppError(f"'{value}' is not a valid domain name.", field="values")
    return v.rstrip(".")


def _int(text: str, lo: int, hi: int, label: str) -> int:
    if not text.isdigit() or not lo <= int(text) <= hi:
        raise AppError(f"{label} must be a number between {lo} and {hi}.", field="values")
    return int(text)


def validate_values(rtype: str, values: list[str]) -> list[str]:
    values = [v.strip() for v in values if v and v.strip()]
    if rtype not in RECORD_TYPES:
        raise AppError(f"Record type {rtype} is not supported.", field="type")
    if not values:
        raise AppError("At least one value is required.", field="values")
    if rtype == "CNAME" and len(values) > 1:
        raise AppError("A CNAME record can have only one value.", field="values")

    out: list[str] = []
    for v in values:
        if rtype == "A":
            try:
                ipaddress.IPv4Address(v)
            except ValueError:
                raise AppError(f"'{v}' is not a valid IPv4 address.", field="values")
            out.append(v)
        elif rtype == "AAAA":
            try:
                out.append(str(ipaddress.IPv6Address(v)))
            except ValueError:
                raise AppError(f"'{v}' is not a valid IPv6 address.", field="values")
        elif rtype in ("CNAME", "NS", "PTR"):
            out.append(_host(v))
        elif rtype == "MX":
            parts = v.split()
            if len(parts) != 2:
                raise AppError("MX values must be 'priority mail-server', e.g. 10 mail.example.com.", field="values")
            out.append(f"{_int(parts[0], 0, 65535, 'MX priority')} {_host(parts[1])}")
        elif rtype == "SRV":
            parts = v.split()
            if len(parts) != 4:
                raise AppError("SRV values must be 'priority weight port hostname', e.g. 10 5 5060 sip.example.com.", field="values")
            p = _int(parts[0], 0, 65535, "Priority")
            w = _int(parts[1], 0, 65535, "Weight")
            port = _int(parts[2], 0, 65535, "Port")
            out.append(f"{p} {w} {port} {_host(parts[3])}")
        elif rtype == "CAA":
            m = re.match(r'^(\d{1,3})\s+(issue|issuewild|iodef)\s+"(.*)"$', v, re.I)
            if not m or int(m.group(1)) > 255:
                raise AppError('CAA values must look like: 0 issue "letsencrypt.org".', field="values")
            out.append(f'{int(m.group(1))} {m.group(2).lower()} "{m.group(3)}"')
        elif rtype == "TXT":
            body = v[1:-1] if len(v) >= 2 and v.startswith('"') and v.endswith('"') else v
            if len(body) > 4000:
                raise AppError("TXT values can be at most 4000 characters.", field="values")
            out.append(f'"{body}"')
    return out


def validate_ttl(ttl) -> int:
    try:
        ttl = int(ttl)
    except (TypeError, ValueError):
        raise AppError("TTL must be a whole number of seconds.", field="ttl")
    if not 0 <= ttl <= 2147483647:
        raise AppError("TTL must be between 0 and 2147483647 seconds.", field="ttl")
    return ttl


def validate_alias_target(target: str) -> str:
    t = target.strip().lower()
    if not HOST_RE.match(t):
        raise AppError(f"'{target}' is not a valid alias target.", field="alias_target")
    return t.rstrip(".")
