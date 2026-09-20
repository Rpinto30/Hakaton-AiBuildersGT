import type { ConsultaDelAgente } from '@/features/api'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/** Un mensaje anterior, tal como lo espera la API para entender seguimientos. */
export interface ChatTurn {
  role: Message['role']
  content: string
}

export interface ChatRequest {
  pregunta: string
  contexto: string[]
  historial: ChatTurn[]
}

export interface ChatResponse {
  respuesta: string
  /** False si respondió el buscador determinista (sin llave o sin modelo). */
  conIa: boolean
  /** Qué consultó el agente para responder: de aquí sale cada cifra. */
  consultas: ConsultaDelAgente[]
}
