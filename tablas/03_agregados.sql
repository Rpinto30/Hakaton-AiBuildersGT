-- =============================================================================
-- 03_agregados.sql · Agregados precalculados
-- =============================================================================
-- Son tablas pequeñas (de 4 a 340 filas) y es lo único que consultan la API, el
-- dashboard y el agente. Así nadie escanea los 4.3 M de registros en cada
-- interacción, y las cifras del chat coinciden siempre con las del dashboard
-- porque salen de la misma tabla.
--
-- Decisiones de conteo (documentadas para no cambiarlas sin querer):
--   * retirados = 'Retirado' + 'Retirado Definitivo'. El segundo no aparece ni
--     una vez en las 4.3 M de filas, pero se cuenta por si reaparece.
--   * el denominador de las tasas es TODO el grupo, incluidas Vigentes e
--     Ignoradas, así que promoción + no promoción + retiro puede sumar < 100%.
--   * 'Ignorado' se reporta como fila propia, nunca se descarta: es dato real.
--
-- CUIDADO CON LAS ETIQUETAS: se comparan por igualdad exacta contra los valores
-- que produce la ingesta, y son los del diccionario del INE tal cual. Dos van
-- SIN TILDE y es fácil equivocarse:
--       repitente = 'Si'              (no 'Sí')
--       graduando = 'Si es graduando' (no 'Sí es graduando')
-- Una comparación con tilde no lanza error: simplemente cuenta cero y deja la
-- tasa de repitencia en 0.00 sin que nada avise. 04_validacion.sql tiene un
-- control específico para eso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Forma común de todas las tablas de agregados.
--   clave    identificador único dentro de la dimensión
--   etiqueta nombre legible que ve el usuario final
--   padre    dimensión contenedora (solo municipio: su departamento)
--   orden    para ordenar de forma natural (Preprimaria antes que Primaria)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS agg_departamento, agg_nivel, agg_sector, agg_area,
                     agg_municipio, agg_departamento_nivel, agg_resumen CASCADE;

CREATE TABLE agg_departamento (
    clave         TEXT    PRIMARY KEY,
    etiqueta      TEXT    NOT NULL,
    padre         TEXT,
    orden         INTEGER,
    total         INTEGER NOT NULL DEFAULT 0,
    promovidos    INTEGER NOT NULL DEFAULT 0,
    no_promovidos INTEGER NOT NULL DEFAULT 0,
    retirados     INTEGER NOT NULL DEFAULT 0,
    vigentes      INTEGER NOT NULL DEFAULT 0,
    ignorados     INTEGER NOT NULL DEFAULT 0,
    repitentes    INTEGER NOT NULL DEFAULT 0,
    graduandos    INTEGER NOT NULL DEFAULT 0,

    tasa_promocion    NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * promovidos    / NULLIF(total, 0), 2)) STORED,
    tasa_no_promocion NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * no_promovidos / NULLIF(total, 0), 2)) STORED,
    tasa_retiro       NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * retirados     / NULLIF(total, 0), 2)) STORED,
    tasa_repitencia   NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * repitentes    / NULLIF(total, 0), 2)) STORED
);

-- Las otras cuatro tienen exactamente la misma forma.
CREATE TABLE agg_nivel     (LIKE agg_departamento INCLUDING ALL);
CREATE TABLE agg_sector    (LIKE agg_departamento INCLUDING ALL);
CREATE TABLE agg_area      (LIKE agg_departamento INCLUDING ALL);
CREATE TABLE agg_municipio (LIKE agg_departamento INCLUDING ALL);  -- alimenta el mapa

-- -----------------------------------------------------------------------------
-- Cruce departamento × nivel: la "desagregación" que pide el reto.
-- -----------------------------------------------------------------------------
CREATE TABLE agg_departamento_nivel (
    departamento_codigo SMALLINT NOT NULL,
    departamento        TEXT     NOT NULL,
    nivel_codigo        SMALLINT,
    nivel               TEXT     NOT NULL,
    total               INTEGER  NOT NULL,
    promovidos          INTEGER  NOT NULL,
    no_promovidos       INTEGER  NOT NULL,
    retirados           INTEGER  NOT NULL,
    tasa_promocion      NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * promovidos / NULLIF(total, 0), 2)) STORED,
    PRIMARY KEY (departamento_codigo, nivel)
);

-- -----------------------------------------------------------------------------
-- Resumen nacional: una sola fila con los KPIs de portada.
--
-- Existe para que la API no tenga que contar municipios ni escuelas distintas
-- al vuelo: ese count(DISTINCT) sobre los 4.3 M de filas tarda ~10 segundos y
-- es exactamente lo que estas tablas están para evitar.
-- -----------------------------------------------------------------------------
CREATE TABLE agg_resumen (
    fila_unica    BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (fila_unica),
    inscripciones INTEGER NOT NULL,
    departamentos INTEGER NOT NULL,
    municipios    INTEGER NOT NULL,
    escuelas      INTEGER NOT NULL,
    promovidos    INTEGER NOT NULL,
    no_promovidos INTEGER NOT NULL,
    retirados     INTEGER NOT NULL,
    repitentes    INTEGER NOT NULL,
    graduandos    INTEGER NOT NULL,

    tasa_promocion    NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * promovidos    / NULLIF(inscripciones, 0), 2)) STORED,
    tasa_no_promocion NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * no_promovidos / NULLIF(inscripciones, 0), 2)) STORED,
    tasa_retiro       NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * retirados     / NULLIF(inscripciones, 0), 2)) STORED,
    tasa_repitencia   NUMERIC(5,2) GENERATED ALWAYS AS
        (ROUND(100.0 * repitentes    / NULLIF(inscripciones, 0), 2)) STORED
);

