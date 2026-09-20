-- =============================================================================
-- 04_validacion.sql · Verificación de la carga
-- =============================================================================
-- Correr después de \copy + refresh_agregados().
-- Compara lo que quedó en Postgres contra las cifras publicadas en la
-- documentación del reto. Si todo dice "ok", la cadena completa desde el .xlsx
-- hasta la base está correcta.
-- =============================================================================

\echo '--- Total de registros (esperado 4,298,887) ---'
SELECT count(*)                                  AS total,
       CASE WHEN count(*) = 4298887 THEN 'ok' ELSE 'MAL' END AS estado
FROM inscripciones;

\echo '--- Municipios en Guatemala (esperado 17) ---'
SELECT count(DISTINCT municipio_codigo)          AS municipios,
       CASE WHEN count(DISTINCT municipio_codigo) = 17 THEN 'ok' ELSE 'MAL' END AS estado
FROM inscripciones
WHERE departamento_codigo = 1;

\echo '--- Municipios a nivel nacional (esperado ~340) ---'
SELECT count(DISTINCT municipio_codigo) AS municipios FROM inscripciones;

\echo '--- El cero a la izquierda sobrevivió (esperado 0101) ---'
SELECT DISTINCT municipio_codigo
FROM inscripciones
WHERE departamento_codigo = 1
ORDER BY municipio_codigo
LIMIT 1;

\echo '--- Sector (esperado 74.7 / 20.9 / 4.0 / 0.3) ---'
SELECT etiqueta,
       total,
       ROUND(100.0 * total / SUM(total) OVER (), 1) AS pct
FROM agg_sector ORDER BY total DESC;

\echo '--- Área (esperado Rural 61.4 / Urbana 38.6) ---'
SELECT etiqueta,
       total,
       ROUND(100.0 * total / SUM(total) OVER (), 1) AS pct
FROM agg_area ORDER BY total DESC;

\echo '--- Nivel (esperado 56.4 / 17.8 / 17.1 / 8.5) ---'
SELECT etiqueta,
       total,
       ROUND(100.0 * total / SUM(total) OVER (), 1) AS pct
FROM agg_nivel ORDER BY total DESC;

\echo '--- Resultado (esperado Promovido 85.2 / No promovido 9.2 / Retirado 5.5) ---'
SELECT ROUND(100.0 * SUM(promovidos)    / SUM(total), 1) AS pct_promovido,
       ROUND(100.0 * SUM(no_promovidos) / SUM(total), 1) AS pct_no_promovido,
       ROUND(100.0 * SUM(retirados)     / SUM(total), 1) AS pct_retirado
FROM agg_departamento;

\echo '--- Los agregados suman igual que la tabla base ---'
SELECT (SELECT SUM(total) FROM agg_departamento) AS suma_agregados,
       (SELECT count(*)   FROM inscripciones)    AS filas_base,
       CASE WHEN (SELECT SUM(total) FROM agg_departamento)
               = (SELECT count(*)   FROM inscripciones)
            THEN 'ok' ELSE 'MAL' END AS estado;

\echo '--- Escuelas reales vs códigos completos ---'
SELECT count(DISTINCT cod_establecimiento_base) AS escuelas,
       count(DISTINCT cod_establecimiento)      AS codigos_nivel
FROM inscripciones;
