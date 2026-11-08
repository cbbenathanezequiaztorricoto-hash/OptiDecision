# app/modules/buscador_ahp/schemas.py
# Esquemas Pydantic para el algoritmo multicriterio AHP.

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator

# -------------------------------------------------------------------------
# MODELO DE ENTRADA (LO QUE EL CLIENTE O EL FRONTEND ENVÍA)
# -------------------------------------------------------------------------
class AHPMatrizCriteriosInput(BaseModel):
    criterios: List[str] = Field(
        default=["Precio", "Distancia", "Reputacion", "Stock"],
        description="Nombres de los criterios de comparación"
    )
    matriz_comparacion: List[List[float]] = Field(
        ...,
        description="Matriz cuadrada A (n x n) de comparación por pares (Escala de Saaty 1-9)"
    )
    alternativas: Optional[List[Dict[str, float]]] = Field(
        default=None,
        description="Lista de opciones con sus puntuaciones normalizadas por criterio (opcional)"
    )
    # 1. VALIDADOR 
    #Cuando llegue el atributo matriz_comparacion, se ejecuta esta función para validar su contenido
    @field_validator("matriz_comparacion")
    @classmethod
    def validar_matriz_cuadrada(cls, v: List[List[float]]) -> List[List[float]]:
        if not v or not v[0]:
            raise ValueError("La matriz de comparación no puede estar vacía.")
        
        n = len(v)
        for i, fila in enumerate(v):
            if len(fila) != n:
                raise ValueError(f"La matriz de comparación debe ser cuadrada ({n}x{n}). La fila {i} tiene {len(fila)} columnas.")
            if abs(fila[i] - 1.0) > 1e-4:
                raise ValueError(f"La diagonal principal de la matriz AHP debe ser exactamente 1.0 (error en celda [{i},{i}] = {fila[i]}).")
        return v
    # 2. VALIDADOR DE RECIPROCIDAD Y NOMBRES DE CRITERIOS
    # Cuando se haya validado la matriz de comparación, se ejecuta esta función para validar la reciprocidad y los nombres de los criterios
    @model_validator(mode="after")
    def validar_reciprocidad_y_nombres(self) -> "AHPMatrizCriteriosInput":
        n = len(self.matriz_comparacion)
        
        if len(self.criterios) != n:
            raise ValueError(f"Se definieron {len(self.criterios)} criterios, pero la matriz es de {n}x{n}.")
        
        if len(set(self.criterios)) != len(self.criterios):
            raise ValueError("Los nombres de los criterios no pueden estar duplicados.")

        # Validación de reciprocidad: A[i][j] * A[j][i] approx 1.0
        for i in range(n):
            for j in range(i + 1, n):
                val_ij = self.matriz_comparacion[i][j]
                val_ji = self.matriz_comparacion[j][i]
                if val_ij <= 0 or val_ji <= 0:
                    raise ValueError(f"Todos los valores de la matriz deben ser estrictamente mayores a cero. Error en celda [{i},{j}].")
                
                if abs((val_ij * val_ji) - 1.0) > 0.05:
                    raise ValueError(
                        f"La matriz no es recíproca en la celda [{i},{j}]: "
                        f"A[{i}][{j}]={val_ij} y A[{j}][{i}]={val_ji} (su producto debe ser 1.0)."
                    )
        return self

# -------------------------------------------------------------------------
# MODELO DE SALIDA (LO QUE RESPONDE NUESTRA API)
# -------------------------------------------------------------------------
class AHPResultadoOutput(BaseModel):
    vector_pesos_W: Dict[str, float] = Field(
        ..., 
        description="Pesos porcentuales asignados a cada criterio"
    )
    lambda_maximo: float = Field(
        ..., 
        description="Autovalor máximo lambda_max de la matriz"
    )
    indice_consistencia_CI: float = Field(
        ..., 
        description="Índice de Consistencia CI = (lambda_max - n) / (n - 1)"
    )
    indice_aleatorio_RI: float = Field(
        ..., 
        description="Índice Aleatorio de referencia RI según Saaty"
    )
    ratio_consistencia_CR: float = Field(
        ..., 
        description="Ratio de Consistencia CR = CI / RI (Debe ser < 0.10)"
    )
    es_consistente: bool = Field(
        ..., 
        description="True si CR < 0.10, False en caso de inconsistencia en los juicios"
    )
    ranking_alternativas: Optional[List[Dict[str, Any]]] = Field(
        default=None, 
        description="Lista de ferreterías ordenadas de mayor a menor puntuación ponderada"
    )
    mensaje_consistencia: str = Field(
        ..., 
        description="Explicación en lenguaje natural sobre la validez de los pesos"
    )
   