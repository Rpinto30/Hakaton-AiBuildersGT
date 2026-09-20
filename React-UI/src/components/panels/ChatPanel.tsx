import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { MessageSquare, Send, X } from 'lucide-react'

import { useChat } from '@/features/chat'
import { useDepartmentsData } from '@/features/departments'
import { useMapUiStore } from '@/features/mapui'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/ui/Spinner'

const PROMPT_CHIPS = [
  '¿Cuál es el más poblado?',
  'Compara Petén y Guatemala',
  'Resume el departamento seleccionado',
] as const

export function ChatPanel() {
  const { messages, isTyping, send } = useChat()
  const { data: departamentos } = useDepartmentsData()
  const selected = useMapUiStore((state) => state.selected)
  const toggleChat = useUiStore((state) => state.toggleChat)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const isEmpty =
    !isTyping &&
    messages.length === 1 &&
    messages[0]?.id === 'welcome'

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, isTyping])

  const submitText = (pregunta: string) => {
    void send(pregunta, selected === null ? [] : [selected], departamentos)
  }

  const submit = () => {
    const pregunta = draft
    setDraft('')
    submitText(pregunta)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const handleChip = (prompt: string) => {
    setDraft('')
    submitText(prompt)
  }

  const canSend = draft.trim() !== '' && !isTyping

  return (
    <section
      aria-label="Chat de datos"
      className="flex h-full flex-col bg-jade-950 text-white"
    >
      <header className="flex items-center justify-between gap-2 border-b border-jade-800/60 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-jade-800 text-gold-300">
            <MessageSquare size={16} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold leading-none text-petate-100">
              Guate Datos
            </h2>
            <p className="mt-1 text-[13px] text-jade-300">
              Asistente con los datos del mapa
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleChat()}
          aria-label="Ocultar chat"
          className="flex h-8 w-8 items-center justify-center rounded-md text-jade-300 transition-colors hover:bg-jade-800 hover:text-white lg:hidden"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="scrollbar-thin-jade min-h-0 flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {isEmpty ? (
          <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-4 px-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jade-800/80 text-gold-300">
              <MessageSquare size={22} aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-petate-100">
                Pregunta al mapa
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-jade-300">
                Elige un departamento o prueba una de estas preguntas.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {PROMPT_CHIPS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleChip(prompt)}
                  className="rounded-xl border border-jade-700/80 bg-jade-900/60 px-3 py-2.5 text-left text-[14px] text-jade-100 transition-colors hover:border-gold-400/50 hover:bg-jade-800"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed',
                  message.role === 'user'
                    ? 'ml-auto rounded-br-md bg-jade-600 text-white'
                    : 'rounded-bl-md bg-jade-800/70 text-jade-50',
                )}
              >
                {message.content}
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center gap-2 text-[14px] text-jade-300">
                <Spinner className="h-3.5 w-3.5 border-jade-300" />
                Escribiendo…
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-jade-800/60 p-3"
      >
        {selected !== null && (
          <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-jade-700 bg-jade-900/70 px-2.5 py-1 text-[13px] text-jade-200">
            <span className="shrink-0 text-jade-400">Contexto</span>
            <span className="truncate font-medium text-petate-100">
              {selected}
            </span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Pregunta
          </label>
          <textarea
            id="chat-input"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selected === null
                ? 'Pregunta algo…'
                : `Pregunta sobre ${selected}…`
            }
            className="max-h-28 min-h-11 flex-1 resize-none rounded-lg bg-jade-900 px-3 py-2.5 text-[15px] placeholder:text-jade-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-gold-400"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold-400 text-jade-950 transition-colors hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  )
}
