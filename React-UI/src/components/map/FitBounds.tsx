import { useEffect } from 'react'
import type { GeoJsonObject } from 'geojson'
import L from 'leaflet'
import { useMap } from 'react-leaflet'

import { useMapUiStore } from '@/features/mapui'
import type { DepartmentFeatureCollection } from '@/features/departments'

interface FitBoundsProps {
  geojson: DepartmentFeatureCollection
}

export function FitBounds({ geojson }: FitBoundsProps) {
  const map = useMap()
  const resetSignal = useMapUiStore((state) => state.resetSignal)

  useEffect(() => {
    const bounds = L.geoJSON(geojson as GeoJsonObject).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] })
    }
  }, [geojson, map, resetSignal])

  return null
}