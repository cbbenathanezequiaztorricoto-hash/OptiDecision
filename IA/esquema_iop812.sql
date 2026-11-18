--
-- PostgreSQL database dump
--

\restrict cQJLmYX9YSophl04MlcXzinzyGFpEk8WTXmFEY2fxYHGAmRAsGxVHldJvPv7r0v

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

-- Started on 2026-11-18 00:55:07

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16398)
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- TOC entry 5831 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 17512)
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id_categoria integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text
);


--
-- TOC entry 225 (class 1259 OID 17511)
-- Name: categorias_id_categoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_id_categoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5832 (class 0 OID 0)
-- Dependencies: 225
-- Name: categorias_id_categoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_id_categoria_seq OWNED BY public.categorias.id_categoria;


--
-- TOC entry 240 (class 1259 OID 17614)
-- Name: escenarios_incertidumbre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escenarios_incertidumbre (
    id_escenario integer NOT NULL,
    id_producto integer,
    alternativa character varying(100) NOT NULL,
    estado_naturaleza character varying(100) NOT NULL,
    probabilidad numeric(4,3),
    pago_estimado numeric(12,2) NOT NULL
);


--
-- TOC entry 239 (class 1259 OID 17613)
-- Name: escenarios_incertidumbre_id_escenario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.escenarios_incertidumbre_id_escenario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5833 (class 0 OID 0)
-- Dependencies: 239
-- Name: escenarios_incertidumbre_id_escenario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.escenarios_incertidumbre_id_escenario_seq OWNED BY public.escenarios_incertidumbre.id_escenario;


--
-- TOC entry 224 (class 1259 OID 17494)
-- Name: ferreterias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ferreterias (
    id_ferreteria integer NOT NULL,
    id_usuario_propietario integer,
    nombre character varying(150) NOT NULL,
    direccion text NOT NULL,
    latitud numeric(10,8) NOT NULL,
    longitud numeric(11,8) NOT NULL,
    ubicacion public.geometry(Point,4326),
    reputacion numeric(3,2) DEFAULT 5.00,
    superficie_almacen_m2 numeric(10,2) DEFAULT 0.00,
    capacidad_canales_atencion integer DEFAULT 1
);


--
-- TOC entry 236 (class 1259 OID 17582)
-- Name: ferreterias_favoritas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ferreterias_favoritas (
    id_favorito integer NOT NULL,
    id_ferreteria integer,
    id_usuario integer
);


--
-- TOC entry 235 (class 1259 OID 17581)
-- Name: ferreterias_favoritas_id_favorito_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ferreterias_favoritas_id_favorito_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5834 (class 0 OID 0)
-- Dependencies: 235
-- Name: ferreterias_favoritas_id_favorito_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ferreterias_favoritas_id_favorito_seq OWNED BY public.ferreterias_favoritas.id_favorito;


--
-- TOC entry 223 (class 1259 OID 17493)
-- Name: ferreterias_id_ferreteria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ferreterias_id_ferreteria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5835 (class 0 OID 0)
-- Dependencies: 223
-- Name: ferreterias_id_ferreteria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ferreterias_id_ferreteria_seq OWNED BY public.ferreterias.id_ferreteria;


