from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import User
from .security import hash_password
from .services import record_service, zone_service

DEMO_VPC = "vpc-0a1b2c3d4e5f67890"

# (name, description, type, records)
DEMO_ZONES = [
    ("example.com", "Primary website zone", "public", [
        {"name": "", "type": "A", "ttl": 300, "values": ["192.0.2.44"]},
        {"name": "www", "type": "CNAME", "ttl": 300, "values": ["example.com"]},
        {"name": "", "type": "MX", "ttl": 3600, "values": ["10 mail1.example.com", "20 mail2.example.com"]},
        {"name": "", "type": "TXT", "ttl": 300, "values": ["v=spf1 include:_spf.example.com ~all"]},
        {"name": "_sip._tcp", "type": "SRV", "ttl": 300, "values": ["10 5 5060 sip.example.com"]},
        {"name": "", "type": "CAA", "ttl": 3600, "values": ['0 issue "letsencrypt.org"']},
    ]),
    ("api.example.com", "API subdomain", "public", [
        {"name": "", "type": "A", "ttl": 60, "values": ["198.51.100.10", "198.51.100.11"]},
        {"name": "", "type": "AAAA", "ttl": 60, "values": ["2001:db8::1"]},
    ]),
    ("internal.corp", "Private zone for internal services", "private", [
        {"name": "db", "type": "A", "ttl": 60, "values": ["10.0.1.25"]},
    ]),
    ("mycompany.io", "Marketing site", "public", [
        {"name": "blog", "type": "CNAME", "ttl": 300, "values": ["hosting.example.net"]},
    ]),
    ("shop.example.org", "Storefront", "public", [
        {"name": "", "type": "A", "ttl": 300, "values": ["203.0.113.7"]},
    ]),
]


def seed(db: Session) -> None:
    """On an empty database create the demo account (admin / admin123) with five sample zones."""
    if db.scalar(select(User.id).limit(1)):
        return
    admin = User(username="admin", password_hash=hash_password("admin123"), account_name="Demo Account", account_id="123456789012")
    db.add(admin)
    db.commit()
    for name, description, ztype, records in DEMO_ZONES:
        private = ztype == "private"
        zone = zone_service.create_zone(
            db, admin, name, description, ztype, [{"key": "env", "value": "demo"}],
            DEMO_VPC if private else None, "us-east-1" if private else None,
        )
        if records:
            record_service.create_records(db, zone, records)
