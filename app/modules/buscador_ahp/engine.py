# app/modules/buscador_ahp/engine.py
# Motor algebraico con NumPy para la toma de decisiones multicriterio AHP.

import numpy as np
from typing import Dict, Any, List
from app.modules.buscador_ahp.schemas import AHPMatrizCriteriosInput

# Tabla de Índices Aleatorios (RI) de Saaty para matrices de tamaño n=1 a 10
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


def calcular_proceso_ahp(datos: AHPMatrizCriteriosInput) -> Dict[str, Any]:
    criterios = datos.criterios
    n = len(criterios)
    A = np.array(datos.matriz_comparacion, dtype=float)

    # 1. Normalización por columnas: N[i, j] = A[i, j] / sum(A[:, j])
    suma_columnas = np.sum(A, axis=0)
    matriz_normalizada = A / suma_columnas

    # 2. Vector de Pesos / Prioridades (W): Promedio por fila de la matriz normalizada
    W = np.mean(matriz_normalizada, axis=1)

    # 3. Cálculo de A * W
    A_w = np.dot(A, W)

    # 4. Cálculo de lambda_max = Promedio( (A * W) / W )
    ratios_lambda = A_w / W
    lambda_max = float(np.mean(ratios_lambda))

    # 5. Índice de Consistencia CI = (lambda_max - n) / (n - 1)
    if n > 1:
        CI = (lambda_max - n) / (n - 1)
    else:
        CI = 0.0

    # 6. Índice Aleatorio RI según el tamaño n
    RI = TABLA_RI.get(n, 1.49)

    # 7. Ratio de Consistencia CR = CI / RI
    if RI > 0:
        CR = CI / RI
    else:
        CR = 0.0

    es_consistente = bool(CR < 0.10)

    # Formatear el vector de pesos a diccionario
    dict_pesos_W = {
        criterio: round(float(W[i] * 100.0), 2)
        for i, criterio in enumerate(criterios)
    }

    # 8. Evaluación de alternativas (si se enviaron)
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

        # Ordenar de mayor a menor puntuación
        ranking = sorted(ranking_evaluado, key=lambda x: x["puntuacion_ponderada"], reverse=True)

    # Mensaje explícito de consistencia
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