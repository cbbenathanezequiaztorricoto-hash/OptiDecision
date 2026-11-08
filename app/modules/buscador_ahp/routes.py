# app/modules/buscador_ahp/routes.py
# Controlador HTTP para el Algoritmo AHP de Selección y Buscador Multicriterio.

from fastapi import APIRouter, HTTPException, status
from app.modules.buscador_ahp.schemas import AHPSearchInput, AHPMatrizCriteriosInput
from app.modules.buscador_ahp.engine import calcular_proceso_ahp

#Definimos una variable del tipo APIRouter que contendrá todos los endpoints 
# relacionados con el módulo AHP.

### RECUERDA: Un endpoint es una función que se ejecuta cuando un cliente 
# hace una solicitud HTTP a una ruta específica de la API.
router = APIRouter(prefix="/api/ahp", tags=["Buscador AHP"])

#¿QUÉ HACÍA ESTE ENDPOINT?
#Es una arroba que define un endpoint POST en la ruta "/buscar" del router de FastAPI. 
#Este endpoint recibe datos en formato JSON que representan la matriz de comparación 
#   por pares entre criterios (como Precio, Distancia, Reputación, Stock) 
#   y evalúa la consistencia estocástica según la metodología AHP de Saaty. 
# Devuelve un resultado que incluye el vector de prioridades W, el ratio de consistencia CR y el ranking AHP.

@router.post(
    "/buscar", 
    status_code=status.HTTP_200_OK,
    summary="Busca herramientas más barata y cercana según criterios AHP"
)
async def evaluar_criterios_ahp(datos: AHPSearchInput):
    try:
        # Convertir los 4 sliders del usuario en la matriz recíproca AHP (4x4)
        v = [datos.pesos.precio, datos.pesos.distancia, datos.pesos.reputacion, datos.pesos.stock]
        n = len(v)
        matriz = [[float(v[i] / v[j]) for j in range(n)] for i in range(n)]

        # Construir el objeto que tu engine.py ya sabe procesar
        entrada_ahp = AHPMatrizCriteriosInput(
            criterios=["Precio", "Distancia", "Reputación", "Stock"],
            matriz_comparacion=matriz
        )

        # Ejecutar tu motor algebraico en NumPy
        resultado = calcular_proceso_ahp(entrada_ahp)
        return resultado

    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))