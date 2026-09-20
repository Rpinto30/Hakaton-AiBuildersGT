-- =============================================================================
-- 02_indices.sql · Índices
-- =============================================================================
-- CORRER DESPUÉS DEL \copy, nunca antes.
-- Mantener índices vivos durante la carga de 4.3 M de filas la hace varias veces
-- más lenta. Se crean al final, de una sola pasada.
-- =============================================================================

CREATE INDEX idx_insc_departamento ON inscripciones (departamento_codigo);
CREATE INDEX idx_insc_municipio    ON inscripciones (municipio_codigo);
CREATE INDEX idx_insc_nivel        ON inscripciones (nivel_codigo);
CREATE INDEX idx_insc_sector       ON inscripciones (sector);
CREATE INDEX idx_insc_area         ON inscripciones (area);

-- Deja las estadísticas del planificador al día tras la carga masiva.
ANALYZE inscripciones;
