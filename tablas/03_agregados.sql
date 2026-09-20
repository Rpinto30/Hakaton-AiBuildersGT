-- =============================================================================
-- 03_agregados.sql · Agregados precalculados
-- =============================================================================
-- Son tablas pequeñas (de 4 a 340 filas) y es lo único que consultan la API, el
-- dashboard y el agente. Así nadie escanea los 4.3 M de registros en cada
-- interacción, y las cifras del chat coinciden siempre con las del dashboard
-- porque salen de la misma tabla.
--
-- Decisiones de conteo (documentadas para no cambiarlas sin querer):
--   * retirados = 'Retirado' + 'Retirado definitivo'. El segundo casi no aparece.
--   * el denominador de las tasas es TODO el grupo, incluidas Vigentes e
--     Ignoradas, así que promoción + no promoción + retiro puede sumar < 100%.
--   * 'Ignorado' se reporta como fila propia, nunca se descarta: es dato real.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Forma común de todas las tablas de agregados.
--   clave    identificador único dentro de la dimensión
--   etiqueta nombre legible que ve el usuario final
--   padre    dimensión contenedora (solo municipio: su departamento)
--   orden    para ordenar de forma natural (Preprimaria antes que Primaria)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS agg_departamento, agg_nivel, agg_sector, agg_area,
                     agg_municipio, agg_departamento_nivel CASCADE;

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
                   count(*) FILTER (WHERE resultado_final IN ('Retirado', 'Retirado definitivo')),
                   count(*) FILTER (WHERE resultado_final = 'Vigente'),
                   count(*) FILTER (WHERE resultado_final = 'Ignorado'),
                   count(*) FILTER (WHERE repitente LIKE 'Sí%%'),
                   count(*) FILTER (WHERE graduando LIKE 'Sí%%')
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
           count(*) FILTER (WHERE resultado_final IN ('Retirado', 'Retirado definitivo'))
    FROM inscripciones
    GROUP BY departamento_codigo, departamento, nivel_codigo, COALESCE(nivel, '(sin dato)');
END;
$$;
