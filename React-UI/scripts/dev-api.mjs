/**
 * Levanta la API de FastAPI desde `npm run dev`.
 *
 * Existe para no depender de que quien clone tenga el entorno virtual activado:
 * busca el intérprete del .venv de la raíz del repo (Windows y POSIX tienen
 * rutas distintas) y solo si no aparece cae a `python` del PATH.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const candidatos = [
  join(raizRepo, '.venv', 'Scripts', 'python.exe'), // Windows
  join(raizRepo, '.venv', 'bin', 'python'), // macOS / Linux
]

const python = candidatos.find((ruta) => existsSync(ruta))

if (python === undefined) {
  console.warn(
    '[api] No encontré .venv en la raíz del repo; uso "python" del PATH.\n' +
      '[api] Si falla: crea el entorno con `python -m venv .venv` e instala\n' +
      '[api] las dependencias con `pip install -r requirements.txt`.',
  )
}

const proceso = spawn(
  python ?? 'python',
  ['-m', 'uvicorn', 'api.main:app', '--reload', '--port', '8000'],
  { cwd: raizRepo, stdio: 'inherit' },
)

proceso.on('error', (error) => {
  console.error(`[api] No se pudo arrancar uvicorn: ${error.message}`)
  process.exit(1)
})

proceso.on('exit', (codigo) => process.exit(codigo ?? 0))
