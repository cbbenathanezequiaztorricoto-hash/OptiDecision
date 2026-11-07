# app/modules/colas_mm1/schemas.py
# Validaciones para el modelo de colas M/M/1 de la materia IOP812.

from typing import List, Dict
from pydantic import BaseModel, Field, model_validator

# -------------------------------------------------------------------------
# MODELO DE ENTRADA: COLA MODELO M/M/1
# -------------------------------------------------------------------------
class ColasMM1Input(BaseModel):
    tasa_llegada_lambda: float = Field(
        ..., 
        gt=0.0, 
        description="Tasa promedio de llegada de clientes lambda (clientes por hora/minuto)"
    )
    tasa_servicio_mu: float = Field(
        ..., 
        gt=0.0, 
        description="Tasa promedio de atención del servidor mu (clientes por hora/minuto)"
    )
    unidad_tiempo: str = Field(
        default="horas", 
        description="Unidad de tiempo de las tasas (ej. 'horas', 'minutos')"
    )
    # VALIDADOR 1: Comprobar que el sistema sea estable (mu > lambda)
    @model_validator(mode="after")
    def validar_estabilidad_sistema(self) -> "ColasMM1Input":
        #Comparación cantidad<cantidad para evitar errores de precisión con floats
        if self.tasa_servicio_mu <= self.tasa_llegada_lambda:
            raise ValueError(
                f"El sistema es inestable (cola infinita). La tasa de servicio mu ({self.tasa_servicio_mu}) "
                f"debe ser estrictamente mayor que la tasa de llegada lambda ({self.tasa_llegada_lambda})."
            )
        return self

# -------------------------------------------------------------------------
# MODELO DE SALIDA: ES UN MOLDE EN EL QUE SE LLENAN LOS RESULTADOS DE CÁLCULO
# -------------------------------------------------------------------------
class ColasMM1Output(BaseModel):
    factor_utilizacion_rho: float = Field(
        ..., 
        description="Uso del sistema rho = lambda / mu (porcentaje de ocupación)"
    )
    probabilidad_sistema_vacio_P0: float = Field(
        ..., 
        description="Probabilidad de que el mostrador esté ocioso P0 = 1 - rho"
    )
    clientes_promedio_sistema_L: float = Field(
        ..., 
        description="Número esperado de clientes en el sistema L"
    )
    clientes_promedio_cola_Lq: float = Field(
        ..., 
        description="Número esperado de clientes esperando en cola Lq"
    )
    tiempo_promedio_sistema_W: float = Field(
        ..., 
        description="Tiempo total promedio gastado en la ferretería W"
    )
    tiempo_promedio_cola_Wq: float = Field(
        ..., 
        description="Tiempo promedio esperado haciendo cola Wq"
    )
    probabilidades_estado_estacionario: Dict[str, float] = Field(
        ..., 
        description="Probabilidad Pn de tener n clientes en el sistema (n=0..5)"
    )
    recomendacion_cliente: str = Field(
        ..., 
        description="Recomendación en lenguaje natural sobre la conveniencia de visitar"
    )
