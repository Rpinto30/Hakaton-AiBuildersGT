export { normalizeName } from './lib/normalizeName'
export { geoJoin } from './lib/geoJoin'
export {
  esPorcentaje,
  formatMetricLabel,
  formatValue,
  topMetrics,
} from './lib/format'
export { metricasDeFila } from './lib/metricas'
export { useDepartmentsData } from './hooks/useDepartmentsData'
export { useDepartmentMeta } from './hooks/useDepartmentMeta'
export type {
  DepartmentData,
  DepartmentFeature,
  DepartmentFeatureCollection,
  DepartmentProperties,
  JoinedDepartment,
  Metrics,
  MetricValue,
} from './types'