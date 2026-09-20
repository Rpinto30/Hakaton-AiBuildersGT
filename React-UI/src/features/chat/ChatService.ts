import type { ChatRequest, ChatResponse } from './types'

const STUB_DELAY_MS = 450

export const ChatService = {
  async send(request: ChatRequest): Promise<ChatResponse> {
    await new Promise((resolve) => setTimeout(resolve, STUB_DELAY_MS))
    const contexto =
      request.contexto.length > 0
        ? request.contexto.join(', ')
        : 'ningún departamento seleccionado'
    return {
      respuesta: `Recibí tu pregunta «${request.pregunta}» y la llevaré al asistente con contexto de ${contexto}. El modelo se conecta aquí cuando el servicio esté disponible.`,
    }
  },
}