import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ChatPanel } from '@/components/panels/ChatPanel'
import { ComparadorPanel } from '@/components/panels/ComparadorPanel'
import { InfoPanel } from '@/components/panels/InfoPanel'
import { GuatemalaMap } from '@/components/map/GuatemalaMap'
import {
  useDepartmentMeta,
  useDepartmentsData,
} from '@/features/departments'
import { useMapUiStore } from '@/features/mapui'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/lib/cn'

export function AppLayout() {
  const selected = useMapUiStore((state) => state.selected)
  const chatOpen = useUiStore((state) => state.chatOpen)
  const detailsOpen = useUiStore((state) => state.detailsOpen)
  const toggleChat = useUiStore((state) => state.toggleChat)
  const toggleDetails = useUiStore((state) => state.toggleDetails)

  const { joined } = useDepartmentsData()
  const { joined: selectedJoined } = useDepartmentMeta(selected, joined)

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-petate-100">
      <aside
        aria-hidden={!chatOpen}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col border-r border-volc-900/10 transition-[width] duration-200 ease-out',
          chatOpen
            ? 'w-[min(100%,20rem)] lg:w-[22rem]'
            : 'w-0 overflow-hidden border-r-0',
        )}
      >
        <div
          className={cn(
            'flex h-full w-[min(100%,20rem)] shrink-0 flex-col lg:w-[22rem]',
            !chatOpen && 'pointer-events-none',
          )}
        >
          <ChatPanel />
        </div>
        {chatOpen ? (
          <button
            type="button"
            onClick={() => toggleChat()}
            aria-label="Ocultar chat"
            className="absolute -right-3 top-1/2 z-30 hidden h-8 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-volc-900/10 bg-white text-volc-600 shadow-sm transition-colors hover:bg-petate-100 hover:text-jade-800 lg:flex"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        ) : null}
      </aside>

      {!chatOpen ? (
        <button
          type="button"
          onClick={() => toggleChat()}
          aria-label="Abrir chat"
          className="absolute left-0 top-1/2 z-30 hidden h-10 w-7 -translate-y-1/2 items-center justify-center rounded-r-md border border-volc-900/10 bg-jade-950 text-gold-300 shadow-sm transition-colors hover:bg-jade-900 lg:flex"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      ) : null}

      <main className="relative min-h-0 min-w-0 flex-1">
        <GuatemalaMap />
        <ComparadorPanel />
      </main>

      {!detailsOpen ? (
        <button
          type="button"
          onClick={() => toggleDetails()}
          aria-label="Abrir detalles"
          className="absolute right-0 top-1/2 z-30 hidden h-10 w-7 -translate-y-1/2 items-center justify-center rounded-l-md border border-volc-900/10 bg-white text-jade-700 shadow-sm transition-colors hover:bg-petate-100 lg:flex"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      ) : null}

      <aside
        aria-hidden={!detailsOpen}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col border-l border-volc-900/10 transition-[width] duration-200 ease-out',
          detailsOpen
            ? 'w-[min(100%,20rem)] lg:w-[22.5rem]'
            : 'w-0 overflow-hidden border-l-0',
        )}
      >
        <div
          className={cn(
            'flex h-full w-[min(100%,20rem)] shrink-0 flex-col lg:w-[22.5rem]',
            !detailsOpen && 'pointer-events-none',
          )}
        >
          <InfoPanel
            selected={selected}
            data={selectedJoined?.data ?? undefined}
          />
        </div>
        {detailsOpen ? (
          <button
            type="button"
            onClick={() => toggleDetails()}
            aria-label="Ocultar detalles"
            className="absolute -left-3 top-1/2 z-30 hidden h-8 w-6 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-volc-900/10 bg-white text-volc-600 shadow-sm transition-colors hover:bg-petate-100 hover:text-jade-800 lg:flex"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ) : null}
      </aside>
    </div>
  )
}
