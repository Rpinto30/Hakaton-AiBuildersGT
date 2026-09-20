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
}