# app/shared/database.py
# Conector y pool de conexiones a PostgreSQL / PostGIS.

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()


def obtener_conexion():
    """Retorna una nueva conexión activa a PostgreSQL."""
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            dbname=os.getenv("DB_NAME", "iop812_db"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        raise RuntimeError(f"Error al conectar con PostgreSQL: {str(e)}")