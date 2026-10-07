from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from ..errors import AppError
from ..models import DnsRecord, HostedZone
from .filters import build_clause, contains
from .validators import ALIAS_TYPES, SYSTEM_TYPES, full_record_name, validate_alias_target, validate_ttl, validate_values


def record_to_dict(r: DnsRecord) -> dict:
    return {
        "id": r.id,
        "zone_id": r.zone_id,
        "name": r.name,
        "type": r.type,
        "ttl": r.ttl,
        "values": r.values,
        "routing_policy": r.routing_policy,
        "alias": r.alias_target is not None,
        "alias_target": r.alias_target,
        "created_at": r.created_at.isoformat() + "Z",
        "updated_at": r.updated_at.isoformat() + "Z",
    }


def _value_match(text: str):
    return or_(contains(cast(DnsRecord.values, String), text), contains(func.coalesce(DnsRecord.alias_target, ""), text))


RECORD_MATCHERS = {
    "name": lambda t: contains(DnsRecord.name, t),
    "type": lambda t: contains(DnsRecord.type, t),
    "value": _value_match,
}


def list_records(
    db: Session, zone: HostedZone, filters: list[str], op: str, rtype: str | None, policy: str | None,
    alias: bool | None, page: int, page_size: int,
) -> dict:
    stmt = select(DnsRecord).where(DnsRecord.zone_id == zone.id)
    if rtype:
        stmt = stmt.where(DnsRecord.type == rtype.upper())
    if policy:
        stmt = stmt.where(DnsRecord.routing_policy == policy)
    if alias is True:
        stmt = stmt.where(DnsRecord.alias_target.is_not(None))
    elif alias is False:
        stmt = stmt.where(DnsRecord.alias_target.is_(None))
    clause = build_clause(filters, op, RECORD_MATCHERS)
    if clause is not None:
        stmt = stmt.where(clause)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(DnsRecord.name, DnsRecord.type).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [record_to_dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}


def _check_conflicts(db: Session, zone: HostedZone, name: str, rtype: str, ignore_id: int | None = None) -> None:
    same_name = [
        r for r in db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.name == name)) if r.id != ignore_id
    ]
    if any(r.type == rtype for r in same_name):
        raise AppError(
            f"Tried to create resource record set [name='{name}.', type='{rtype}'] but it already exists",
            code="RecordAlreadyExists", field="name",
        )
    if rtype == "CNAME":
        if name == zone.name:
            raise AppError("A CNAME record can't have the same name as the hosted zone.", field="name")
        if same_name:
            raise AppError(
                f"RRSet of type CNAME with DNS name {name}. is not permitted as it conflicts with other records with the same DNS name.",
                field="type",
            )
    elif any(r.type == "CNAME" for r in same_name):
        raise AppError(
            f"RRSet of type {rtype} with DNS name {name}. is not permitted as it conflicts with a CNAME record with the same DNS name.",
            field="type",
        )


def _prepare(db: Session, zone: HostedZone, data: dict, ignore_id: int | None = None) -> dict:
    rtype = (data.get("type") or "").upper()
    if rtype in SYSTEM_TYPES and ignore_id is None:
        raise AppError(f"{rtype} records are managed by Route 53 and can't be created.", field="type")
    name = full_record_name(data.get("name", ""), zone.name)
    alias_target = (data.get("alias_target") or "").strip() or None
    if alias_target:
        if rtype not in ALIAS_TYPES:
            raise AppError(f"Alias records aren't supported for type {rtype}.", field="type")
        ttl, values = 0, []
        alias_target = validate_alias_target(alias_target)
    else:
        ttl, values = validate_ttl(data.get("ttl", 300)), validate_values(rtype, data.get("values", []))
    prepared = {
        "name": name,
        "type": rtype,
        "ttl": ttl,
        "values": values,
        "routing_policy": data.get("routing_policy") or "Simple",
        "alias_target": alias_target,
    }
    _check_conflicts(db, zone, name, rtype, ignore_id)
    return prepared


def create_records(db: Session, zone: HostedZone, items: list[dict]) -> list[DnsRecord]:
    """All-or-nothing: the first invalid item aborts the batch and the error carries its index."""
    created, seen = [], set()
    try:
        for i, item in enumerate(items):
            try:
                prepared = _prepare(db, zone, item)
                key = (prepared["name"], prepared["type"])
                if key in seen:
                    raise AppError(f"Duplicate record in request: {key[0]} {key[1]}.", field="name")
            except AppError as exc:
                exc.index = i
                raise
            seen.add(key)
            rec = DnsRecord(zone_id=zone.id, **prepared)
            db.add(rec)
            db.flush()
            created.append(rec)
        db.commit()
    except AppError:
        db.rollback()
        raise
    return created


def get_record_or_404(db: Session, zone: HostedZone, record_id: int) -> DnsRecord:
    rec = db.get(DnsRecord, record_id)
    if not rec or rec.zone_id != zone.id:
        raise AppError("Record not found.", code="NoSuchRecord", status=404)
    return rec


def update_record(db: Session, zone: HostedZone, rec: DnsRecord, data: dict) -> DnsRecord:
    if rec.type in SYSTEM_TYPES:
        rec.ttl = validate_ttl(data.get("ttl", rec.ttl))
    else:
        data = {**data, "type": data.get("type") or rec.type}
        prepared = _prepare(db, zone, data, ignore_id=rec.id)
        for k, v in prepared.items():
            setattr(rec, k, v)
    db.commit()
    return rec


def delete_records(db: Session, zone: HostedZone, ids: list[int]) -> int:
    rows = [get_record_or_404(db, zone, i) for i in ids]
    if any(r.type in SYSTEM_TYPES for r in rows):
        raise AppError("You can't delete NS or SOA records.", code="SystemRecord", status=400)
    for r in rows:
        db.delete(r)
    db.commit()
    return len(rows)


def test_record(db: Session, zone: HostedZone, name: str, rtype: str) -> dict:
    """Mimics Route 53 'Test record': answer from the zone's own data (no real DNS lookup)."""
    fqdn = full_record_name(name, zone.name)
    rtype = (rtype or "A").upper()
    rec = db.scalar(select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.name == fqdn, DnsRecord.type == rtype))
    if rec is None:
        cname = db.scalar(select(DnsRecord).where(DnsRecord.zone_id == zone.id, DnsRecord.name == fqdn, DnsRecord.type == "CNAME"))
        rec = cname
    if rec is None:
        exists = db.scalar(select(func.count(DnsRecord.id)).where(DnsRecord.zone_id == zone.id, DnsRecord.name == fqdn))
        return {"response_code": "NOERROR" if exists else "NXDOMAIN", "record_name": fqdn, "record_type": rtype, "protocol": "UDP", "answers": []}
    values = [rec.alias_target] if rec.alias_target else rec.values
    return {
        "response_code": "NOERROR", "record_name": fqdn, "record_type": rec.type, "protocol": "UDP",
        "ttl": rec.ttl, "answers": values,
    }
