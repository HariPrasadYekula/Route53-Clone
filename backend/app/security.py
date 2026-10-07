import hashlib
import hmac
import secrets
from datetime import datetime

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from .db import get_db
from .errors import AppError
from .models import Session as SessionRow
from .models import User, utcnow

COOKIE = "r53_session"


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, _ = stored.split("$", 1)
    return hmac.compare_digest(hash_password(password, salt), stored)


def current_user(token: str | None = Cookie(default=None, alias=COOKIE), db: Session = Depends(get_db)) -> User:
    row = db.get(SessionRow, token) if token else None
    if not row or row.expires_at < utcnow():
        raise AppError("You must sign in to continue.", code="Unauthorized", status=401)
    return db.get(User, row.user_id)
