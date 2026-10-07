import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import models  # noqa: F401  (register tables)
from .db import Base, SessionLocal, engine
from .errors import AppError, app_error_handler, http_error_handler, validation_handler
from .routers import auth, export, records, zones
from .seed import seed


def _reset_legacy_schema() -> None:
    """Databases created before zones belonged to an account have no hosted_zones.owner_id.

    There is no migration tool in this project, so such a file (demo data only) is rebuilt from scratch.
    """
    inspector = inspect(engine)
    if inspector.has_table("hosted_zones") and "owner_id" not in {c["name"] for c in inspector.get_columns("hosted_zones")}:
        Base.metadata.drop_all(engine)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _reset_legacy_schema()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Route 53 Clone API", version="1.1.0", lifespan=lifespan)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(StarletteHTTPException, http_error_handler)
app.add_exception_handler(RequestValidationError, validation_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (auth.router, zones.router, records.router, export.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
