import { MapPin, X } from 'lucide-react'

import { useMapUiStore } from '@/features/mapui'
import type { DepartmentData } from '@/features/departments'
import {
  formatMetricLabel,
  formatValue,
  topMetrics,
} from '@/features/departments'
import { Badge } from '@/components/ui/Badge'

interface InfoPanelProps {
  selected: string | null
  data?: DepartmentData
}

export function InfoPanel({ selected, data }: InfoPanelProps) {
  const setSelected = useMapUiStore((state) => state.setSelected)

  if (selected === null) {
    return (
      <section
        aria-label="Detalle del departamento"
        className="flex h-full flex-col overflow-hidden bg-petate-100"
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-jade-600 shadow-sm">
            <MapPin size={20} aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-semibold text-jade-900">
            Mapa interactivo
          </h2>
          <p className="text-[15px] leading-relaxed text-volc-500">
            Haz clic en uno de los 22 departamentos para ver sus cifras reales
            del censo educativo 2024.
          </p>
        </div>
      </section>
    )
  }

  const featured = data ? topMetrics(data, 3) : []
  const featuredKeys = new Set(featured.map(([key]) => key))
  const rest = data
    ? Object.entries(data.metricas).filter(([key]) => !featuredKeys.has(key))
    : []

  return (
    <section
      aria-label="Detalle del departamento"
      className="flex h-full flex-col overflow-hidden bg-petate-100"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-2 border-b border-volc-900/10 px-5 pb-4 pt-5">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wide text-volc-400">
              Departamento
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-semibold text-jade-900">
              {selected}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Cerrar detalle"
            className="flex h-8 w-8 items-center justify-center rounded-md text-volc-500 transition-colors hover:bg-volc-900/10 hover:text-volc-900"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 pt-3">
          {data ? (
            <Badge>Datos del censo 2024</Badge>
          ) : (
            <Badge className="bg-petate-300 text-volc-700">Sin datos</Badge>
          )}
        </div>

        <div className="scrollbar-thin-volc min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {data ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-2.5">
                {featured.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-volc-900/10 bg-white px-4 py-3"
                  >
                    <dt className="text-[13px] font-medium uppercase tracking-wide text-volc-400">
                      {formatMetricLabel(key)}
                    </dt>
                    <dd className="mt-1 font-display text-2xl font-semibold leading-none text-jade-900">
                      {formatValue(value, key)}
                    </dd>
                  </div>
                ))}
              </dl>

              {rest.length > 0 ? (
                <dl className="divide-y divide-volc-900/10 rounded-lg border border-volc-900/10 bg-white/70">
                  {rest.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-baseline justify-between gap-3 px-3.5 py-2"
                    >
                      <dt className="text-[14px] text-volc-500">
                        {formatMetricLabel(key)}
                      </dt>
                      <dd className="font-display text-sm font-semibold text-jade-900">
                        {formatValue(value, key)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-volc-400 shadow-sm">
                <MapPin size={18} aria-hidden="true" />
              </span>
              <p className="font-display text-base font-semibold text-jade-900">
                Sin datos para {selected}
              </p>
              <p className="text-[15px] leading-relaxed text-volc-500">
                La API no devolvió cifras para este departamento.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
