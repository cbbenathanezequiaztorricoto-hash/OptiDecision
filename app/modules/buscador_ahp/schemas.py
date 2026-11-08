# app/modules/buscador_ahp/schemas.py
# Esquemas Pydantic para el algoritmo multicriterio AHP y búsqueda geoespacial.

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator


# -------------------------------------------------------------------------
# 1. PONDERACIÓN DE SLIDERS AHP (DESDE EL BUSCADOR FLOTANTE EN FRONTEND)
# -------------------------------------------------------------------------
class PesosAHPInput(BaseModel):
    precio: int = Field(
        default=4,
        description="Peso asignado al criterio de precio (Escala Saaty 1-9)"
    )
    distancia: int = Field(
        default=3,
        description="Peso asignado al criterio de distancia (Escala Saaty 1-9)"
    )
    reputacion: int = Field(
        default=2,
        description="Peso asignado al criterio de reputación (Escala Saaty 1-9)"
    )
    stock: int = Field(
        default=1,
        description="Peso asignado al criterio de stock (Escala Saaty 1-9)"
    )


# -------------------------------------------------------------------------
# 2. ENTRADA DE BÚSQUEDA GEOESPACIAL (MAPA + SLIDERS)
# -------------------------------------------------------------------------
class AHPSearchInput(BaseModel):
    latitud: float = Field(..., description="Latitud GPS del origen")
    longitud: float = Field(..., description="Longitud GPS del origen")
    producto: str = Field(..., min_length=1, description="Nombre del producto ferretero")
    pesos: PesosAHPInput = Field(default_factory=PesosAHPInput, description="Ponderación de los sliders AHP")


# -------------------------------------------------------------------------
# 3. ENTRADA DE MATRIZ AHP PURA (EVALUACIÓN MANUAL N x N)
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
        description="Lista de opciones con sus puntuaciones normalizadas por criterio"
    )

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

    @model_validator(mode="after")
    def validar_reciprocidad_y_nombres(self) -> "AHPMatrizCriteriosInput":
        n = len(self.matriz_comparacion)
        
        if len(self.criterios) != n:
            raise ValueError(f"Se definieron {len(self.criterios)} criterios, pero la matriz es de {n}x{n}.")
        
        if len(set(self.criterios)) != len(self.criterios):
            raise ValueError("Los nombres de los criterios no pueden estar duplicados.")

        for i in range(n):
            for j in range(i + 1, n):
                val_ij = self.matriz_comparacion[i][j]
                val_ji = self.matriz_comparacion[j][i]
                if val_ij <= 0 or val_ji <= 0:
                    raise ValueError(f"Todos los valores de la matriz deben ser mayores a cero. Celda [{i},{j}].")
                
                if abs((val_ij * val_ji) - 1.0) > 0.05:
                    raise ValueError(
                        f"La matriz no es recíproca en la celda [{i},{j}]: "
                        f"A[{i}][{j}]={val_ij} y A[{j}][{i}]={val_ji} (su producto debe ser 1.0)."
                    )
        return self


# -------------------------------------------------------------------------
# 4. SALIDA UNIFICADA AHP Y BUSCADOR
# -------------------------------------------------------------------------
class AHPResultadoOutput(BaseModel):
    vector_pesos_W: Dict[str, float] = Field(..., description="Pesos porcentuales asignados a cada criterio")
    lambda_maximo: float = Field(..., description="Autovalor máximo lambda_max de la matriz")
    indice_consistencia_CI: float = Field(..., description="Índice de Consistencia CI")
    indice_aleatorio_RI: float = Field(..., description="Índice Aleatorio de referencia RI (Saaty)")
    ratio_consistencia_CR: float = Field(..., description="Ratio de Consistencia CR = CI / RI (< 0.10)")
    es_consistente: bool = Field(..., description="True si CR < 0.10")
    ferreterias: Optional[List[Dict[str, Any]]] = Field(default=None, description="Ferreterías resultado ordenadas por AHP")
    ranking_alternativas: Optional[List[Dict[str, Any]]] = Field(default=None, description="Ranking genérico AHP")
    mensaje_consistencia: str = Field(..., description="Explicación en lenguaje natural")