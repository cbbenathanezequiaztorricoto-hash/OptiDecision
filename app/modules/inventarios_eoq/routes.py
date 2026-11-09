# app/modules/inventarios_eoq/routes.py
# Controlador de endpoints HTTP para la Gestión de Inventarios y Catálogo.

from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from app.modules.inventarios_eoq.schemas import EOQParametrosInput, EOQResultadoOutput
from app.modules.inventarios_eoq.engine import calcular_modelo_inventario
from app.shared.database import obtener_conexion

router = APIRouter(tags=["Gestión de Inventarios (EOQ/EPQ) y Catálogo"])


@router.post(
    "/api/inventario/calcular",
    response_model=EOQResultadoOutput,
    status_code=status.HTTP_200_OK,
    summary="Calcular lote óptimo Q*, ROP y costos para EOQ Básico, EPQ o Faltantes"
)
async def calcular_inventario_optimo(datos: EOQParametrosInput):
    try:
        resultado = calcular_modelo_inventario(datos)
        return resultado
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )


@router.get(
    "/api/productos",
    status_code=status.HTTP_200_OK,
    summary="Obtener lista de productos del catálogo desde PostgreSQL"
)
async def obtener_productos() -> List[Dict[str, Any]]:
    productos = []
    conn = obtener_conexion()
    
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo establecer conexión con la base de datos PostgreSQL."
        )

    try:
        with conn.cursor() as cur:
            sql = """
                SELECT id_producto, nombre, precio_bob, stock_actual, demanda_anual_D 
                FROM productos 
                ORDER BY id_producto ASC;
            """
            cur.execute(sql)
            filas = cur.fetchall()

            for f in filas:
                productos.append({
                    "id_producto": f["id_producto"],
                    "nombre": f["nombre"],
                    "precio_bob": float(f["precio_bob"]),
                    "stock_actual": int(f["stock_actual"]),
                    "demanda_anual_D": int(f["demanda_anual_D"])
                })
        conn.close()
        return productos
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar la tabla productos: {str(e)}"
        )
