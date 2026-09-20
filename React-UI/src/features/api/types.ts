/** Espejo de api/schemas.py. Si cambia allá, cambia aquí. */

export type Dimension =
  | 'departamento'
  | 'municipio'
  | 'nivel'
  | 'sector'
  | 'area'

/**
 * Una fila de agregados. `clave` es texto en todas las dimensiones: código del
 * INE en departamento y nivel ("1"), código de 4 dígitos en municipio ("0101")
 * y la etiqueta misma en sector y área ("Público"), porque el dataset
 * decodificado no conserva códigos numéricos para esas dos.
 */
export interface FilaAgregada {
  clave: string
  etiqueta: string
  padre: string | null
  orden: number | null
  total: number
  promovidos: number
  no_promovidos: number
  retirados: number
  vigentes: number
  ignorados: number
  repitentes: number
  graduandos: number
  tasa_promocion: number
  tasa_no_promocion: number
  tasa_retiro: number
  tasa_repitencia: number
}

export interface RespuestaAgregados {
  dimension: Dimension
  total_registros: number
  filas: FilaAgregada[]
}

export interface Resumen {
  inscripciones: number
  departamentos: number
  municipios: number
  escuelas: number
  tasa_promocion: number
  tasa_no_promocion: number
  tasa_retiro: number
  tasa_repitencia: number
}

export interface CeldaCruce {
  departamento_codigo: number
  departamento: string
  nivel_codigo: number | null
  nivel: string
  total: number
  promovidos: number
  no_promovidos: number
  retirados: number
  tasa_promocion: number
}

/** Una consulta que el agente le hizo a la base para poder responder. */
export interface ConsultaDelAgente {
  herramienta: string
  argumentos: string
  resultado: Record<string, unknown>
}

export interface RespuestaChat {
  respuesta: string
  con_ia: boolean
  cifras: FilaAgregada[]
  consultas: ConsultaDelAgente[]
}

/** Un municipio con su tasa observada y la que su composición hacía esperar. */
export interface MunicipioPriorizado {
  municipio_codigo: string
  municipio: string
  departamento: string
  departamento_codigo: number
  total: number
  tasa_promocion: number
  tasa_no_promocion: number
  tasa_retiro: number
  tasa_repitencia: number
  pct_rural: number
  esperado: number
  brecha: number
  estudiantes_bajo_lo_esperado: number
  en_el_ajuste: boolean
}

export interface Coeficiente {
  variable: string
  coeficiente: number
}

export interface Prioridad {
  r2: number
  municipios_ajustados: number
  municipios_totales: number
  matricula_minima: number
  intercepto: number
  coeficientes: Coeficiente[]
  municipios: MunicipioPriorizado[]
}
