import type { ReactNode } from 'react'
import {
  ArrowLeft,
  BarChart3,
  GraduationCap,
  MapPinned,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

import { Card } from '@/components/ui/Card'
import { useDashboardData } from '@/features/dashboard'
import { formatValue } from '@/features/departments'

const JADE = ['#bce8d8', '#8fdcc2', '#5cc3a3', '#33a884', '#1f8a6b', '#0e3a30']
const GOLD = '#d8a03a'
const VOLC = '#46564f'

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

function ChartShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <Card className="flex min-h-0 flex-col rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-jade-900">{title}</h2>
      <p className="mt-1 text-sm text-volc-500">{subtitle}</p>
      <div className="mt-4 h-80 w-full">{children}</div>
    </Card>
  )
}

function shortName(nombre: string): string {
  return nombre.length > 11 ? `${nombre.slice(0, 10)}…` : nombre
}

export function DashboardPage() {
  const { kpis, byPoblacion, byPobreza, rows } = useDashboardData()
  const topPoblacion = byPoblacion.slice(0, 10).map((row) => ({
    ...row,
    label: shortName(row.nombre),
  }))

  const eduPoverty = [...rows]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((row) => ({
      nombre: row.nombre,
      label: shortName(row.nombre),
      pobreza: Number((row.pobreza * 100).toFixed(1)),
      educativo: Number((row.educativo * 100).toFixed(1)),
    }))

  const densityDist = [...rows]
    .sort((a, b) => a.densidad - b.densidad)
    .map((row) => ({
      nombre: row.nombre,
      label: shortName(row.nombre),
      densidad: row.densidad,
    }))

  const scatter = rows.map((row) => ({
    nombre: row.nombre,
    area: row.area,
    densidad: row.densidad,
    poblacion: row.poblacion,
  }))

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
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <p className="text-sm text-volc-500">
            Estadísticas de ejemplo desde{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-jade-800">
              resources/departamentos-data.example.json
            </code>
            . Sin datos reales todavía.
          </p>

          <section
            aria-label="Indicadores clave"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <KpiCard
              label="Población total"
              value={`${formatValue(Number(kpis.poblacionTotal.toFixed(2)))} M`}
              hint="Suma mock 2024 · 22 departamentos"
              icon={<Users size={18} aria-hidden="true" />}
            />
            <KpiCard
              label="Área total"
              value={`${formatValue(Math.round(kpis.areaTotal))} km²`}
              hint="Cobertura nacional en el JSON"
              icon={<MapPinned size={18} aria-hidden="true" />}
            />
            <KpiCard
              label="Educación media"
              value={`${Math.round(kpis.educativoMedia * 100)}%`}
              hint="Promedio del índice educativo"
              icon={<GraduationCap size={18} aria-hidden="true" />}
            />
            <KpiCard
              label="Pobreza media"
              value={`${Math.round(kpis.pobrezaMedia * 100)}%`}
              hint="Promedio del índice de pobreza"
              icon={<BarChart3 size={18} aria-hidden="true" />}
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <ChartShell
              title="Población por departamento"
              subtitle="Top 10 · millones de habitantes"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topPoblacion}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ecea" />
                  <XAxis type="number" tick={{ fill: VOLC, fontSize: 13 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={108}
                    tick={{ fill: '#2b3a34', fontSize: 13 }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${formatValue(Number(value))} M`,
                      'Población',
                    ]}
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.nombre ?? '')
                    }
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: '#e8ecea',
                      fontSize: 14,
                    }}
                  />
                  <Bar dataKey="poblacion" radius={[0, 6, 6, 0]}>
                    {topPoblacion.map((row, index) => (
                      <Cell key={row.nombre} fill={JADE[index % JADE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              title="Educación vs pobreza"
              subtitle="Índices en % · los 22 departamentos"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={eduPoverty}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ecea" />
                  <XAxis dataKey="label" hide />
                  <YAxis
                    tick={{ fill: VOLC, fontSize: 13 }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.nombre ?? '')
                    }
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: '#e8ecea',
                      fontSize: 14,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="educativo"
                    name="Educación"
                    stroke="#1f8a6b"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pobreza"
                    name="Pobreza"
                    stroke={GOLD}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              title="Densidad poblacional"
              subtitle="Hab/km² ordenado de menor a mayor"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={densityDist}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ecea" />
                  <XAxis dataKey="label" hide />
                  <YAxis tick={{ fill: VOLC, fontSize: 13 }} />
                  <Tooltip
                    formatter={(value) => [value, 'Densidad']}
                    labelFormatter={(_, payload) =>
                      String(payload?.[0]?.payload?.nombre ?? '')
                    }
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: '#e8ecea',
                      fontSize: 14,
                    }}
                  />
                  <Bar dataKey="densidad" fill="#33a884" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              title="Área vs densidad"
              subtitle="Burbuja ≈ población (millones)"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ecea" />
                  <XAxis
                    type="number"
                    dataKey="area"
                    name="Área"
                    tick={{ fill: VOLC, fontSize: 13 }}
                    tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                  />
                  <YAxis
                    type="number"
                    dataKey="densidad"
                    name="Densidad"
                    tick={{ fill: VOLC, fontSize: 13 }}
                  />
                  <ZAxis type="number" dataKey="poblacion" range={[50, 320]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => [value, String(name)]}
                    labelFormatter={() => ''}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: '#e8ecea',
                      fontSize: 14,
                    }}
                  />
                  <Scatter data={scatter} fill="#1f8a6b" fillOpacity={0.75} />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartShell>
          </section>

          <Card className="rounded-2xl border border-volc-900/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-jade-900">
              Ranking de pobreza
            </h2>
            <p className="mt-1 text-sm text-volc-500">
              Más alto primero · comparación entre departamentos
            </p>
            <ol className="mt-4 divide-y divide-volc-900/10">
              {byPobreza.slice(0, 10).map((row, index) => (
                <li
                  key={row.nombre}
                  className="flex items-center justify-between gap-3 py-3 text-base"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{
                        backgroundColor: index < 3 ? GOLD : '#1f8a6b',
                      }}
                    >
                      {index + 1}
                    </span>
                    <span className="font-medium text-volc-900">{row.nombre}</span>
                  </span>
                  <span className="font-display text-xl font-semibold text-jade-900">
                    {Math.round(row.pobreza * 100)}%
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <p className="pb-2 text-center text-sm text-volc-400">
            Reemplaza el JSON en resources/ cuando existan cifras reales.
          </p>
        </div>
      </div>
    </div>
  )
}
