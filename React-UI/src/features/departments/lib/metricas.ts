import type { FilaAgregada } from '@/features/api'

import type { Metrics } from '../types'

/**
 * Convierte una fila de la API en las métricas que muestran el mapa y el panel.
 *
 * El orden importa: el coropletas elige automáticamente la primera métrica
 * numérica presente en todos los departamentos (ver pickChoroplethMetric), y el
 * panel de detalle destaca las tres primeras. Por eso la tasa de promoción va
 * primero: es la que mejor se lee en un mapa, porque es comparable entre
 * departamentos grandes y chicos. El total de inscripciones, en cambio, solo
 * dibujaría dónde vive más gente.
 */
export function metricasDeFila(fila: FilaAgregada): Metrics {
  return {
    // Las tres primeras son las que el panel de detalle muestra destacadas.
    tasa_promocion: fila.tasa_promocion,
    inscripciones: fila.total,
    tasa_repitencia: fila.tasa_repitencia,
    tasa_no_promocion: fila.tasa_no_promocion,
    tasa_retiro: fila.tasa_retiro,
    promovidos: fila.promovidos,
    no_promovidos: fila.no_promovidos,
    retirados: fila.retirados,
    repitentes: fila.repitentes,
    graduandos: fila.graduandos,
  }
}
