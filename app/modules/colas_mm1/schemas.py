# app/modules/colas_mm1/schemas.py
# Validaciones para el modelo de colas M/M/1.

from typing import Dict, Optional
from pydantic import BaseModel, Field, model_validator


class ColasMM1Input(BaseModel):
    tasa_llegada_lambda: float = Field(
        ...,
        gt=0.0,
        description="Tasa promedio de llegada de clientes lambda"
    )
    tasa_servicio_mu: float = Field(
        ...,
        gt=0.0,
        description="Tasa promedio de atención mu"
    )
    unidad_tiempo: str = Field(
        default="horas",
        description="Unidad de tiempo ('horas' o 'minutos')"
    )
    id_ferreteria: Optional[int] = Field(
        default=None,
        description="ID opcional de ferretería (solo aplicable por admin)"
    )

    @model_validator(mode="after")
    def validar_estabilidad_sistema(self) -> "ColasMM1Input":
        if self.tasa_servicio_mu <= self.tasa_llegada_lambda:
            raise ValueError(
                f"El sistema es inestable (cola infinita). La tasa de atención mu ({self.tasa_servicio_mu}) "
                f"debe ser estrictamente mayor que la de llegada lambda ({self.tasa_llegada_lambda})."
            )
        return self


class ColasMM1Output(BaseModel):
    factor_uso_rho: float = Field(..., description="Porcentaje de tiempo que el servicio está ocupado")
    probabilidad_sistema_vacio_P0_pct: float = Field(..., description="Probabilidad de ser atendido inmediatamente")
    clientes_en_sistema_Ls: float = Field(..., description="Número promedio de clientes dentro del establecimiento")
    clientes_en_cola_Lq: float = Field(..., description="Número promedio de clientes en la fila")
    tiempo_espera_cola_Wq: float = Field(..., description="Tiempo promedio parado haciendo fila")
    tiempo_atencion_caja_minutos: float = Field(..., description="Tiempo promedio de cobro en ventanilla")
    tiempo_total_sistema_Ws_minutos: float = Field(..., description="Tiempo total en el establecimiento")
    probabilidades_estado_estacionario: Dict[str, float] = Field(..., description="Probabilidades por número de clientes")
    recomendacion_cliente: str = Field(..., description="Recomendación final para la toma de decisiones")