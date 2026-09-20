import { enviar } from '@/features/api'
import type { RespuestaChat as RespuestaApi } from '@/features/api'

import type { ChatRequest, ChatResponse } from './types'

/**
 * Habla con POST /api/chat.
 *
 * El backend responde leyendo las mismas tablas `agg_*` que alimentan el
 * dashboard, así que el chat nunca puede dar una cifra distinta a la de las
 * gráficas. Mientras `con_ia` sea false, la redacción la arma un buscador
 * determinista, no un modelo de lenguaje.
 */
export const ChatService = {
  async send(request: ChatRequest): Promise<ChatResponse> {
    const respuesta = await enviar<RespuestaApi>('/api/chat', {
      pregunta: request.pregunta,
      contexto: request.contexto,
    })
    return { respuesta: respuesta.respuesta, conIa: respuesta.con_ia }
  },
}
