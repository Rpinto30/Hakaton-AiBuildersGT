import type { ReactNode } from 'react'
import {
  ArrowLeft,
  BarChart3,
  GraduationCap,
  School,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PrioridadSection } from '@/components/dashboard/PrioridadSection'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useDashboardData } from '@/features/dashboard'
import type { DashboardRow, DistribucionRow } from '@/features/dashboard'

const JADE = ['#bce8d8', '#8fdcc2', '#5cc3a3', '#33a884', '#1f8a6b', '#0e3a30']
const GOLD = '#d8a03a'
const VOLC = '#46564f'

const enteros = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 })
const decimales = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 1 })

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: ReactNode
}) {
  return (
    <Card className="rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-wide text-volc-400">
          {label}
        </p>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-jade-950 text-gold-300">
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold leading-none text-jade-900">
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm leading-snug text-volc-500">{hint}</p> : null}
    </Card>
  )
}

/**
 * Cada gráfica va con su lectura escrita. El reto lo pide explícitamente: no
 * basta con mostrar la visualización, hay que decir qué significa. El texto se
 * calcula de los mismos datos, nunca se escribe a mano, para que no se
 * desactualice cuando cambien las cifras.
 */
function ChartShell({
  title,
  subtitle,
  analysis,
  alto = 'h-80',
  children,
}: {
  title: string
  subtitle: string
  analysis: ReactNode
  /** Alto del área de dibujo. El ranking de 22 barras necesita más que el resto. */
  alto?: string
  children: ReactNode
}) {
  return (
    <Card className="flex min-h-0 flex-col rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-jade-900">{title}</h2>
      <p className="mt-1 text-sm text-volc-500">{subtitle}</p>
      <div className={`mt-4 w-full ${alto}`}>{children}</div>
      <p className="mt-4 border-t border-volc-900/10 pt-3 text-[15px] leading-relaxed text-volc-600">
        {analysis}
      </p>
    </Card>
  )
}

function shortName(nombre: string): string {
  return nombre.length > 11 ? `${nombre.slice(0, 10)}…` : nombre
}

const tooltipStyle = {
  borderRadius: 12,
  borderColor: '#e8ecea',
  fontSize: 14,
} as const

function nombreDelPunto(payload: ReadonlyArray<{ payload?: { nombre?: string } }> | undefined) {
  return String(payload?.[0]?.payload?.nombre ?? '')
}

function Aviso({ children, tono }: { children: ReactNode; tono: 'carga' | 'error' }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span
        className={
          tono === 'error'
            ? 'flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gold-500 shadow-sm'
            : 'flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-jade-600 shadow-sm'
        }
      >
        {tono === 'error' ? <TriangleAlert size={20} /> : <Spinner className="h-5 w-5" />}
      </span>
      <div className="max-w-md text-[15px] leading-relaxed text-volc-600">{children}</div>
    </div>
  )
}

