import { MapContainer, TileLayer } from 'react-leaflet'

import { useDepartmentsData } from '@/features/departments'

import { DepartmentLayer } from './DepartmentLayer'
import { FitBounds } from './FitBounds'
import { Legend } from './Legend'
import { MapControls } from './MapControls'
import { MapEvents } from './MapEvents'

const DEFAULT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function tileUrl(): string {
  return (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim() ?? DEFAULT_TILE_URL
}

function attribution(): string {
  return (
    (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined)?.trim() ??
    DEFAULT_ATTRIBUTION
  )
}

export function GuatemalaMap() {
  const { geojson, joined } = useDepartmentsData()

  return (
    <MapContainer
      className="h-full w-full bg-petate-200"
      center={[15.5, -90.3]}
      zoom={7}
      minZoom={6}
      maxZoom={18}
      scrollWheelZoom
      zoomControl={false}
      attributionControl
    >
      <TileLayer attribution={attribution()} url={tileUrl()} subdomains="abcd" />
      <DepartmentLayer geojson={geojson} joined={joined} />
      <FitBounds geojson={geojson} />
      <MapControls />
      <Legend joined={joined} />
      <MapEvents />
    </MapContainer>
  )
}