COMMENT ON COLUMN agg_resumen.escuelas IS
    'Establecimientos distintos por cod_establecimiento_base. Contar el código '
    'completo inflaría la cifra porque su 4.º segmento es el nivel educativo.';

-- =============================================================================
-- Reconstruye todos los agregados desde `inscripciones`.
-- Se llama UNA vez al terminar la carga:  CALL refresh_agregados();
--
-- Las medidas se escriben una sola vez y se aplican a cada dimensión con SQL
-- dinámico, para no repetir el mismo bloque de conteos cinco veces.
-- =============================================================================
CREATE OR REPLACE PROCEDURE refresh_agregados()
LANGUAGE plpgsql
AS $$
DECLARE
    dim RECORD;
BEGIN
    FOR dim IN
        SELECT * FROM (VALUES
            -- tabla              clave                          etiqueta        padre           orden                  group by
            ('agg_departamento', 'departamento_codigo::text',   'departamento', 'NULL',         'departamento_codigo', 'departamento_codigo, departamento'),
            ('agg_nivel',        'nivel_codigo::text',          'nivel',        'NULL',         'nivel_codigo',        'nivel_codigo, nivel'),
            ('agg_sector',       'sector',                      'sector',       'NULL',         'NULL',                'sector'),
            ('agg_area',         'area',                        'area',         'NULL',         'NULL',                'area'),
            ('agg_municipio',    'municipio_codigo',            'municipio',    'departamento', 'departamento_codigo', 'municipio_codigo, municipio, departamento, departamento_codigo')
        ) AS t(tabla, clave, etiqueta, padre, orden, agrupar)
    LOOP
        EXECUTE format('TRUNCATE %I', dim.tabla);

        EXECUTE format($sql$
            INSERT INTO %1$I (clave, etiqueta, padre, orden, total, promovidos,
                              no_promovidos, retirados, vigentes, ignorados,
                              repitentes, graduandos)
            SELECT COALESCE(%2$s, '(sin dato)'),
                   COALESCE(%3$s, '(sin dato)'),
                   %4$s,
                   %5$s,
                   count(*),
                   count(*) FILTER (WHERE resultado_final = 'Promovido'),
                   count(*) FILTER (WHERE resultado_final = 'No promovido'),
                   count(*) FILTER (WHERE resultado_final IN ('Retirado', 'Retirado Definitivo')),
                   count(*) FILTER (WHERE resultado_final = 'Vigente'),
                   count(*) FILTER (WHERE resultado_final = 'Ignorado'),
                   count(*) FILTER (WHERE repitente = 'Si'),
                   count(*) FILTER (WHERE graduando = 'Si es graduando')
            FROM inscripciones
            GROUP BY %6$s
        $sql$, dim.tabla, dim.clave, dim.etiqueta, dim.padre, dim.orden, dim.agrupar);
    END LOOP;

    TRUNCATE agg_departamento_nivel;
    INSERT INTO agg_departamento_nivel
        (departamento_codigo, departamento, nivel_codigo, nivel,
         total, promovidos, no_promovidos, retirados)
    SELECT departamento_codigo,
           departamento,
           nivel_codigo,
           COALESCE(nivel, '(sin dato)'),
           count(*),
           count(*) FILTER (WHERE resultado_final = 'Promovido'),
           count(*) FILTER (WHERE resultado_final = 'No promovido'),
           count(*) FILTER (WHERE resultado_final IN ('Retirado', 'Retirado Definitivo'))
    FROM inscripciones
    GROUP BY departamento_codigo, departamento, nivel_codigo, COALESCE(nivel, '(sin dato)');

    -- El resumen se arma en una sola pasada sobre los microdatos. Es la única
    -- vez que se recorren los 4.3 M de filas, y pasa aquí y no en la API.
    TRUNCATE agg_resumen;
    INSERT INTO agg_resumen
        (inscripciones, departamentos, municipios, escuelas,
         promovidos, no_promovidos, retirados, repitentes, graduandos)
    SELECT count(*),
           count(DISTINCT departamento_codigo),
           count(DISTINCT municipio_codigo),
           count(DISTINCT cod_establecimiento_base),
           count(*) FILTER (WHERE resultado_final = 'Promovido'),
           count(*) FILTER (WHERE resultado_final = 'No promovido'),
           count(*) FILTER (WHERE resultado_final IN ('Retirado', 'Retirado Definitivo')),
           count(*) FILTER (WHERE repitente = 'Si'),
           count(*) FILTER (WHERE graduando = 'Si es graduando')
    FROM inscripciones;
END;
$$;
