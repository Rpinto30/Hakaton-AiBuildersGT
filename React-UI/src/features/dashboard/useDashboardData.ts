import { useMemo } from 'react'
import raw from '@resources/departamentos-data.example.json'

import { parseDepartmentsJson } from '@/features/departments'
import type { DepartmentData } from '@/features/departments'

export interface DashboardRow {
  nombre: string
  poblacion: number
  area: number
  densidad: number
  educativo: number
  pobreza: number
}

export interface DashboardKpis {
  departamentos: number
  poblacionTotal: number
  areaTotal: number
  densidadMedia: number
  educativoMedia: number
  pobrezaMedia: number
}

function num(metrics: DepartmentData['metricas'], key: string): number {
  const value = metrics[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function useDashboardData() {
  return useMemo(() => {
    const departments = parseDepartmentsJson(raw)
    const rows: DashboardRow[] = departments.map((dept) => ({
      nombre: dept.nombre,
      poblacion: num(dept.metricas, 'poblacion_2024'),
      area: num(dept.metricas, 'area_km2'),
      densidad: num(dept.metricas, 'densidad_hab_per_km2'),
      educativo: num(dept.metricas, 'indice_educativo'),
      pobreza: num(dept.metricas, 'indice_pobreza'),
    }))

    const departamentos = rows.length
    const poblacionTotal = rows.reduce((sum, row) => sum + row.poblacion, 0)
    const areaTotal = rows.reduce((sum, row) => sum + row.area, 0)
    const densidadMedia =
      departamentos === 0
        ? 0
        : rows.reduce((sum, row) => sum + row.densidad, 0) / departamentos
    const educativoMedia =
      departamentos === 0
        ? 0
        : rows.reduce((sum, row) => sum + row.educativo, 0) / departamentos
    const pobrezaMedia =
      departamentos === 0
        ? 0
        : rows.reduce((sum, row) => sum + row.pobreza, 0) / departamentos

    const byPoblacion = [...rows].sort((a, b) => b.poblacion - a.poblacion)
    const byPobreza = [...rows].sort((a, b) => b.pobreza - a.pobreza)

    const kpis: DashboardKpis = {
      departamentos,
      poblacionTotal,
      areaTotal,
      densidadMedia,
      educativoMedia,
      pobrezaMedia,
    }

    return { rows, kpis, byPoblacion, byPobreza }
  }, [])
}
