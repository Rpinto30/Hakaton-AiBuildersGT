import { MapContainer, TileLayer } from 'react-leaflet'

import { useDepartmentsData } from '@/features/departments'

import { DepartmentLayer } from './DepartmentLayer'
import { FitBounds } from './FitBounds'
import { Legend } from './Legend'
import { MapControls } from './MapControls'

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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <DepartmentLayer geojson={geojson} joined={joined} />
      <FitBounds geojson={geojson} />
      <MapControls />
      <Legend joined={joined} />
    </MapContainer>
  )
}
