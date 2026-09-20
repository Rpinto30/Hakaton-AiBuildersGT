import { useMemo, useState } from 'react'
import { ChevronDown, Scale, Search, X } from 'lucide-react'

import { Spinner } from '@/components/ui/Spinner'
import {
  MAXIMO_SELECCIONADOS,
  useComparadorDatos,
  useComparadorStore,
} from '@/features/comparador'
import type { Ambito } from '@/features/comparador'
import type { FilaAgregada } from '@/features/api'
import { cn } from '@/lib/cn'

const enteros = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 })
const decimales = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 1 })

/** Las filas de la tabla comparativa. `mejorEsMayor` decide a quién se resalta. */
const METRICAS = [
  { clave: 'total', etiqueta: 'Inscripciones', formato: 'entero', mejorEsMayor: true },
  { clave: 'tasa_promocion', etiqueta: 'Promoción', formato: 'pct', mejorEsMayor: true },
  { clave: 'tasa_no_promocion', etiqueta: 'No promoción', formato: 'pct', mejorEsMayor: false },
  { clave: 'tasa_retiro', etiqueta: 'Retiro', formato: 'pct', mejorEsMayor: false },
  { clave: 'tasa_repitencia', etiqueta: 'Repitencia', formato: 'pct', mejorEsMayor: false },
  { clave: 'graduandos', etiqueta: 'Graduandos', formato: 'entero', mejorEsMayor: true },
] as const

function valorDe(fila: FilaAgregada, clave: (typeof METRICAS)[number]['clave']): number {
  return fila[clave]
}

function formatear(valor: number, formato: 'entero' | 'pct'): string {
  return formato === 'pct'
    ? `${decimales.format(valor)} %`
    : enteros.format(valor)
}

/** Quita tildes para que "Coban" encuentre "Cobán": nadie las escribe al buscar. */
function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

const AMBITOS: Array<{ valor: Ambito; etiqueta: string }> = [
  { valor: 'departamento', etiqueta: 'Departamentos' },
  { valor: 'municipio', etiqueta: 'Municipios' },
]

