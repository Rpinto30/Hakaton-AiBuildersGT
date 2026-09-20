import { useMemo } from 'react'

import type { JoinedDepartment } from '../types'

export interface DepartmentMeta {
  nombre: string | null
  joined: JoinedDepartment | null
}

export function useDepartmentMeta(
  selected: string | null,
  joined: JoinedDepartment[],
): DepartmentMeta {
  return useMemo(() => {
    if (selected === null) return { nombre: null, joined: null }
    const item = joined.find((entry) => entry.nombre === selected) ?? null
    return { nombre: selected, joined: item }
  }, [selected, joined])
}