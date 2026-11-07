# app/modules/decisiones/engine.py
# Motor algebraico con NumPy para Teoría de Decisión (Incertidumbre y Riesgo).

import numpy as np
from typing import Dict, Any
from app.modules.decisiones.schemas import DecisionInput


def evaluar_toma_decisiones(datos: DecisionInput) -> Dict[str, Any]:
    """
    Resuelve los 5 criterios bajo Incertidumbre (Laplace, Wald Optimista/Pesimista, Hurwicz, Savage)
    y opcionalmente los criterios bajo Riesgo (VME, VEconIP, VEIP).
    """
    alts = datos.alternativas
    estados = datos.estados_naturaleza
    matriz_A = np.array(datos.matriz_pagos, dtype=float)  # Dimensión: (num_alts, num_estados)
    alpha = datos.alpha_hurwicz

    num_alts, num_estados = matriz_A.shape

    # -------------------------------------------------------------------------
    # 1. CRITERIOS BAJO INCERTIDUMBRE
    # -------------------------------------------------------------------------
    
    # A) LAPLACE: Promedio por fila (asume equiprobabilidad 1/n)
    v_laplace = np.mean(matriz_A, axis=1)
    idx_laplace = int(np.argmax(v_laplace))
    
    # B) WALD OPTIMISTA (MaxiMax): El máximo de los máximos por fila
    maximos_fila = np.max(matriz_A, axis=1)
    idx_optimista = int(np.argmax(maximos_fila))
    
    # C) WALD PESIMISTA (MaxiMin): El máximo de los mínimos por fila
    minimos_fila = np.min(matriz_A, axis=1)
    idx_pesimista = int(np.argmax(minimos_fila))
    
    # D) HURWICZ: alpha * Max + (1 - alpha) * Min
    v_hurwicz = (alpha * maximos_fila) + ((1.0 - alpha) * minimos_fila)
    idx_hurwicz = int(np.argmax(v_hurwicz))
    
    # E) SAVAGE (Arrepentimiento / Pérdida de Oportunidad):
    #     R_ij = Max_coluna_j - A_ij
    maximos_columna = np.max(matriz_A, axis=0)  # Valor máximo alcanzable en cada estado
    matriz_savage = maximos_columna - matriz_A   # Matriz de lamento (>= 0)
    
    lamento_maximo_fila = np.max(matriz_savage, axis=1)  # Peor arrepentimiento posible por alternativa
    idx_savage = int(np.argmin(lamento_maximo_fila))     # Criterio MiniMax: Elegir el menor lamento máximo
    
    # Formatear la tabla Savage para el retorno
    dict_savage_tabla = {}
    for i, alt in enumerate(alts):
        dict_savage_tabla[alt] = {}
        for j, est in enumerate(estados):
            dict_savage_tabla[alt][est] = round(float(matriz_savage[i, j]), 2)

    criterios_incertidumbre = {
        "Laplace (Equiprobabilidad)": {
            "alternativa_optima": alts[idx_laplace],
            "valor_obtenido": round(float(v_laplace[idx_laplace]), 2)
        },
        "Wald Optimista (MaxiMax)": {
            "alternativa_optima": alts[idx_optimista],
            "valor_obtenido": round(float(maximos_fila[idx_optimista]), 2)
        },
        "Wald Pesimista (MaxiMin)": {
            "alternativa_optima": alts[idx_pesimista],
            "valor_obtenido": round(float(minimos_fila[idx_pesimista]), 2)
        },
        f"Hurwicz (alpha={alpha})": {
            "alternativa_optima": alts[idx_hurwicz],
            "valor_obtenido": round(float(v_hurwicz[idx_hurwicz]), 2)
        },
        "Savage (MiniMax Arrepentimiento)": {
            "alternativa_optima": alts[idx_savage],
            "valor_obtenido": round(float(lamento_maximo_fila[idx_savage]), 2)
        }
    }

    # -------------------------------------------------------------------------
    # 2. CRITERIOS BAJO RIESGO (Si se proporcionan probabilidades P_j)
    # -------------------------------------------------------------------------
    analisis_riesgo = None
    if datos.probabilidades is not None:
        P = np.array(datos.probabilidades, dtype=float)
        
        # VME_i = sum_j ( P_j * A_ij )  -> Multiplicación Matriz-Vector
        vector_vme = np.dot(matriz_A, P)
        idx_vme_opt = int(np.argmax(vector_vme))
        vme_optimo = float(vector_vme[idx_vme_opt])
        
        # VEconIP = sum_j ( P_j * Max_i(A_ij) )  -> Valor Esperado Con Información Perfecta
        ve_con_ip = float(np.sum(P * maximos_columna))
        
        # VEIP = VEconIP - VME_optimo  -> Valor Esperado de la Información Perfecta
        veip = ve_con_ip - vme_optimo
        
        dict_vme_alts = {
            alts[i]: round(float(vector_vme[i]), 2)
            for i in range(num_alts)
        }
        
        analisis_riesgo = {
            "vme_por_alternativa": dict_vme_alts,
            "decision_optima_vme": alts[idx_vme_opt],
            "vme_optimo": round(vme_optimo, 2),
            "ve_con_ip": round(ve_con_ip, 2),
            "veip": round(veip, 2)
        }

    # -------------------------------------------------------------------------
    # 3. RECOMENDACIÓN GENERAL COMPRENSIBLE
    # -------------------------------------------------------------------------
    if analisis_riesgo:
        rec = (
            f"Bajo condiciones de riesgo, se recomienda la alternativa '{analisis_riesgo['decision_optima_vme']}' "
            f"con un VME de {analisis_riesgo['vme_optimo']} BOB. El Valor Esperado de la Información Perfecta (VEIP) "
            f"es de {analisis_riesgo['veip']} BOB (móntulo máximo a pagar por un estudio de mercado)."
        )
    else:
        rec = (
            f"Bajo incertidumbre, el criterio Pesimista (Wald) sugiere '{alts[idx_pesimista]}', "
            f"mientras que Laplace recomienda '{alts[idx_laplace]}'. Savage minimiza el lamento en '{alts[idx_savage]}'."
        )

    return {
        "criterios_incertidumbre": criterios_incertidumbre,
        "matriz_savage_arrepentimiento": dict_savage_tabla,
        "analisis_riesgo": analisis_riesgo,
        "recomendacion_general": rec
    }