from fastapi import APIRouter, HTTPException, status
from app.modules.markov.schemas import MarkovMatrixInput, MarkovResultadoOutput
from app.modules.markov.engine import calcular_cadena_markov_absorbente

router = APIRouter(prefix="/api/markov", tags=["Cadenas de Markov Absorbentes"])


@router.post(
    "/simular",
    response_model=MarkovResultadoOutput,
    status_code=status.HTTP_200_OK,
    summary="Simular probabilidades de conversión mediante Cadenas de Markov Absorbentes"
)
async def simular_comportamiento_usuario(datos: MarkovMatrixInput):
    """
    Recibe la configuración de la matriz de transición y calcula:
    - **Matriz Fundamental N**: Tiempos de permanencia en estados transitorios.
    - **Matriz B**: Probabilidad final de absorción (Compra vs. Abandono).
    - **Pasos t**: Cantidad esperada de clics antes de salir del sistema.
    """
    try:
        resultado = calcular_cadena_markov_absorbente(
            datos.estados_transitorios,
            datos.estados_absorbentes,
            datos.matriz_Q,
            datos.matriz_R
        )
        return resultado
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )