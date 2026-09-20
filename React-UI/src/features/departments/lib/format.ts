import type { DepartmentData, MetricValue } from '../types'

const TOKENS: Record<string, string> = {
  poblacion: 'Población',
  indice: 'Índice',
  indicex: 'Índice',
  area: 'Área',
  densidad: 'Densidad',
  educacion: 'educación',
  educativo: 'educativo',
  pobreza: 'pobreza',
  hab: 'hab',
  tasa: 'tasa',
  km2: 'km²',
  humedad: 'humedad',
  anual: 'anual',
  media: 'media',
}

const numberFormatter = new Intl.NumberFormat('es-GT', {
  maximumFractionDigits: 2,
})

export function formatMetricLabel(rawKey: string): string {
  const label = rawKey
    .split('_')
    .filter(Boolean)
    .map((token) => TOKENS[token.toLowerCase()] ?? token)
    .join(' ')
    .replace(/\sper\s/g, ' / ')

  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatValue(value: MetricValue): string {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return String(value)
  return numberFormatter.format(value)
}

export function topMetrics(
  data: DepartmentData,
  count = 3,
): Array<[string, MetricValue]> {
  return Object.entries(data.metricas).slice(0, count)
}