function Selector() {
  const ambito = useComparadorStore((estado) => estado.ambito)
  const seleccion = useComparadorStore((estado) => estado.seleccion)
  const alternarClave = useComparadorStore((estado) => estado.alternarClave)
  const { filas, cargando } = useComparadorDatos()
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => {
    const aguja = sinTildes(busqueda.trim())
    const coinciden =
      aguja === ''
        ? filas
        : filas.filter(
            (fila) =>
              sinTildes(fila.etiqueta).includes(aguja) ||
              sinTildes(fila.padre ?? '').includes(aguja),
          )
    // Con 340 municipios la lista completa no se puede mostrar de golpe.
    return coinciden.slice(0, 60)
  }, [filas, busqueda])

  const lleno = seleccion.length >= MAXIMO_SELECCIONADOS

  return (
    <div className="flex w-full flex-col gap-2 lg:w-64 lg:shrink-0">
      <label className="relative block">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-volc-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder={ambito === 'municipio' ? 'Buscar municipio…' : 'Buscar departamento…'}
          aria-label="Buscar"
          className="w-full rounded-lg border border-volc-900/15 bg-white py-2 pl-9 pr-3 text-[14px] text-volc-900 outline-none placeholder:text-volc-400 focus:border-jade-600"
        />
      </label>

      <div className="scrollbar-thin-volc h-40 overflow-y-auto rounded-lg border border-volc-900/10 bg-white lg:h-48">
        {cargando ? (
          <p className="flex items-center gap-2 px-3 py-3 text-[14px] text-volc-500">
            <Spinner className="h-3.5 w-3.5" /> Cargando…
          </p>
        ) : visibles.length === 0 ? (
          <p className="px-3 py-3 text-[14px] text-volc-500">Sin coincidencias.</p>
        ) : (
          <ul>
            {visibles.map((fila) => {
              const elegido = seleccion.includes(fila.clave)
              return (
                <li key={fila.clave}>
                  <button
                    type="button"
                    onClick={() => alternarClave(fila.clave)}
                    disabled={!elegido && lleno}
                    className={cn(
                      'flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-[14px] transition-colors',
                      elegido
                        ? 'bg-jade-950 text-petate-100'
                        : 'text-volc-700 hover:bg-petate-100 disabled:cursor-not-allowed disabled:text-volc-300',
                    )}
                  >
                    <span className="truncate">{fila.etiqueta}</span>
                    {fila.padre !== null ? (
                      <span
                        className={cn(
                          'shrink-0 text-[12px]',
                          elegido ? 'text-jade-300' : 'text-volc-400',
                        )}
                      >
                        {fila.padre}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-[13px] text-volc-500">
        {seleccion.length} de {MAXIMO_SELECCIONADOS} elegidos
        {lleno ? ' · quita uno para cambiar' : ''}
      </p>
    </div>
  )
}

function Tabla() {
  const { seleccionadas, error } = useComparadorDatos()
  const alternarClave = useComparadorStore((estado) => estado.alternarClave)

  if (error !== null) {
    return (
      <p className="flex-1 px-1 py-6 text-[15px] leading-relaxed text-volc-600">
        No se pudieron cargar las cifras: {error}
      </p>
    )
  }

  if (seleccionadas.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8 text-center">
        <p className="max-w-sm text-[15px] leading-relaxed text-volc-500">
          Elige hasta {MAXIMO_SELECCIONADOS} de la lista para compararlos lado a
          lado. También puedes hacer clic en un departamento del mapa.
        </p>
      </div>
    )
  }

  return (
    <div className="scrollbar-thin-volc min-w-0 flex-1 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-[14px]">
        <thead>
          <tr>
            <th scope="col" className="w-36 px-2 py-2 text-left font-medium text-volc-400">
              Indicador
            </th>
            {seleccionadas.map((fila) => (
              <th key={fila.clave} scope="col" className="px-2 py-2 text-right">
                <span className="flex items-center justify-end gap-1.5">
                  <span className="truncate font-display text-[15px] font-semibold text-jade-900">
                    {fila.etiqueta}
                  </span>
                  <button
                    type="button"
                    onClick={() => alternarClave(fila.clave)}
                    aria-label={`Quitar ${fila.etiqueta}`}
                    className="shrink-0 rounded text-volc-400 transition-colors hover:text-volc-900"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </span>
                {fila.padre !== null ? (
                  <span className="block text-[12px] font-normal text-volc-400">
                    {fila.padre}
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICAS.map((metrica) => {
            const valores = seleccionadas.map((fila) => valorDe(fila, metrica.clave))
            // Con una sola columna no hay nada que comparar, así que no se resalta.
            const destacado =
              valores.length < 2
                ? null
                : metrica.mejorEsMayor
                  ? Math.max(...valores)
                  : Math.min(...valores)

            return (
              <tr key={metrica.clave} className="border-t border-volc-900/10">
                <th scope="row" className="px-2 py-2 text-left font-normal text-volc-500">
                  {metrica.etiqueta}
                </th>
                {seleccionadas.map((fila, indice) => (
                  <td
                    key={fila.clave}
                    className={cn(
                      'px-2 py-2 text-right tabular-nums',
                      destacado !== null && valores[indice] === destacado
                        ? 'font-display font-semibold text-jade-800'
                        : 'text-volc-700',
                    )}
                  >
                    {formatear(valores[indice], metrica.formato)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-2 pb-1 pt-3 text-[13px] leading-relaxed text-volc-400">
        Resaltado el mejor valor de cada fila. Las tasas se calculan sobre el
        total del grupo, incluidas las inscripciones vigentes e ignoradas.
      </p>
    </div>
  )
}

/**
 * Cajón inferior para comparar departamentos o municipios.
 *
 * Va abajo y colapsado por defecto para no robarle espacio al mapa, que es el
 * elemento principal de la pantalla.
 */
export function ComparadorPanel() {
  const abierto = useComparadorStore((estado) => estado.abierto)
  const alternar = useComparadorStore((estado) => estado.alternar)
  const ambito = useComparadorStore((estado) => estado.ambito)
  const cambiarAmbito = useComparadorStore((estado) => estado.cambiarAmbito)
  const seleccion = useComparadorStore((estado) => estado.seleccion)
  const limpiar = useComparadorStore((estado) => estado.limpiar)

  return (
    <section
      aria-label="Comparador"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[600] border-t border-volc-900/10 bg-petate-100/97 shadow-[0_-2px_12px_rgb(27_36_31/0.08)] backdrop-blur"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => alternar()}
          aria-expanded={abierto}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] font-semibold text-jade-900 transition-colors hover:bg-volc-900/5"
        >
          <Scale size={16} className="text-jade-600" aria-hidden="true" />
          Comparar
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={cn('text-volc-500 transition-transform', abierto && 'rotate-180')}
          />
        </button>

        {seleccion.length > 0 ? (
          <span className="rounded-full bg-jade-950 px-2 py-0.5 text-[12px] font-medium text-petate-100">
            {seleccion.length}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {AMBITOS.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => cambiarAmbito(opcion.valor)}
              aria-pressed={ambito === opcion.valor}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[14px] transition-colors',
                ambito === opcion.valor
                  ? 'bg-jade-950 font-medium text-petate-100'
                  : 'text-volc-600 hover:bg-volc-900/5',
              )}
            >
              {opcion.etiqueta}
            </button>
          ))}
          {seleccion.length > 0 ? (
            <button
              type="button"
              onClick={() => limpiar()}
              className="ml-1 rounded-lg px-2 py-1.5 text-[14px] text-volc-500 transition-colors hover:bg-volc-900/5 hover:text-volc-900"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      {abierto ? (
        <div className="flex max-h-[19rem] flex-col gap-4 overflow-y-auto border-t border-volc-900/10 px-3 py-3 lg:flex-row lg:overflow-visible">
          <Selector />
          <Tabla />
        </div>
      ) : null}
    </section>
  )
}
