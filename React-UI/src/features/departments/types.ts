import type { MultiPolygon } from 'geojson'

export type MetricValue = number | string

export type Metrics = Record<string, MetricValue>

export interface DepartmentData {
  nombre: string
  metricas: Metrics
}

export interface DepartmentProperties {
  NOMBRE: string
  GID_1: string
  NAME_1: string
}

export interface DepartmentFeature {
  type: 'Feature'
  properties: DepartmentProperties
  geometry: MultiPolygon
  id?: string | number
}

export interface DepartmentFeatureCollection {
  type: 'FeatureCollection'
  name: string
  features: DepartmentFeature[]
}

export interface JoinedDepartment {
  nombre: string
  feature: DepartmentFeature
  data?: DepartmentData
}