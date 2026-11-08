# app/modules/autenticacion/engine.py
# Motor criptográfico y de tokens JWT.

import os
import hmac
import hashlib
import jwt
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Cargar las variables declaradas en el archivo .env de la raíz
load_dotenv()

# Lectura dinámica de variables de entorno
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS"))


def encriptar_password(password: str) -> str:
    """Genera un hash SHA-256 seguro con sal implícita para la contraseña."""
    return hmac.new(
        SECRET_KEY.encode("utf-8"),
        password.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def verificar_password(password_plana: str, password_hash: str) -> bool:
    """Compara la contraseña recibida contra el hash almacenado."""
    return hmac.compare_digest(encriptar_password(password_plana), password_hash)


def crear_access_token(data: Dict[str, Any], expira_horas: int = ACCESS_TOKEN_EXPIRE_HOURS) -> str:
    """Crea un token JWT firmado con fecha de expiración."""
    payload = data.copy()
    expiracion = datetime.now(timezone.utc) + timedelta(hours=expira_horas)
    payload.update({"exp": expiracion})
    
    token_firmado = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token_firmado


def decodificar_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodifica y valida la firma y vigencia de un token JWT."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None