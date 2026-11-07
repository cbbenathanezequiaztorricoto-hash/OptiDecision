# app/modules/inventarios_eoq/routes.py
# Controlador de endpoints HTTP para la Gestión de Inventarios.

from fastapi import APIRouter, HTTPException, status
from app.modules.inventarios_eoq.schemas import EOQParametrosInput, EOQResultadoOutput
from app.modules.inventarios_eoq.engine import calcular_modelo_inventario

router = APIRouter(prefix="/api/inventario", tags=["Gestión de Inventarios (EOQ/EPQ)"])


@router.post(
    "/calcular",
    response_model=EOQResultadoOutput,
    status_code=status.HTTP_200_OK,
    summary="Calcular lote óptimo Q*, ROP y costos para EOQ Básico, EPQ o Faltantes"
)
async def calcular_inventario_optimo(datos: EOQParametrosInput):
    """
    Calcula el lote óptimo de pedido (Q*), el punto de reorden (ROP) y el desglose de costos.
    Soporta unidades dinámicas (Años, Meses, Días) normalizadas automáticamente.
    """
    try:
        resultado = calcular_modelo_inventario(datos)
        return resultado
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )