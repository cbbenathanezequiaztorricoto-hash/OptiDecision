# app/modules/autenticacion/engine.py
# Motor de autenticación, salting/hashing PBKDF2 y tokens JWT.

import os
import hashlib
import secrets
import jwt
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import requests as http_requests
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests

logger = logging.getLogger(__name__)

# Cargar variables de entorno desde el .env raíz
load_dotenv()

# Validaciones estrictas de configuración en entorno (Sin secretos en duro)
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
raw_expire = os.getenv("ACCESS_TOKEN_EXPIRE_HOURS")

if not SECRET_KEY:
    raise ValueError("Error de configuración: La variable 'SECRET_KEY' es requerida en el archivo .env")

if not ALGORITHM:
    raise ValueError("Error de configuración: La variable 'ALGORITHM' es requerida en el archivo .env")

if not raw_expire:
    raise ValueError("Error de configuración: La variable 'ACCESS_TOKEN_EXPIRE_HOURS' es requerida en el archivo .env")

ACCESS_TOKEN_EXPIRE_HOURS = int(raw_expire)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "").strip()

def generar_salt_y_hash(password: str) -> str:
    """Genera un hash seguro utilizando PBKDF2-HMAC-SHA256 con sal aleatoria de 16 bytes."""
    salt = secrets.token_bytes(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{salt.hex()}:{hash_bytes.hex()}"


def verificar_password(password_plana: str, password_almacenado: str) -> bool:
    """Verifica si la contraseña dada coincide con la sal y hash guardados."""
    try:
        salt_hex, hash_hex = password_almacenado.split(":")
        salt = bytes.fromhex(salt_hex)
        hash_calculado = hashlib.pbkdf2_hmac("sha256", password_plana.encode("utf-8"), salt, 100_000)
        return secrets.compare_digest(hash_calculado.hex(), hash_hex)
    except Exception as exc:
        logger.warning("Fallo al verificar el hash de contraseña: %s", exc)
        return False


def crear_access_token(data: Dict[str, Any], expira_horas: int = ACCESS_TOKEN_EXPIRE_HOURS) -> str:
    """Firma un token de acceso JWT con vigencia programada."""
    payload = data.copy()
    expiracion = datetime.now(timezone.utc) + timedelta(hours=expira_horas)
    payload.update({"exp": expiracion})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decodificar_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Valida la autenticidad y vigencia del JWT."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        logger.warning("El token de acceso ha expirado: %s", exc)
        return None
    except jwt.InvalidTokenError as exc:
        logger.warning("El token de acceso no es válido: %s", exc)
        return None


def verificar_token_google(credential_token: str) -> Optional[Dict[str, Any]]:
    """Verifica la firma del ID Token recibido de Google Identity Services."""
    try:
        request_adapter = requests.Request()
        if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID != "TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com":
            id_info = id_token.verify_oauth2_token(credential_token, request_adapter, GOOGLE_CLIENT_ID)
        else:
            # Si no hay Client ID real en .env, valida la firma con los certificados públicos de Google
            id_info = id_token.verify_oauth2_token(credential_token, request_adapter)
        return id_info
    except Exception as e:
        logger.warning("Error verificando token de Google: %s", e)
        return None
def generar_estado_oauth() -> str:
    """Genera un token state firmado (JWT de 10 min) para protección anti-CSRF en OAuth2."""
    expiracion = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "purpose": "google_oauth_state",
        "nonce": secrets.token_urlsafe(16),
        "exp": expiracion
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def validar_estado_oauth(state: str) -> bool:
    """Valida la firma y vigencia del parámetro state devuelto por Google."""
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("purpose") == "google_oauth_state"
    except Exception as exc:
        logger.warning("Estado OAuth2 inválido o expirado: %s", exc)
        return False


def intercambiar_codigo_google(code: str, redirect_uri: str) -> Optional[Dict[str, Any]]:
    """Intercambia el authorization code de Google por tokens y valida el id_token."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env")
        return None

    try:
        resp = http_requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            },
            timeout=10
        )
        if resp.status_code != 200:
            logger.warning("Error intercambiando código OAuth2 con Google (%s): %s", resp.status_code, resp.text)
            return None

        token_data = resp.json()
        raw_id_token = token_data.get("id_token")
        if not raw_id_token:
            return None

        return verificar_token_google(raw_id_token)
    except Exception as exc:
        logger.warning("Excepción en intercambio OAuth2 con Google: %s", exc)
        return None