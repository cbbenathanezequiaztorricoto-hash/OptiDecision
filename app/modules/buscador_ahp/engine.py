# app/modules/buscador_ahp/engine.py
# Motor algebraico con NumPy para AHP, cálculo M/M/1 (Wq) y enrutamiento OpenRouteService.

import os
import math
import requests
import numpy as np
from typing import Dict, Any, List, Optional
from app.modules.buscador_ahp.schemas import AHPMatrizCriteriosInput

TABLA_RI = {
    1: 0.00,
    2: 0.00,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49
}

PERFILES_ORS_VALIDOS = {"driving-car", "cycling-regular", "foot-walking"}


def calcular_proceso_ahp(datos: AHPMatrizCriteriosInput) -> Dict[str, Any]:
    criterios = datos.criterios
    n = len(criterios)
    A = np.array(datos.matriz_comparacion, dtype=float)

    suma_columnas = np.sum(A, axis=0)
    matriz_normalizada = A / suma_columnas
    W = np.mean(matriz_normalizada, axis=1)

    A_w = np.dot(A, W)
    ratios_lambda = A_w / W
    lambda_max = float(np.mean(ratios_lambda))

    CI = (lambda_max - n) / (n - 1) if n > 1 else 0.0
    RI = TABLA_RI.get(n, 1.49)
    CR = CI / RI if RI > 0 else 0.0
    es_consistente = bool(CR < 0.10)

    dict_pesos_W = {
        criterio: round(float(W[i] * 100.0), 2)
        for i, criterio in enumerate(criterios)
    }

    ranking = None
    if datos.alternativas:
        ranking_evaluado = []
        for alt in datos.alternativas:
            nombre = alt.get("nombre", "Ferretería Desconocida")
            score_total = 0.0
            for i, crit in enumerate(criterios):
                score_criterio = alt.get(crit, 0.0)
                score_total += score_criterio * W[i]
            ranking_evaluado.append({
                "nombre": nombre,
                "puntuacion_ponderada": round(float(score_total), 4),
                "detalles": alt
            })
        ranking = sorted(ranking_evaluado, key=lambda x: x["puntuacion_ponderada"], reverse=True)

    if es_consistente:
        mensaje = (
            f"Matriz AHP consistente (CR = {round(CR, 4)} < 0.10). "
            f"Los pesos asignados son válidos para la toma de decisiones."
        )
    else:
        mensaje = (
            f"Advertencia: Matriz AHP inconsistente (CR = {round(CR, 4)} >= 0.10). "
            f"Existen juicios contradictorios. Por favor revise las comparaciones entre criterios."
        )

    return {
        "vector_pesos_W": dict_pesos_W,
        "lambda_maximo": round(lambda_max, 4),
        "indice_consistencia_CI": round(CI, 4),
        "indice_aleatorio_RI": round(RI, 2),
        "ratio_consistencia_CR": round(CR, 4),
        "es_consistente": es_consistente,
        "ranking_alternativas": ranking,
        "mensaje_consistencia": mensaje
    }


def calcular_wq_y_estado(lam: Optional[float], mu: Optional[float]) -> Dict[str, Any]:
    """Calcula el tiempo esperado en cola Wq (minutos) y la etiqueta de congestión M/M/1."""
    if lam is None or mu is None or mu <= lam or lam <= 0:
        return {
            "tiempo_espera_wq_min": None,
            "estado_congestion": "Sin datos de cola"
        }

    wq_min = round((lam / (mu * (mu - lam))) * 60.0, 1)
    if wq_min > 15.0:
        estado = "Alta congestión"
    elif wq_min > 5.0:
        estado = "Congestión moderada"
    else:
        estado = "Atención fluida"

    return {
        "tiempo_espera_wq_min": wq_min,
        "estado_congestion": estado
    }


def _distancia_haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def consultar_ruta_ors(
    origen_lat: float,
    origen_lng: float,
    destino_lat: float,
    destino_lng: float,
    modo: str = "driving-car"
) -> Dict[str, Any]:
    """Consulta OpenRouteService API y devuelve ruta principal y alternativas en GeoJSON (RN-10)."""
    if modo not in PERFILES_ORS_VALIDOS:
        raise ValueError(f"Modo de transporte inválido '{modo}'. Use: driving-car, cycling-regular o foot-walking.")

    api_key = os.getenv("ORS_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Falta la variable ORS_API_KEY en el archivo .env del servidor.")

    url = f"https://api.openrouteservice.org/v2/directions/{modo}/geojson"
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json; charset=utf-8"
    }

    body: Dict[str, Any] = {
        "coordinates": [
            [origen_lng, origen_lat],
            [destino_lng, destino_lat]
        ]
    }

    # ORS soporta alternative_routes cuando la distancia es menor a 100 km
    if _distancia_haversine_km(origen_lat, origen_lng, destino_lat, destino_lng) < 90.0:
        body["alternative_routes"] = {
            "target_count": 3,
            "weight_factor": 1.4,
            "share_factor": 0.6
        }

    resp = requests.post(url, json=body, headers=headers, timeout=12)
    if resp.status_code != 200:
        # Reintentar sin alternative_routes si ORS rechaza alternativas para ese tramo
        if "alternative_routes" in body:
            body.pop("alternative_routes", None)
            resp = requests.post(url, json=body, headers=headers, timeout=12)

    if resp.status_code != 200:
        raise ValueError(f"OpenRouteService respondió con error ({resp.status_code}): {resp.text[:200]}")

    geojson = resp.json()
    features = geojson.get("features") or []
    if not features:
        raise ValueError("OpenRouteService no encontró una ruta vial entre los puntos indicados.")

    rutas = []
    for idx, feat in enumerate(features):
        summary = feat.get("properties", {}).get("summary", {})
        distancia_m = float(summary.get("distance", 0.0))
        duracion_s = float(summary.get("duration", 0.0))
        rutas.append({
            "indice": idx,
            "es_principal": idx == 0,
            "etiqueta": "Ruta óptima" if idx == 0 else f"Alternativa {idx}",
            "distancia_km": round(distancia_m / 1000.0, 2),
            "duracion_min": round(duracion_s / 60.0, 1),
            "geometry": feat.get("geometry")
        })

    return {
        "modo": modo,
        "total_rutas": len(rutas),
        "rutas": rutas
    }
