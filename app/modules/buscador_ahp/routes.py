# app/modules/buscador_ahp/routes.py
# Controlador HTTP para el Algoritmo AHP de Selección y Buscador Multicriterio.
from typing import Optional, Dict, Any, List
from psycopg2 import errors as pg_errors
from fastapi import APIRouter, HTTPException, Depends, Query, status
from app.modules.buscador_ahp.schemas import (
    AHPSearchInput,
    AHPMatrizCriteriosInput,
    AHPResultadoOutput,
    FerreteriaCatalogoOutput
)
from app.modules.buscador_ahp.engine import (
    calcular_proceso_ahp,
    calcular_wq_y_estado,
    consultar_ruta_ors
)
from app.modules.autenticacion.routes import obtener_usuario_actual, obtener_usuario_opcional
from app.shared.database import obtener_conexion

router = APIRouter(prefix="/api/ahp", tags=["Buscador AHP Geoespacial, Favoritos e Historial"])


@router.post("/buscar", response_model=AHPResultadoOutput)
async def buscar_ferreterias_ahp(
    datos: AHPSearchInput,
    usuario: Optional[Dict[str, Any]] = Depends(obtener_usuario_opcional)
) -> AHPResultadoOutput:
    try:
        # 1. Construir matriz recíproca 4x4 desde los sliders
        v = [datos.pesos.precio, datos.pesos.distancia, datos.pesos.reputacion, datos.pesos.stock]
        n = len(v)
        matriz = [[float(v[i] / v[j]) for j in range(n)] for i in range(n)]

        entrada_ahp = AHPMatrizCriteriosInput(
            criterios=["Precio", "Distancia", "Reputación", "Stock"],
            matriz_comparacion=matriz
        )
        # 2. Calcular consistencia matemática (NumPy)
        res_math = calcular_proceso_ahp(entrada_ahp)

        # 3. Consulta Geoespacial a PostgreSQL con PostGIS
        ferreterias_ordenadas = []
        conn = obtener_conexion()
        try:
            with conn.cursor() as cur:
                # Registrar en historial si el usuario está autenticado
                if usuario:
                    cur.execute(
                        """
                        INSERT INTO historial_busquedas (id_usuario, texto_buscado, latitud_usuario, longitud_usuario)
                        VALUES (%s, %s, %s, %s);
                        """,
                        (usuario["id_usuario"], datos.producto.strip(), datos.latitud, datos.longitud)
                    )
                    conn.commit()

                sql = """
                    SELECT 
                        f.id_ferreteria, f.nombre, f.direccion, f.latitud, f.longitud,
                        p.precio_bob, p.stock_actual, f.reputacion,
                        (ST_DistanceSphere(
                            COALESCE(f.ubicacion, ST_SetSRID(ST_MakePoint(f.longitud, f.latitud), 4326)),
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                        ) / 1000.0) AS distancia_km,
                        rc.tasa_llegada_lambda,
                        rc.tasa_servicio_mu
                    FROM ferreterias f
                    JOIN productos p ON f.id_ferreteria = p.id_ferreteria
                    LEFT JOIN LATERAL (
                        SELECT tasa_llegada_lambda, tasa_servicio_mu
                        FROM registro_colas_atencion
                        WHERE id_ferreteria = f.id_ferreteria
                        ORDER BY fecha_registro DESC
                        LIMIT 1
                    ) rc ON TRUE
                    WHERE LOWER(p.nombre) LIKE LOWER(%s) AND p.stock_actual > 0
                    LIMIT 25;
                """
                cur.execute(sql, (datos.longitud, datos.latitud, f"%{datos.producto}%"))
                filas = cur.fetchall()

                if filas:
                    # Lectura con llaves de RealDictCursor
                    precios = [float(f["precio_bob"]) for f in filas]
                    distancias = [float(f["distancia_km"]) for f in filas]
                    reputaciones = [float(f["reputacion"]) for f in filas]
                    stocks = [int(f["stock_actual"]) for f in filas]

                    max_p, min_p = max(precios) or 1.0, min(precios) or 0.0
                    max_d, min_d = max(distancias) or 1.0, min(distancias) or 0.0
                    max_r, min_r = max(reputaciones) or 5.0, min(reputaciones) or 1.0
                    max_s, min_s = max(stocks) or 1, min(stocks) or 0

                    w_precio = res_math["vector_pesos_W"]["Precio"] / 100.0
                    w_dist = res_math["vector_pesos_W"]["Distancia"] / 100.0
                    w_rep = res_math["vector_pesos_W"]["Reputación"] / 100.0
                    w_stock = res_math["vector_pesos_W"]["Stock"] / 100.0

                    for f in filas:
                        norm_precio = (max_p - float(f["precio_bob"])) / (max_p - min_p) if max_p != min_p else 1.0
                        norm_dist = (max_d - float(f["distancia_km"])) / (max_d - min_d) if max_d != min_d else 1.0
                        norm_rep = (float(f["reputacion"]) - min_r) / (max_r - min_r) if max_r != min_r else 1.0
                        norm_stock = (int(f["stock_actual"]) - min_s) / (max_s - min_s) if max_s != min_s else 1.0

                        score_total = (norm_precio * w_precio) + (norm_dist * w_dist) + (norm_rep * w_rep) + (norm_stock * w_stock)

                        info_cola = calcular_wq_y_estado(
                            float(f["tasa_llegada_lambda"]) if f["tasa_llegada_lambda"] is not None else None,
                            float(f["tasa_servicio_mu"]) if f["tasa_servicio_mu"] is not None else None
                        )

                        ferreterias_ordenadas.append({
                            "id_ferreteria": f["id_ferreteria"],
                            "nombre": f["nombre"],
                            "direccion": f["direccion"],
                            "latitud": float(f["latitud"]),
                            "longitud": float(f["longitud"]),
                            "precio_bob": float(f["precio_bob"]),
                            "stock": int(f["stock_actual"]),
                            "reputacion": float(f["reputacion"]),
                            "distancia_km": round(float(f["distancia_km"]), 2),
                            "puntuacion_ahp": round(float(score_total), 4),
                            "tiempo_espera_wq_min": info_cola["tiempo_espera_wq_min"],
                            "estado_congestion": info_cola["estado_congestion"]
                        })

                    ferreterias_ordenadas.sort(key=lambda x: x["puntuacion_ahp"], reverse=True)
        finally:
            conn.close()

        return AHPResultadoOutput(
            vector_pesos_W=res_math["vector_pesos_W"],
            lambda_maximo=res_math["lambda_maximo"],
            indice_consistencia_CI=res_math["indice_consistencia_CI"],
            indice_aleatorio_RI=res_math["indice_aleatorio_RI"],
            ratio_consistencia_CR=res_math["ratio_consistencia_CR"],
            es_consistente=res_math["es_consistente"],
            mensaje_consistencia=res_math["mensaje_consistencia"],
            ferreterias=ferreterias_ordenadas
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en consulta PostGIS/AHP: {str(e)}"
        )

