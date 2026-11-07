# app/modules/colas_mm1/engine.py
# Motor de cálculo determinístico para Teoría de Colas M/M/1.
#Traemos los moldes de entrada y salida para el cálculo de colas M/M/1
from typing import Dict, Any
from app.modules.colas_mm1.schemas import ColasMM1Input


def calcular_colas_mm1(datos: ColasMM1Input) -> Dict[str, Any]:
    lam = datos.tasa_llegada_lambda
    mu = datos.tasa_servicio_mu
    unidad = datos.unidad_tiempo.lower().strip()

    # Factor de conversión a minutos
    factor_a_minutos = 60.0 if unidad == "horas" else 1.0

    # 1. Factor de uso rho = lambda / mu (Porcentaje de ocupación del cajero)
    rho = lam / mu

    # 2. Probabilidad de sistema vacío P0 = 1 - rho (Atención sin fila)
    P0 = 1.0 - rho

    # 3. Número promedio de clientes en el sistema Ls = lambda / (mu - lambda)
    Ls = lam / (mu - lam)

    # 4. Número promedio de clientes en cola Lq = lambda^2 / (mu * (mu - lambda))
    Lq = (lam ** 2) / (mu * (mu - lam))

    # 5. Tiempo promedio en el sistema Ws = 1 / (mu - lambda)
    Ws_raw = 1.0 / (mu - lam)
    Ws_min = Ws_raw * factor_a_minutos

    # 6. Tiempo promedio en cola Wq = lambda / (mu * (mu - lambda))
    Wq_raw = lam / (mu * (mu - lam))
    Wq_min = Wq_raw * factor_a_minutos

    # 7. Tiempo de atención directo en caja = 1 / mu
    W_servicio_min = (1.0 / mu) * factor_a_minutos

    # 8. Probabilidades de estado estacionario Pn = (1 - rho) * (rho^n)
    probabilidades_Pn = {}
    for n in range(6):
        Pn = (1.0 - rho) * (rho ** n)
        probabilidades_Pn[f"P_{n}_clientes"] = round(float(Pn * 100.0), 2)

    # 9. Construcción de recomendación contextualizada para el comprador
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
    #Retornamos un diccionario con los resultados de cálculo, redondeados a 2 decimales para el molde de salida
    return {
        "factor_utilizacion_rho_pct": round(float(rho * 100.0), 2),
        "probabilidad_sistema_vacio_P0_pct": round(float(P0 * 100.0), 2),
        "clientes_en_sistema_Ls": round(float(Ls), 2),
        "clientes_en_cola_Lq": round(float(Lq), 2),
        "tiempo_espera_cola_Wq_minutos": round(float(Wq_min), 2),
        "tiempo_atencion_caja_minutos": round(float(W_servicio_min), 2),
        "tiempo_total_sistema_Ws_minutos": round(float(Ws_min), 2),
        "probabilidades_estado_estacionario": probabilidades_Pn,
        "recomendacion_cliente": rec
    }
#Solo hay una función en este módulo
