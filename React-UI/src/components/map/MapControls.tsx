import type { ReactNode } from 'react'
import {
  BarChart3,
  Info,
  MessageSquare,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMap } from 'react-leaflet'

import { cn } from '@/lib/cn'
import { useMapUiStore } from '@/features/mapui'
import { useUiStore } from '@/store/uiStore'
import { Toggle } from '@/components/ui/Toggle'

interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}

function IconButton({ label, onClick, children, className }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-volc-700 transition-colors hover:bg-volc-100',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function MapControls() {
  const map = useMap()

  const showDataLayer = useMapUiStore((state) => state.showDataLayer)
  const showTooltips = useMapUiStore((state) => state.showTooltips)
  const toggleDataLayer = useMapUiStore((state) => state.toggleDataLayer)
  const toggleTooltips = useMapUiStore((state) => state.toggleTooltips)
  const triggerReset = useMapUiStore((state) => state.triggerReset)

  const chatOpen = useUiStore((state) => state.chatOpen)
  const detailsOpen = useUiStore((state) => state.detailsOpen)
  const toggleChat = useUiStore((state) => state.toggleChat)
  const toggleDetails = useUiStore((state) => state.toggleDetails)

  return (
    <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-3.5 py-2.5 text-sm font-semibold text-jade-950 shadow-md transition-colors hover:bg-gold-300"
      >
        <BarChart3 size={16} aria-hidden="true" />
        Dashboard
      </Link>
      <div className="flex w-[11.5rem] flex-col overflow-hidden rounded-xl border border-volc-900/10 bg-white/95 shadow-sm backdrop-blur">
        <div className="grid gap-2 p-2.5">
          <Toggle
            label="Capa de datos"
            checked={showDataLayer}
            onChange={() => toggleDataLayer()}
          />
          <Toggle
            label="Tooltips"
            checked={showTooltips}
            onChange={() => toggleTooltips()}
          />
        </div>

        <div className="flex items-center gap-1 border-t border-volc-900/10 px-1.5 py-1.5">
          <IconButton label="Reencuadrar a Guatemala" onClick={() => triggerReset()}>
            <RotateCcw size={15} />
          </IconButton>
          <IconButton label="Alejar" onClick={() => map.zoomOut()}>
            <ZoomOut size={15} />
          </IconButton>
          <IconButton label="Acercar" onClick={() => map.zoomIn()}>
            <ZoomIn size={15} />
          </IconButton>
          <IconButton
            label={chatOpen ? 'Ocultar chat' : 'Abrir chat'}
            onClick={() => toggleChat()}
            className="lg:hidden"
          >
            <MessageSquare size={15} />
          </IconButton>
          <IconButton
            label={detailsOpen ? 'Ocultar detalles' : 'Abrir detalles'}
            onClick={() => toggleDetails()}
            className="lg:hidden"
          >
            <Info size={15} />
          </IconButton>
        </div>

        <p className="border-t border-volc-900/10 px-2.5 py-1.5 text-xs leading-snug text-volc-500">
          22 departamentos · clic para detalle
        </p>
      </div>
    </div>
  )
}
