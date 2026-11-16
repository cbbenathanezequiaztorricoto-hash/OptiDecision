# app/modules/inventarios_eoq/routes.py
# Controlador de endpoints HTTP para la Gestión de Inventarios y Catálogo.
import csv
import io
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from pydantic import BaseModel, Field

from app.modules.inventarios_eoq.schemas import EOQParametrosInput, EOQResultadoOutput
from app.modules.inventarios_eoq.engine import calcular_modelo_inventario
from app.modules.autenticacion.routes import obtener_usuario_actual, obtener_usuario_opcional
from app.shared.database import obtener_conexion

router = APIRouter(tags=["Gestión de Inventarios (EOQ/EPQ) y Carga Masiva"])


class ProductoCRUDInput(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150)
    precio_bob: float = Field(..., gt=0)
    stock_actual: int = Field(default=0, ge=0)
    demanda_anual_D: int = Field(default=100, ge=0)
    costo_pedido_K: float = Field(default=50.0, ge=0)
    costo_mantenimiento_H: float = Field(default=5.0, ge=0)
    tiempo_entrega_dias_L: int = Field(default=3, ge=0)
    stock_seguridad_SS: int = Field(default=10, ge=0)
    tasa_produccion_p: Optional[int] = Field(default=None)
    id_ferreteria: Optional[int] = Field(default=None)


def _resolver_ferreteria_destino(cur, usuario: Dict[str, Any], id_ferreteria_req: Optional[int]) -> int:
    rol = usuario.get("rol")
    if rol not in ("ferretero", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Solo los usuarios con rol Ferretero o Administrador pueden modificar el catálogo."
        )

    if rol == "admin" and id_ferreteria_req:
        return id_ferreteria_req

    if usuario.get("id_ferreteria"):
        return usuario["id_ferreteria"]

    # Si es admin sin ferretería propia, toma la primera ferretería registrada
    cur.execute("SELECT id_ferreteria FROM ferreterias ORDER BY id_ferreteria ASC LIMIT 1;")
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="No existe ninguna ferretería registrada.")
    return row["id_ferreteria"]


@router.post(
    "/api/inventario/calcular", 
    response_model=EOQResultadoOutput,
    status_code=status.HTTP_200_OK,
    summary="Calcular inventario óptimo EOQ/EPQ para un producto"
)
async def calcular_inventario_optimo(datos: EOQParametrosInput):
    try:
        return calcular_modelo_inventario(datos)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )


@router.get(
    "/api/productos",
    status_code=status.HTTP_200_OK,
    summary="Obtener listado de productos del catálogo (con precios BOB y stock)"
)
async def obtener_productos(
    usuario: Optional[Dict[str, Any]] = Depends(obtener_usuario_opcional)
) -> List[Dict[str, Any]]:
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            if usuario and usuario.get("rol") == "ferretero" and usuario.get("id_ferreteria"):
                cur.execute(
                    """
                    SELECT p.id_producto, p.nombre, p.precio_bob, p.stock_actual,
                           p.demanda_anual_D, p.costo_pedido_K, p.costo_mantenimiento_H,
                           p.tiempo_entrega_dias_L, p.stock_seguridad_SS, p.tasa_produccion_p,
                           f.nombre AS ferreteria_nombre
                    FROM productos p
                    JOIN ferreterias f ON f.id_ferreteria = p.id_ferreteria
                    WHERE p.id_ferreteria = %s
                    ORDER BY p.id_producto DESC;
                    """,
                    (usuario["id_ferreteria"],)
                )
            else:
                cur.execute(
                    """
                    SELECT p.id_producto, p.nombre, p.precio_bob, p.stock_actual,
                           p.demanda_anual_D, p.costo_pedido_K, p.costo_mantenimiento_H,
                           p.tiempo_entrega_dias_L, p.stock_seguridad_SS, p.tasa_produccion_p,
                           f.nombre AS ferreteria_nombre
                    FROM productos p
                    JOIN ferreterias f ON f.id_ferreteria = p.id_ferreteria
                    ORDER BY p.id_producto DESC
                    LIMIT 100;
                    """
                )

            return [
                {
                    "id_producto": f["id_producto"],
                    "nombre": f["nombre"],
                    "precio_bob": float(f["precio_bob"]),
                    "stock_actual": int(f["stock_actual"]),
                    "demanda_anual_D": int(f["demanda_anual_d"]),
                    "costo_pedido_K": float(f["costo_pedido_k"]),
                    "costo_mantenimiento_H": float(f["costo_mantenimiento_h"]),
                    "tiempo_entrega_dias_L": int(f["tiempo_entrega_dias_l"]),
                    "stock_seguridad_SS": int(f["stock_seguridad_ss"]),
                    "tasa_produccion_p": f["tasa_produccion_p"],
                    "ferreteria_nombre": f["ferreteria_nombre"]
                }
                for f in cur.fetchall()
            ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar la tabla productos: {str(e)}"
        )
    finally:
        conn.close()


@router.post(
    "/api/productos", 
    status_code=status.HTTP_201_CREATED
)
async def crear_producto(datos: ProductoCRUDInput, usuario: Dict[str, Any] = Depends(obtener_usuario_actual)):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            id_ferr = _resolver_ferreteria_destino(cur, usuario, datos.id_ferreteria)
            cur.execute(
                """
                INSERT INTO productos (
                    id_ferreteria, nombre, precio_bob, stock_actual, demanda_anual_D,
                    costo_pedido_K, costo_mantenimiento_H, tiempo_entrega_dias_L,
                    stock_seguridad_SS, tasa_produccion_p
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id_producto;
                """,
                (
                    id_ferr, datos.nombre, datos.precio_bob, datos.stock_actual,
                    datos.demanda_anual_D, datos.costo_pedido_K, datos.costo_mantenimiento_H,
                    datos.tiempo_entrega_dias_L, datos.stock_seguridad_SS, datos.tasa_produccion_p
                )
            )
            nuevo_id = cur.fetchone()["id_producto"]
            conn.commit()
            return {"id_producto": nuevo_id, "mensaje": "Producto agregado al catálogo correctamente."}
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


