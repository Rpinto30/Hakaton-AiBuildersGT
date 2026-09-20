import type { DepartmentData, MetricValue } from '@/features/departments'
import {
  formatMetricLabel,
  formatValue,
  normalizeName,
} from '@/features/departments'

interface MetricSemantic {
  label: string
  keywords: string[]
  dataKeys: string[]
}

const SEMANTICS: MetricSemantic[] = [
  {
    label: 'Población',
    keywords: ['poblacion', 'poblado', 'poblada', 'habitante', 'habitantes'],
    dataKeys: ['poblacion_2024', 'poblacion'],
  },
  {
    label: 'Área',
    keywords: ['area', 'extension', 'superficie', 'tamano'],
    dataKeys: ['area_km2', 'area'],
  },
  {
    label: 'Densidad',
    keywords: ['densidad', 'denso', 'densa'],
    dataKeys: ['densidad_hab_per_km2', 'densidad'],
  },
  {
    label: 'Educación',
    keywords: ['educacion', 'educativo', 'educativa', 'educad'],
    dataKeys: ['indice_educativo', 'educativo'],
  },
  {
    label: 'Pobreza',
    keywords: ['pobreza', 'pobrez', 'pobre'],
    dataKeys: ['indice_pobreza', 'pobreza'],
  },
]

function strip(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function compact(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchDepartments(question: string, data: DepartmentData[]): string[] {
  const normalized = compact(question)
  const names = [...new Set(data.map((item) => item.nombre))]
  const found: string[] = []
  for (const nombre of [...names].sort((a, b) => b.length - a.length)) {
    if (normalized.includes(normalizeName(nombre))) found.push(nombre)
  }
  return found
}

function detectSemantic(question: string): MetricSemantic | null {
  for (const semantic of SEMANTICS) {
    if (semantic.keywords.some((keyword) => question.includes(keyword))) {
      return semantic
    }
  }
  return null
}

function resolveKey(data: DepartmentData[], semantic: MetricSemantic): string {
  for (const key of semantic.dataKeys) {
    if (data.some((item) => hasNumber(item, key))) return key
  }
  return semantic.dataKeys[0] ?? ''
}

function hasNumber(item: DepartmentData, key: string): boolean {
  return numericValue(item, key) !== undefined
}

function numericValue(item: DepartmentData, key: string): number | undefined {
  const value = item.metricas[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function fmt(value: MetricValue): string {
  return formatValue(value)
}

function summaryAnswer(nombre: string, data: DepartmentData[]): string {
  const item = data.find((entry) => entry.nombre === nombre)
  if (!item) {
    return `No tengo datos de ${nombre} en el JSON cargado.`
  }
  const lines = Object.entries(item.metricas).map(
    ([key, value]) => `${formatMetricLabel(key)}: ${fmt(value)}`,
  )
  return `Resumen de ${item.nombre}:\n${lines.join('\n')}`
}

function compareAnswer(nombreA: string, nombreB: string, data: DepartmentData[]): string {
  const a = data.find((entry) => entry.nombre === nombreA)
  const b = data.find((entry) => entry.nombre === nombreB)
  if (!a || !b) {
    return `No tengo datos de ${!a ? nombreA : nombreB} en el JSON cargado.`
  }
  const keys = [...new Set([...Object.keys(a.metricas), ...Object.keys(b.metricas)])]
  const lines = keys.map((key) => {
    const aValue = a.metricas[key] ?? '—'
    const bValue = b.metricas[key] ?? '—'
    return `${formatMetricLabel(key)}: ${fmt(aValue)} vs ${fmt(bValue)}`
  })
  return `Comparación ${a.nombre} ↔ ${b.nombre}:\n${lines.join('\n')}`
}

function superlativeAnswer(
  question: string,
  semantic: MetricSemantic,
  data: DepartmentData[],
): string {
  const key = resolveKey(data, semantic)
  const rows = data.filter((item) => hasNumber(item, key))
  if (rows.length === 0) {
    return `No hay valores numéricos de ${semantic.label.toLowerCase()} en el JSON cargado.`
  }

  const ascending = /menos |menor|baj[ao]|minimo/.test(question)
  const sorted = [...rows].sort((a, b) => {
    const aValue = numericValue(a, key) ?? 0
    const bValue = numericValue(b, key) ?? 0
    return ascending ? aValue - bValue : bValue - aValue
  })
  const top = sorted.slice(0, 3)
  const direction = ascending ? 'de menor a mayor' : 'de mayor a menor'
  const lines = top.map(
    (item, index) => `${index + 1}. ${item.nombre} — ${fmt(numericValue(item, key) ?? '')}`,
  )
  const extra =
    rows.length > 3
      ? `\n… y ${rows.length - 3} departamentos más, de ${rows.length} con datos.`
      : ''
  return `Por ${semantic.label.toLowerCase()} (${direction}):\n${lines.join('\n')}${extra}`
}

function fallbackAnswer(question: string, contexto: string[]): string {
  const context =
    contexto.length > 0 ? `\nTengo como contexto seleccionado: ${contexto.join(', ')}.` : ''
  return `No pude interpretar «${question}». Intenta por ejemplo:\n• «¿Cuál es el más poblado?»\n• «Compara Petén y Guatemala»\n• «Resume Quiché»\n• «¿Cuántos departamentos hay?»${context}`
}

export function localAnswer(
  rawQuestion: string,
  contexto: string[],
  departamentos: DepartmentData[],
): string {
  const trimmed = rawQuestion.trim()
  if (trimmed === '') {
    return 'Estoy listo. Escríbeme una pregunta sobre los departamentos.'
  }
  if (departamentos.length === 0) {
    return 'Aún no hay datos cargados en el JSON. Revisa resources/ y recarga.'
  }

  const question = strip(trimmed)

  if (/hola|buenas|saludos|buenos dias|buenas tardes/.test(question)) {
    return `¡Hola! Soy el asistente del mapa. Pregúntame por los datos de los ${departamentos.length} departamentos.`
  }
  if (/gracias|agradec/.test(question)) {
    return '¡De nada! Sigue preguntando cuando quieras.'
  }
  if (/cuantos departamento/.test(question)) {
    return `Guatemala tiene ${departamentos.length} departamentos en el JSON cargado.`
  }

  const found = matchDepartments(question, departamentos)

  if (/resume|resumir|resumen|informacion de|datos de|ficha de/.test(question)) {
    if (found.length > 0) return summaryAnswer(found[0], departamentos)
    if (contexto.length > 0) return summaryAnswer(contexto[0], departamentos)
    return 'Dime cuál departamento quieres que resuma (por ejemplo: «Resume Quiché»).'
  }

  if (found.length >= 2) {
    return compareAnswer(found[0], found[1], departamentos)
  }

  const semantic = detectSemantic(question)
  if (
    semantic &&
    / mas |menos |mayor|mayores|menor|menores|mejor|top|ranking|maximo|minimo/.test(question)
  ) {
    return superlativeAnswer(question, semantic, departamentos)
  }

  if (found.length === 1) {
    return summaryAnswer(found[0], departamentos)
  }

  return fallbackAnswer(trimmed, contexto)
}