import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface ToggleProps {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function Toggle({ label, checked, onChange, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('group flex items-center gap-3', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked
            ? 'border-jade-600 bg-jade-600'
            : 'border-volc-400/40 bg-volc-100',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] motion-reduce:transition-none',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
      <span className="text-[15px] font-medium text-volc-800">{label}</span>
    </button>
  )
}