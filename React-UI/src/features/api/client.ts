/**
 * Cliente HTTP de la API.
 *
 * En desarrollo las rutas `/api/*` las reenvía el proxy de Vite al backend en
 * :8000 (ver vite.config.ts), así que no hace falta CORS ni una variable de
 * entorno con la URL. En producción se sirve todo desde el mismo origen.
 */

const TIEMPO_LIMITE_MS = 15_000

/** Error con el mensaje que devolvió la API, no uno genérico de red. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function leerDetalle(response: Response): Promise<string> {
  try {
    const cuerpo = (await response.json()) as { detail?: unknown }
    if (typeof cuerpo.detail === 'string') return cuerpo.detail
  } catch {
    // La respuesta no era JSON; se usa el texto de estado.
  }
  return `${response.status} ${response.statusText}`
}

async function pedir<T>(
  ruta: string,
  init?: RequestInit,
  tiempoLimiteMs = TIEMPO_LIMITE_MS,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(ruta, {
      ...init,
      signal: AbortSignal.timeout(tiempoLimiteMs),
    })
  } catch (error) {
    const causa = error instanceof Error ? error.message : String(error)
    throw new ApiError(
      `No se pudo contactar la API en ${ruta}. ¿Está corriendo el backend? (${causa})`,
      0,
    )
  }

  if (!response.ok) throw new ApiError(await leerDetalle(response), response.status)
  return (await response.json()) as T
}

export function obtener<T>(ruta: string): Promise<T> {
  return pedir<T>(ruta)
}

export function enviar<T>(
  ruta: string,
  cuerpo: unknown,
  tiempoLimiteMs?: number,
): Promise<T> {
  return pedir<T>(
    ruta,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    },
    tiempoLimiteMs,
  )
}
