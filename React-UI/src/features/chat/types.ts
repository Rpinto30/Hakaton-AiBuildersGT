import type { DepartmentData } from '@/features/departments'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  pregunta: string
  contexto: string[]
  departamentos?: DepartmentData[]
}

export interface ChatResponse {
  respuesta: string
}