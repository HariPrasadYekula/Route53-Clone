from datetime import datetime, timedelta, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    account_name: Mapped[str] = mapped_column(String(128))
    account_id: Mapped[str] = mapped_column(String(12))


class Session(Base):
    __tablename__ = "sessions"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: utcnow() + timedelta(days=7))


class HostedZone(Base):
    __tablename__ = "hosted_zones"
    __table_args__ = (UniqueConstraint("owner_id", "name", "type", name="uq_zone_owner_name_type"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    type: Mapped[str] = mapped_column(String(16), default="public")
    description: Mapped[str] = mapped_column(String(256), default="")
    created_by: Mapped[str] = mapped_column(String(64), default="Route 53")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    vpc_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vpc_region: Mapped[str | None] = mapped_column(String(64), nullable=True)

    records: Mapped[list["DnsRecord"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", passive_deletes=True
    )
    tags: Mapped[list["ZoneTag"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)


class DnsRecord(Base):
    __tablename__ = "dns_records"
    __table_args__ = (UniqueConstraint("zone_id", "name", "type", name="uq_record_identity"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    type: Mapped[str] = mapped_column(String(8))
    ttl: Mapped[int] = mapped_column(Integer, default=300)
    values: Mapped[list] = mapped_column(JSON, default=list)
    routing_policy: Mapped[str] = mapped_column(String(32), default="Simple")
    alias_target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    zone: Mapped[HostedZone] = relationship(back_populates="records")


class ZoneTag(Base):
    __tablename__ = "zone_tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(128))
    value: Mapped[str] = mapped_column(String(256), default="")
