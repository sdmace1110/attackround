import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError

_http_bearer = HTTPBearer()

ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24

def _get_secret_key() -> str:
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise ValueError("SECRET_KEY is not set")
    return secret_key

def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_token(payload: dict[str, Any]) -> str:
    to_encode = payload.copy()
    expire_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    to_encode["exp"] = expire_at
    return jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
    except ExpiredSignatureError as exc:
        raise ValueError("Token has expired") from exc
    except InvalidTokenError as exc:
        raise ValueError("Invalid token") from exc


async def get_current_dm(
    credentials: HTTPAuthorizationCredentials = Depends(_http_bearer),
) -> uuid.UUID:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    if payload.get("role") != "dm":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="DM access required")
    return uuid.UUID(payload["sub"])