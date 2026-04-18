from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from jose import jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.schemas.auth import LoginRequest, TokenResponse


router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    token = jwt.encode(
        {"sub": payload.email, "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    return TokenResponse(access_token=token)
