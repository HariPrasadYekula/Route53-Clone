import os
import secrets

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import AppError
from ..models import Session as SessionRow
from ..models import User
from ..schemas import LoginIn, SignupIn
from ..security import COOKIE, current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_SECONDS = 7 * 24 * 3600


def _user_out(u: User) -> dict:
    return {"username": u.username, "account_name": u.account_name, "account_id": u.account_id}


def _open_session(db: Session, response: Response, user: User) -> None:
    token = secrets.token_urlsafe(32)
    db.add(SessionRow(token=token, user_id=user.id))
    db.commit()
    response.set_cookie(
        COOKIE, token, httponly=True, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "1",
        max_age=SESSION_SECONDS, path="/",
    )


def _new_account_id(db: Session) -> str:
    while True:
        candidate = str(secrets.randbelow(9) + 1) + "".join(str(secrets.randbelow(10)) for _ in range(11))
        if not db.scalar(select(User.id).where(User.account_id == candidate)):
            return candidate


def _account_matches(user: User, account: str | None) -> bool:
    """The account field is optional here; when given it must be the account ID (dashes allowed) or alias."""
    given = (account or "").strip()
    if not given:
        return True
    return given.replace("-", "") == user.account_id or given.lower() == user.account_name.lower()


@router.post("/signup", status_code=201)
def signup(body: SignupIn, response: Response, db: Session = Depends(get_db)):
    taken = AppError(
        "An IAM user with this name already exists. Choose a different user name.",
        code="UsernameAlreadyExists", status=409, field="username",
    )
    if db.scalar(select(User.id).where(func.lower(User.username) == body.username.lower())):
        raise taken
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        account_name=body.account_name or f"{body.username}'s account",
        account_id=_new_account_id(db),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # same name registered between the check and the insert
        db.rollback()
        raise taken
    _open_session(db, response, user)
    return _user_out(user)


@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.username) == body.username.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash) or not _account_matches(user, body.account):
        raise AppError("Your authentication information is incorrect. Please try again.", code="InvalidCredentials", status=401)
    _open_session(db, response, user)
    return _user_out(user)


@router.post("/logout", status_code=204)
def logout(response: Response, db: Session = Depends(get_db), token: str | None = Cookie(default=None, alias=COOKIE)):
    """Ends only this browser's session; always succeeds so a stale cookie can still be cleared."""
    row = db.get(SessionRow, token) if token else None
    if row:
        db.delete(row)
        db.commit()
    response.delete_cookie(COOKIE, path="/")


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _user_out(user)
