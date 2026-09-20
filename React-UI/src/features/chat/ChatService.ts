import { enviar } from '@/features/api'
import type { RespuestaChat as RespuestaApi } from '@/features/api'

import type { ChatRequest, ChatResponse } from './types'

// El agente llama al modelo dos veces y consulta Postgres entre medias: lo normal
// son ~5 s, pero una pregunta con varias consultas pasa de los 15 s del resto de la API.
const TIEMPO_LIMITE_CHAT_MS = 60_000

/**
 * Habla con POST /api/chat.
 *
 * Responde un agente: un modelo de lenguaje que no conoce las cifras y las pide
 * a la base con consultas cerradas, usando las mismas definiciones que las
 * tablas `agg_*` del dashboard. Si no hay llave de OpenAI o el modelo falla,
 * el backend responde con un buscador determinista y `conIa` viene en false.
 */
export const ChatService = {
  async send(request: ChatRequest): Promise<ChatResponse> {
    const respuesta = await enviar<RespuestaApi>(
      '/api/chat',
      request,
      TIEMPO_LIMITE_CHAT_MS,
    )
    return {
      respuesta: respuesta.respuesta,
      conIa: respuesta.con_ia,
      consultas: respuesta.consultas,
    }
  },
}