--
-- TOC entry 234 (class 1259 OID 17569)
-- Name: historial_busquedas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_busquedas (
    id_busqueda integer NOT NULL,
    id_usuario integer,
    texto_buscado character varying(255) NOT NULL,
    latitud_usuario numeric(10,8) NOT NULL,
    longitud_usuario numeric(11,8) NOT NULL,
    fecha_busqueda timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 233 (class 1259 OID 17568)
-- Name: historial_busquedas_id_busqueda_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historial_busquedas_id_busqueda_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5836 (class 0 OID 0)
-- Dependencies: 233
-- Name: historial_busquedas_id_busqueda_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historial_busquedas_id_busqueda_seq OWNED BY public.historial_busquedas.id_busqueda;


--
-- TOC entry 238 (class 1259 OID 17601)
-- Name: log_navegacion_markov; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.log_navegacion_markov (
    id_log integer NOT NULL,
    id_usuario integer,
    estado_origen character varying(50) NOT NULL,
    estado_destino character varying(50) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 237 (class 1259 OID 17600)
-- Name: log_navegacion_markov_id_log_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.log_navegacion_markov_id_log_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5837 (class 0 OID 0)
-- Dependencies: 237
-- Name: log_navegacion_markov_id_log_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.log_navegacion_markov_id_log_seq OWNED BY public.log_navegacion_markov.id_log;


--
-- TOC entry 228 (class 1259 OID 17521)
-- Name: marcas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marcas (
    id_marca integer NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 17520)
-- Name: marcas_id_marca_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marcas_id_marca_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5838 (class 0 OID 0)
-- Dependencies: 227
-- Name: marcas_id_marca_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marcas_id_marca_seq OWNED BY public.marcas.id_marca;


--
-- TOC entry 230 (class 1259 OID 17528)
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id_producto integer NOT NULL,
    id_ferreteria integer,
    id_categoria integer,
    id_marca integer,
    nombre character varying(150) NOT NULL,
    precio_bob numeric(10,2) NOT NULL,
    stock_actual integer DEFAULT 0,
    foto_url character varying(255),
    volumen_m3 numeric(8,4) DEFAULT 0.0000,
    demanda_anual_d integer DEFAULT 0,
    tasa_produccion_p integer,
    costo_pedido_k numeric(10,2) DEFAULT 0.00,
    costo_mantenimiento_h numeric(10,2) DEFAULT 0.00,
    costo_faltante_p numeric(10,2),
    tiempo_entrega_dias_l integer DEFAULT 0,
    stock_seguridad_ss integer DEFAULT 0,
    descripcion text
);


--
-- TOC entry 229 (class 1259 OID 17527)
-- Name: productos_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_id_producto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5839 (class 0 OID 0)
-- Dependencies: 229
-- Name: productos_id_producto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_id_producto_seq OWNED BY public.productos.id_producto;


--
-- TOC entry 242 (class 1259 OID 17626)
-- Name: registro_colas_atencion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registro_colas_atencion (
    id_registro integer NOT NULL,
    id_ferreteria integer,
    tasa_llegada_lambda numeric(8,2) NOT NULL,
    tasa_servicio_mu numeric(8,2) NOT NULL,
    fecha_registro timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 241 (class 1259 OID 17625)
-- Name: registro_colas_atencion_id_registro_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registro_colas_atencion_id_registro_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5840 (class 0 OID 0)
-- Dependencies: 241
-- Name: registro_colas_atencion_id_registro_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registro_colas_atencion_id_registro_seq OWNED BY public.registro_colas_atencion.id_registro;


--
-- TOC entry 232 (class 1259 OID 17557)
-- Name: tramos_descuento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tramos_descuento (
    id_tramo integer NOT NULL,
    id_producto integer,
    cantidad_minima integer NOT NULL,
    cantidad_maxima integer NOT NULL,
    precio_unitario_descuento numeric(10,2) NOT NULL
);


--
-- TOC entry 231 (class 1259 OID 17556)
-- Name: tramos_descuento_id_tramo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tramos_descuento_id_tramo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5841 (class 0 OID 0)
-- Dependencies: 231
-- Name: tramos_descuento_id_tramo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tramos_descuento_id_tramo_seq OWNED BY public.tramos_descuento.id_tramo;


--
-- TOC entry 222 (class 1259 OID 17480)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id_usuario integer NOT NULL,
    google_id character varying(255),
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255),
    fecha_registro timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    rol character varying(20) DEFAULT 'cliente'::character varying
);


--
-- TOC entry 221 (class 1259 OID 17479)
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5842 (class 0 OID 0)
-- Dependencies: 221
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_usuario_seq OWNED BY public.usuarios.id_usuario;


--
-- TOC entry 5616 (class 2604 OID 17515)
-- Name: categorias id_categoria; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id_categoria SET DEFAULT nextval('public.categorias_id_categoria_seq'::regclass);


