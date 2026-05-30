import bcrypt
import jwt
from datetime import datetime, timedelta
from app.config import settings


class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hashes password securely via bcrypt.
        Password is encoded to bytes before hashing.
        """
        password_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verifies plain password against stored bcrypt hash.
        """
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8")
            )
        except Exception:
            return False

    @staticmethod
    def generate_access_token(user_data: dict) -> str:
        """
        Generates a short-lived access JWT.
        """
        payload = {
            "id": user_data["id"],
            "email": user_data["email"],
            "role": user_data["role"],
            "firstName": user_data["firstName"],
            "lastName": user_data["lastName"],
            "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES)
        }
        # In pyjwt, encode returns a string
        return jwt.encode(payload, settings.JWT_ACCESS_SECRET, algorithm="HS256")

    @staticmethod
    def generate_refresh_token(user_id: str) -> str:
        """
        Generates a long-lived refresh JWT.
        """
        payload = {
            "id": user_id,
            "exp": datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS)
        }
        return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm="HS256")
