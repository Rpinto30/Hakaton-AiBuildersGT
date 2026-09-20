import { create } from 'zustand'

export interface UiState {
  chatOpen: boolean
  detailsOpen: boolean
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  toggleDetails: () => void
  setDetailsOpen: (open: boolean) => void
}

function startsWithDesktopLayout(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= 1024
}

export const useUiStore = create<UiState>()((set) => ({
  chatOpen: startsWithDesktopLayout(),
  detailsOpen: startsWithDesktopLayout(),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  toggleDetails: () => set((state) => ({ detailsOpen: !state.detailsOpen })),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
}))
