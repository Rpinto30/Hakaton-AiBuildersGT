-- =============================================================================
-- 01_schema.sql · Esquema base
-- =============================================================================
-- Premisa: el CSV que se carga YA VIENE DECODIFICADO desde la ingesta en Python.
-- Trae palabras, no códigos numéricos, y el municipio ya resuelto y validado.
-- Postgres NO traduce nada: no hay tabla de catálogo ni columnas generadas que
-- deriven el municipio.
--
-- Esa decisión es deliberada. La derivación del municipio no se puede hacer en
-- SQL con una fórmula simple: en guatemala.xlsx ~310 mil registros traen el
-- prefijo "00-", y ahí el 2.º segmento del código NO es un municipio sino una
-- ZONA de la Ciudad de Guatemala (valores 01-19, 21, 24, 25). Calcular
-- departamento*100 + segmento inventa cinco municipios inexistentes. La ingesta
-- ya resolvió ese caso y lo validó contra las cifras publicadas.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- -----------------------------------------------------------------------------
-- Microdatos: una fila = una inscripción del ciclo 2024.
--
-- Sin clave primaria a propósito: el dataset no trae identificador de estudiante
-- y dos filas idénticas son inscripciones distintas, no duplicados.
--
-- El orden de las columnas es EXACTAMENTE el del CSV, porque \copy es posicional.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS inscripciones CASCADE;

CREATE TABLE inscripciones (
    anio                     SMALLINT    NOT NULL,
    cod_establecimiento      VARCHAR(16) NOT NULL,  -- DD-MM-NNNN-SS (original, conserva la zona)
    cod_establecimiento_base VARCHAR(12) NOT NULL,  -- 3 primeros segmentos = escuela real
    departamento_codigo      SMALLINT    NOT NULL,  -- 1..22, para ordenar
    departamento             TEXT        NOT NULL,
    municipio_codigo         CHAR(4)     NOT NULL,  -- '0101' — TEXTO, nunca integer
    municipio                TEXT        NOT NULL,
    sector                   TEXT,
    area                     TEXT,
    sexo                     TEXT,
    nivel_codigo             SMALLINT,              -- para ordenar
    nivel                    TEXT,
    grado_codigo             SMALLINT,              -- solo se interpreta junto con nivel
    grado                    TEXT,
    pueblo_pertenencia       TEXT,
    plan_estudio             TEXT,
    jornada                  TEXT,
    resultado_final          TEXT,
    repitente                TEXT,
    graduando                TEXT
);

COMMENT ON COLUMN inscripciones.municipio_codigo IS
    'Código INE de 4 dígitos como TEXTO. Si se declara integer, 0101 se vuelve 101 '
    'y el join con el GeoJSON del mapa se rompe en silencio.';

COMMENT ON COLUMN inscripciones.cod_establecimiento_base IS
    'Primeros 3 segmentos del código. Contar códigos completos infla el número de '
    'escuelas porque el 4.º segmento es el nivel: una escuela con 3 niveles aparece 3 veces.';
