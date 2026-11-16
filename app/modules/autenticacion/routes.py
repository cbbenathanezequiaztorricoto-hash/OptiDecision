# app/modules/autenticacion/routes.py
# Endpoints HTTP para registro, login, Google OAuth2 y perfil con persistencia PostgreSQL.
import os
import csv
import io
from urllib.parse import urlencode
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, status
from fastapi.responses import RedirectResponse, Response
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
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    generar_salt_y_hash,
    verificar_password,
    crear_access_token,
    decodificar_access_token,
    verificar_token_google,
    generar_estado_oauth,
    validar_estado_oauth,
    intercambiar_codigo_google
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación, Google OAuth y Roles"])
security = HTTPBearer()
security_opcional = HTTPBearer(auto_error=False)


def _obtener_lista_admins() -> List[str]:
    raw_admins = os.getenv("ADMIN_EMAILS") or os.getenv("ADMIN_EMAIL") or ""
    return [e.strip().lower() for e in raw_admins.split(",") if e.strip()]


def _determinar_rol_inicial(cur, email: str) -> str:
    admin_emails = _obtener_lista_admins()
    if admin_emails:
        return "admin" if email.strip().lower() in admin_emails else "cliente"

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
    client_id = GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID != "TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com" else ""
    return {
        "google_client_id": client_id,
        "google_oauth_enabled": bool(client_id and GOOGLE_CLIENT_SECRET)
    }

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

def _autenticar_o_crear_usuario_google(google_info: Dict[str, Any]) -> Dict[str, Any]:
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


def _resolver_google_redirect_uri(request: Request) -> str:
    if GOOGLE_REDIRECT_URI:
        return GOOGLE_REDIRECT_URI
    uri = str(request.url_for("google_oauth_callback"))
    if request.headers.get("x-forwarded-proto") == "https" and uri.startswith("http://"):
        uri = "https://" + uri[len("http://"):]
    return uri


@router.get("/google/login", summary="Iniciar flujo OAuth 2.0 Authorization Code con Google")
async def iniciar_login_google(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(url="/?auth_error=google_not_configured", status_code=302)

    redirect_uri = _resolver_google_redirect_uri(request)
    state = generar_estado_oauth()
    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account"
    })
    return RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}", status_code=302)


@router.get("/google/callback", name="google_oauth_callback", summary="Callback OAuth 2.0 de Google")
async def callback_login_google(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None
):
    if error:
        return RedirectResponse(url=f"/?auth_error={error}", status_code=302)
    if not code or not state or not validar_estado_oauth(state):
        return RedirectResponse(url="/?auth_error=invalid_state", status_code=302)

    redirect_uri = _resolver_google_redirect_uri(request)
    google_info = intercambiar_codigo_google(code, redirect_uri)
    if not google_info:
        return RedirectResponse(url="/?auth_error=google_token_exchange_failed", status_code=302)

    try:
        sesion = _autenticar_o_crear_usuario_google(google_info)
        return RedirectResponse(url=f"/#access_token={sesion['access_token']}", status_code=302)
    except Exception:
        return RedirectResponse(url="/?auth_error=google_db_error", status_code=302)


@router.post("/google", response_model=TokenOutput, status_code=status.HTTP_200_OK, summary="Login o registro con Google OAuth2 (Token directo)")
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

    return _autenticar_o_crear_usuario_google(google_info)

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
@router.get("/ferreterias/resumen", summary="Resumen global de ferreterías y productos (Solo Admin)")
async def resumen_ferreterias_admin(admin: Dict[str, Any] = Depends(requerir_admin)) -> Dict[str, int]:
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM ferreterias;")
            total_ferreterias = cur.fetchone()["total"]
            cur.execute("SELECT COUNT(*) AS total FROM productos;")
            total_productos = cur.fetchone()["total"]
            return {
                "total_ferreterias": total_ferreterias,
                "total_productos": total_productos
            }
    finally:
        conn.close()

@router.get("/ferreterias/plantilla-catalogo", summary="Generar plantilla CSV dinámica con las ferreterías registradas")
async def descargar_plantilla_catalogo_admin(admin: Dict[str, Any] = Depends(requerir_admin)):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT nombre FROM ferreterias ORDER BY nombre ASC;")
            ferreterias = [r["nombre"] for r in cur.fetchall()]

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "ferreteria", "nombre", "precio_bob", "stock_actual",
            "demanda_anual_D", "costo_pedido_K", "costo_mantenimiento_H",
            "tiempo_entrega_dias_L", "stock_seguridad_SS"
        ])
        for nombre_ferr in ferreterias:
            writer.writerow([nombre_ferr, "", "", "", "", "", "", "", ""])

        return Response(
            content="\ufeff" + buffer.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="plantilla_ferreterias_cbba.csv"'}
        )
    finally:
        conn.close()
