-- init_db.sql
-- Script completo de creación de base de datos e índices geoespaciales para IOP812.

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

-- 2. Tabla Ferreteria (Con coordenadas y PostGIS)
CREATE TABLE IF NOT EXISTS ferreterias (
    id_ferreteria SERIAL PRIMARY KEY,
    id_usuario_propietario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    direccion TEXT NOT NULL,
    latitud DECIMAL(10,8) NOT NULL,
    longitud DECIMAL(11,8) NOT NULL,
    ubicacion GEOMETRY(Point, 4326),
    reputacion DECIMAL(3,2) DEFAULT 5.00,
    superficie_almacen_m2 DECIMAL(10,2) DEFAULT 0.00,
    capacidad_canales_atencion INT DEFAULT 1
);
--- Índice geoespacial GIST para consultas por proximidad rápida
CREATE INDEX IF NOT EXISTS idx_ferreterias_ubicacion ON ferreterias USING GIST (ubicacion);

-- 3. Tabla Categoria
CREATE TABLE IF NOT EXISTS categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL
);

-- 4. Tabla Marca
CREATE TABLE IF NOT EXISTS marcas (
    id_marca SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

-- 5. Tabla Producto (Modelos EOQ / EPQ / ROP)
CREATE TABLE IF NOT EXISTS productos (
    id_producto SERIAL PRIMARY KEY,
    id_ferreteria INT REFERENCES ferreterias(id_ferreteria) ON DELETE CASCADE,
    id_categoria INT REFERENCES categorias(id_categoria) ON DELETE SET NULL,
    id_marca INT REFERENCES marcas(id_marca) ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    precio_bob DECIMAL(10,2) NOT NULL,
    stock_actual INT DEFAULT 0,
    foto_url VARCHAR(255) NULL,
    volumen_m3 DECIMAL(8,4) DEFAULT 0.0000,
    demanda_anual_D INT DEFAULT 0,
    tasa_produccion_p INT NULL,
    costo_pedido_K DECIMAL(10,2) DEFAULT 0.00,
    costo_mantenimiento_H DECIMAL(10,2) DEFAULT 0.00,
    costo_faltante_p DECIMAL(10,2) NULL,
    tiempo_entrega_dias_L INT DEFAULT 0,
    stock_seguridad_SS INT DEFAULT 0
);

-- 6. Tabla TramoDescuento (EOQ con Descuento por Cantidad)
CREATE TABLE IF NOT EXISTS tramos_descuento (
    id_tramo SERIAL PRIMARY KEY,
    id_producto INT REFERENCES productos(id_producto) ON DELETE CASCADE,
    cantidad_minima INT NOT NULL,
    cantidad_maxima INT NOT NULL,
    precio_unitario_descuento DECIMAL(10,2) NOT NULL
);

-- 7. Tabla HistorialBusqueda
CREATE TABLE IF NOT EXISTS historial_busquedas (
    id_busqueda SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    texto_buscado VARCHAR(255) NOT NULL,
    latitud_usuario DECIMAL(10,8) NOT NULL,
    longitud_usuario DECIMAL(11,8) NOT NULL,
    fecha_busqueda TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla FerreteriaFavorita
CREATE TABLE IF NOT EXISTS ferreterias_favoritas (
    id_favorito SERIAL PRIMARY KEY,
    id_ferreteria INT REFERENCES ferreterias(id_ferreteria) ON DELETE CASCADE,
    id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT uq_usuario_ferreteria UNIQUE(id_usuario, id_ferreteria)
);

-- 9. Tabla LogNavegacionMarkov (Predicción de Conversión)
CREATE TABLE IF NOT EXISTS log_navegacion_markov (
    id_log SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    estado_origen VARCHAR(50) NOT NULL,
    estado_destino VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabla EscenarioIncertidumbre (Matriz de Decisiones / Riesgo)
CREATE TABLE IF NOT EXISTS escenarios_incertidumbre (
    id_escenario SERIAL PRIMARY KEY,
    id_producto INT REFERENCES productos(id_producto) ON DELETE CASCADE,
    alternativa VARCHAR(100) NOT NULL,
    estado_naturaleza VARCHAR(100) NOT NULL,
    probabilidad DECIMAL(4,3) NULL,
    pago_estimado DECIMAL(12,2) NOT NULL
);

-- 11. Tabla RegistroColaAtencion (Simulación M/M/1)
CREATE TABLE IF NOT EXISTS registro_colas_atencion (
    id_registro SERIAL PRIMARY KEY,
    id_ferreteria INT REFERENCES ferreterias(id_ferreteria) ON DELETE CASCADE,
    tasa_llegada_lambda DECIMAL(8,2) NOT NULL,
    tasa_servicio_mu DECIMAL(8,2) NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
