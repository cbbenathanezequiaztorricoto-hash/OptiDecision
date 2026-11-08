# app/modules/autenticacion/routes.py
# Endpoints HTTP para registro, login y perfil con persistencia PostgreSQL.

from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.shared.database import obtener_conexion
from app.modules.autenticacion.schemas import (
    UsuarioRegistroInput,
    UsuarioLoginInput,
    TokenOutput,
    UsuarioPerfilOutput
)
from app.modules.autenticacion.engine import (
    generar_salt_y_hash,
    verificar_password,
    crear_access_token,
    decodificar_access_token
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación y Usuarios (OAuth / JWT)"])
security = HTTPBearer()


def obtener_usuario_actual(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Middleware de dependencia que valida el JWT contra la base de datos PostgreSQL."""
    token = credentials.credentials
    payload = decodificar_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso inválido o expirado. Por favor, inicie sesión nuevamente."
        )

    email = payload.get("sub")
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_usuario, email, username, google_id, fecha_registro FROM usuarios WHERE email = %s;", (email,))
            usuario = cur.fetchone()
            if not usuario:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="El usuario asociado al token ya no existe."
                )
            return dict(usuario)
    finally:
        conn.close()


@router.post(
    "/registro",
    response_model=TokenOutput,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un usuario en PostgreSQL"
)
async def registrar_usuario(datos: UsuarioRegistroInput):
    password_hash = generar_salt_y_hash(datos.password)
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            # Comprobar si existe el email
            cur.execute("SELECT id_usuario FROM usuarios WHERE email = %s;", (datos.email,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El correo electrónico ya se encuentra registrado."
                )

            # Insertar nuevo usuario
            cur.execute(
                """
                INSERT INTO usuarios (email, username, password_hash)
                VALUES (%s, %s, %s)
                RETURNING id_usuario;
                """,
                (datos.email, datos.username, password_hash)
            )
            conn.commit()

        token = crear_access_token({"sub": datos.email, "username": datos.username})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": datos.username,
            "email": datos.email
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en base de datos: {str(e)}"
        )
    finally:
        conn.close()


@router.post(
    "/login",
    response_model=TokenOutput,
    status_code=status.HTTP_200_OK,
    summary="Iniciar sesión verificando hash en PostgreSQL"
)
async def login_usuario(datos: UsuarioLoginInput):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id_usuario, email, username, password_hash FROM usuarios WHERE email = %s;",
                (datos.email,)
            )
            usuario = cur.fetchone()
            if not usuario or not usuario["password_hash"] or not verificar_password(datos.password, usuario["password_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas."
                )

        token = crear_access_token({"sub": usuario["email"], "username": usuario["username"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": usuario["username"],
            "email": usuario["email"]
        }
    finally:
        conn.close()


@router.get(
    "/perfil",
    response_model=UsuarioPerfilOutput,
    status_code=status.HTTP_200_OK,
    summary="Obtener información del usuario autenticado"
)
async def obtener_perfil(usuario_actual: Dict[str, Any] = Depends(obtener_usuario_actual)):
    return usuario_actual
