import random
import re
import string

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..errors import AppError
from ..models import DnsRecord, HostedZone, User, ZoneTag
from .filters import build_clause, contains
from .validators import SYSTEM_TYPES, normalize_zone_name

_TLDS = ["com", "net", "org", "co.uk"]
_VPC_RE = re.compile(r"^vpc-[0-9a-f]{8,17}$")
MAX_TAGS = 50

ZONE_MATCHERS = {
    "name": lambda t: contains(HostedZone.name, t),
    "type": lambda t: contains(HostedZone.type, t),
    "id": lambda t: contains(HostedZone.id, t),
    "description": lambda t: contains(HostedZone.description, t),
}


def new_zone_id() -> str:
    return "Z" + "".join(random.choices(string.ascii_uppercase + string.digits, k=13))


def generate_name_servers() -> list[str]:
    """Four name servers in Route 53's format, one per TLD, e.g. ns-2048.awsdns-64.com."""
    base = random.randint(0, 2047)
    return [f"ns-{(base + i * 512) % 2048}.awsdns-{random.randint(0, 63):02d}.{tld}" for i, tld in enumerate(_TLDS)]


def soa_value(first_ns: str) -> str:
    return f"{first_ns}. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"


def zone_to_dict(db: Session, zone: HostedZone, with_ns: bool = False, count: int | None = None) -> dict:
    if count is None:
        count = db.scalar(select(func.count(DnsRecord.id)).where(DnsRecord.zone_id == zone.id))
    data = {
        "id": zone.id,
        "name": zone.name,
        "type": zone.type,
        "description": zone.description,
        "created_by": zone.created_by,
        "created_at": zone.created_at.isoformat() + "Z",
        "record_count": count,
        "vpc_id": zone.vpc_id,
        "vpc_region": zone.vpc_region,
    }
    if with_ns:
        ns = db.scalar(
            select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.type == "NS", DnsRecord.name == zone.name)
        )
        data["name_servers"] = ns.values if ns else []
    return data


def get_zone_or_404(db: Session, zone_id: str, user: User) -> HostedZone:
    """Zones belong to one account; another account's zone looks exactly like a missing one."""
    zone = db.get(HostedZone, zone_id)
    if not zone or zone.owner_id != user.id:
        raise AppError(f"No hosted zone found with ID: {zone_id}", code="NoSuchHostedZone", status=404)
    return zone


def list_zones(db: Session, user: User, filters: list[str], op: str, page: int, page_size: int) -> dict:
    stmt = select(HostedZone).where(HostedZone.owner_id == user.id)
    clause = build_clause(filters, op, ZONE_MATCHERS)
    if clause is not None:
        stmt = stmt.where(clause)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    zones = db.scalars(stmt.order_by(HostedZone.name, HostedZone.type).offset((page - 1) * page_size).limit(page_size)).all()
    counts = dict(
        db.execute(
            select(DnsRecord.zone_id, func.count(DnsRecord.id))
            .where(DnsRecord.zone_id.in_([z.id for z in zones]))
            .group_by(DnsRecord.zone_id)
        ).all()
    )
    items = [zone_to_dict(db, z, count=counts.get(z.id, 0)) for z in zones]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def build_tags(tags: list[dict]) -> list[ZoneTag]:
    """Validate a tag list the way Route 53 does and turn it into rows."""
    rows, seen = [], set()
    for tag in tags:
        key = (tag.get("key") or "").strip()
        if not key:
            continue
        if key.lower().startswith("aws:"):
            raise AppError("Tag keys can't start with the reserved prefix aws:.", field="tags")
        if key in seen:
            raise AppError(f"Tag keys must be unique. '{key}' is used more than once.", field="tags")
        seen.add(key)
        rows.append(ZoneTag(key=key, value=tag.get("value") or ""))
    if len(rows) > MAX_TAGS:
        raise AppError(f"A hosted zone can have at most {MAX_TAGS} tags.", field="tags")
    return rows


def create_zone(
    db: Session, user: User, name: str, description: str, ztype: str, tags: list[dict],
    vpc_id: str | None = None, vpc_region: str | None = None,
) -> HostedZone:
    name = normalize_zone_name(name)
    vpc_id, vpc_region = (vpc_id or "").strip(), (vpc_region or "").strip()
    if ztype == "private":
        if not _VPC_RE.match(vpc_id):
            raise AppError("Enter a valid VPC ID, for example vpc-0a1b2c3d4e5f67890.", field="vpc_id")
        if not vpc_region:
            raise AppError("Choose the Region of the VPC.", field="vpc_region")
    else:
        vpc_id = vpc_region = ""
    exists = db.scalar(
        select(HostedZone.id).where(HostedZone.owner_id == user.id, HostedZone.name == name, HostedZone.type == ztype)
    )
    already = AppError(f"A {ztype} hosted zone named {name} already exists.", code="HostedZoneAlreadyExists", field="name")
    if exists:
        raise already
    zone = HostedZone(
        id=new_zone_id(), owner_id=user.id, name=name, type=ztype, description=(description or "").strip(),
        created_by="Route 53", vpc_id=vpc_id or None, vpc_region=vpc_region or None,
    )
    ns = generate_name_servers()
    zone.records = [
        DnsRecord(name=name, type="NS", ttl=172800, values=ns),
        DnsRecord(name=name, type="SOA", ttl=900, values=[soa_value(ns[0])]),
    ]
    zone.tags = build_tags(tags)
    db.add(zone)
    try:
        db.commit()
    except IntegrityError:  # two identical requests raced
        db.rollback()
        raise already
    return zone


def replace_tags(db: Session, zone: HostedZone, tags: list[dict]) -> list[dict]:
    zone.tags = build_tags(tags)
    db.commit()
    return [{"key": t.key, "value": t.value} for t in zone.tags]


def delete_zone(db: Session, zone: HostedZone) -> None:
    extra = db.scalar(
        select(func.count(DnsRecord.id)).where(DnsRecord.zone_id == zone.id, DnsRecord.type.not_in(list(SYSTEM_TYPES)))
    )
    if extra:
        raise AppError(
            "The specified hosted zone contains non-required resource record sets and so cannot be deleted.",
            code="HostedZoneNotEmpty",
            status=400,
        )
    db.delete(zone)
    db.commit()
