# app/main.py
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

#from app.shared.db_init import inicializar_base_datos
from app.modules.autenticacion.routes import router as auth_router
from app.modules.buscador_ahp.routes import router as ahp_router
from app.modules.inventarios_eoq.routes import router as inventarios_router
from app.modules.decisiones.routes import router as decisiones_router
from app.modules.markov.routes import router as markov_router
from app.modules.colas_mm1.routes import router as colas_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_base_datos()
    yield


app = FastAPI(
    title="OptiDecision Suite - IOP812",
    description="API Modular para Optimización Ferretera y Análisis Geoespacial AHP",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(auth_router)
app.include_router(ahp_router)
app.include_router(inventarios_router)
app.include_router(decisiones_router)
app.include_router(markov_router)
app.include_router(colas_router)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
assets_path = os.path.join(frontend_path, "assets")

if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")


@app.get("/api/estado", tags=["Estado del Sistema"])
def estado_sistema():
    return {
        "sistema": "OptiDecision Suite - IOP812",
        "estado": "Activo",
        "modulos": [
            "autenticacion",
            "buscador_ahp",
            "inventarios_eoq",
            "decisiones",
            "markov",
            "colas_mm1"
        ]
    }


@app.get("/", response_class=FileResponse)
async def servir_index():
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return index_path
    return {"status": "ok", "message": "Backend IOP812 activo."}
