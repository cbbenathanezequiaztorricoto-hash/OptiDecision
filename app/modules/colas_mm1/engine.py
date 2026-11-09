# app/modules/colas_mm1/engine.py
# Motor de cálculo determinístico para Teoría de Colas M/M/1.

from typing import Dict, Any
from app.modules.colas_mm1.schemas import ColasMM1Input


def calcular_colas_mm1(datos: ColasMM1Input) -> Dict[str, Any]:
    lam = datos.tasa_llegada_lambda
    mu = datos.tasa_servicio_mu
    unidad = datos.unidad_tiempo.lower().strip()

    factor_a_minutos = 60.0 if unidad == "horas" else 1.0

    rho = lam / mu
    P0 = 1.0 - rho
    Ls = lam / (mu - lam)
    Lq = (lam ** 2) / (mu * (mu - lam))
    
    Ws_raw = 1.0 / (mu - lam)
    Ws_min = Ws_raw * factor_a_minutos

    Wq_raw = lam / (mu * (mu - lam))
    Wq_min = Wq_raw * factor_a_minutos

    W_servicio_min = (1.0 / mu) * factor_a_minutos

    probabilidades_Pn = {}
    for n in range(6):
        Pn = (1.0 - rho) * (rho ** n)
        probabilidades_Pn[f"P_{n}_clientes"] = round(float(Pn * 100.0), 2)

    if Wq_min > 15.0:
        rec = (
            f"Alta congestión: Se estima una espera en cola (Wq) de {round(Wq_min, 1)} min "
            f"y un tiempo total de estancia (Ws) de {round(Ws_min, 1)} min. "
            f"Probabilidad de ser atendido sin fila (P0): {round(P0 * 100, 1)}%."
        )
    elif Wq_min > 5.0:
        rec = (
            f"Congestión moderada: Tiempo en cola (Wq) de {round(Wq_min, 1)} min. "
            f"Tiempo de estancia estimado: {round(Ws_min, 1)} min."
        )
    else:
        rec = (
            f"Atención fluida: Solo {round(Wq_min, 1)} min en cola (Wq). "
            f"Tienes un {round(P0 * 100, 1)}% de probabilidad de ser atendido de inmediato."
        )

    # Claves exactas requeridas por ColasMM1Output
    return {
        "factor_uso_rho": round(float(rho), 4),
        "probabilidad_sistema_vacio_P0_pct": round(float(P0 * 100.0), 2),
        "clientes_en_sistema_Ls": round(float(Ls), 2),
        "clientes_en_cola_Lq": round(float(Lq), 2),
        "tiempo_espera_cola_Wq": round(float(Wq_raw), 4),
        "tiempo_atencion_caja_minutos": round(float(W_servicio_min), 2),
        "tiempo_total_sistema_Ws_minutos": round(float(Ws_min), 2),
        "probabilidades_estado_estacionario": probabilidades_Pn,
        "recomendacion_cliente": rec
    }
