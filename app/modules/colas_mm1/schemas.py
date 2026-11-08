# app/modules/colas_mm1/schemas.py
# Validaciones para el modelo de colas M/M/1 de la materia IOP812.

from typing import Dict
from pydantic import BaseModel, Field, model_validator

# -------------------------------------------------------------------------
# MOLDE DE ENTRADA: COLA MODELO M/M/1
# -------------------------------------------------------------------------
class ColasMM1Input(BaseModel):
    tasa_llegada_lambda: float = Field(
        ..., 
        gt=0.0, 
        description="Tasa promedio de llegada de clientes lambda (ej. 5 clientes/hora)"
    )
    tasa_servicio_mu: float = Field(
        ..., 
        gt=0.0, 
        description="Tasa promedio de atención mu (ej. 6 clientes/hora)"
    )
    unidad_tiempo: str = Field(
        default="horas", 
        description="Unidad de tiempo ('horas' o 'minutos')"
    )
    # VALIDADOR 1: Comprobar que el sistema sea estable (mu > lambda)
    @model_validator(mode="after")
    def validar_estabilidad_sistema(self) -> "ColasMM1Input":
        #Comparación cantidad_1 (esMayor/esMenor) cantidad_2 para evitar errores de precisión con floats
        if self.tasa_servicio_mu <= self.tasa_llegada_lambda:
            raise ValueError(
                f"El sistema es inestable (cola infinita). La tasa de atención mu ({self.tasa_servicio_mu}) "
                f"debe ser estrictamente mayor que la de llegada lambda ({self.tasa_llegada_lambda})."
            )
        return self

# -------------------------------------------------------------------------
# MOLDE DE SALIDA: ES UN MOLDE EN EL QUE SE LLENAN LOS RESULTADOS DE CÁLCULO
# -------------------------------------------------------------------------
class ColasMM1Output(BaseModel):
    factor_utilizacion_rho_pct: float = Field(
        ..., 
        description="Porcentaje de tiempo que el servicio está ocupado"
    )
    probabilidad_sistema_vacio_P0_pct: float = Field(
        ...,
        description="Probabilidad de llegar y ser atendido INMEDIATAMENTE"
    )
    clientes_en_sistema_Ls: float = Field(
        ..., 
        description="Número promedio de clientes dentro de la ferretería"
    )
    clientes_en_cola_Lq: float = Field(
        ..., 
        description="Número promedio de clientes parados en la fila"
    )
    
    # TIEMPOS DESGLOSADOS (Wq vs Ws)
    tiempo_espera_cola_Wq_minutos: float = Field(
        ..., 
        description="Tiempo promedio parado HACIENDO FILA (Wq en minutos)"
    )
    tiempo_atencion_caja_minutos: float = Field(
        ..., 
        description="Tiempo promedio que toma el cobro en ventanilla"
    )
    tiempo_total_sistema_Ws_minutos: float = Field(
        ..., 
        description="Tiempo TOTAL en la ferretería: Fila + Cobro"
    )
    
    probabilidades_estado_estacionario: Dict[str, float] = Field(
        ..., 
        description="Probabilidad de encontrar exactamente n clientes en el mostrador"
    )
    recomendacion_cliente: str = Field(
        ..., 
        description="Recomendación final para la toma de decisión del usuario"
    )
