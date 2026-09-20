import { localAnswer } from './localAssistant'
import type { ChatRequest, ChatResponse } from './types'

const REMOTE_PLACEHOLDER =
  'Recibí tu pregunta y la llevaré al asistente. El modelo se conecta aquí cuando el servicio esté disponible.'

function endpoint(): string {
  return (import.meta.env.VITE_CHAT_ENDPOINT as string | undefined)?.trim() ?? ''
}

async function remote(request: ChatRequest): Promise<ChatResponse> {
  const url = endpoint()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pregunta: request.pregunta,
      contexto: request.contexto,
    }),
  })
  if (!response.ok) {
    throw new Error(`POST ${url} respondió ${response.status}`)
  }
  const body = (await response.json()) as Partial<ChatResponse>
  return { respuesta: body.respuesta ?? REMOTE_PLACEHOLDER }
}

export const ChatService = {
  async send(request: ChatRequest): Promise<ChatResponse> {
    if (endpoint() !== '') {
      return remote(request)
    }
    return {
      respuesta: localAnswer(
        request.pregunta,
        request.contexto,
        request.departamentos ?? [],
      ),
    }
  },
  localAnswer,
}