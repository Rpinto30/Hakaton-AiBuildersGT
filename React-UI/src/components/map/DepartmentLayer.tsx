import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Feature as GeoFeature, Geometry, GeoJsonObject } from 'geojson'
import type {
  GeoJSON as LeafletGeoJSON,
  Layer as LeafletLayer,
  Path as LeafletPath,
  PathOptions,
} from 'leaflet'
import { GeoJSON } from 'react-leaflet'

import { useMapUiStore } from '@/features/mapui'
import type {
  DepartmentFeatureCollection,
  JoinedDepartment,
} from '@/features/departments'

import { departmentTooltipHtml } from './DepartmentTooltip'

export const CHOROPLETH_COLORS = [
  '#bce8d8',
  '#8fdcc2',
  '#5cc3a3',
  '#33a884',
  '#1f8a6b',
  '#0e3a30',
]

export const NO_DATA_COLOR = '#cfc7b3'

const BASE_STROKE = '#1b241f'
const HOVER_STROKE = '#e7bd63'
const SELECTED_STROKE = '#c08a26'

export function pickChoroplethMetric(joined: JoinedDepartment[]): string | null {
  const counts = new Map<string, number>()
  for (const entry of joined) {
    if (!entry.data) continue
    for (const [key, value] of Object.entries(entry.data.metricas)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
  }

  let best: string | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  return best
}

export function metricDomain(
  joined: JoinedDepartment[],
  metric: string,
): [number, number] | null {
  let min = Infinity
  let max = -Infinity
  for (const entry of joined) {
    const value = entry.data?.metricas[metric]
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < min) min = value
      if (value > max) max = value
    }
  }
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null
}

function fillFor(
  value: number | undefined,
  domain: [number, number] | null,
): string {
  if (value === undefined || domain === null) return NO_DATA_COLOR
  const [min, max] = domain
  const t = max === min ? 1 : (value - min) / (max - min)
  const index = Math.min(
    CHOROPLETH_COLORS.length - 1,
    Math.floor(t * CHOROPLETH_COLORS.length),
  )
  return CHOROPLETH_COLORS[index]
}

export interface DepartmentLayerProps {
  geojson: DepartmentFeatureCollection
  joined: JoinedDepartment[]
}

export function DepartmentLayer({ geojson, joined }: DepartmentLayerProps) {
  const hovered = useMapUiStore((state) => state.hovered)
  const selected = useMapUiStore((state) => state.selected)
  const showDataLayer = useMapUiStore((state) => state.showDataLayer)
  const showTooltips = useMapUiStore((state) => state.showTooltips)
  const setHovered = useMapUiStore((state) => state.setHovered)
  const setSelected = useMapUiStore((state) => state.setSelected)

  const latest = useRef({ hovered, selected, showDataLayer })
  latest.current = { hovered, selected, showDataLayer }

  const metric = useMemo(() => pickChoroplethMetric(joined), [joined])
  const domain = useMemo(
    () => (metric === null ? null : metricDomain(joined, metric)),
    [joined, metric],
  )

  const dataByNombre = useMemo(() => {
    const map = new Map<string, JoinedDepartment['data']>()
    for (const entry of joined) map.set(entry.nombre, entry.data)
    return map
  }, [joined])

  const nameByLayer = useMemo(() => new WeakMap<LeafletLayer, string>(), [])
  const layerRef = useRef<LeafletGeoJSON | null>(null)

  const styleFor = useCallback(
    (nombre: string): PathOptions => {
      const { hovered: currentHovered, selected: currentSelected, showDataLayer: useData } =
        latest.current

      const rawValue = dataByNombre.get(nombre)?.metricas[metric ?? '']
      const value = typeof rawValue === 'number' ? rawValue : undefined
      const colored = useData && metric !== null

      const base: PathOptions = {
        color: BASE_STROKE,
        weight: 0.7,
        opacity: 0.55,
        fillColor: colored ? fillFor(value, domain) : NO_DATA_COLOR,
        fillOpacity: colored ? 0.78 : 0.16,
      }

      if (currentSelected === nombre) {
        return {
          ...base,
          color: SELECTED_STROKE,
          weight: 2.5,
          opacity: 1,
          fillOpacity: colored ? 0.95 : 0.42,
        }
      }
      if (currentHovered === nombre) {
        return { ...base, color: HOVER_STROKE, weight: 1.8, opacity: 1 }
      }
      return base
    },
    [dataByNombre, domain, metric],
  )

  const applyStyles = useCallback(() => {
    layerRef.current?.eachLayer((layer) => {
      const nombre = nameByLayer.get(layer)
      if (nombre) (layer as LeafletPath).setStyle(styleFor(nombre))
    })
  }, [nameByLayer, styleFor])

  useEffect(() => {
    applyStyles()
  }, [applyStyles, hovered, selected, showDataLayer, showTooltips])

  const onEachFeature = useCallback(
    (feature: GeoFeature<Geometry>, layer: LeafletLayer) => {
      const nombre = feature.properties?.NOMBRE
      if (typeof nombre !== 'string' || nombre === '') return

      nameByLayer.set(layer, nombre)
      layer.on({
        click: () => setSelected(nombre),
        mouseover: () => {
          setHovered(nombre)
          if ('bringToFront' in layer) (layer as LeafletPath).bringToFront()
        },
        mouseout: () => setHovered(null),
      })

      if (showTooltips) {
        layer.bindTooltip(departmentTooltipHtml(nombre, dataByNombre.get(nombre)), {
          sticky: true,
          direction: 'top',
          className: 'department-tooltip',
        })
      }
    },
    [dataByNombre, nameByLayer, setHovered, setSelected, showTooltips],
  )

  return (
    <GeoJSON
      key={showTooltips ? 'with-tooltips' : 'without-tooltips'}
      ref={(element) => {
        layerRef.current = element
      }}
      data={geojson as GeoJsonObject}
      onEachFeature={onEachFeature}
    />
  )
}