#NUEVO 17-11-2026
#Catalogo de productos
@router.get(
    "/ferreterias/{id_ferreteria}/catalogo",
    response_model=FerreteriaCatalogoOutput,
    summary="Obtener ficha detallada y catálogo completo de una ferretería"
)
async def obtener_catalogo_ferreteria(id_ferreteria: int) -> FerreteriaCatalogoOutput:
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id_ferreteria, nombre, direccion, latitud, longitud,
                       COALESCE(reputacion, 5.00) AS reputacion,
                       COALESCE(superficie_almacen_m2, 0.00) AS superficie_almacen_m2,
                       COALESCE(capacidad_canales_atencion, 1) AS capacidad_canales_atencion
                FROM ferreterias
                WHERE id_ferreteria = %s
                LIMIT 1;
                """,
                (id_ferreteria,)
            )
            ferreteria = cur.fetchone()
            if not ferreteria:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Ferretería no encontrada."
                )

            # Consultar último registro M/M/1 si existe
            cur.execute(
                """
                SELECT tasa_llegada_lambda, tasa_servicio_mu
                FROM registro_colas_atencion
                WHERE id_ferreteria = %s
                ORDER BY fecha_registro DESC
                LIMIT 1;
                """,
                (id_ferreteria,)
            )
            cola = cur.fetchone()
            wq_min: Optional[float] = None
            estado_congestion = "Sin datos de cola"

            if cola:
                lam = float(cola["tasa_llegada_lambda"])
                mu = float(cola["tasa_servicio_mu"])
                if mu > lam > 0:
                    wq_min = round((lam / (mu * (mu - lam))) * 60.0, 1)
                    if wq_min > 15.0:
                        estado_congestion = "Alta congestión"
                    elif wq_min > 5.0:
                        estado_congestion = "Congestión moderada"
                    else:
                        estado_congestion = "Atención fluida"

            # Consultar catálogo completo de la ferretería
            cur.execute(
                """
                SELECT p.id_producto, p.nombre, p.precio_bob, p.stock_actual, p.foto_url,
                       c.nombre AS categoria, m.nombre AS marca
                FROM productos p
                LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
                LEFT JOIN marcas m ON m.id_marca = p.id_marca
                WHERE p.id_ferreteria = %s
                ORDER BY p.stock_actual DESC, p.nombre ASC;
                """,
                (id_ferreteria,)
            )
            productos = [
                {
                    "id_producto": row["id_producto"],
                    "nombre": row["nombre"],
                    "precio_bob": float(row["precio_bob"]),
                    "stock_actual": int(row["stock_actual"]),
                    "foto_url": row["foto_url"],
                    "categoria": row["categoria"],
                    "marca": row["marca"]
                }
                for row in cur.fetchall()
            ]

            return FerreteriaCatalogoOutput(
                id_ferreteria=ferreteria["id_ferreteria"],
                nombre=ferreteria["nombre"],
                direccion=ferreteria["direccion"],
                latitud=float(ferreteria["latitud"]),
                longitud=float(ferreteria["longitud"]),
                reputacion=float(ferreteria["reputacion"]),
                superficie_almacen_m2=float(ferreteria["superficie_almacen_m2"]),
                capacidad_canales_atencion=int(ferreteria["capacidad_canales_atencion"]),
                tiempo_espera_wq_min=wq_min,
                estado_congestion=estado_congestion,
                total_productos=len(productos),
                productos=productos
            )
    finally:
        conn.close()


@router.get("/historial", summary="Obtener historial de búsquedas del usuario")
async def obtener_historial(usuario: Dict[str, Any] = Depends(obtener_usuario_actual)) -> List[Dict[str, Any]]:
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id_busqueda, texto_buscado, latitud_usuario, longitud_usuario, fecha_busqueda
                FROM historial_busquedas
                WHERE id_usuario = %s
                ORDER BY fecha_busqueda DESC
                LIMIT 15;
                """,
                (usuario["id_usuario"],)
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.delete("/historial/{id_busqueda}", summary="Eliminar un registro individual del historial")
async def eliminar_historial(id_busqueda: int, usuario: Dict[str, Any] = Depends(obtener_usuario_actual)):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM historial_busquedas
                WHERE id_busqueda = %s AND id_usuario = %s
                RETURNING id_busqueda;
                """,
                (id_busqueda, usuario["id_usuario"])
            )
            eliminado = cur.fetchone()
            if not eliminado:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Registro de historial no encontrado."
                )
            conn.commit()
            return {"mensaje": "Registro eliminado del historial."}
    finally:
        conn.close()

#RUD COMPLETO Y LÓGICA DE FAVORITOS
@router.get("/favoritos", summary="Listar ferreterías favoritas del usuario")
async def listar_favoritos(usuario: Dict[str, Any] = Depends(obtener_usuario_actual)) -> List[Dict[str, Any]]:
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ff.id_favorito, f.id_ferreteria, f.nombre, f.direccion, f.latitud, f.longitud, f.reputacion
                FROM ferreterias_favoritas ff
                JOIN ferreterias f ON f.id_ferreteria = ff.id_ferreteria
                WHERE ff.id_usuario = %s
                ORDER BY ff.id_favorito DESC;
                """,
                (usuario["id_usuario"],)
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


