# app/modules/autenticacion/routes.py
# Endpoints HTTP para autenticación y perfil de usuario.
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime

from app.modules.autenticacion.schemas import (
    UsuarioRegistroInput,
    UsuarioLoginInput,
    GoogleAuthInput,
    TokenOutput,
    UsuarioPerfilOutput
)
from app.modules.autenticacion.engine import (
    encriptar_password,
    verificar_password,
    crear_access_token,
    decodificar_access_token
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación y Usuarios (OAuth / JWT)"])
security = HTTPBearer()

# Base de datos simulada en memoria para desarrollo preliminar del módulo
USUARIOS_DB: Dict[str, Dict[str, Any]] = {}
COUNTER_ID = 1


def obtener_usuario_actual(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Middleware de dependencia para proteger rutas con Bearer Token JWT."""
    token = credentials.credentials
    payload = decodificar_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado. Por favor inicie sesión nuevamente."
        )
    email = payload.get("sub")
    usuario = USUARIOS_DB.get(email)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado en la base de datos."
        )
    return usuario


@router.post(
    "/registro",
    response_model=TokenOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo usuario con correo y contraseña"
)
async def registrar_usuario(datos: UsuarioRegistroInput):
    global COUNTER_ID
    if datos.email in USUARIOS_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya se encuentra registrado."
        )

    usuario_nuevo = {
        "id_usuario": COUNTER_ID,
        "email": datos.email,
        "username": datos.username,
        "password_hash": encriptar_password(datos.password),
        "google_id": None,
        "fecha_registro": datetime.now()
    }
    USUARIOS_DB[datos.email] = usuario_nuevo
    COUNTER_ID += 1

    token = crear_access_token({"sub": datos.email, "username": datos.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": datos.username,
        "email": datos.email
    }


@router.post(
    "/login",
    response_model=TokenOutput,
    status_code=status.HTTP_200_OK,
    summary="Iniciar sesión con credenciales tradicionales"
)
async def login_usuario(datos: UsuarioLoginInput):
    usuario = USUARIOS_DB.get(datos.email)
    if not usuario or not verificar_password(datos.password, usuario["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas. Verifique correo y contraseña."
        )

    token = crear_access_token({"sub": usuario["email"], "username": usuario["username"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": usuario["username"],
        "email": usuario["email"]
    }


@router.get(
    "/perfil",
    response_model=UsuarioPerfilOutput,
    status_code=status.HTTP_200_OK,
    summary="Obtener perfil del usuario autenticado vía JWT"
)
async def obtener_perfil(usuario_actual: Dict[str, Any] = Depends(obtener_usuario_actual)):
    return {
        "id_usuario": usuario_actual["id_usuario"],
        "email": usuario_actual["email"],
        "username": usuario_actual["username"],
        "google_id": usuario_actual["google_id"],
        "fecha_registro": usuario_actual["fecha_registro"]
    }