# app/modules/buscador_ahp/routes.py
# Controlador HTTP para el Algoritmo AHP de Selección y Buscador Multicriterio.
from fastapi import APIRouter, HTTPException, status
from app.modules.buscador_ahp.schemas import AHPSearchInput, AHPMatrizCriteriosInput, AHPResultadoOutput
from app.modules.buscador_ahp.engine import calcular_proceso_ahp
from app.shared.database import obtener_conexion

#Definimos una variable del tipo APIRouter que contendrá todos los endpoints 
# relacionados con el módulo AHP.

### RECUERDA: Un endpoint es una función que se ejecuta cuando un cliente 
# hace una solicitud HTTP a una ruta específica de la API.

router = APIRouter(prefix="/api/ahp", tags=["Buscador AHP Geoespacial"])



#¿QUÉ HACÍA ESTE ENDPOINT?
#Es una arroba que define un endpoint POST en la ruta "/buscar" del router de FastAPI. 
@router.post(
    "/buscar",
    response_model=AHPResultadoOutput,
    status_code=status.HTTP_200_OK,
    summary="Busca ferreterías optimizadas por AHP y PostGIS"
)
async def buscar_ferreterias_ahp(datos: AHPSearchInput) -> AHPResultadoOutput:
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
        if conn:
            with conn.cursor() as cur:
                # Consulta SQL parametrizada con cálculo de distancia esférica (PostGIS)
                sql = """
                    SELECT 
                        f.id_ferreteria, f.nombre, f.direccion, f.latitud, f.longitud,
                        p.precio_bob, p.stock_actual, f.reputacion,
                        (ST_DistanceSphere(f.ubicacion, ST_MakePoint(%s, %s)) / 1000.0) AS distancia_km
                    FROM ferreterias f
                    JOIN productos p ON f.id_ferreteria = p.id_ferreteria
                    WHERE LOWER(p.nombre) LIKE LOWER(%s) AND p.stock_actual > 0
                    LIMIT 20;
                """
                cur.execute(sql, (datos.longitud, datos.latitud, f"%{datos.producto}%"))
                filas = cur.fetchall()

                if filas:
                    # Extraer min/max para normalización Min-Max por criterio
                    precios = [f[5] for f in filas]
                    distancias = [f[8] for f in filas]
                    reputaciones = [f[7] for f in filas]
                    stocks = [f[6] for f in filas]

                    max_p, min_p = max(precios) or 1.0, min(precios) or 0.0
                    max_d, min_d = max(distancias) or 1.0, min(distancias) or 0.0
                    max_r, min_r = max(reputaciones) or 5.0, min(reputaciones) or 1.0
                    max_s, min_s = max(stocks) or 1, min(stocks) or 0

                    w_precio = res_math["vector_pesos_W"]["Precio"] / 100.0
                    w_dist = res_math["vector_pesos_W"]["Distancia"] / 100.0
                    w_rep = res_math["vector_pesos_W"]["Reputación"] / 100.0
                    w_stock = res_math["vector_pesos_W"]["Stock"] / 100.0

                    for f in filas:
                        # Normalizar valores (Precio y Distancia son inversamente proporcionales)
                        norm_precio = (max_p - f[5]) / (max_p - min_p) if max_p != min_p else 1.0
                        norm_dist = (max_d - f[8]) / (max_d - min_d) if max_d != min_d else 1.0
                        norm_rep = (f[7] - min_r) / (max_r - min_r) if max_r != min_r else 1.0
                        norm_stock = (f[6] - min_s) / (max_s - min_s) if max_s != min_s else 1.0

                        score_total = (norm_precio * w_precio) + (norm_dist * w_dist) + (norm_rep * w_rep) + (norm_stock * w_stock)

                        ferreterias_ordenadas.append({
                            "id_ferreteria": f[0],
                            "nombre": f[1],
                            "direccion": f[2],
                            "latitud": float(f[3]),
                            "longitud": float(f[4]),
                            "precio_bob": float(f[5]),
                            "stock": int(f[6]),
                            "reputacion": float(f[7]),
                            "distancia_km": round(float(f[8]), 2),
                            "puntuacion_ahp": round(float(score_total), 4)
                        })

                    # Ordenar descendentemente por puntuación AHP final
                    ferreterias_ordenadas.sort(key=lambda x: x["puntuacion_ahp"], reverse=True)
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error en consulta PostGIS/AHP: {str(e)}")
