from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import DnsRecord, User
from ..security import current_user
from ..services import record_service
from ..services.zone_service import get_zone_or_404, zone_to_dict

router = APIRouter(prefix="/api/hosted-zones/{zone_id}/export", tags=["export"], dependencies=[Depends(current_user)])


@router.get("")
def export_zone(zone_id: str, format: str = "json", db: Session = Depends(get_db), user: User = Depends(current_user)):
    zone = get_zone_or_404(db, zone_id, user)
    records = db.scalars(select(DnsRecord).where(DnsRecord.zone_id == zone.id).order_by(DnsRecord.name, DnsRecord.type)).all()
    if format == "bind":
        lines = [f"$ORIGIN {zone.name}.", f"; Exported from Route 53 clone - zone {zone.id}"]
        for r in records:
            if r.alias_target:  # BIND has no alias concept, so keep it as a comment instead of dropping it silently
                lines.append(f"; ALIAS {r.name}. {r.type} -> {r.alias_target}.")
                continue
            for v in r.values:
                lines.append(f"{r.name}.\t{r.ttl}\tIN\t{r.type}\t{v}")
        return PlainTextResponse("\n".join(lines) + "\n", headers={"Content-Disposition": f'attachment; filename="{zone.name}.zone"'})
    body = {"hosted_zone": zone_to_dict(db, zone, with_ns=True), "records": [record_service.record_to_dict(r) for r in records]}
    return JSONResponse(body, headers={"Content-Disposition": f'attachment; filename="{zone.name}.json"'})
