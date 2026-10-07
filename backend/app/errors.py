from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_HTTP_CODES = {401: "Unauthorized", 403: "Forbidden", 404: "NotFound", 405: "MethodNotAllowed"}


class AppError(Exception):
    """A business-rule failure. `field` names the form field to highlight, `index` the item of a batch."""

    def __init__(self, message: str, code: str = "BadRequest", status: int = 400, field: str | None = None, index: int | None = None):
        super().__init__(message)
        self.message, self.code, self.status, self.field, self.index = message, code, status, field, index


def _body(code: str, message: str, field: str | None = None, index: int | None = None):
    return {"error": {"code": code, "message": message, "field": field, "index": index}}


async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(_body(exc.code, exc.message, exc.field, exc.index), status_code=exc.status)


async def http_error_handler(_: Request, exc: StarletteHTTPException):
    code = _HTTP_CODES.get(exc.status_code, "HttpError")
    return JSONResponse(_body(code, str(exc.detail)), status_code=exc.status_code, headers=getattr(exc, "headers", None))


async def validation_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    last = first["loc"][-1] if first["loc"] else None
    field = last if isinstance(last, str) and last != "body" else None
    message = str(first["msg"]).removeprefix("Value error, ")
    return JSONResponse(_body("ValidationError", message, field), status_code=422)
