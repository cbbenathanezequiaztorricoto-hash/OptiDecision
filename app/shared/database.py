# app/shared/database.py
# Gestión de conexiones PostgreSQL/PostGIS e inicialización limpia del esquema.

import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def obtener_conexion():
    """
    Abre una conexión a PostgreSQL utilizando DATABASE_URL (Render/Nube)
    o las variables individuales del archivo .env local, devolviendo filas como diccionarios.
    """
    database_url = os.getenv("DATABASE_URL", "").strip()

    if database_url:
        # Render a veces entrega 'postgres://' y psycopg2 requiere 'postgresql://'
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "iop812_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        cursor_factory=RealDictCursor
    )


def inicializar_base_datos():
    """
    Ejecuta init_db.sql para garantizar la extensión PostGIS, las 11 tablas e índices,
    añade la columna 'rol' en usuarios y asigna permisos 'admin' al correo definido en
    ADMIN_EMAIL sin insertar datos ficticios.
    """
    conn = None
    try:
        conn = obtener_conexion()
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        sql_path = os.path.join(root_dir, "init_db.sql")

        with conn.cursor() as cur:
            if os.path.exists(sql_path):
                with open(sql_path, "r", encoding="utf-8") as f:
                    cur.execute(f.read())
            else:
                logger.warning("No se encontró init_db.sql en %s", sql_path)

            cur.execute("""
                ALTER TABLE usuarios
                ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'cliente';
            """)

            admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
            if admin_email:
                cur.execute(
                    "UPDATE usuarios SET rol = 'admin' WHERE LOWER(email) = %s;",
                    (admin_email,)
                )

            conn.commit()
            logger.info("Esquema PostgreSQL/PostGIS verificado correctamente (base limpia).")
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Error al inicializar el esquema de base de datos: %s", e)
        raise
    finally:
        if conn:
            conn.close()
