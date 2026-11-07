# app/modules/colas_mm1/engine.py
# Motor de cálculo determinístico para Teoría de Colas M/M/1.

#Traemos los moldes de entrada y salida para el cálculo de colas M/M/1
from typing import Dict, Any
from app.modules.colas_mm1.schemas import ColasMM1Input


def calcular_colas_mm1(datos: ColasMM1Input) -> Dict[str, Any]:
    lam = datos.tasa_llegada_lambda
    mu = datos.tasa_servicio_mu
    unidad = datos.unidad_tiempo

    # 1. Factor de uso rho = lambda / mu
    rho = lam / mu

    # 2. Probabilidad de sistema vacío P0 = 1 - rho
    P0 = 1.0 - rho

    # 3. Número promedio de clientes en el sistema L = lambda / (mu - lambda)
    L = lam / (mu - lam)

    # 4. Número promedio de clientes en cola Lq = lambda^2 / (mu * (mu - lambda))
    Lq = (lam ** 2) / (mu * (mu - lam))

    # 5. Tiempo promedio en el sistema W = 1 / (mu - lambda)
    W = 1.0 / (mu - lam)

    # 6. Tiempo promedio en cola Wq = lambda / (mu * (mu - lambda))
    Wq = lam / (mu * (mu - lam))

    # 7. Probabilidades Pn = (1 - rho) * (rho^n) para n de 0 a 5
    probabilidades_Pn = {}
    for n in range(6):
        Pn = (1.0 - rho) * (rho ** n)
        probabilidades_Pn[f"P_{n}_clientes"] = round(float(Pn * 100), 2)

    # Convertir tiempos a minutos si la unidad eran horas
    tiempo_cola_min = Wq * 60.0 if unidad == "horas" else Wq

    if tiempo_cola_min > 15.0:
        rec = f"Atención: Tiempo de espera estimado en cola de {round(tiempo_cola_min, 1)} minutos. Se sugiere visitar en otro horario."
    else:
        rec = f"Buena oportunidad: Tiempo de espera estimado en cola de solo {round(tiempo_cola_min, 1)} minutos."

    #Retornamos un diccionario con los resultados de cálculo, redondeados a 2 decimales para el molde de salida
    return {
        "factor_utilizacion_rho": round(float(rho * 100), 2),
        "probabilidad_sistema_vacio_P0": round(float(P0 * 100), 2),
        "clientes_promedio_sistema_L": round(float(L), 2),
        "clientes_promedio_cola_Lq": round(float(Lq), 2),
        "tiempo_promedio_sistema_W": round(float(W), 2),
        "tiempo_promedio_cola_Wq": round(float(Wq), 2),
        "probabilidades_estado_estacionario": probabilidades_Pn,
        "recomendacion_cliente": rec
    }
#Solo hay una función en este módulo