@router.post("/ferreterias/carga-masiva", summary="Carga masiva CSV de ferreterías reales (Solo Admin/Desarrollador)")
async def carga_masiva_ferreterias_admin(
    archivo: UploadFile = File(...),
    admin: Dict[str, Any] = Depends(requerir_admin)
):
    """
    Acepta directamente el CSV exportado desde Overpass Turbo:
      @id,name,addr:street,addr:city,@lat,@lon
    o el formato estándar:
      nombre,direccion,latitud,longitud,reputacion,superficie_almacen_m2,capacidad_canales_atencion
    """
    contenido = await archivo.read()
    texto = contenido.decode("utf-8-sig", errors="replace")
    lineas = texto.splitlines()
    if not lineas:
        raise HTTPException(status_code=400, detail="El archivo CSV está vacío.")

    delimitador = ";" if ";" in lineas[0] else ","
    lector = csv.DictReader(io.StringIO(texto), delimiter=delimitador)

    conn = obtener_conexion()
    insertadas = 0
    actualizadas = 0
    omitidas = 0
    errores = []

    def _limpiar_campo(val: Optional[str]) -> str:
        if not val:
            return ""
        limpio = val.strip()
        return "" if limpio.lower() == "null" else limpio

    try:
        with conn.cursor() as cur:
            for num_fila, fila in enumerate(lector, start=2):
                try:
                    nombre = _limpiar_campo(fila.get("nombre") or fila.get("name"))
                    if not nombre:
                        omitidas += 1
                        continue

                    raw_lat = _limpiar_campo(fila.get("latitud") or fila.get("@lat"))
                    raw_lon = _limpiar_campo(fila.get("longitud") or fila.get("@lon"))
                    if not raw_lat or not raw_lon:
                        omitidas += 1
                        continue

                    latitud = float(raw_lat)
                    longitud = float(raw_lon)

                    direccion = _limpiar_campo(fila.get("direccion"))
                    if not direccion:
                        calle = _limpiar_campo(fila.get("addr:street"))
                        ciudad = _limpiar_campo(fila.get("addr:city"))
                        partes = [p for p in (calle, ciudad) if p]
                        direccion = ", ".join(partes) if partes else "Región Metropolitana Kanata, Cochabamba"

                    reputacion = float(_limpiar_campo(fila.get("reputacion")) or 4.5)
                    superficie = float(_limpiar_campo(fila.get("superficie_almacen_m2")) or 120.0)
                    canales = int(float(_limpiar_campo(fila.get("capacidad_canales_atencion")) or 1))

                    # Evitar duplicados por nombre y cercanía (< ~50m)
                    cur.execute(
                        """
                        SELECT id_ferreteria FROM ferreterias
                        WHERE LOWER(nombre) = LOWER(%s)
                          AND ABS(latitud - %s) < 0.0005
                          AND ABS(longitud - %s) < 0.0005
                        LIMIT 1;
                        """,
                        (nombre, latitud, longitud)
                    )
                    existente = cur.fetchone()

                    if existente:
                        cur.execute(
                            """
                            UPDATE ferreterias
                            SET direccion = %s, latitud = %s, longitud = %s,
                                ubicacion = ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                                reputacion = %s, superficie_almacen_m2 = %s,
                                capacidad_canales_atencion = %s
                            WHERE id_ferreteria = %s;
                            """,
                            (
                                direccion, latitud, longitud, longitud, latitud,
                                reputacion, superficie, canales, existente["id_ferreteria"]
                            )
                        )
                        actualizadas += 1
                    else:
                        cur.execute(
                            """
                            INSERT INTO ferreterias (
                                id_usuario_propietario, nombre, direccion, latitud, longitud,
                                ubicacion, reputacion, superficie_almacen_m2, capacidad_canales_atencion
                            )
                            VALUES (NULL, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s);
                            """,
                            (
                                nombre, direccion, latitud, longitud,
                                longitud, latitud, reputacion, superficie, canales
                            )
                        )
                        insertadas += 1
                except Exception as row_err:
                    errores.append(f"Fila {num_fila}: {str(row_err)}")

            conn.commit()
            return {
                "mensaje": f"Ferreterías procesadas: {insertadas} nuevas, {actualizadas} actualizadas ({omitidas} sin nombre/coordenadas omitidas).",
                "insertadas": insertadas,
                "actualizados": actualizadas,
                "omitidas": omitidas,
                "errores": errores[:15]
            }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error en carga masiva de ferreterías: {str(e)}")
    finally:
        conn.close()
