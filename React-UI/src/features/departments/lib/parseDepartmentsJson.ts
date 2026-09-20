import type { DepartmentData, Metrics, MetricValue } from '../types'

const HEADER_KEY = 'departamento'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toMetrics(record: Record<string, unknown>): Metrics {
  const entry: Record<string, unknown> = { ...record }
  delete entry[HEADER_KEY]
  const metricas: Metrics = {}
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number' || typeof value === 'string') {
      metricas[key] = value satisfies MetricValue
    }
  }
  return metricas
}

export function parseDepartmentsJson(input: unknown): DepartmentData[] {
  if (Array.isArray(input)) {
    return input.flatMap((row): DepartmentData[] => {
      if (!isPlainObject(row)) return []
      const nombre = row[HEADER_KEY]
      if (typeof nombre !== 'string' || nombre.trim() === '') return []
      return [{ nombre: nombre.trim(), metricas: toMetrics(row) }]
    })
  }

  if (isPlainObject(input)) {
    return Object.entries(input).flatMap(([nombre, value]): DepartmentData[] => {
      if (!isPlainObject(value)) return []
      return [{ nombre, metricas: toMetrics(value) }]
    })
  }

  return []
}