--
-- TOC entry 5632 (class 2604 OID 17617)
-- Name: escenarios_incertidumbre id_escenario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escenarios_incertidumbre ALTER COLUMN id_escenario SET DEFAULT nextval('public.escenarios_incertidumbre_id_escenario_seq'::regclass);


--
-- TOC entry 5612 (class 2604 OID 17497)
-- Name: ferreterias id_ferreteria; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias ALTER COLUMN id_ferreteria SET DEFAULT nextval('public.ferreterias_id_ferreteria_seq'::regclass);


--
-- TOC entry 5629 (class 2604 OID 17585)
-- Name: ferreterias_favoritas id_favorito; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias_favoritas ALTER COLUMN id_favorito SET DEFAULT nextval('public.ferreterias_favoritas_id_favorito_seq'::regclass);


--
-- TOC entry 5627 (class 2604 OID 17572)
-- Name: historial_busquedas id_busqueda; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_busquedas ALTER COLUMN id_busqueda SET DEFAULT nextval('public.historial_busquedas_id_busqueda_seq'::regclass);


--
-- TOC entry 5630 (class 2604 OID 17604)
-- Name: log_navegacion_markov id_log; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log_navegacion_markov ALTER COLUMN id_log SET DEFAULT nextval('public.log_navegacion_markov_id_log_seq'::regclass);


--
-- TOC entry 5617 (class 2604 OID 17524)
-- Name: marcas id_marca; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marcas ALTER COLUMN id_marca SET DEFAULT nextval('public.marcas_id_marca_seq'::regclass);


--
-- TOC entry 5618 (class 2604 OID 17531)
-- Name: productos id_producto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN id_producto SET DEFAULT nextval('public.productos_id_producto_seq'::regclass);


--
-- TOC entry 5633 (class 2604 OID 17629)
-- Name: registro_colas_atencion id_registro; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_colas_atencion ALTER COLUMN id_registro SET DEFAULT nextval('public.registro_colas_atencion_id_registro_seq'::regclass);


--
-- TOC entry 5626 (class 2604 OID 17560)
-- Name: tramos_descuento id_tramo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tramos_descuento ALTER COLUMN id_tramo SET DEFAULT nextval('public.tramos_descuento_id_tramo_seq'::regclass);


--
-- TOC entry 5609 (class 2604 OID 17483)
-- Name: usuarios id_usuario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuarios_id_usuario_seq'::regclass);


--
-- TOC entry 5648 (class 2606 OID 17519)
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id_categoria);


--
-- TOC entry 5664 (class 2606 OID 17619)
-- Name: escenarios_incertidumbre escenarios_incertidumbre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escenarios_incertidumbre
    ADD CONSTRAINT escenarios_incertidumbre_pkey PRIMARY KEY (id_escenario);


--
-- TOC entry 5658 (class 2606 OID 17587)
-- Name: ferreterias_favoritas ferreterias_favoritas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias_favoritas
    ADD CONSTRAINT ferreterias_favoritas_pkey PRIMARY KEY (id_favorito);


--
-- TOC entry 5645 (class 2606 OID 17504)
-- Name: ferreterias ferreterias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias
    ADD CONSTRAINT ferreterias_pkey PRIMARY KEY (id_ferreteria);


--
-- TOC entry 5656 (class 2606 OID 17575)
-- Name: historial_busquedas historial_busquedas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_busquedas
    ADD CONSTRAINT historial_busquedas_pkey PRIMARY KEY (id_busqueda);


--
-- TOC entry 5662 (class 2606 OID 17607)
-- Name: log_navegacion_markov log_navegacion_markov_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log_navegacion_markov
    ADD CONSTRAINT log_navegacion_markov_pkey PRIMARY KEY (id_log);


--
-- TOC entry 5650 (class 2606 OID 17526)
-- Name: marcas marcas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marcas
    ADD CONSTRAINT marcas_pkey PRIMARY KEY (id_marca);


--
-- TOC entry 5652 (class 2606 OID 17540)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id_producto);


--
-- TOC entry 5666 (class 2606 OID 17632)
-- Name: registro_colas_atencion registro_colas_atencion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_colas_atencion
    ADD CONSTRAINT registro_colas_atencion_pkey PRIMARY KEY (id_registro);


