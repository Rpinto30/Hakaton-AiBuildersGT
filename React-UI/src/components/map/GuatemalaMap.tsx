import { TriangleAlert } from 'lucide-react'
import { MapContainer, TileLayer } from 'react-leaflet'

import { useDepartmentsData } from '@/features/departments'
import { Spinner } from '@/components/ui/Spinner'

import { DepartmentLayer } from './DepartmentLayer'
import { FitBounds } from './FitBounds'
import { Legend } from './Legend'
import { MapControls } from './MapControls'

/**
 * Aviso flotante sobre el mapa. Los polígonos se dibujan igual sin cifras, así
 * que en vez de tapar el mapa se avisa por qué salió gris.
 */
function EstadoDatos({ loading, error }: { loading: boolean; error: string | null }) {
  if (!loading && error === null) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-[500] w-[min(92%,34rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-volc-900/10 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <span className="mt-0.5 shrink-0 text-jade-600">
          {loading ? <Spinner className="h-4 w-4" /> : <TriangleAlert size={16} className="text-gold-500" />}
        </span>
        <div className="text-[14px] leading-relaxed text-volc-600">
          {loading ? (
            'Cargando las cifras del censo 2024…'
          ) : (
            <>
              <strong className="text-jade-900">El mapa está sin cifras.</strong>{' '}
              {error}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function GuatemalaMap() {
  const { geojson, joined, loading, error } = useDepartmentsData()

  return (
    <>
      <EstadoDatos loading={loading} error={error} />
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
        {/*
          OpenStreetMap directo: no pide API key. Los tiles claros de CARTO
          (basemaps.cartocdn.com) ahora la exigen y devuelven las imágenes con
          "API KEY REQUIRED" estampado encima de todo el mapa.
        */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <DepartmentLayer geojson={geojson} joined={joined} />
        <FitBounds geojson={geojson} />
        <MapControls />
        <Legend joined={joined} />
      </MapContainer>
    </>
  )
}
