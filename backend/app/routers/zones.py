from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, ZoneTag
from ..schemas import TagIn, ZoneCreate, ZoneUpdate
from ..security import current_user
from ..services import zone_service as svc

router = APIRouter(prefix="/api/hosted-zones", tags=["hosted zones"], dependencies=[Depends(current_user)])


@router.get("")
def list_zones(
    f: list[str] = Query(default=[], description="Property filters, e.g. name:example (repeatable)"),
    op: str = "and",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return svc.list_zones(db, user, f, op, page, page_size)


@router.post("", status_code=201)
def create_zone(body: ZoneCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    zone = svc.create_zone(
        db, user, body.name, body.description, body.type, [t.model_dump() for t in body.tags], body.vpc_id, body.vpc_region
    )
    return svc.zone_to_dict(db, zone, with_ns=True)


@router.get("/{zone_id}")
def get_zone(zone_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.zone_to_dict(db, svc.get_zone_or_404(db, zone_id, user), with_ns=True)


@router.patch("/{zone_id}")
def update_zone(zone_id: str, body: ZoneUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    zone = svc.get_zone_or_404(db, zone_id, user)
    zone.description = body.description.strip()
    db.commit()
    return svc.zone_to_dict(db, zone, with_ns=True)


@router.delete("/{zone_id}", status_code=204)
def delete_zone(zone_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    svc.delete_zone(db, svc.get_zone_or_404(db, zone_id, user))


@router.get("/{zone_id}/tags")
def get_tags(zone_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    svc.get_zone_or_404(db, zone_id, user)
    rows = db.scalars(select(ZoneTag).where(ZoneTag.zone_id == zone_id).order_by(ZoneTag.key))
    return [{"key": t.key, "value": t.value} for t in rows]


@router.put("/{zone_id}/tags")
def put_tags(zone_id: str, tags: list[TagIn], db: Session = Depends(get_db), user: User = Depends(current_user)):
    zone = svc.get_zone_or_404(db, zone_id, user)
    return svc.replace_tags(db, zone, [t.model_dump() for t in tags])
