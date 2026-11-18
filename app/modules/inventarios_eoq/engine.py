# app/modules/inventarios_eoq/engine.py
# Motor de cálculo determinístico de inventarios (EOQ Básico, EPQ, EOQ con Faltantes y ROP).

import asyncio
import math
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

from app.modules.inventarios_eoq.schemas import EOQParametrosInput

MAX_IMAGE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_MIMES: set[str] = {"image/jpeg", "image/png", "image/webp"}
CLOUDINARY_PRODUCTS_FOLDER: str = "iop812_productos"


def _configurar_cloudinary() -> None:
    """Valida credenciales en entorno y configura el SDK de Cloudinary."""
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()

    if not cloud_name or not api_key or not api_secret or cloud_name == "tu_cloud_name":
        raise ValueError(
            "Faltan credenciales válidas de Cloudinary (CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) en el archivo .env."
        )

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )


async def validar_y_leer_imagen(archivo: UploadFile) -> bytes:
    """Valida tipo MIME, contenido no vacío y peso máximo antes de subir."""
    if archivo.content_type not in ALLOWED_IMAGE_MIMES:
        raise ValueError(
            f"Formato no permitido en '{archivo.filename}'. Usa JPG, PNG o WEBP."
        )

    contenido = await archivo.read()
    if not contenido:
        raise ValueError(f"El archivo '{archivo.filename}' está vacío.")

    if len(contenido) > MAX_IMAGE_SIZE_BYTES:
        raise ValueError(
            f"El archivo '{archivo.filename}' supera el límite de 5 MB."
        )

    return contenido


def _subir_bytes_cloudinary_sync(contenido: bytes, carpeta: str) -> Dict[str, str]:
    """Ejecuta la subida síncrona a Cloudinary con compresión y formato automático."""
    resultado = cloudinary.uploader.upload(
        contenido,
        folder=carpeta,
        resource_type="image",
        transformation=[{"quality": "auto", "fetch_format": "auto"}],
    )
    return {
        "foto_url": resultado["secure_url"],
        "public_id": resultado["public_id"],
    }


async def subir_imagen_producto_cloudinary(archivo: UploadFile) -> Dict[str, str]:
    """Valida y sube una imagen individual de producto sin bloquear el event loop."""
    _configurar_cloudinary()
    contenido = await validar_y_leer_imagen(archivo)
    return await asyncio.to_thread(
        _subir_bytes_cloudinary_sync, contenido, CLOUDINARY_PRODUCTS_FOLDER
    )


def normalizar_clave_nombre(texto: str) -> str:
    """Normaliza nombres de archivo o producto (sin extensión, tildes ni símbolos)."""
    base = os.path.splitext(texto.strip())[0]
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", base)
        if unicodedata.category(c) != "Mn"
    )
    limpio = re.sub(r"[^a-zA-Z0-9]+", " ", sin_tildes).strip().lower()
    return limpio


