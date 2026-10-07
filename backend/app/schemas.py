import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

_USERNAME_RE = re.compile(r"[A-Za-z0-9+=,.@_-]+")


class LoginIn(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    account: str | None = None


class SignupIn(BaseModel):
    username: str
    password: str
    account_name: str = ""

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip()
        if not 3 <= len(v) <= 64 or not _USERNAME_RE.fullmatch(v):
            raise ValueError("User name must be 3 to 64 characters: letters, numbers and + = , . @ _ - only.")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if not 8 <= len(v) <= 128:
            raise ValueError("Password must be between 8 and 128 characters.")
        return v

    @field_validator("account_name")
    @classmethod
    def _account_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 64:
            raise ValueError("Account alias can have at most 64 characters.")
        return v


class TagIn(BaseModel):
    key: str = Field(max_length=128)
    value: str = Field(default="", max_length=256)


class ZoneCreate(BaseModel):
    name: str
    description: str = Field(default="", max_length=256)
    type: Literal["public", "private"] = "public"
    tags: list[TagIn] = []
    vpc_id: str | None = None
    vpc_region: str | None = None


class ZoneUpdate(BaseModel):
    description: str = Field(max_length=256)


class RecordIn(BaseModel):
    name: str = ""
    type: str
    ttl: int = 300
    values: list[str] = []
    routing_policy: str = "Simple"
    alias_target: str | None = None


class BulkDelete(BaseModel):
    ids: list[int] = Field(min_length=1)


class ZoneFileIn(BaseModel):
    zone_file: str = Field(min_length=1, max_length=200_000)
