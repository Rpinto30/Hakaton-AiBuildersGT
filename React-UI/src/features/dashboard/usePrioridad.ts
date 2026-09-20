import { useEffect, useState } from 'react'

import { obtener } from '@/features/api'
import type { Prioridad } from '@/features/api'

export interface PrioridadState {
  cargando: boolean
  error: string | null
  datos: Prioridad | null
}

export function usePrioridad(): PrioridadState {
  const [estado, setEstado] = useState<PrioridadState>({
    cargando: true,
    error: null,
    datos: null,
  })

  useEffect(() => {
    let vigente = true

    obtener<Prioridad>('/api/prioridad')
      .then((datos) => {
        if (vigente) setEstado({ cargando: false, error: null, datos })
      })
      .catch((causa: unknown) => {
        if (!vigente) return
        setEstado({
          cargando: false,
          error: causa instanceof Error ? causa.message : String(causa),
          datos: null,
        })
      })

    return () => {
      vigente = false
    }
  }, [])

  return estado
}
