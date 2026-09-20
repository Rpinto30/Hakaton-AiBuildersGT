import type { DepartmentData } from '@/features/departments'
import {
  formatMetricLabel,
  formatValue,
  topMetrics,
} from '@/features/departments'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function departmentTooltipHtml(
  nombre: string,
  data?: DepartmentData,
): string {
  const name = `<strong>${escapeHtml(nombre)}</strong>`

  if (!data) {
    return `<div class="tooltip-body">${name}<div class="tooltip-muted">Sin datos en el JSON</div></div>`
  }

  const rows = topMetrics(data)
    .map(
      ([key, value]) =>
        `<div class="tooltip-row"><span class="tooltip-label">${escapeHtml(
          formatMetricLabel(key),
        )}</span><span class="tooltip-value">${escapeHtml(
          formatValue(value),
        )}</span></div>`,
    )
    .join('')

  return `<div class="tooltip-body">${name}${rows}</div>`
}
