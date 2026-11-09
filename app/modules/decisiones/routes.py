# app/modules/decisiones/routes.py
# Controlador HTTP para el módulo de Teoría de Decisiones (IOP812).

from fastapi import APIRouter, HTTPException, status
from app.modules.decisiones.schemas import DecisionInput, DecisionOutput
from app.modules.decisiones.engine import evaluar_toma_decisiones

router = APIRouter(prefix="/api/decisiones", tags=["Teoría de Decisiones"])


@router.post(
    "/evaluar",
    response_model=DecisionOutput,
    status_code=status.HTTP_200_OK,
    summary="Evalúa criterios de decisión bajo incertidumbre (Laplace, Wald, Hurwicz, Savage) y riesgo (VME/VEIP)"
)
async def evaluar_decisiones(datos: DecisionInput) -> DecisionOutput:
    """
    Recibe la matriz de pagos A, escenarios y probabilidades opcionales.
    Ejecuta el motor numérico NumPy y devuelve la estructura completa DecisionOutput.
    """
    try:
        resultado = evaluar_toma_decisiones(datos)
        return resultado
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en el motor de decisiones: {str(err)}"
        )
