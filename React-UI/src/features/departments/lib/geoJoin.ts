import { normalizeName } from './normalizeName'
import type {
  DepartmentData,
  DepartmentFeatureCollection,
  JoinedDepartment,
} from '../types'

export function geoJoin(
  geojson: DepartmentFeatureCollection,
  data: DepartmentData[],
): JoinedDepartment[] {
  const index = new Map<string, DepartmentData>()
  for (const item of data) {
    const key = normalizeName(item.nombre)
    if (!index.has(key)) index.set(key, item)
  }

  return geojson.features.map((feature) => {
    const nombre = feature.properties.NOMBRE
    return {
      nombre,
      feature,
      data: index.get(normalizeName(nombre)),
    }
  })
}