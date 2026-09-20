import { create } from 'zustand'

export interface UiState {
  chatOpen: boolean
  detailsOpen: boolean
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  toggleDetails: () => void
  setDetailsOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  chatOpen: true,
  detailsOpen: true,
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  toggleDetails: () => set((state) => ({ detailsOpen: !state.detailsOpen })),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
}))
