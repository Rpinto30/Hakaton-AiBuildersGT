export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  pregunta: string
  contexto: string[]
}

export interface ChatResponse {
  respuesta: string
  /** False mientras responda el buscador determinista, sin modelo de lenguaje. */
  conIa: boolean
}
