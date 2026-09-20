import { useEffect, useMemo, useState } from 'react'
import geojsonSource from '@resources/guatemala-departments.geojson?raw'

import { obtener } from '@/features/api'
import type { RespuestaAgregados } from '@/features/api'

import { geoJoin } from '../lib/geoJoin'
import { metricasDeFila } from '../lib/metricas'
import type {
  DepartmentData,
  DepartmentFeatureCollection,
  JoinedDepartment,
} from '../types'

export interface DepartmentsState {
  geojson: DepartmentFeatureCollection
  data: DepartmentData[]
  joined: JoinedDepartment[]
  loading: boolean
  error: string | null
}

function readGeoJson(): DepartmentFeatureCollection {
  return JSON.parse(geojsonSource) as DepartmentFeatureCollection
}

/**
 * El layout y el mapa piden los mismos datos. Compartir la promesa evita que
 * cada uno dispare su propia petición al montar.
 */
let peticionEnCurso: Promise<DepartmentData[]> | null = null

function cargarDepartamentos(): Promise<DepartmentData[]> {
  peticionEnCurso ??= obtener<RespuestaAgregados>('/api/agregados/departamento')
    .then((respuesta) =>
      respuesta.filas.map((fila) => ({
        nombre: fila.etiqueta,
        metricas: metricasDeFila(fila),
      })),
    )
    .catch((causa: unknown) => {
      // Un fallo no debe quedar cacheado: el siguiente montaje reintenta.
      peticionEnCurso = null
      throw causa
    })
  return peticionEnCurso
}

/**
 * Los polígonos son estáticos (viven en resources/), las cifras vienen de la
 * API. El join es por nombre de departamento: los 22 del GeoJSON coinciden
 * exactamente con los del diccionario del INE, tildes incluidas.
 */
export function useDepartmentsData(): DepartmentsState {
  const geojson = useMemo(readGeoJson, [])
  const [data, setData] = useState<DepartmentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    cargarDepartamentos()
      .then((departamentos) => {
        if (!vigente) return
        setData(departamentos)
        setError(null)
      })
      .catch((causa: unknown) => {
        if (!vigente) return
        setData([])
        setError(causa instanceof Error ? causa.message : String(causa))
      })
      .finally(() => {
        if (vigente) setLoading(false)
      })

    return () => {
      vigente = false
    }
  }, [])

  const joined = useMemo(() => geoJoin(geojson, data), [geojson, data])

  return { geojson, data, joined, loading, error }
}
