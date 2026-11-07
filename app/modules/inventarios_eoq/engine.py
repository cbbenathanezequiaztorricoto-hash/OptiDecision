# app/modules/inventarios_eoq/engine.py
# Motor de cálculo determinístico de inventarios (EOQ Básico, EPQ, EOQ con Faltantes y ROP).

import math
from typing import Dict, Any
from app.modules.inventarios_eoq.schemas import EOQParametrosInput


def calcular_modelo_inventario(datos: EOQParametrosInput) -> Dict[str, Any]:
    """
    Selecciona y ejecuta dinámicamente el modelo de inventario correspondiente
    según los parámetros proporcionados:
      - EPQ: Si existe tasa_produccion_anual_P
      - EOQ con Faltantes: Si existe costo_faltante_p
      - EOQ Básico: Si no hay producción ni faltantes
    """
    # -------------------------------------------------------------------------
    # 1. EXTRACCIÓN DE PARÁMETROS NORMALIZADOS (ESCALA ANUAL)
    # -------------------------------------------------------------------------
    D = datos.demanda_anual_D or (datos.demanda_D * 1.0)
    H = datos.costo_mantenimiento_anual_H or (datos.costo_mantenimiento_H * 1.0)
    K = datos.costo_pedido_K
    C = datos.costo_unitario_C
    L_dias = datos.tiempo_entrega_dias_L
    dias_ano = datos.dias_laborales_ano
    SS = datos.stock_seguridad_SS

    if D <= 0 or H <= 0 or K <= 0:
        raise ValueError("La demanda (D), el costo de pedido (K) y el costo de mantenimiento (H) deben ser mayores a cero.")

    # Demanda diaria (d)
    d_diaria = D / float(dias_ano)

    # -------------------------------------------------------------------------
    # 2. IDENTIFICACIÓN Y CÁLCULO DEL MODELO CORRESPONDIENTE
    # -------------------------------------------------------------------------
    deficit_maximo_S = None
    inventario_maximo_Imax = None

    # CASO A: Modelo de Lote Económico de Producción (EPQ)
    if datos.tasa_produccion_anual_P is not None:
        P = datos.tasa_produccion_anual_P
        if P <= D:
            raise ValueError("En el modelo EPQ, la tasa de producción (P) debe ser mayor a la demanda (D).")
        
        modelo_nombre = "Lote Económico de Producción (EPQ)"
        # Q* = sqrt( (2 * D * K) / ( H * (1 - D/P) ) )
        factor_produccion = 1.0 - (D / P)
        lote_optimo_Q = math.sqrt((2.0 * D * K) / (H * factor_produccion))
        
        inventario_maximo_Imax = lote_optimo_Q * factor_produccion
        costo_mant_anual = (inventario_maximo_Imax / 2.0) * H
        costo_faltante_anual = 0.0

    # CASO B: Modelo EOQ con Faltantes / Déficit Permitido
    elif datos.costo_faltante_p is not None:
        p_costo = datos.costo_faltante_p
        if p_costo <= 0:
            raise ValueError("El costo de penalización por faltante (p) debe ser mayor a cero.")
        
        modelo_nombre = "EOQ con Faltantes Permitidos"
        # Q* = sqrt( ((2*D*K)/H) * ((p + H)/p) )
        lote_optimo_Q = math.sqrt(((2.0 * D * K) / H) * ((p_costo + H) / p_costo))
        
        # S* = Q* * (H / (p + H))
        deficit_maximo_S = lote_optimo_Q * (H / (p_costo + H))
        inventario_maximo_Imax = lote_optimo_Q - deficit_maximo_S
        
        costo_mant_anual = ((inventario_maximo_Imax ** 2) / (2.0 * lote_optimo_Q)) * H
        costo_faltante_anual = ((deficit_maximo_S ** 2) / (2.0 * lote_optimo_Q)) * p_costo

    # CASO C: Modelo EOQ Básico Clásico
    else:
        modelo_nombre = "Lote Económico de Pedido (EOQ Básico)"
        # Q* = sqrt( (2 * D * K) / H )
        lote_optimo_Q = math.sqrt((2.0 * D * K) / H)
        inventario_maximo_Imax = lote_optimo_Q
        
        costo_mant_anual = (lote_optimo_Q / 2.0) * H
        costo_faltante_anual = 0.0

    # -------------------------------------------------------------------------
    # 3. MÉTRICAS COMPLEMENTARIAS Y COSTOS TOTALES
    # -------------------------------------------------------------------------
    # Punto de Reorden ROP = (d * L) + SS
    rop = (d_diaria * float(L_dias)) + float(SS)

    # Número de pedidos/corridas al año N = D / Q*
    pedidos_ano_N = D / lote_optimo_Q

    # Tiempo entre pedidos T (días) = dias_laborales / N
    tiempo_entre_pedidos_T = float(dias_ano) / pedidos_ano_N

    # Costo de ordenar/preparar al año = N * K
    costo_pedido_anual = pedidos_ano_N * K

    # Costo de adquisición directo = D * C
    costo_adquisicion_anual = D * C

    # Costo Total de Gestión de Inventario CT
    costo_total_CT = costo_pedido_anual + costo_mant_anual + costo_faltante_anual + costo_adquisicion_anual

    # -------------------------------------------------------------------------
    # 4. ESTRUCTURA DE RETORNO NATIVA (Coincide con EOQResultadoOutput)
    # -------------------------------------------------------------------------
    return {
        "modelo_aplicado": modelo_nombre,
        "lote_optimo_Q": round(lote_optimo_Q, 2),
        "punto_reorden_ROP": round(rop, 2),
        "pedidos_por_ano_N": round(pedidos_ano_N, 2),
        "tiempo_entre_pedidos_T_dias": round(tiempo_entre_pedidos_T, 1),
        "costo_pedido_anual": round(costo_pedido_anual, 2),
        "costo_mantenimiento_anual": round(costo_mant_anual, 2),
        "costo_total_inventario_CT": round(costo_total_CT, 2),
        "deficit_maximo_S": round(deficit_maximo_S, 2) if deficit_maximo_S is not None else None,
        "inventario_maximo_Imax": round(inventario_maximo_Imax, 2) if inventario_maximo_Imax is not None else None,
    }