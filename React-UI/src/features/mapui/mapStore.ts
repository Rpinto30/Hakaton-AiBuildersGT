import { create } from 'zustand'

export interface MapUiState {
  hovered: string | null
  selected: string | null
  showDataLayer: boolean
  showTooltips: boolean
  resetSignal: number
  setHovered: (name: string | null) => void
  setSelected: (name: string | null) => void
  toggleDataLayer: () => void
  toggleTooltips: () => void
  triggerReset: () => void
}

export const useMapUiStore = create<MapUiState>()((set) => ({
  hovered: null,
  selected: null,
  showDataLayer: true,
  showTooltips: true,
  resetSignal: 0,
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  toggleDataLayer: () =>
    set((state) => ({ showDataLayer: !state.showDataLayer })),
  toggleTooltips: () =>
    set((state) => ({ showTooltips: !state.showTooltips })),
  triggerReset: () =>
    set((state) => ({ resetSignal: state.resetSignal + 1 })),
}))
