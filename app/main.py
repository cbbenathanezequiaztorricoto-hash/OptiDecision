# app/main.py
# Orquestador Principal FastAPI de la Aplicación IOP812.

from fastapi import FastAPI
from app.modules.markov import markov_router
from app.modules.inventarios_eoq import inventarios_router
from app.modules.decisiones import decisiones_router
from app.modules.colas_mm1 import colas_router
from app.modules.buscador_ahp import ahp_router

app = FastAPI(
    title="Sistema de Métodos Numéricos e Investigación Operativa II (IOP812)",
    description="API Modular para Optimización Ferretera: Cadenas de Markov, Inventarios (EOQ/EPQ) y Teoría de Decisiones",
    version="1.0.0"
)

# Registramos los routers de cada módulo independiente (Vertical Slices)
app.include_router(markov_router)
app.include_router(inventarios_router)
app.include_router(decisiones_router)
app.include_router(colas_router)
app.include_router(ahp_router)

@app.get("/", tags=["Estado del Sistema"])
def estado_sistema():
    return {
        "sistema": "OptiDecision Ferreterías - IOP812",
        "estado": "Activo y Operativo",
        "documentacion_swagger": "/docs",
        "modulos_cargados": [
            "Cadenas de Markov Absorbentes",
            "Gestión de Inventarios (EOQ / EPQ / ROP)",
            "Teoría de Decisiones (Incertidumbre y Riesgo)",
            "Colas agregado 7/11/2026 a las 16:15 pm"
            "Buscador y Ordenamiento Multicriterio AHP agregado 7/11/2026 a las 19:31 pm"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)