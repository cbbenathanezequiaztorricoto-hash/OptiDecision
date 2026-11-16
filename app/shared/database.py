# app/shared/database.py
# Conector y pool de conexiones a PostgreSQL / PostGIS.
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()


def obtener_conexion():
    """
    Establece conexión con PostgreSQL/PostGIS usando DATABASE_URL (Render/Cloud)
    o variables individuales DB_* (entorno local).
    """
    database_url = os.getenv("DATABASE_URL")

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
        password=os.getenv("DB_PASSWORD", "postgres"),
        cursor_factory=RealDictCursor
    )
