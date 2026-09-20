import { useCallback, useState } from 'react'

import type { DepartmentData } from '@/features/departments'

import { ChatService } from './ChatService'
import type { Message } from './types'

export interface ChatState {
  messages: Message[]
  isTyping: boolean
  send: (
    pregunta: string,
    contexto: string[],
    departamentos?: DepartmentData[],
  ) => Promise<void>
  clear: () => void
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Haz clic en un departamento del mapa y pregúntame sobre sus cifras.',
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `msg-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export function useChat(): ChatState {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [isTyping, setIsTyping] = useState(false)

  const send = useCallback(
    async (
      pregunta: string,
      contexto: string[],
      departamentos: DepartmentData[] = [],
    ) => {
      const trimmed = pregunta.trim()
      if (trimmed === '') return

      const userMessage: Message = {
        id: makeId(),
        role: 'user',
        content: trimmed,
      }
      setMessages((prev) => [...prev, userMessage])
      setIsTyping(true)

      try {
        const response = await ChatService.send({
          pregunta: trimmed,
          contexto,
          departamentos,
        })
        const assistantMessage: Message = {
          id: makeId(),
          role: 'assistant',
          content: response.respuesta,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch {
        const errorMessage: Message = {
          id: makeId(),
          role: 'assistant',
          content:
            'No pude conectar con el asistente. Verifica VITE_CHAT_ENDPOINT o revisa la consola.',
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsTyping(false)
      }
    },
    [],
  )

  const clear = useCallback(() => {
    setMessages([WELCOME])
  }, [])

  return { messages, isTyping, send, clear }
}