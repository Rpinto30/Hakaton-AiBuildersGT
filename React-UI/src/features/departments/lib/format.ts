import type { DepartmentData, MetricValue } from '../types'

/**
 * Etiquetas escritas a mano para las métricas que sirve la API.
 *
 * Antes se armaban uniendo token por token y salían frases rotas como "Tasa de
 * no de promoción". Un mapa explícito es más largo pero siempre correcto; el
 * armado por tokens queda solo como respaldo para claves que no estén aquí.
 */
const ETIQUETAS: Record<string, string> = {
  tasa_promocion: 'Tasa de promoción',
  tasa_no_promocion: 'Tasa de no promoción',
  tasa_retiro: 'Tasa de retiro',
  tasa_repitencia: 'Tasa de repitencia',
  inscripciones: 'Inscripciones',
  promovidos: 'Promovidos',
  no_promovidos: 'No promovidos',
  retirados: 'Retirados',
  vigentes: 'Vigentes',
  ignorados: 'Ignorados',
  repitentes: 'Repitentes',
  graduandos: 'Graduandos',
  escuelas: 'Escuelas',
  municipios: 'Municipios',
}

const TOKENS: Record<string, string> = {
  tasa: 'tasa',
  area: 'área',
  km2: 'km²',
}

const numberFormatter = new Intl.NumberFormat('es-GT', {
  maximumFractionDigits: 2,
})

/** Las métricas `tasa_*` son porcentajes y se muestran con el signo. */
export function esPorcentaje(key: string): boolean {
  return key.startsWith('tasa_')
}

export function formatMetricLabel(rawKey: string): string {
  const conocida = ETIQUETAS[rawKey]
  if (conocida !== undefined) return conocida

  const label = rawKey
    .split('_')
    .filter(Boolean)
    .map((token) => TOKENS[token.toLowerCase()] ?? token)
    .join(' ')
    .replace(/\sper\s/g, ' / ')

  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * `key` es opcional para no romper las llamadas que solo tienen el valor, pero
 * pasarlo es lo que permite distinguir un porcentaje de un conteo.
 */
export function formatValue(value: MetricValue, key?: string): string {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return String(value)
  const texto = numberFormatter.format(value)
  return key !== undefined && esPorcentaje(key) ? `${texto} %` : texto
}

export function topMetrics(
  data: DepartmentData,
  count = 3,
): Array<[string, MetricValue]> {
  return Object.entries(data.metricas).slice(0, count)
}
