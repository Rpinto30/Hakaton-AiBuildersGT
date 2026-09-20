import { useMemo } from 'react'
import dataSource from '@resources/departamentos-data.example.json'
import geojsonSource from '@resources/guatemala-departments.geojson?raw'

import { geoJoin } from '../lib/geoJoin'
import { parseDepartmentsJson } from '../lib/parseDepartmentsJson'
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
}

function readGeoJson(): DepartmentFeatureCollection {
  return JSON.parse(geojsonSource) as DepartmentFeatureCollection
}

export function useDepartmentsData(): DepartmentsState {
  return useMemo<DepartmentsState>(() => {
    const geojson = readGeoJson()
    const data = parseDepartmentsJson(dataSource)
    return {
      geojson,
      data,
      joined: geoJoin(geojson, data),
      loading: false,
    }
  }, [])
}