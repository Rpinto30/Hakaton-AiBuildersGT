import { useCallback, useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'

import { obtener } from '@/features/api'
import type { FilaAgregada, RespuestaAgregados } from '@/features/api'

export type Ambito = 'departamento' | 'municipio'

export const MAXIMO_SELECCIONADOS = 4

interface ComparadorUiState {
  abierto: boolean
  ambito: Ambito
  /** Claves seleccionadas: código de departamento ("1") o de municipio ("0101"). */
  seleccion: string[]
  abrir: () => void
  cerrar: () => void
  alternar: () => void
  cambiarAmbito: (ambito: Ambito) => void
  alternarClave: (clave: string) => void
  limpiar: () => void
}

/**
 * La selección vive en un store porque el mapa también escribe en ella: al
 * hacer clic en un departamento se agrega al comparador sin tener que pasar
 * callbacks por media aplicación.
 */
export const useComparadorStore = create<ComparadorUiState>()((set) => ({
  abierto: false,
  ambito: 'departamento',
  seleccion: [],
  abrir: () => set({ abierto: true }),
  cerrar: () => set({ abierto: false }),
  alternar: () => set((estado) => ({ abierto: !estado.abierto })),
  // Cambiar de ámbito limpia la selección: mezclar códigos de departamento y de
  // municipio en la misma lista no tendría sentido.
  cambiarAmbito: (ambito) => set({ ambito, seleccion: [] }),
  alternarClave: (clave) =>
    set((estado) => {
      if (estado.seleccion.includes(clave)) {
        return { seleccion: estado.seleccion.filter((c) => c !== clave) }
      }
      if (estado.seleccion.length >= MAXIMO_SELECCIONADOS) return estado
      return { seleccion: [...estado.seleccion, clave] }
    }),
  limpiar: () => set({ seleccion: [] }),
}))

export interface ComparadorDatos {
  filas: FilaAgregada[]
  seleccionadas: FilaAgregada[]
  cargando: boolean
  error: string | null
}

/** Las listas por ámbito se piden una vez y se recuerdan. */
const cache = new Map<Ambito, Promise<FilaAgregada[]>>()

function cargar(ambito: Ambito): Promise<FilaAgregada[]> {
  const guardada = cache.get(ambito)
  if (guardada !== undefined) return guardada

  const peticion = obtener<RespuestaAgregados>(`/api/agregados/${ambito}`)
    .then((respuesta) => respuesta.filas)
    .catch((causa: unknown) => {
      cache.delete(ambito)
      throw causa
    })
  cache.set(ambito, peticion)
  return peticion
}

export function useComparadorDatos(): ComparadorDatos {
  const ambito = useComparadorStore((estado) => estado.ambito)
  const seleccion = useComparadorStore((estado) => estado.seleccion)

  const [filas, setFilas] = useState<FilaAgregada[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)

    cargar(ambito)
      .then((resultado) => {
        if (!vigente) return
        setFilas(resultado)
        setError(null)
      })
      .catch((causa: unknown) => {
        if (!vigente) return
        setFilas([])
        setError(causa instanceof Error ? causa.message : String(causa))
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [ambito])

  // Se respeta el orden en que la persona fue eligiendo, no el de la API.
  const seleccionadas = useMemo(() => {
    const porClave = new Map(filas.map((fila) => [fila.clave, fila]))
    return seleccion.flatMap((clave) => {
      const fila = porClave.get(clave)
      return fila === undefined ? [] : [fila]
    })
  }, [filas, seleccion])

  return { filas, seleccionadas, cargando, error }
}

/** Agrega un departamento al comparador desde el mapa, por su nombre. */
export function useAgregarDepartamento() {
  const cambiarAmbito = useComparadorStore((estado) => estado.cambiarAmbito)
  const alternarClave = useComparadorStore((estado) => estado.alternarClave)
  const abrir = useComparadorStore((estado) => estado.abrir)
  const ambito = useComparadorStore((estado) => estado.ambito)

  return useCallback(
    async (nombre: string) => {
      if (ambito !== 'departamento') cambiarAmbito('departamento')
      const filas = await cargar('departamento')
      const fila = filas.find((f) => f.etiqueta === nombre)
      if (fila === undefined) return
      alternarClave(fila.clave)
      abrir()
    },
    [abrir, alternarClave, cambiarAmbito, ambito],
  )
}