@router.put(
    "/api/productos/{id_producto}",
    status_code=status.HTTP_200_OK,
    summary="Actualizar información de un producto del catálogo"
)
async def actualizar_producto(
    id_producto: int,
    datos: ProductoCRUDInput,
    usuario: Dict[str, Any] = Depends(obtener_usuario_actual)
):
    if usuario.get("rol") not in ("ferretero", "admin"):
        raise HTTPException(status_code=403, detail="Sin permisos para editar productos.")

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE productos
                SET nombre = %s, precio_bob = %s, stock_actual = %s, demanda_anual_D = %s,
                    costo_pedido_K = %s, costo_mantenimiento_H = %s, tiempo_entrega_dias_L = %s,
                    stock_seguridad_SS = %s, tasa_produccion_p = %s
                WHERE id_producto = %s
                RETURNING id_producto;
                """,
                (
                    datos.nombre, datos.precio_bob, datos.stock_actual, datos.demanda_anual_D,
                    datos.costo_pedido_K, datos.costo_mantenimiento_H, datos.tiempo_entrega_dias_L,
                    datos.stock_seguridad_SS, datos.tasa_produccion_p, id_producto
                )
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Producto no encontrado.")
            conn.commit()
            return {"mensaje": "Producto actualizado correctamente."}
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


@router.delete(
    "/api/productos/{id_producto}",
    status_code=status.HTTP_200_OK,
    summary="Eliminar un producto del catálogo"
)
async def eliminar_producto(id_producto: int, usuario: Dict[str, Any] = Depends(obtener_usuario_actual)):
    if usuario.get("rol") not in ("ferretero", "admin"):
        raise HTTPException(status_code=403, detail="Sin permisos para eliminar productos.")

    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM productos WHERE id_producto = %s RETURNING id_producto;", (id_producto,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Producto no encontrado.")
            conn.commit()
            return {"mensaje": "Producto eliminado del catálogo."}
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
    "/api/productos/carga-masiva", 
    status_code=status.HTTP_200_OK,
    summary="Carga masiva CSV de catálogo, precios BOB y stock"
)
async def carga_masiva_productos(
    archivo: UploadFile = File(...),
    usuario: Dict[str, Any] = Depends(obtener_usuario_actual)
):
    """
    Columnas CSV aceptadas (con encabezado):
    nombre,precio_bob,stock_actual,demanda_anual_D,costo_pedido_K,costo_mantenimiento_H,tiempo_entrega_dias_L,stock_seguridad_SS
    """
    contenido = await archivo.read()
    texto = contenido.decode("utf-8-sig", errors="replace")
    delimitador = ";" if ";" in texto.splitlines()[0] else ","
    lector = csv.DictReader(io.StringIO(texto), delimiter=delimitador)

    conn = obtener_conexion()
    insertados = 0
    actualizados = 0
    errores = []

    try:
        with conn.cursor() as cur:
            id_ferr = _resolver_ferreteria_destino(cur, usuario, None)

            for num_fila, fila in enumerate(lector, start=2):
                try:
                    nombre = (fila.get("nombre") or "").strip()
                    if not nombre:
                        continue
                    precio = float(fila.get("precio_bob") or 0)
                    stock = int(float(fila.get("stock_actual") or 0))
                    demanda = int(float(fila.get("demanda_anual_D") or 120))
                    costo_k = float(fila.get("costo_pedido_K") or 50.0)
                    costo_h = float(fila.get("costo_mantenimiento_H") or 5.0)
                    lead_l = int(float(fila.get("tiempo_entrega_dias_L") or 3))
                    ss = int(float(fila.get("stock_seguridad_SS") or 10))

                    cur.execute(
                        "SELECT id_producto FROM productos WHERE id_ferreteria = %s AND LOWER(nombre) = LOWER(%s);",
                        (id_ferr, nombre)
                    )
                    existente = cur.fetchone()
                    if existente:
                        cur.execute(
                            """
                            UPDATE productos
                            SET precio_bob = %s, stock_actual = %s, demanda_anual_D = %s,
                                costo_pedido_K = %s, costo_mantenimiento_H = %s,
                                tiempo_entrega_dias_L = %s, stock_seguridad_SS = %s
                            WHERE id_producto = %s;
                            """,
                            (precio, stock, demanda, costo_k, costo_h, lead_l, ss, existente["id_producto"])
                        )
                        actualizados += 1
                    else:
                        cur.execute(
                            """
                            INSERT INTO productos (
                                id_ferreteria, nombre, precio_bob, stock_actual, demanda_anual_D,
                                costo_pedido_K, costo_mantenimiento_H, tiempo_entrega_dias_L, stock_seguridad_SS
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """,
                            (id_ferr, nombre, precio, stock, demanda, costo_k, costo_h, lead_l, ss)
                        )
                        insertados += 1
                except Exception as row_err:
                    errores.append(f"Fila {num_fila}: {str(row_err)}")

            conn.commit()
            return {
                "mensaje": f"Carga masiva completada: {insertados} nuevos, {actualizados} actualizados.",
                "insertados": insertados,
                "actualizados": actualizados,
                "errores": errores
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
