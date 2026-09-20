-- =============================================================================
-- 05_perfil_municipio.sql · Composición de cada municipio
-- =============================================================================
-- Correr después de cargar `inscripciones`. Es independiente de 03_agregados.sql.
--
-- Para qué: el modelo de /api/prioridad necesita describir a cada municipio por
-- lo que SÍ está en el dataset —qué tan rural es, qué mezcla de sectores tiene,
-- qué niveles atiende, qué pueblos de pertenencia— para después preguntarse si
-- su tasa de promoción es la que cabría esperar de un municipio así.
--
-- Lo que este perfil NO es: una explicación causal. El dataset trae un solo
-- ciclo, sin notas, sin datos socioeconómicos y sin seguimiento por estudiante.
-- Estas columnas describen composición, no causas.
-- =============================================================================

DROP TABLE IF EXISTS agg_municipio_perfil CASCADE;

CREATE TABLE agg_municipio_perfil (
    municipio_codigo    CHAR(4)  PRIMARY KEY,
    municipio           TEXT     NOT NULL,
    departamento_codigo SMALLINT NOT NULL,
    departamento        TEXT     NOT NULL,
    total               INTEGER  NOT NULL,

    -- Composición, en porcentaje sobre el total del municipio.
    pct_publico         NUMERIC(5,2) NOT NULL,
    pct_privado         NUMERIC(5,2) NOT NULL,
    pct_cooperativa     NUMERIC(5,2) NOT NULL,
    pct_municipal       NUMERIC(5,2) NOT NULL,
    pct_rural           NUMERIC(5,2) NOT NULL,
    pct_mujer           NUMERIC(5,2) NOT NULL,
    pct_preprimaria     NUMERIC(5,2) NOT NULL,
    pct_primaria        NUMERIC(5,2) NOT NULL,
    pct_basico          NUMERIC(5,2) NOT NULL,
    pct_diversificado   NUMERIC(5,2) NOT NULL,
    pct_maya            NUMERIC(5,2) NOT NULL,
    pct_ladino          NUMERIC(5,2) NOT NULL,

    -- Resultados observados. `tasa_promocion` es lo que el modelo predice.
    tasa_promocion      NUMERIC(5,2) NOT NULL,
    tasa_no_promocion   NUMERIC(5,2) NOT NULL,
    tasa_retiro         NUMERIC(5,2) NOT NULL,
    tasa_repitencia     NUMERIC(5,2) NOT NULL
);

COMMENT ON TABLE agg_municipio_perfil IS
    'Una fila por municipio con su composición y sus tasas. Describe, no explica: '
    'el dataset no permite atribuir causas.';

CREATE OR REPLACE PROCEDURE refresh_perfil_municipio()
LANGUAGE plpgsql
AS $$
BEGIN
    TRUNCATE agg_municipio_perfil;

    INSERT INTO agg_municipio_perfil
    SELECT
        municipio_codigo,
        min(municipio),
        min(departamento_codigo),
        min(departamento),
        count(*),
        ROUND(100.0 * count(*) FILTER (WHERE sector = 'Público')       / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE sector = 'Privado')       / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE sector = 'Cooperativa')   / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE sector = 'Municipal')     / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE area   = 'Rural')         / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE sexo   = 'Mujer')         / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE nivel  = 'Preprimaria')   / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE nivel  = 'Primaria')      / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE nivel  = 'Básico')        / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE nivel  = 'Diversificado') / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE pueblo_pertenencia = 'Maya')          / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE pueblo_pertenencia = 'Ladino/Mestizo')/ count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE resultado_final = 'Promovido')    / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE resultado_final = 'No promovido') / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE resultado_final IN ('Retirado', 'Retirado Definitivo')) / count(*), 2),
        ROUND(100.0 * count(*) FILTER (WHERE repitente = 'Si')                 / count(*), 2)
    FROM inscripciones
    GROUP BY municipio_codigo;
END;
$$;
