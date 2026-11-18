# app/modules/buscador_ahp/schemas.py
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class PesosAHPInput(BaseModel):
    precio: int = Field(default=4, ge=1, le=9)
    distancia: int = Field(default=3, ge=1, le=9)
    reputacion: int = Field(default=2, ge=1, le=9)
    stock: int = Field(default=1, ge=1, le=9)


class AHPSearchInput(BaseModel):
    latitud: float = Field(..., description="Latitud GPS de origen")
    longitud: float = Field(..., description="Longitud GPS de origen")
    producto: str = Field(..., min_length=1, description="Producto buscado")
    pesos: PesosAHPInput = Field(default_factory=PesosAHPInput)


class AHPMatrizCriteriosInput(BaseModel):
    criterios: List[str] = ["Precio", "Distancia", "Reputación", "Stock"]
    matriz_comparacion: List[List[float]]
    alternativas: Optional[List[Dict[str, Any]]] = None


class FerreteriaResultadoAHP(BaseModel):
    id_ferreteria: int
    nombre: str
    direccion: str
    latitud: float
    longitud: float
    precio_bob: float
    stock: int
    reputacion: float
    distancia_km: float
    puntuacion_ahp: float
    tiempo_espera_wq_min: Optional[float] = None
    estado_congestion: str = "Sin datos de cola"


class AHPResultadoOutput(BaseModel):
    vector_pesos_W: Dict[str, float]
    lambda_maximo: float
    indice_consistencia_CI: float
    indice_aleatorio_RI: float
    ratio_consistencia_CR: float
    es_consistente: bool
    mensaje_consistencia: str
    ferreterias: List[FerreteriaResultadoAHP] = []


class ProductoCatalogoTiendaOutput(BaseModel):
    id_producto: int
    nombre: str
    precio_bob: float
    stock_actual: int
    foto_url: Optional[str] = None
    categoria: Optional[str] = None
    marca: Optional[str] = None


class FerreteriaCatalogoOutput(BaseModel):
    id_ferreteria: int
    nombre: str
    direccion: str
    latitud: float
    longitud: float
    reputacion: float
    superficie_almacen_m2: float = 0.0
    capacidad_canales_atencion: int = 1
    tiempo_espera_wq_min: Optional[float] = None
    estado_congestion: str = "Sin registro M/M/1"
    total_productos: int
    productos: List[ProductoCatalogoTiendaOutput] = []