@router.post("/favoritos/{id_ferreteria}", summary="Guardar ferretería en favoritos")
async def agregar_favorito(id_ferreteria: int, usuario: Dict[str, Any] = Depends(obtener_usuario_actual)):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ferreterias_favoritas (id_ferreteria, id_usuario)
                VALUES (%s, %s)
                ON CONFLICT (id_usuario, id_ferreteria) DO NOTHING;
                """,
                (id_ferreteria, usuario["id_usuario"])
            )
            conn.commit()
            return {"mensaje": "Ferretería guardada en tus favoritos."}
    except pg_errors.ForeignKeyViolation:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La ferretería indicada no existe."
        )
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar favorito: {str(e)}"
        )
    finally:
        conn.close()

@router.delete("/favoritos/{id_ferreteria}", summary="Eliminar ferretería de favoritos")
async def eliminar_favorito(id_ferreteria: int, usuario: Dict[str, Any] = Depends(obtener_usuario_actual)):
    conn = obtener_conexion()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM ferreterias_favoritas WHERE id_usuario = %s AND id_ferreteria = %s;",
                (usuario["id_usuario"], id_ferreteria)
            )
            conn.commit()
            return {"mensaje": "Ferretería eliminada de favoritos."}
    finally:
        conn.close()


@router.get("/ruta", summary="Trazar ruta vial multi-modo con OpenRouteService y rutas alternativas (RN-10)")
async def obtener_ruta_multimodo(
    origen_lat: float = Query(..., ge=-90, le=90),
    origen_lng: float = Query(..., ge=-180, le=180),
    destino_lat: float = Query(..., ge=-90, le=90),
    destino_lng: float = Query(..., ge=-180, le=180),
    modo: str = Query(default="driving-car", description="driving-car | cycling-regular | foot-walking")
) -> Dict[str, Any]:
    try:
        return consultar_ruta_ors(origen_lat, origen_lng, destino_lat, destino_lng, modo)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo obtener la ruta desde OpenRouteService: {str(e)}"
        )
