import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// El asistente responde en Markdown con una estructura fija (respuesta, detalle, nota).
// Aquí se decide cómo se ve cada elemento dentro de la burbuja, que es angosta (~280 px):
// por eso las tablas llevan scroll horizontal propio y letra un punto más pequeña.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gold-200">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-gold-400/60 pl-2.5 text-[14px] text-jade-200">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="scrollbar-thin-jade mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th
      style={style}
      className="border-b border-jade-600 px-2 py-1 text-left font-semibold text-petate-100"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td
      style={style}
      className="border-b border-jade-700/60 px-2 py-1 tabular-nums"
    >
      {children}
    </td>
  ),
  // El asistente no debe enlazar ni incrustar nada; si lo hiciera, se muestra como texto.
  a: ({ children }) => <span>{children}</span>,
  img: () => null,
}

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {content}
    </ReactMarkdown>
  )
}
