from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import BulkDelete, RecordIn, ZoneFileIn
from ..security import current_user
from ..services import record_service as svc
from ..services.validators import RECORD_TYPES
from ..services.zone_file import parse_zone_file
from ..services.zone_service import get_zone_or_404

router = APIRouter(prefix="/api/hosted-zones/{zone_id}/records", tags=["records"], dependencies=[Depends(current_user)])


@router.get("/types")
def record_types():
    return RECORD_TYPES


@router.get("/test")
def test_record(zone_id: str, name: str = "", type: str = "A", db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.test_record(db, get_zone_or_404(db, zone_id, user), name, type)


@router.get("")
def list_records(
    zone_id: str,
    f: list[str] = Query(default=[], description="Property filters, e.g. name:www (repeatable)"),
    op: str = "and",
    type: str | None = None,
    routing_policy: str | None = None,
    alias: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    zone = get_zone_or_404(db, zone_id, user)
    return svc.list_records(db, zone, f, op, type, routing_policy, alias, page, page_size)


@router.post("", status_code=201)
def create_records(zone_id: str, body: RecordIn | list[RecordIn], db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Accepts one record or a list (Quick create). A list is created atomically."""
    items = body if isinstance(body, list) else [body]
    created = svc.create_records(db, get_zone_or_404(db, zone_id, user), [i.model_dump() for i in items])
    return [svc.record_to_dict(r) for r in created]


@router.post("/import", status_code=201)
def import_zone_file(zone_id: str, body: ZoneFileIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Import a BIND zone file. All-or-nothing: fails if any record already exists."""
    zone = get_zone_or_404(db, zone_id, user)
    created = svc.create_records(db, zone, parse_zone_file(body.zone_file, zone.name))
    return {"imported": len(created), "records": [svc.record_to_dict(r) for r in created]}


@router.post("/bulk-delete")
def bulk_delete(zone_id: str, body: BulkDelete, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {"deleted": svc.delete_records(db, get_zone_or_404(db, zone_id, user), body.ids)}


@router.put("/{record_id}")
def update_record(zone_id: str, record_id: int, body: RecordIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    zone = get_zone_or_404(db, zone_id, user)
    rec = svc.get_record_or_404(db, zone, record_id)
    return svc.record_to_dict(svc.update_record(db, zone, rec, body.model_dump()))


@router.delete("/{record_id}", status_code=204)
def delete_record(zone_id: str, record_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    zone = get_zone_or_404(db, zone_id, user)
    svc.delete_records(db, zone, [record_id])
