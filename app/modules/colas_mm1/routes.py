# app/modules/colas_mm1/routes.py
# Traemos el motor de cálculo y los moldes de entrada y salida para la API de FastAPI
from fastapi import APIRouter, HTTPException, status
from app.modules.colas_mm1.schemas import ColasMM1Input, ColasMM1Output
from app.modules.colas_mm1.engine import calcular_colas_mm1

#Ponemos nombre a la ruta y el grupo de rutas para la documentación automática de FastAPI
router = APIRouter(prefix="/api/colas", tags=["Teoría de Colas (M/M/1)"])

#Usamos POST para recibir los datos de entrada y devolver los resultados de cálculo
@router.post(
    "/mm1",
    response_model=ColasMM1Output,
    status_code=status.HTTP_200_OK,
    summary="Calcular métricas de espera M/M/1 (rho, L, Lq, W, Wq, P0)"
)
#async es opcional, pero lo dejamos para que la función pueda ser llamada de manera asíncrona si se desea
async def evaluar_cola_mm1(datos: ColasMM1Input):
    try:
        return calcular_colas_mm1(datos)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )
