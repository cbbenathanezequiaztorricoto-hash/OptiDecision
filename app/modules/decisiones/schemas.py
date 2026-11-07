# app/modules/decisiones/schemas.py
# Contratos de entrada y salida para evaluar 
# decisiones bajo incertidumbre y riesgo.
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

# -------------------------------------------------------------------------
# MODELO DE ENTRADA: MATRIZ DE PAGOS Y ESCENARIOS
# -------------------------------------------------------------------------
class DecisionInput(BaseModel):
    alternativas: List[str] = Field(
        default=["Lote Conservador", "Lote Estándar", "Lote Mayorista"],
        description="Nombres de las decisiones o alternativas a evaluar"
    )
    estados_naturaleza: List[str] = Field(
        default=["Demanda Baja", "Demanda Media", "Demanda Alta"],
        description="Escenarios o estados de la naturaleza posibles"
    )
    matriz_pagos: List[List[float]] = Field(
        ...,
        description="Matriz de beneficios/pagos A (filas = alternativas, columnas = estados)"
    )
    probabilidades: Optional[List[float]] = Field(
        default=None,
        description="Probabilidades Pj de cada estado para decisiones bajo riesgo (opcional)"
    )
    alpha_hurwicz: float = Field(
        default=0.7, 
        ge=0.0, 
        le=1.0, 
        description="Coeficiente de optimismo alpha para Hurwicz"
    )
    # VALIDADOR 1: Comprobar dimensiones de la matriz de pagos 
    # vs alternativas y estados
    @field_validator("matriz_pagos")
    @classmethod
    def validar_dimensiones_matriz(cls, v: List[List[float]], info) -> List[List[float]]:
        if not v or not v[0]:
            raise ValueError("La matriz de pagos no puede estar vacía.")

        alternativas = info.data.get("alternativas")
        estados = info.data.get("estados_naturaleza")

        if alternativas and len(v) != len(alternativas):
            raise ValueError(
                f"La matriz de pagos tiene {len(v)} filas, pero se definieron {len(alternativas)} alternativas."
            )

        if estados:
            num_cols = len(estados)
            for i, fila in enumerate(v):
                if len(fila) != num_cols:
                    raise ValueError(
                        f"La fila {i} de la matriz tiene {len(fila)} columnas, pero hay {num_cols} estados de la naturaleza."
                    )
        return v
    # VALIDADOR 2: Si se envían probabilidades, deben coincidir 
    # con la cantidad de estados y sumar 1.0
    @model_validator(mode="after")
    def validar_consistencia_decision(self) -> "DecisionInput":
        # Evitar claves sobrescritas en diccionarios
        if len(set(self.alternativas)) != len(self.alternativas):
            raise ValueError("No puede haber nombres de alternativas duplicadas.")
        if len(set(self.estados_naturaleza)) != len(self.estados_naturaleza):
            raise ValueError("No puede haber nombres de estados de la naturaleza duplicados.")

        if self.probabilidades is not None:
            num_estados = len(self.estados_naturaleza)
            if len(self.probabilidades) != num_estados:
                raise ValueError(
                    f"Se enviaron {len(self.probabilidades)} probabilidades, pero hay {num_estados} estados de la naturaleza."
                )

            for p in self.probabilidades:
                if p < 0.0 or p > 1.0:
                    raise ValueError(f"La probabilidad {p} debe estar entre 0.0 y 1.0.")

            suma_p = sum(self.probabilidades)
            if abs(suma_p - 1.0) > 1e-4:
                raise ValueError(f"La suma de las probabilidades debe ser exactamente 1.0 (suma actual: {suma_p:.4f}).")

        return self


# -------------------------------------------------------------------------
# MODELO DE SALIDA: RESULTADOS DE TODOS LOS CRITERIOS DE I.O. II
# -------------------------------------------------------------------------
class CriterioResultado(BaseModel):
    alternativa_optima: str = Field(..., description="Nombre de la mejor alternativa según este criterio")
    valor_obtenido: float = Field(..., description="Valor óptimo calculado por el criterio")


class RiesgoResultado(BaseModel):
    vme_por_alternativa: Dict[str, float] = Field(..., description="Valor Medio Esperado VME de cada alternativa")
    decision_optima_vme: str = Field(..., description="Alternativa que maximiza el VME")
    vme_optimo: float = Field(..., description="Valor VME máximo alcanzado")
    ve_con_ip: float = Field(..., description="Valor Esperado Con Información Perfecta")
    veip: float = Field(..., description="Valor Esperado de la Información Perfecta (VEIP)")


class DecisionOutput(BaseModel):
    criterios_incertidumbre: Dict[str, CriterioResultado] = Field(
        ..., 
        description="Resultados de Laplace, Wald Optimista, Wald Pesimista, Hurwicz y Savage"
    )
    matriz_savage_arrepentimiento: Dict[str, Dict[str, float]] = Field(
        ..., 
        description="Tabla de arrepentimiento/pérdida de oportunidad utilizada en Savage"
    )
    analisis_riesgo: Optional[RiesgoResultado] = Field(
        default=None, 
        description="Análisis VME y VEIP (solo presente si se enviaron probabilidades)"
    )
    recomendacion_general: str = Field(
        ..., 
        description="Resumen comprensible para la toma de decisión final"
    )
