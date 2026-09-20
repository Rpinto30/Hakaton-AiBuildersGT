import { useMemo } from 'react'
import { useMapEvents } from 'react-leaflet'

import { useMapUiStore } from '@/features/mapui'

export function MapEvents() {
  const events = useMemo(() => {
    return {
      click() {
        const state = useMapUiStore.getState()
        if (state.selected !== null) state.setSelected(null)
      },
    }
  }, [])

  useMapEvents(events)
  return null
}