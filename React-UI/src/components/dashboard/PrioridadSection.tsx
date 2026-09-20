import { Info, Target } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { usePrioridad } from '@/features/dashboard'

const enteros = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 })
const decimales = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 1 })

const CUANTOS = 12

/**
 * Municipios que promueven menos de lo que promueven otros municipios con una
 * composición parecida.
 *
 * El aviso de alcance no es decorativo: el dataset trae un solo ciclo, sin
 * notas ni datos socioeconómicos, así que el modelo asocia, no explica. Decirlo
 * en la pantalla evita que alguien lea el ranking como una lista de culpables.
 */
export function PrioridadSection() {
  const { cargando, error, datos } = usePrioridad()

  if (cargando) {
    return (
      <Card className="rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
        <p className="flex items-center gap-2 text-[15px] text-volc-500">
          <Spinner className="h-4 w-4 text-jade-600" /> Ajustando el modelo…
        </p>
      </Card>
    )
  }

  if (error !== null || datos === null) {
    return (
      <Card className="rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-jade-900">
          Dónde mirar primero
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-volc-600">
          No se pudo calcular: {error ?? 'la API no devolvió datos.'}
        </p>
        <p className="mt-2 text-[14px] text-volc-500">
          Requiere{' '}
          <code className="rounded bg-petate-100 px-1.5 py-0.5 font-mono text-jade-800">
            tablas/05_perfil_municipio.sql
          </code>{' '}
          y{' '}
          <code className="rounded bg-petate-100 px-1.5 py-0.5 font-mono text-jade-800">
            CALL refresh_perfil_municipio()
          </code>
          .
        </p>
      </Card>
    )
  }

  const peores = datos.municipios.filter((m) => m.brecha < 0).slice(0, CUANTOS)
  const totalAfectados = peores.reduce(
    (suma, m) => suma + m.estudiantes_bajo_lo_esperado,
    0,
  )

  return (
    <Card className="rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-jade-900">
            Dónde mirar primero
          </h2>
          <p className="mt-1 text-sm text-volc-500">
            Municipios que promueven menos que otros de composición parecida
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-jade-950 text-gold-300">
          <Target size={18} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-volc-900/10 text-volc-400">
              <th scope="col" className="px-2 py-2 text-left font-medium">Municipio</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Matrícula</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Promoción</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Esperada</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Brecha</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Estudiantes</th>
            </tr>
          </thead>
          <tbody>
            {peores.map((m) => (
              <tr key={m.municipio_codigo} className="border-b border-volc-900/5">
                <td className="px-2 py-2">
                  <span className="font-medium text-volc-900">{m.municipio}</span>
                  <span className="block text-[12px] text-volc-400">{m.departamento}</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-volc-600">
                  {enteros.format(m.total)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-volc-700">
                  {decimales.format(m.tasa_promocion)} %
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-volc-400">
                  {decimales.format(m.esperado)} %
                </td>
                <td className="px-2 py-2 text-right font-display font-semibold tabular-nums text-gold-600">
                  {decimales.format(m.brecha)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-volc-700">
                  {enteros.format(m.estudiantes_bajo_lo_esperado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-volc-900/10 pt-3 text-[15px] leading-relaxed text-volc-600">
        Estos {peores.length} municipios suman{' '}
        <strong>{enteros.format(totalAfectados)} inscripciones</strong> por debajo
        de lo que su propia composición hacía esperar. Ordenar por esa brecha, y
        no por la tasa cruda, evita señalar a un municipio solo por ser rural o
        por atender sobre todo primaria: el modelo ya descuenta eso.
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-petate-100 px-3.5 py-3 text-[14px] leading-relaxed text-volc-600">
        <Info size={15} className="mt-0.5 shrink-0 text-volc-400" aria-hidden="true" />
        <p>
          <strong className="text-jade-900">Cómo leer esto.</strong> Una regresión
          ponderada por matrícula predice la promoción de cada municipio a partir
          de su composición (sector, área, nivel, pueblo de pertenencia) y explica{' '}
          {decimales.format(datos.r2 * 100)} % de la variación entre los{' '}
          {datos.municipios_ajustados} municipios. Es <strong>asociación, no
          causa</strong>: el dataset trae un solo ciclo, sin notas, sin datos
          socioeconómicos y sin seguimiento por estudiante. No proyecta otros años
          ni dice nada sobre los resultados de PISA, que no están en estos datos.
        </p>
      </div>
    </Card>
  )
}
