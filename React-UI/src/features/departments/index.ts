export { normalizeName } from './lib/normalizeName'
export { parseDepartmentsJson } from './lib/parseDepartmentsJson'
export { geoJoin } from './lib/geoJoin'
export {
  formatMetricLabel,
  formatValue,
  topMetrics,
} from './lib/format'
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