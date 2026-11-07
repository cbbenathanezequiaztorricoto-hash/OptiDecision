# app/modules/inventarios_eoq/schemas.py
# Validaciones de entrada y salida con soporte para unidades de tiempo dinámicas.

from typing import Optional, Literal
from pydantic import BaseModel, Field, model_validator


# -------------------------------------------------------------------------
# 1. MODELO DE ENTRADA CON UNIDAD DE TIEMPO DINÁMICA
# -------------------------------------------------------------------------
class EOQParametrosInput(BaseModel):
    unidad_tiempo: Literal["Años", "Meses", "Días"] = Field(
        default="Años",
        description="Unidad de tiempo en la que se expresan demanda, tasa de producción, costo de mantenimiento y costo de faltante"
    )
    demanda_D: float = Field(..., gt=0, description="Demanda del producto en la unidad de tiempo elegida")
    costo_pedido_K: float = Field(..., gt=0, description="Costo fijo por realizar un pedido K (BOB)")
    costo_mantenimiento_H: float = Field(..., gt=0, description="Costo de mantener una unidad en inventario por la unidad de tiempo elegida (BOB)")
    costo_unitario_C: float = Field(default=0.0, ge=0, description="Costo de adquisición por unidad (BOB)")
    tiempo_entrega_dias_L: int = Field(default=5, ge=0, description="Tiempo de espera del proveedor L (días)")
    dias_laborales_ano: int = Field(default=300, gt=0, description="Días operativos de la ferretería al año")
    stock_seguridad_SS: int = Field(default=0, ge=0, description="Stock de seguridad requerido")
    
    # Parámetros opcionales para EPQ (Producción propia)
    tasa_produccion_P: Optional[float] = Field(default=None, description="Tasa de producción en la misma unidad de tiempo (para EPQ)")
    
    # Parámetros opcionales para EOQ con Faltantes
    costo_faltante_p: Optional[float] = Field(default=None, description="Costo de penalización por unidad faltante p (BOB)")

    # Campos calculados internamente para el motor
    demanda_anual_D: Optional[float] = None
    tasa_produccion_anual_P: Optional[float] = None
    costo_mantenimiento_anual_H: Optional[float] = None
    costo_faltante_anual_p: Optional[float] = None

    # VALIDADOR INTEGRADO (Post-validación de modelo)
    @model_validator(mode="after")
    def validar_y_normalizar(self) -> "EOQParametrosInput":
        # 1. Regla de negocio EPQ: La tasa de producción debe superar a la demanda
        if self.tasa_produccion_P is not None and self.tasa_produccion_P <= self.demanda_D:
            raise ValueError(
                "En el modelo EPQ, la tasa de producción (P) debe ser estrictamente mayor que la demanda (D) para evitar un desabastecimiento infinito."
            )

        # 2. Normalización automática a escala anual
        factor = 1.0
        if self.unidad_tiempo == "Meses":
            factor = 12.0
        elif self.unidad_tiempo == "Días":
            factor = float(self.dias_laborales_ano)

        self.demanda_anual_D = self.demanda_D * factor
        self.costo_mantenimiento_anual_H = self.costo_mantenimiento_H * factor
        
        if self.tasa_produccion_P is not None:
            self.tasa_produccion_anual_P = self.tasa_produccion_P * factor

        if self.costo_faltante_p is not None:
            self.costo_faltante_anual_p = self.costo_faltante_p * factor
            
        return self


# -------------------------------------------------------------------------
# 2. MODELO DE SALIDA (RESULTADOS DEL CÁLCULO DE INVENTARIOS)
# -------------------------------------------------------------------------
class EOQResultadoOutput(BaseModel):
    modelo_aplicado: str = Field(..., description="Nombre del modelo (EOQ Básico, EPQ, o EOQ con Faltantes)")
    lote_optimo_Q: float = Field(..., description="Cantidad óptima a pedir/producir Q*")
    punto_reorden_ROP: float = Field(..., description="Punto de reorden ROP (unidades)")
    pedidos_por_ano_N: float = Field(..., description="Frecuencia de pedidos al año N")
    tiempo_entre_pedidos_T_dias: float = Field(..., description="Días entre cada pedido T")
    costo_pedido_anual: float = Field(..., description="Costo total de pedir (D/Q)*K")
    costo_mantenimiento_anual: float = Field(..., description="Costo total de mantener inventario")
    costo_total_inventario_CT: float = Field(..., description="Costo total anual de gestión de inventario")
    
    # Campos opcionales para modelos avanzados
    deficit_maximo_S: Optional[float] = Field(default=None, description="Déficit máximo permitido S* (Solo en EOQ con Faltantes)")
    inventario_maximo_Imax: Optional[float] = Field(default=None, description="Nivel máximo de inventario físico alcanzado")