def buscar_producto_coincidente(
    nombre_archivo: str,
    productos: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Empareja el nombre de archivo normalizado contra el catálogo de la ferretería."""
    clave_archivo = normalizar_clave_nombre(nombre_archivo)
    if not clave_archivo:
        return None

    # 1. Coincidencia exacta normalizada
    for prod in productos:
        if normalizar_clave_nombre(prod["nombre"]) == clave_archivo:
            return prod

    # 2. Coincidencia por inclusión (ej. 'cemento_coboce.jpg' -> 'Cemento COBOCE IP-30 50kg')
    for prod in productos:
        clave_prod = normalizar_clave_nombre(prod["nombre"])
        if len(clave_archivo) >= 4 and (clave_archivo in clave_prod or clave_prod in clave_archivo):
            return prod

    return None


def calcular_modelo_inventario(datos: EOQParametrosInput) -> Dict[str, Any]:
    """
    Selecciona y ejecuta dinámicamente el modelo de inventario correspondiente
    según los parámetros proporcionados:
      - EPQ: Si existe tasa_produccion_anual_P
      - EOQ con Faltantes: Si existe costo_faltante_p
      - EOQ Básico: Si no hay producción ni faltantes
    """
    # -------------------------------------------------------------------------
    # 1. EXTRACCIÓN DE PARÁMETROS NORMALIZADOS (ESCALA ANUAL)
    # -------------------------------------------------------------------------
    D = datos.demanda_anual_D or (datos.demanda_D * 1.0)
    H = datos.costo_mantenimiento_anual_H or (datos.costo_mantenimiento_H * 1.0)
    K = datos.costo_pedido_K
    C = datos.costo_unitario_C
    L_dias = datos.tiempo_entrega_dias_L
    dias_ano = datos.dias_laborales_ano
    SS = datos.stock_seguridad_SS

    if D <= 0 or H <= 0 or K <= 0:
        raise ValueError("La demanda (D), el costo de pedido (K) y el costo de mantenimiento (H) deben ser mayores a cero.")

    # Demanda diaria (d)
    d_diaria = D / float(dias_ano)

    # -------------------------------------------------------------------------
    # 2. IDENTIFICACIÓN Y CÁLCULO DEL MODELO CORRESPONDIENTE
    # -------------------------------------------------------------------------
    deficit_maximo_S = None
    inventario_maximo_Imax = None

    # CASO A: Modelo de Lote Económico de Producción (EPQ)
    if datos.tasa_produccion_anual_P is not None:
        P = datos.tasa_produccion_anual_P
        if P <= D:
            raise ValueError("En el modelo EPQ, la tasa de producción (P) debe ser mayor a la demanda (D).")
        
        modelo_nombre = "Lote Económico de Producción (EPQ)"
        # Q* = sqrt( (2 * D * K) / ( H * (1 - D/P) ) )
        factor_produccion = 1.0 - (D / P)
        lote_optimo_Q = math.sqrt((2.0 * D * K) / (H * factor_produccion))
        
        inventario_maximo_Imax = lote_optimo_Q * factor_produccion
        costo_mant_anual = (inventario_maximo_Imax / 2.0) * H
        costo_faltante_anual = 0.0

    # CASO B: Modelo EOQ con Faltantes / Déficit Permitido
    elif datos.costo_faltante_p is not None:
        # En la sección de EOQ con Faltantes de engine.py
        p_anual = datos.costo_faltante_anual_p if datos.costo_faltante_anual_p is not None else datos.costo_faltante_p
        if p_anual <= 0:
            raise ValueError("El costo de penalización por faltante (p) debe ser mayor a cero.")
        
        modelo_nombre = "EOQ con Faltantes Permitidos"
        # Q* = sqrt( ((2*D*K)/H) * ((p + H)/p) )
        lote_optimo_Q = math.sqrt(((2.0 * D * K) / H) * ((p_anual + H) / p_anual))
        
        # S* = Q* * (H / (p + H))
        deficit_maximo_S = lote_optimo_Q * (H / (p_anual + H))
        inventario_maximo_Imax = lote_optimo_Q - deficit_maximo_S
        
        costo_mant_anual = ((inventario_maximo_Imax ** 2) / (2.0 * lote_optimo_Q)) * H
        costo_faltante_anual = ((deficit_maximo_S ** 2) / (2.0 * lote_optimo_Q)) * p_anual

    # CASO C: Modelo EOQ Básico Clásico
    else:
        modelo_nombre = "Lote Económico de Pedido (EOQ Básico)"
        # Q* = sqrt( (2 * D * K) / H )
        lote_optimo_Q = math.sqrt((2.0 * D * K) / H)
        inventario_maximo_Imax = lote_optimo_Q
        
        costo_mant_anual = (lote_optimo_Q / 2.0) * H
        costo_faltante_anual = 0.0

    # -------------------------------------------------------------------------
    # 3. MÉTRICAS COMPLEMENTARIAS Y COSTOS TOTALES
    # -------------------------------------------------------------------------
    # Punto de Reorden ROP = (d * L) + SS
    rop = (d_diaria * float(L_dias)) + float(SS)

    # Número de pedidos/corridas al año N = D / Q*
    pedidos_ano_N = D / lote_optimo_Q

    # Tiempo entre pedidos T (días) = dias_laborales / N
    tiempo_entre_pedidos_T = float(dias_ano) / pedidos_ano_N

    # Costo de ordenar/preparar al año = N * K
    costo_pedido_anual = pedidos_ano_N * K

    # Costo de adquisición directo = D * C
    costo_adquisicion_anual = D * C

    # Costo Total de Gestión de Inventario CT
    costo_total_CT = costo_pedido_anual + costo_mant_anual + costo_faltante_anual + costo_adquisicion_anual

    # -------------------------------------------------------------------------
    # 4. ESTRUCTURA DE RETORNO NATIVA (Coincide con EOQResultadoOutput)
    # -------------------------------------------------------------------------
    return {
        "modelo_aplicado": modelo_nombre,
        "lote_optimo_Q": round(lote_optimo_Q, 2),
        "punto_reorden_ROP": round(rop, 2),
        "pedidos_por_ano_N": round(pedidos_ano_N, 2),
        "tiempo_entre_pedidos_T_dias": round(tiempo_entre_pedidos_T, 1),
        "costo_pedido_anual": round(costo_pedido_anual, 2),
        "costo_mantenimiento_anual": round(costo_mant_anual, 2),
        "costo_total_inventario_CT": round(costo_total_CT, 2),
        "deficit_maximo_S": round(deficit_maximo_S, 2) if deficit_maximo_S is not None else None,
        "inventario_maximo_Imax": round(inventario_maximo_Imax, 2) if inventario_maximo_Imax is not None else None,
    }