# Guate Datos — Mapa interactivo de departamentos

> Aplicación web que visualiza los datos de los **22 departamentos de Guatemala**
> sobre un mapa interactivo, con panel de detalle, asistente conversacional y
> dashboard de estadísticas.
>
> Proyecto del equipo **AI Builders GT** — Hackathon AIBuildersGT 2026.

![Estado](https://img.shields.io/badge/estado-en%20desarrollo-amarillo)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-4-38bdf8?logo=tailwindcss&logoColor=white)

---

## Tabla de contenidos

- [¿Qué hace?](#qué-hace)
- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Ejecución](#ejecución)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo funcionan los datos](#cómo-funcionan-los-datos)
- [Asistente de datos (chat)](#asistente-de-datos-chat)
- [Personalización](#personalización)
- [Scripts disponibles](#scripts-disponibles)
- [Atribución y licencia de datos](#atribución-y-licencia-de-datos)
- [Futuro](#futuro)
- [Documentación relacionada](#documentación-relacionada)

## ¿Qué hace?

**Guate Datos** carga en el navegador un JSON de métricas por departamento y lo
une con el GeoJSON de los 22 departamentos de Guatemala para mostrarlo sobre un
mapa (Leaflet). El usuario puede:

- **Explorar** el mapa: cada departamento es un polígono coloreado según la métrica
  detectada en los datos (mapa coroplético).
- **Pasar el cursor** sobre un departamento para ver un resumen rápido.
- **Hacer clic** en un departamento para ver sus cifras en el panel lateral derecho.
- **Preguntar** al asistente del panel izquierdo (funciona localmente sin backend).
- **Consultar** un dashboard con indicadores y gráficas comparativas nacionales.

Los datos viven en `resources/`, **fuera de `src/`**, para que se puedan reemplazar
sin tocar código: basta con actualizar los archivos y recargar la página.

## Características

- Mapa de los 22 departamentos con **polígonos GeoJSON** y capa coroplética
  (la métrica más poblada en datos numéricos se selecciona automáticamente).
- **Tooltips** al hacer hover con las métricas principales del departamento.
- **Panel de detalle** con todas las métricas del departamento seleccionado
  (y estado "sin datos" si el departamento no tiene entradas en el JSON).
- **Asistente conversacional** en español que responde con los datos cargados:
  resúmenes, comparaciones entre departamentos y rankings ("el más poblado",
  "la menor pobreza", "el mayor índice educativo", etc.).
  Conexión a un servicio real (p. ej. GrokBot) mediante `VITE_CHAT_ENDPOINT`.
- **Dashboard nacional** (`/dashboard`) con KPIs y gráficas (Recharts):
  población por departamento, educación vs. pobreza, densidad poblacional,
  área vs. densidad y ranking de pobreza.
- Paneles colapsables (chat y detalle), controles de zoom/reencuadre y
  atajos para abrir/cerrar paneles desde el mapa.
- **Layout responsive**: en pantallas pequeñas los paneles se abren con botones
  superpuestos al mapa en lugar de ocupar espacio lateral.
- Datos importados como módulos ES → **no requiere servidor ni conexión a BD**.

## Stack tecnológico

| Área | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estilos | Tailwind CSS v4 (tokens CSS propios: `jade`, `gold`, `petate`, `volc`) |
| Mapa | `react-leaflet` 5 + Leaflet 1.9 (tiles CARTO/OSM) |
| Estado global | Zustand 5 (stores por feature) |
| Gráficas | Recharts 3 |
| Enrutado | React Router 7 |
| Iconos | lucide-react |
| Utilidades | clsx + tailwind-merge (`cn()`) |
| Linter | oxlint |

## Requisitos

- **Node.js** `^20.19.0` o `>=22.12.0` (requerido por Vite 8).
- npm (o pnpm/yarn) incluido con Node.

## Instalación

```bash
npm install
```

Copia el archivo de ejemplo de variables de entorno (opcional):

```bash
cp .env.example .env
```

## Ejecución

```bash
npm run dev
```

Abre la URL que muestra Vite (por defecto `http://localhost:5173/`).

Rutas:

| Ruta | Contenido |
|---|---|
| `/` | Mapa interactivo con chat y panel de detalle |
| `/dashboard` | Dashboard nacional con KPIs y gráficas |

## Variables de entorno

Se definen en un archivo `.env` en la raíz (no se sube a git). Todas son
opcionales; si se dejan vacías la app usa valores por defecto.

| Variable | Descripción | Por defecto |
|---|---|---|
| `VITE_CHAT_ENDPOINT` | URL del backend del chatbot. Contrato: `POST {endpoint}` con `{ pregunta, contexto }` → `200 { respuesta }`. Vacía ⇒ el chat responde localmente con los datos de `resources/`. | *(vacío)* |
| `VITE_MAP_TILE_URL` | Plantilla de tiles del mapa (soporta `{s}`, `{z}`, `{x}`, `{y}`, `{r}`). | Tiles `light_all` de CARTO |
| `VITE_MAP_ATTRIBUTION` | Atribución mostrada en el mapa (HTML). | OSM + CARTO |

## Estructura del proyecto

```
React-UI/
│
├── index.html                     # HTML base (meta, fuentes, título)
├── vite.config.ts                 # Alias @ → src/ y @resources → resources/
├── package.json
├── .env.example                   # Variables de entorno de ejemplo
├── ARQUITECTURA.md                # Documento de arquitectura y decisiones
│
├── resources/                     # DATOS LOCALES (se reemplazan sin tocar código)
│   ├── guatemala-departments.geojson    # 22 polígonos (propiedad NOMBRE = clave de unión)
│   ├── departamentos-data.example.json  # Métricas por departamento (ejemplo)
│   └── README.md                        # Cómo reemplazar los datos reales
│
└── src/
    ├── main.tsx                   # Bootstrap de la app
    ├── App.tsx                    # Rutas (React Router)
    │
    ├── app/
    │   └── layout.tsx             # Layout 3 columnas: [Chat | Mapa | Detalle]
    │
    ├── components/
    │   ├── map/                   # Mapa y capas (Leaflet)
    │   │   ├── GuatemalaMap.tsx        # MapContainer + layer de tiles
    │   │   ├── DepartmentLayer.tsx     # Polígonos, coropletas, hover/click
    │   │   ├── DepartmentTooltip.tsx   # HTML del tooltip
    │   │   ├── MapControls.tsx         # Toogles, zoom, reset, enlace al dashboard
    │   │   ├── Legend.tsx              # Leyenda de la capa temática
    │   │   ├── FitBounds.tsx           # Encuadre inicial + reset
    │   │   └── MapEvents.tsx           # Clic en el mapa → deseleccionar
    │   ├── panels/
    │   │   ├── ChatPanel.tsx      # Sidebar izquierdo: chat de datos
    │   │   └── InfoPanel.tsx      # Sidebar derecho: detalle del departamento
    │   ├── ui/                    # Primitivos: Card, Badge, Toggle, Spinner
    │   ├── dashboard/             # (re-export de la página del dashboard)
    │   └── pages/
    │       └── DashboardPage.tsx  # Página /dashboard (KPIs + Recharts)
    │
    ├── features/                  # Módulos por funcionalidad
    │   ├── departments/           # Datos: parsers, join, formateo, hooks
    │   ├── chat/                  # ChatService + asistente local + useChat
    │   ├── dashboard/             # useDashboardData (KPIs, rankings)
    │   └── mapui/                 # Store Zustand del mapa + selectores
    │
    ├── store/
    │   └── uiStore.ts             # Estado de UI: paneles abiertos/cerrados
    │
    ├── lib/
    │   └── cn.ts                  # clsx + tailwind-merge
    │
    └── styles/
        └── index.css              # Tokens de tema, Tailwind v4, tooltips
```

## Cómo funcionan los datos

1. `useDepartmentsData` (`src/features/departments`) lee el GeoJSON y el JSON de
   métricas desde `resources/` (importados como módulos ES vía el alias
   `@resources`).
2. `parseDepartmentsJson` acepta **dos formatos**:
   - **Objeto keyed por nombre** (recomendado):
     ```json
     { "Petén": { "poblacion_2024": 0.65, "area_km2": 35854 } }
     ```
   - **Arreglo con fila de cabeceras** (columna `departamento`):
     ```json
     [ { "departamento": "Petén", "poblacion_2024": 0.65 } ]
     ```
3. `geoJoin` une cada polígono con sus métricas usando la **propiedad `NOMBRE`**
   del GeoJSON como clave. Los nombres se normalizan (`normalizeName`): sin
   tildes, minúsculas y sin espacios (`Peten` ≡ `Petén`), con una tabla de alias
   para variantes (p. ej. `Quezaltenango` → `Quetzaltenango`).
4. Si un departamento **no tiene datos** se pinta en gris, no se rompe: el tooltip
   y el panel muestran "sin datos".

> Para reemplazar con datos reales, mira [`resources/README.md`](resources/README.md)
> (formatos aceptados, nombres canónicos de los 22 departamentos y licencia).

### Nombres canónicos

```
Alta Verapaz, Baja Verapaz, Chimaltenango, Chiquimula, El Progreso, Escuintla,
Guatemala, Huehuetenango, Izabal, Jalapa, Jutiapa, Petén, Quetzaltenango, Quiché,
Retalhuleu, Sacatepéquez, San Marcos, Santa Rosa, Sololá, Suchitepéquez,
Totonicapán, Zacapa
```

## Asistente de datos (chat)

El panel izquierdo incluye un asistente que responde preguntas sobre los datos
cargados. **Sin configuración** usa un motor local basado en reglas
(`ChatService` → `localAssistant`) que entiende, en español:

- Saludos y cortesías (`hola`, `gracias`).
- Cuántos departamentos hay.
- **Resumen** de un departamento: `Resume Quiché`, `hablame de Petén`.
- **Comparación** entre dos: `Compara Petén y Guatemala`.
- **Superlativos/rankings** por métrica: `¿Cuál es el más poblado?`,
  `el de menor pobreza`, `top de educación`, `mayor área`.
- Utiliza el **contexto del departamento seleccionado** en el mapa si no se
  menciona ninguno.

Si se define `VITE_CHAT_ENDPOINT`, las preguntas se envían como
`POST { pregunta, contexto }` al endpoint y se espera `{ respuesta }` (p. ej.
un futuro backend GrokBot). El contexto es la lista de departamentos
seleccionados.

## Personalización

- **Cambiar los datos**: reemplaza los archivos en `resources/` (ver
  `resources/README.md`). Sin tocar código.
- **Cambiar los tiles del mapa**: define `VITE_MAP_TILE_URL` y
  `VITE_MAP_ATTRIBUTION` (CARTO, Esri, Stadia, etc.).
- **Cambiar la paleta / tema**: tokens en `src/styles/index.css`
  (`--color-jade-*`, `--color-gold-*`, `--color-petate-*`, `--color-volc-*`).

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Compilación de TypeScript (`tsc -b`) + build de producción |
| `npm run preview` | Previsualiza el build de producción localmente |
| `npm run lint` | Analiza el código con oxlint |

## Atribución y licencia de datos

- **Polígonos**: GADM 4.1 (`gadm41_GTM_1.json`, nivel departamental),
  https://gadm.org — filtrado a las 22 features de Guatemala.
  Al publicar o presentar, citar: *GADM 4.1, Univ. de Berkeley et al.
  (https://gadm.org) — uso académico/no comercial*.
- **Datos de `departamentos-data.example.json`**: **valores de ejemplo (mock)**,
  no cifras oficiales. Reemplazar por datos reales antes de su uso público.
- **Tiles**: OpenStreetMap/CARTO (gratuitos, sujetos a sus políticas de uso).

## Futuro

- Base de datos servida (PostgreSQL/PostGIS + API): el hook `useDepartmentsData`
  se reemplaza por un proveedor `fetch('/api/departamentos')` con el mismo contrato.
- Asistente real (GrokBot): `ChatService.send()` conectado a `POST /api/chat`,
  con contexto del departamento seleccionado y del JSON cargado.
- Consultas espaciales (cercanía, intersección) vía backend WFS/WMS.
- Intercambio de la fuente de datos del mapa (Natural Earth) a demanda.

## Documentación relacionada

- [`ARQUITECTURA.md`](ARQUITECTURA.md) — decisiones de arquitectura, tipos y
  contrato de datos con detalle.
- [`resources/README.md`](resources/README.md) — guía práctica para reemplazar
  los datos reales.