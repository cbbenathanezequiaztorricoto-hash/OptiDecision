# app/modules/markov/engine.py
# Motor de cálculo algebraico puro con NumPy para Cadenas de Markov Absorbentes.

#Mantenibilidad (Si algo se rompe):
#Si la respuesta JSON de la API no coincide con la documentación 
#   entonces Revisas el diccionario de retorno en engine.py 
# o el modelo en schemas.py.Si da error en la multiplicación o inversión matricial 
#   entonces Ajustas las dimensiones 
# o la conversión a NumPy en engine.py.   
# Si la ruta HTTP falla o no responde 
#   entonces Revisas routes.py.


import numpy as np
from typing import Dict, Any, List


def calcular_cadena_markov_absorbente(
    estados_trans: List[str],
    estados_abs: List[str],
    matriz_Q_raw: List[List[float]],
    matriz_R_raw: List[List[float]]
) -> Dict[str, Any]:
    """
    Ejecuta el álgebra de estados absorbentes usando la forma canónica P = [[Q, R], [0, I]].
    
    Fórmulas:
      1. Matriz Fundamental: N = (I - Q)^-1
      2. Matriz de Absorción: B = N * R
      3. Tiempo/Pasos hasta absorción: t = N * vector_unos
    """
    Q = np.array(matriz_Q_raw, dtype=float)
    R = np.array(matriz_R_raw, dtype=float)
    
    k = Q.shape[0]  # Cantidad de estados transitorios (filas/columnas de Q)
    r = R.shape[1]  # Cantidad de estados absorbentes (columnas de R)
    
    # -------------------------------------------------------------------------
    # VALIDACIÓN DE DIMENSIONES INTERNAS (Defensa contra desalineación)
    # -------------------------------------------------------------------------
    if len(estados_trans) != k:
        raise ValueError(f"Se recibieron {len(estados_trans)} nombres de estados transitorios, pero la matriz Q tiene {k} filas.")
    
    if R.shape[0] != k:
        raise ValueError(f"La matriz R debe tener {k} filas (igual a Q), pero tiene {R.shape[0]}.")
        
    if len(estados_abs) != r:
        raise ValueError(f"Se recibieron {len(estados_abs)} nombres de estados absorbentes, pero la matriz R tiene {r} columnas.")

    # 1. Matriz Identidad I de tamaño (k x k)
    I = np.eye(k)
    
    # 2. Matriz Fundamental: N = (I - Q)^-1
    I_minus_Q = I - Q
    try:
        N = np.linalg.inv(I_minus_Q)
    except np.linalg.LinAlgError:
        raise ValueError(
            "La matriz (I - Q) es singular y no se puede invertir. "
            "Verifique que las probabilidades de Q permitan salir hacia estados absorbentes."
        )
    
    # 3. Matriz de Absorción: B = N * R
    B = np.matmul(N, R)
    
    # 4. Pasos promedio esperados antes de la absorción: t = N * vector_unos
    t = np.sum(N, axis=1)
    
    # -------------------------------------------------------------------------
    # CONVERSIÓN A TIPOS NATIVOS DE PYTHON (Listas y Diccionarios)
    # -------------------------------------------------------------------------
    matriz_N_list = np.round(N, 4).tolist()
    
    dict_B = {}
    for i, origen in enumerate(estados_trans):
        dict_B[origen] = {}
        for j, destino in enumerate(estados_abs):
            dict_B[origen][destino] = round(float(B[i, j]), 4)
            
    dict_t = {
        origen: round(float(t[i]), 2)
        for i, origen in enumerate(estados_trans)
    }
    
    # -------------------------------------------------------------------------
    # GENERACIÓN DINÁMICA DE INTERPRETACIONAL HUMANA (Sin hardcodear B[i, 0])
    # -------------------------------------------------------------------------
    interpretaciones = []
    for i, origen in enumerate(estados_trans):
        pasos = dict_t[origen]
        
        # Iteramos sobre TODOS los estados absorbentes reales sin asumir cuál es el primero
        desglose = [
            f"{round(float(B[i, j]) * 100, 1)}% en '{destino}'"
            for j, destino in enumerate(estados_abs)
        ]
        texto_desglose = ", ".join(desglose)
        
        interpretaciones.append(
            f"Un usuario que inicia en '{origen}' realiza en promedio {pasos} interacciones "
            f"y sus probabilidades finales son: {texto_desglose}."
        )
        
    return {
        "matriz_fundamental_N": matriz_N_list,
        "matriz_absorcion_B": dict_B,
        "pasos_esperados_t": dict_t,
        "interpretacion_humana": interpretaciones
    }