# app/modules/decisiones/routes.py
# Controlador HTTP para Evaluación de Decisiones bajo Incertidumbre y Riesgo.

from fastapi import APIRouter, HTTPException, status
from app.modules.decisiones.schemas import DecisionInput, DecisionOutput
from app.modules.decisiones.engine import evaluar_toma_decisiones

router = APIRouter(prefix="/api/decisiones", tags=["Evaluación de Decisiones (IOP812)"])


@router.post(
    "/evaluar",
    response_model=DecisionOutput,
    status_code=status.HTTP_200_OK,
    summary="Evaluar alternativas por Laplace, Wald, Hurwicz, Savage, VME y VEIP"
)
async def evaluar_matriz_decisión(datos: DecisionInput):
    """
    Recibe la matriz de pagos y retorna la evaluación completa de 
    Investigación Operativa II para toma de decisiones bajo Incertidumbre y Riesgo.
    """
    try:
        resultado = evaluar_toma_decisiones(datos)
        return resultado
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )