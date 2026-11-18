# app/modules/colas_mm1/routes.py
# Controlador HTTP para Teoría de Colas (M/M/1) con persistencia por ferretería (RN-09).

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from app.modules.colas_mm1.schemas import ColasMM1Input, ColasMM1Output
from app.modules.colas_mm1.engine import calcular_colas_mm1
from app.modules.autenticacion.routes import obtener_usuario_opcional
from app.shared.database import obtener_conexion

router = APIRouter(prefix="/api/colas", tags=["Teoría de Colas (M/M/1)"])


@router.post(
    "/mm1",
    response_model=ColasMM1Output,
    status_code=status.HTTP_200_OK,
    summary="Calcular métricas de espera M/M/1 (rho, L, Lq, W, Wq, P0) y persistir parámetros"
)
async def evaluar_cola_mm1(
    datos: ColasMM1Input,
    usuario: Optional[Dict[str, Any]] = Depends(obtener_usuario_opcional)
):
    try:
        resultado = calcular_colas_mm1(datos)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

    # Persistir parámetros M/M/1 en registro_colas_atencion si existe ferretería asociada (RN-09)
    id_ferr: Optional[int] = None
    if usuario:
        if usuario.get("rol") == "admin" and datos.id_ferreteria:
            id_ferr = datos.id_ferreteria
        elif usuario.get("id_ferreteria"):
            id_ferr = usuario["id_ferreteria"]

    if id_ferr:
        unidad = datos.unidad_tiempo.lower().strip()
        factor_hora = 60.0 if unidad == "minutos" else 1.0
        lam_hora = round(datos.tasa_llegada_lambda * factor_hora, 2)
        mu_hora = round(datos.tasa_servicio_mu * factor_hora, 2)

        conn = obtener_conexion()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO registro_colas_atencion (id_ferreteria, tasa_llegada_lambda, tasa_servicio_mu)
                    VALUES (%s, %s, %s);
                    """,
                    (id_ferr, lam_hora, mu_hora)
                )
                conn.commit()
        except Exception:
            conn.rollback()
        finally:
            conn.close()

    return resultado