--
-- TOC entry 5654 (class 2606 OID 17562)
-- Name: tramos_descuento tramos_descuento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tramos_descuento
    ADD CONSTRAINT tramos_descuento_pkey PRIMARY KEY (id_tramo);


--
-- TOC entry 5660 (class 2606 OID 17589)
-- Name: ferreterias_favoritas uq_usuario_ferreteria; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias_favoritas
    ADD CONSTRAINT uq_usuario_ferreteria UNIQUE (id_usuario, id_ferreteria);


--
-- TOC entry 5639 (class 2606 OID 17492)
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- TOC entry 5641 (class 2606 OID 17490)
-- Name: usuarios usuarios_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_google_id_key UNIQUE (google_id);


--
-- TOC entry 5643 (class 2606 OID 17488)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- TOC entry 5646 (class 1259 OID 17510)
-- Name: idx_ferreterias_ubicacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ferreterias_ubicacion ON public.ferreterias USING gist (ubicacion);


--
-- TOC entry 5676 (class 2606 OID 17620)
-- Name: escenarios_incertidumbre escenarios_incertidumbre_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escenarios_incertidumbre
    ADD CONSTRAINT escenarios_incertidumbre_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto) ON DELETE CASCADE;


--
-- TOC entry 5673 (class 2606 OID 17590)
-- Name: ferreterias_favoritas ferreterias_favoritas_id_ferreteria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias_favoritas
    ADD CONSTRAINT ferreterias_favoritas_id_ferreteria_fkey FOREIGN KEY (id_ferreteria) REFERENCES public.ferreterias(id_ferreteria) ON DELETE CASCADE;


--
-- TOC entry 5674 (class 2606 OID 17595)
-- Name: ferreterias_favoritas ferreterias_favoritas_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias_favoritas
    ADD CONSTRAINT ferreterias_favoritas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5667 (class 2606 OID 17505)
-- Name: ferreterias ferreterias_id_usuario_propietario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ferreterias
    ADD CONSTRAINT ferreterias_id_usuario_propietario_fkey FOREIGN KEY (id_usuario_propietario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5672 (class 2606 OID 17576)
-- Name: historial_busquedas historial_busquedas_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_busquedas
    ADD CONSTRAINT historial_busquedas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5675 (class 2606 OID 17608)
-- Name: log_navegacion_markov log_navegacion_markov_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log_navegacion_markov
    ADD CONSTRAINT log_navegacion_markov_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5668 (class 2606 OID 17546)
-- Name: productos productos_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categorias(id_categoria) ON DELETE SET NULL;


--
-- TOC entry 5669 (class 2606 OID 17541)
-- Name: productos productos_id_ferreteria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_id_ferreteria_fkey FOREIGN KEY (id_ferreteria) REFERENCES public.ferreterias(id_ferreteria) ON DELETE CASCADE;


--
-- TOC entry 5670 (class 2606 OID 17551)
-- Name: productos productos_id_marca_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_id_marca_fkey FOREIGN KEY (id_marca) REFERENCES public.marcas(id_marca) ON DELETE SET NULL;


--
-- TOC entry 5677 (class 2606 OID 17633)
-- Name: registro_colas_atencion registro_colas_atencion_id_ferreteria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_colas_atencion
    ADD CONSTRAINT registro_colas_atencion_id_ferreteria_fkey FOREIGN KEY (id_ferreteria) REFERENCES public.ferreterias(id_ferreteria) ON DELETE CASCADE;


--
-- TOC entry 5671 (class 2606 OID 17563)
-- Name: tramos_descuento tramos_descuento_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tramos_descuento
    ADD CONSTRAINT tramos_descuento_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto) ON DELETE CASCADE;


-- Completed on 2026-11-18 00:55:08

--
-- PostgreSQL database dump complete
--

\unrestrict cQJLmYX9YSophl04MlcXzinzyGFpEk8WTXmFEY2fxYHGAmRAsGxVHldJvPv7r0v