export function DashboardPage() {
  const { loading, error, resumen, rows, porNivel, porSector, porArea } =
    useDashboardData()

  const contenido = () => {
    if (loading) return <Aviso tono="carga">Consultando la base de datos…</Aviso>
    if (error !== null || resumen === null) {
      return (
        <Aviso tono="error">
          <p className="font-display text-base font-semibold text-jade-900">
            No se pudieron cargar las cifras
          </p>
          <p className="mt-2">{error ?? 'La API no devolvió datos.'}</p>
          <p className="mt-3 text-volc-500">
            Levanta la base con <code className="rounded bg-white px-1.5 py-0.5 font-mono text-jade-800">docker compose up -d db</code>{' '}
            y la API con{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-jade-800">uvicorn api.main:app --port 8000</code>.
          </p>
        </Aviso>
      )
    }

    const peorPromocion = [...rows].sort((a, b) => a.promocion - b.promocion)
    const mayorRepitencia = [...rows].sort((a, b) => b.repitencia - a.repitencia)
    const promocionPorDepto = peorPromocion.map((row) => ({
      ...row,
      label: shortName(row.nombre),
    }))
    const brecha = peorPromocion.length
      ? peorPromocion[peorPromocion.length - 1].promocion - peorPromocion[0].promocion
      : 0

    const nivelesConMatricula = porNivel.filter((fila) => fila.total > 0)
    const nivelMasDebil = [...nivelesConMatricula].sort(
      (a, b) => a.promocion - b.promocion,
    )[0]
    const nivelMayor = [...nivelesConMatricula].sort((a, b) => b.total - a.total)[0]

    const sectorArea: DistribucionRow[] = [...porSector, ...porArea]
    const rural = porArea.find((fila) => fila.etiqueta === 'Rural')
    const urbana = porArea.find((fila) => fila.etiqueta === 'Urbana')
    const publico = porSector.find((fila) => fila.etiqueta === 'Público')
    const privado = porSector.find((fila) => fila.etiqueta === 'Privado')

    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <p className="text-sm text-volc-500">
          Censo administrativo <strong>Educación Formal 2024</strong> del INE ·{' '}
          {enteros.format(resumen.inscripciones)} inscripciones ·{' '}
          {resumen.municipios} municipios · cifras leídas de Postgres.
        </p>

        <section
          aria-label="Indicadores clave"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label="Inscripciones"
            value={enteros.format(resumen.inscripciones)}
            hint={`Ciclo 2024 · ${resumen.departamentos} departamentos`}
            icon={<Users size={18} aria-hidden="true" />}
          />
          <KpiCard
            label="Escuelas"
            value={enteros.format(resumen.escuelas)}
            hint="Establecimientos distintos, sin contar dos veces los que atienden varios niveles"
            icon={<School size={18} aria-hidden="true" />}
          />
          <KpiCard
            label="Tasa de promoción"
            value={`${decimales.format(resumen.tasa_promocion)} %`}
            hint={`No promoción ${decimales.format(resumen.tasa_no_promocion)} % · retiro ${decimales.format(resumen.tasa_retiro)} %`}
            icon={<GraduationCap size={18} aria-hidden="true" />}
          />
          <KpiCard
            label="Tasa de repitencia"
            value={`${decimales.format(resumen.tasa_repitencia)} %`}
            hint="Inscripciones que repiten el grado que cursan"
            icon={<BarChart3 size={18} aria-hidden="true" />}
          />
        </section>

        <ChartShell
          title="Promoción por departamento"
          subtitle="De menor a mayor · porcentaje de inscripciones promovidas"
          alto="h-[34rem]"
          analysis={
            peorPromocion.length > 0 ? (
              <>
                <strong>{peorPromocion[0].nombre}</strong> tiene la promoción más
                baja del país ({decimales.format(peorPromocion[0].promocion)} %) y{' '}
                <strong>{peorPromocion[peorPromocion.length - 1].nombre}</strong> la
                más alta ({decimales.format(peorPromocion[peorPromocion.length - 1].promocion)} %):{' '}
                {decimales.format(brecha)} puntos de diferencia entre vivir en uno u
                otro. La tasa cuenta sobre todas las inscripciones, incluidas las
                retiradas, así que promoción, no promoción y retiro no suman 100 %.
              </>
            ) : null
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={promocionPorDepto}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ecea" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: VOLC, fontSize: 13 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={112}
                interval={0}
                tick={{ fill: '#2b3a34', fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [`${decimales.format(Number(value))} %`, 'Promoción']}
                labelFormatter={(_, payload) => nombreDelPunto(payload)}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="promocion" radius={[0, 6, 6, 0]}>
                {promocionPorDepto.map((row, index) => (
                  <Cell key={row.nombre} fill={JADE[Math.min(index >> 2, JADE.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <section className="grid gap-5 lg:grid-cols-2">
          <ChartShell
            title="Matrícula por nivel"
            subtitle="Inscripciones del ciclo 2024"
            analysis={
              nivelMayor && nivelMasDebil ? (
                <>
                  <strong>{nivelMayor.etiqueta}</strong> concentra{' '}
                  {decimales.format((100 * nivelMayor.total) / resumen.inscripciones)} % de
                  la matrícula. El nivel con peor promoción es{' '}
                  <strong>{nivelMasDebil.etiqueta}</strong> (
                  {decimales.format(nivelMasDebil.promocion)} %), y ahí es donde un
                  punto de mejora rinde más estudiantes.
                </>
              ) : null
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={nivelesConMatricula.map((fila) => ({ ...fila, nombre: fila.etiqueta }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecea" />
                <XAxis dataKey="etiqueta" tick={{ fill: VOLC, fontSize: 12 }} />
                <YAxis
                  tick={{ fill: VOLC, fontSize: 12 }}
                  tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => [enteros.format(Number(value)), 'Inscripciones']}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="total" fill="#1f8a6b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell
            title="Promoción por sector y área"
            subtitle="Quién administra la escuela y dónde está"
            analysis={
              rural && urbana && publico && privado ? (
                <>
                  El área rural concentra{' '}
                  {decimales.format((100 * rural.total) / resumen.inscripciones)} % de la
                  matrícula y promueve {decimales.format(rural.promocion)} %, frente a{' '}
                  {decimales.format(urbana.promocion)} % en la urbana. Entre sectores la
                  brecha es mayor: privado {decimales.format(privado.promocion)} % contra
                  público {decimales.format(publico.promocion)} %. Son poblaciones
                  distintas, no escuelas comparables una a una.
                </>
              ) : null
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sectorArea}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecea" />
                <XAxis dataKey="etiqueta" tick={{ fill: VOLC, fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: VOLC, fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${decimales.format(Number(value))} %`, 'Promoción']}
                  contentStyle={tooltipStyle}
                />
                <Legend />
                <Bar dataKey="promocion" name="Promoción" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </section>

        <PrioridadSection />

        <Card className="rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-jade-900">
            Repitencia más alta
          </h2>
          <p className="mt-1 text-sm text-volc-500">
            Porcentaje de inscripciones que repiten el grado · los 10 primeros
          </p>
          <ol className="mt-4 divide-y divide-volc-900/10">
            {mayorRepitencia.slice(0, 10).map((row: DashboardRow, index) => (
              <li
                key={row.nombre}
                className="flex items-center justify-between gap-3 py-3 text-base"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: index < 3 ? GOLD : '#1f8a6b' }}
                  >
                    {index + 1}
                  </span>
                  <span className="font-medium text-volc-900">{row.nombre}</span>
                </span>
                <span className="font-display text-xl font-semibold text-jade-900">
                  {decimales.format(row.repitencia)} %
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-volc-900/10 pt-3 text-[15px] leading-relaxed text-volc-600">
            La repitencia nacional es {decimales.format(resumen.tasa_repitencia)} %.
            Repetir grado no aparece en el dataset como causa ni consecuencia: solo
            se sabe que el estudiante está cursando de nuevo el mismo grado en 2024.
          </p>
        </Card>

        <p className="pb-2 text-center text-sm text-volc-400">
          Fuente: INE, Educación Formal 2024. Un registro es una inscripción, no
          una persona: el dataset no trae identificador de estudiante.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-petate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-volc-900/10 bg-jade-950 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-jade-800 text-gold-300">
            <BarChart3 size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-jade-300">
              Guate Datos
            </p>
            <h1 className="font-display text-2xl font-semibold leading-tight text-petate-100">
              Dashboard nacional
            </h1>
          </div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-2.5 text-base font-semibold text-jade-950 shadow-sm transition-colors hover:bg-gold-300"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Volver al mapa
        </Link>
      </header>

      <div className="scrollbar-thin-volc min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {contenido()}
      </div>
    </div>
  )
}
