# app/modules/buscador_ahp/routes.py
# Controlador HTTP para el Algoritmo AHP de Selección y Buscador Multicriterio.

from fastapi import APIRouter, HTTPException, status
from app.modules.buscador_ahp.schemas import AHPMatrizCriteriosInput, AHPResultadoOutput, AHPSearchInput
from app.modules.buscador_ahp.engine import calcular_proceso_ahp

#Definimos una variable del tipo APIRouter que contendrá todos los endpoints relacionados con el módulo AHP.
# RECUERDA: Un endpoint es una función que se ejecuta cuando un cliente hace una solicitud HTTP a una ruta específica de la API.
router = APIRouter(prefix="/api/ahp", tags=["Buscador y Ordenamiento Multicriterio AHP"])

#¿QUÉ HACÍA ESTE ENDPOINT?
#Es una arroba que define un endpoint POST en la ruta "/buscar" del router de FastAPI. 
#Este endpoint recibe datos en formato JSON que representan la matriz de comparación 
#   por pares entre criterios (como Precio, Distancia, Reputación, Stock) 
#   y evalúa la consistencia estocástica según la metodología AHP de Saaty. 
# Devuelve un resultado que incluye el vector de prioridades W, el ratio de consistencia CR y el ranking AHP.
@router.post(
    "/buscar",
    response_model=AHPResultadoOutput,
    status_code=status.HTTP_200_OK,
    summary="Calcular vector de prioridades W, ratio de consistencia CR y ranking AHP"
)
async def evaluar_criterios_ahp(datos: AHPSearchInput) -> AHPResultadoOutput:
    """
    Recibe la matriz de comparación por pares entre los criterios (Precio, Distancia, Reputación, Stock)
    y evalúa la consistencia estocástica (CR < 0.10) según la metodología AHP de Saaty.
    """
    try:
        resultado = calcular_proceso_ahp(datos)
        return resultado
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )