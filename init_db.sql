-- Crear base de datos (ejecutar por separado si se usa pgAdmin o psql)
-- CREATE DATABASE iop812_db;

-- Habilitar extensión geoespacial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Tabla Usuario
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla Ferreteria (con coordenadas y extensión PostGIS)
CREATE TABLE IF NOT EXISTS ferreterias (
    id_ferreteria SERIAL PRIMARY KEY,
    id_usuario_propietario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    direccion TEXT NOT NULL,
    latitud DECIMAL(10,8) NOT NULL,
    longitud DECIMAL(11,8) NOT NULL,
    ubicacion GEOMETRY(Point, 4326),
    reputacion DECIMAL(3,2) DEFAULT 5.0,
    superficie_almacen_m2 DECIMAL(10,2) DEFAULT 0.0,
    capacidad_canales_atencion INT DEFAULT 1
);

-- Índice geoespacial GIST para consultas por proximidad rápida
CREATE INDEX IF NOT EXISTS idx_ferreteria_ubicacion ON ferreterias USING GIST (ubicacion);