# app/modules/buscador_ahp/routes.py
# Controlador HTTP para el Algoritmo AHP de Selección y Buscador Multicriterio.

from fastapi import APIRouter, HTTPException, status
from app.modules.buscador_ahp.schemas import AHPMatrizCriteriosInput, AHPResultadoOutput
from app.modules.buscador_ahp.engine import calcular_proceso_ahp

router = APIRouter(prefix="/api/ahp", tags=["Buscador y Ordenamiento Multicriterio AHP"])


@router.post(
    "/evaluar",
    response_model=AHPResultadoOutput,
    status_code=status.HTTP_200_OK,
    summary="Calcular vector de prioridades W, ratio de consistencia CR y ranking AHP"
)
async def evaluar_criterios_ahp(datos: AHPMatrizCriteriosInput):
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