import { useMemo } from 'react'
import { Layers } from 'lucide-react'

import { useMapUiStore } from '@/features/mapui'
import {
  formatMetricLabel,
  formatValue,
} from '@/features/departments'
import type { JoinedDepartment } from '@/features/departments'

import {
  CHOROPLETH_COLORS,
  NO_DATA_COLOR,
  metricDomain,
  pickChoroplethMetric,
} from './DepartmentLayer'

interface LegendProps {
  joined: JoinedDepartment[]
}

export function Legend({ joined }: LegendProps) {
  const showDataLayer = useMapUiStore((state) => state.showDataLayer)

  const data = useMemo(() => {
    const metric = pickChoroplethMetric(joined)
    const domain = metric === null ? null : metricDomain(joined, metric)
    const withData = joined.filter((entry) => entry.data !== undefined).length
    return { metric, domain, withData }
  }, [joined])

  if (!showDataLayer || data.metric === null || data.domain === null) {
    return null
  }

  const [min, max] = data.domain

  return (
    <div className="absolute bottom-8 right-3 z-[500] w-52 rounded-xl border border-volc-900/10 bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-volc-700">
        <Layers size={12} className="text-jade-600" />
        <span>{formatMetricLabel(data.metric)}</span>
      </div>

      <div
        className="mt-2 h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, ${CHOROPLETH_COLORS.join(', ')})`,
        }}
        aria-hidden="true"
      />
      <div className="mt-1 flex justify-between text-[12px] text-volc-500">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-volc-500">
        <span
          className="inline-block h-2 w-4 shrink-0 rounded-sm"
          style={{ backgroundColor: NO_DATA_COLOR }}
          aria-hidden="true"
        />
        <span>
          Sin datos · {data.withData}/{joined.length} con datos
        </span>
      </div>
    </div>
  )
}
