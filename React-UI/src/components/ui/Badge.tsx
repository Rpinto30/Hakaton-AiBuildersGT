import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-jade-100 px-2 py-0.5 text-[13px] font-medium text-jade-800',
        className,
      )}
      {...props}
    />
  )
}