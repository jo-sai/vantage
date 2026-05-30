from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

class AppException(Exception):
    """
    Central Base Custom Exception Class.
    Designed to separate operational exceptions from unexpected runtime errors.
    """
    def __init__(self, message: str, status_code: int, errors: any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors

class BadRequestException(AppException):
    def __init__(self, message: str = "Bad Request", errors: any = None):
        super().__init__(message, 400, errors)

class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, 401)

class ForbiddenException(AppException):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, 403)

class NotFoundException(AppException):
    def __init__(self, message: str = "Resource Not Found"):
        super().__init__(message, 404)

class ConflictException(AppException):
    def __init__(self, message: str = "Resource Conflict"):
        super().__init__(message, 409)

class InternalServerException(AppException):
    def __init__(self, message: str = "Internal Server Error"):
        super().__init__(message, 500)

def register_exception_handlers(app: FastAPI):
    """
    Wires up global exception interceptors in the FastAPI application pipeline,
    guaranteeing that semantic JSON error payloads are sent back to the frontend client.
    """
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        content = {
            "success": False,
            "message": exc.message,
        }
        if exc.errors is not None:
            content["errors"] = exc.errors
        return JSONResponse(
            status_code=exc.status_code,
            content=content
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        # Prevent leaking database structures or raw traces in production
        import traceback
        print("[SYSTEM ERROR] UNEXPECTED RUNTIME SYSTEM EXCEPTION:")
        traceback.print_exc()
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Internal Server Error",
                "detail": str(exc)
            }
        )
