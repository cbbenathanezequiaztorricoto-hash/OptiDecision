# app/modules/autenticacion/routes.py
# Endpoints HTTP para registro, login, Google OAuth2 y perfil con persistencia PostgreSQL.
import os
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.shared.database import obtener_conexion
from app.modules.autenticacion.schemas import (
    UsuarioRegistroInput,
    UsuarioLoginInput,
    GoogleAuthInput,
    TokenOutput,
    UsuarioPerfilOutput,
    RegistroFerreteriaInput,
    CambioRolInput
)
from app.modules.autenticacion.engine import (
    GOOGLE_CLIENT_ID,
    generar_salt_y_hash,
    verificar_password,
    crear_access_token,
    decodificar_access_token,
    verificar_token_google
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación, Google OAuth y Roles"])
security = HTTPBearer()
security_opcional = HTTPBearer(auto_error=False)


def _determinar_rol_inicial(cur, email: str) -> str:
    admin_env = os.getenv("ADMIN_EMAIL", "").strip().lower()
    if admin_env and email.strip().lower() == admin_env:
        return "admin"
    cur.execute("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin';")
    if cur.fetchone()["total"] == 0:
        return "admin"
    return "cliente"


def obtener_usuario_actual(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    payload = decodificar_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso inválido o expirado. Inicie sesión nuevamente."
        )

    email = payload.get("sub")
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id_usuario, u.email, u.username, COALESCE(u.rol, 'cliente') AS rol,
                       u.google_id, u.fecha_registro,
                       f.id_ferreteria, f.nombre AS nombre_ferreteria
                FROM usuarios u
                LEFT JOIN ferreterias f ON f.id_usuario_propietario = u.id_usuario
                WHERE u.email = %s
                LIMIT 1;
                """,
                (email,)
            )
            usuario = cur.fetchone()
            if not usuario:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
            return dict(usuario)
    finally:
        conn.close()


def obtener_usuario_opcional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_opcional)
) -> Optional[Dict[str, Any]]:
    if not credentials:
        return None
    try:
        return obtener_usuario_actual(credentials)
    except HTTPException:
        return None


def requerir_admin(usuario: Dict[str, Any] = Depends(obtener_usuario_actual)) -> Dict[str, Any]:
    if usuario.get("rol") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a administradores del sistema."
        )
    return usuario


@router.get("/config", summary="Configuración pública de Google OAuth2")
async def obtener_config_oauth():
    client_id = GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID != "TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com" else ""
    return {"google_client_id": client_id}


@router.post("/registro", response_model=TokenOutput, status_code=status.HTTP_201_CREATED)
async def registrar_usuario(datos: UsuarioRegistroInput):
    password_hash = generar_salt_y_hash(datos.password)
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_usuario FROM usuarios WHERE email = %s;", (datos.email,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="El correo electrónico ya se encuentra registrado.")

            rol = _determinar_rol_inicial(cur, datos.email)
            cur.execute(
                """
                INSERT INTO usuarios (email, username, password_hash, rol)
                VALUES (%s, %s, %s, %s)
                RETURNING id_usuario, rol;
                """,
                (datos.email, datos.username, password_hash, rol)
            )
            nuevo = cur.fetchone()
            conn.commit()

        token = crear_access_token({"sub": datos.email, "username": datos.username, "rol": nuevo["rol"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": datos.username,
            "email": datos.email,
            "rol": nuevo["rol"]
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error en base de datos: {str(e)}")
    finally:
        conn.close()


@router.post("/login", response_model=TokenOutput, status_code=status.HTTP_200_OK, summary="Login con correo y contraseña")
async def login_usuario(datos: UsuarioLoginInput):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id_usuario, email, username, password_hash, COALESCE(rol, 'cliente') AS rol
                FROM usuarios WHERE email = %s;
                """,
                (datos.email,)
            )
            usuario = cur.fetchone()
            if not usuario or not usuario["password_hash"] or not verificar_password(datos.password, usuario["password_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas.")

        token = crear_access_token({"sub": usuario["email"], "username": usuario["username"], "rol": usuario["rol"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": usuario["username"],
            "email": usuario["email"],
            "rol": usuario["rol"]
        }
    finally:
        conn.close()


@router.post("/google", response_model=TokenOutput, status_code=status.HTTP_200_OK, summary="Login o registro con Google OAuth2")
async def login_con_google(datos: GoogleAuthInput):
    token_raw = datos.credential or datos.id_token
    if not token_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se proporcionó la credencial de Google.")

    google_info = verificar_token_google(token_raw)
    if not google_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token de Google inválido, expirado o Client ID no coincide.")

    google_id = google_info.get("sub")
    email = google_info.get("email")
    if not email or not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="El token de Google no contiene un correo electrónico o ID de usuario válido."
        )

    nombre_google = google_info.get("name") or email.split("@")[0]
    username_base = nombre_google.replace(" ", "_").lower()[:40]

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id_usuario, email, username, google_id, COALESCE(rol, 'cliente') AS rol
                FROM usuarios WHERE google_id = %s OR email = %s;
                """,
                (google_id, email)
            )
            usuario = cur.fetchone()

            if not usuario:
                # Generar username único en caso de colisión
                cur.execute("SELECT id_usuario FROM usuarios WHERE username = %s;", (username_base,))
                username_final = f"{username_base}_{google_id[:5]}" if cur.fetchone() else username_base
                rol = _determinar_rol_inicial(cur, email)

                cur.execute(
                    """
                    INSERT INTO usuarios (email, username, google_id, password_hash, rol)
                    VALUES (%s, %s, %s, NULL, %s)
                    RETURNING id_usuario, email, username, rol;
                    """,
                    (email, username_final, google_id, rol)
                )
                conn.commit()
                usuario_db = cur.fetchone()
                username_actual, email_actual, rol_actual = usuario_db["username"], usuario_db["email"], usuario_db["rol"]
            else:
                if not usuario["google_id"]:
                    cur.execute("UPDATE usuarios SET google_id = %s WHERE id_usuario = %s;", (google_id, usuario["id_usuario"]))
                    conn.commit()
                username_actual, email_actual, rol_actual = usuario["username"], usuario["email"], usuario["rol"]

        token = crear_access_token({"sub": email_actual, "username": username_actual, "rol": rol_actual})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": username_actual,
            "email": email_actual,
            "rol": rol_actual
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error en base de datos al autenticar con Google: {str(e)}"
        )
    finally:
        conn.close()


@router.get(
    "/perfil", 
    response_model=UsuarioPerfilOutput,
    status_code=status.HTTP_200_OK,
    summary="Obtener perfil del usuario autenticado"
)
async def obtener_perfil(usuario_actual: Dict[str, Any] = Depends(obtener_usuario_actual)):
    return usuario_actual


@router.post("/registrar-ferreteria", response_model=TokenOutput)
async def registrar_ferreteria_propietario(
    datos: RegistroFerreteriaInput,
    usuario: Dict[str, Any] = Depends(obtener_usuario_actual)
):
    """Permite a un usuario registrar su ferretería en el mapa y obtener permisos de Ferretero."""
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_ferreteria FROM ferreterias WHERE id_usuario_propietario = %s;", (usuario["id_usuario"],))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ya tienes una ferretería registrada a tu nombre."
                )

            cur.execute(
                """
                INSERT INTO ferreterias (
                    id_usuario_propietario, nombre, direccion, latitud, longitud,
                    ubicacion, superficie_almacen_m2, capacidad_canales_atencion
                )
                VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s);
                """,
                (
                    usuario["id_usuario"], datos.nombre, datos.direccion,
                    datos.latitud, datos.longitud, datos.longitud, datos.latitud,
                    datos.superficie_almacen_m2, datos.capacidad_canales_atencion
                )
            )

            nuevo_rol = "admin" if usuario["rol"] == "admin" else "ferretero"
            cur.execute("UPDATE usuarios SET rol = %s WHERE id_usuario = %s;", (nuevo_rol, usuario["id_usuario"]))
            conn.commit()

        token = crear_access_token({"sub": usuario["email"], "username": usuario["username"], "rol": nuevo_rol})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": usuario["username"],
            "email": usuario["email"],
            "rol": nuevo_rol
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error registrando ferretería: {str(e)}")
    finally:
        conn.close()


@router.get("/usuarios", summary="Listar usuarios y roles (Solo Admin)")
async def listar_usuarios_admin(admin: Dict[str, Any] = Depends(requerir_admin)) -> List[Dict[str, Any]]:
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id_usuario, u.username, u.email, COALESCE(u.rol, 'cliente') AS rol,
                       u.fecha_registro, f.nombre AS nombre_ferreteria
                FROM usuarios u
                LEFT JOIN ferreterias f ON f.id_usuario_propietario = u.id_usuario
                ORDER BY u.id_usuario ASC;
                """
            )
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


@router.patch("/usuarios/{id_usuario}/rol", summary="Cambiar rol de un usuario (Solo Admin)")
async def cambiar_rol_usuario(
    id_usuario: int,
    datos: CambioRolInput,
    admin: Dict[str, Any] = Depends(requerir_admin)
):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE usuarios SET rol = %s WHERE id_usuario = %s RETURNING id_usuario, username, rol;",
                (datos.rol, id_usuario)
            )
            actualizado = cur.fetchone()
            if not actualizado:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado."
                )
            conn.commit()
            return {"mensaje": f"Rol de {actualizado['username']} actualizado a {actualizado['rol']}."}
    finally:
        conn.close()
