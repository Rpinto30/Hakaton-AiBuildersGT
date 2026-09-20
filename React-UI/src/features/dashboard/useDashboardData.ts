import { useEffect, useState } from 'react'

import { obtener } from '@/features/api'
import type {
  CeldaCruce,
  RespuestaAgregados,
  Resumen,
} from '@/features/api'

export interface DashboardRow {
  nombre: string
  inscripciones: number
  promocion: number
  noPromocion: number
  retiro: number
  repitencia: number
}

export interface DistribucionRow {
  etiqueta: string
  total: number
  promocion: number
}

export interface DashboardState {
  loading: boolean
  error: string | null
  resumen: Resumen | null
  rows: DashboardRow[]
  porNivel: DistribucionRow[]
  porSector: DistribucionRow[]
  porArea: DistribucionRow[]
  cruce: CeldaCruce[]
}

const VACIO: Omit<DashboardState, 'loading' | 'error'> = {
  resumen: null,
  rows: [],
  porNivel: [],
  porSector: [],
  porArea: [],
  cruce: [],
}

function aDistribucion(respuesta: RespuestaAgregados): DistribucionRow[] {
  return respuesta.filas.map((fila) => ({
    etiqueta: fila.etiqueta,
    total: fila.total,
    promocion: fila.tasa_promocion,
  }))
}

/**
 * Todo el dashboard sale de las tablas `agg_*` vía la API. No hay cálculos en
 * el navegador: si una cifra aparece aquí, está en la base con ese mismo valor.
 */
export function useDashboardData(): DashboardState {
  const [estado, setEstado] = useState<DashboardState>({
    loading: true,
    error: null,
    ...VACIO,
  })

  useEffect(() => {
    let vigente = true

    Promise.all([
      obtener<Resumen>('/api/resumen'),
      obtener<RespuestaAgregados>('/api/agregados/departamento'),
      obtener<RespuestaAgregados>('/api/agregados/nivel'),
      obtener<RespuestaAgregados>('/api/agregados/sector'),
      obtener<RespuestaAgregados>('/api/agregados/area'),
      obtener<CeldaCruce[]>('/api/departamento-nivel'),
    ])
      .then(([resumen, departamentos, nivel, sector, area, cruce]) => {
        if (!vigente) return
        setEstado({
          loading: false,
          error: null,
          resumen,
          rows: departamentos.filas.map((fila) => ({
            nombre: fila.etiqueta,
            inscripciones: fila.total,
            promocion: fila.tasa_promocion,
            noPromocion: fila.tasa_no_promocion,
            retiro: fila.tasa_retiro,
            repitencia: fila.tasa_repitencia,
          })),
          porNivel: aDistribucion(nivel),
          porSector: aDistribucion(sector),
          porArea: aDistribucion(area),
          cruce,
        })
      })
      .catch((causa: unknown) => {
        if (!vigente) return
        setEstado({
          loading: false,
          error: causa instanceof Error ? causa.message : String(causa),
          ...VACIO,
        })
      })

    return () => {
      vigente = false
    }
  }, [])

  return estado
}
