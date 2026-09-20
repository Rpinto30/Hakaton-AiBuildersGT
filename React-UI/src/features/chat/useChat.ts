import { useCallback, useState } from 'react'

import { ChatService } from './ChatService'
import type { Message } from './types'

export interface ChatState {
  messages: Message[]
  isTyping: boolean
  send: (pregunta: string, contexto: string[]) => Promise<void>
  clear: () => void
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Haz clic en un departamento del mapa y pregúntame sobre sus cifras.',
}

export function useChat(): ChatState {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [isTyping, setIsTyping] = useState(false)

  const send = useCallback(async (pregunta: string, contexto: string[]) => {
    const trimmed = pregunta.trim()
    if (trimmed === '') return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsTyping(true)

    try {
      const response = await ChatService.send({ pregunta: trimmed, contexto })
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.respuesta,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (causa) {
      // Si la API no responde se dice, en vez de dejar la burbuja escribiendo
      // para siempre o inventar una respuesta.
      const detalle = causa instanceof Error ? causa.message : String(causa)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `No pude consultar los datos: ${detalle}`,
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [])

  const clear = useCallback(() => {
    setMessages([WELCOME])
  }, [])

  return { messages, isTyping, send, clear }
}