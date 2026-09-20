# Arquitectura — Sistema Web de Datos Geográficos de Guatemala

> Proyecto: **React-UI** — Hackathon AIBuildersGT 2026
> Estado: **Draft aprobado para implementación** (pendiente de revisión)
> Fecha: 2026-09-20

---

## 1. Propósito

Sistema web que muestra información de datos **parseados en JSON** sobre el mapa de
Guatemala. Cada uno de los **22 departamentos** se representa como un **polígono**; al
hacer hover se muestra un recuadro resumido y al hacer click se despliega la info
relevante en un **sidebar derecho**. Un **sidebar izquierdo** aloja el **chatbot**
(placeholder vacío) que en el futuro responderá con base al mapa y al JSON.

## 2. Decisiones de arquitectura

| Decisión | Elección | Justificación |
|---|---|---|
| Frontend | **React + Vite + TypeScript** | Vite es rápido, moderno y estándar. La "mejor estética" se evaluará con las skills `frontend-design` y `frontend-design-systems` al diseñar componentes. |
| Datos | **JSONs locales en carpeta `resources/`** | Los datos viven en `resources/` (fuera de `src/`) para que el equipo los reemplace sin tocar código. |
| Base de datos | **En servidor (futuro)** | Hoy NO se conecta; los JSON son locales. Se deja una capa de datos modular para escalar a BD servida (PostgreSQL/PostGIS + API) sin tocar la UI. |
| Mapa | **Leaflet (`react-leaflet`) + GeoJSON en navegador** | Polígonos estáticos → no requiere GeoServer/PostGIS. Migración futura a PostGIS/GeoServer = cambiar solo el proveedor de datos. |
| Tiles base | **OpenStreetMap (abierto, gratuito)** | Alternativas: CARTO, Esri World, Stadia (clave gratuita). Intercambiable por config. |
| Estado global | **Zustand** (stores por feature) | Ligero, modular, fácil de reemplazar/combinar. |
| Estilos | **Tailwind CSS v4 + tokens CSS** | Diseño moderno, consistente, con variables de tema. |
| Chatbot | **UI con adaptador stub (`ChatService`)** | Contrato API definido; se conecta al GrokBot/servicio cuando exista. |

## 3. Estructura de carpetas

```
React-UI/
│
├── index.html
├── package.json
├── vite.config.ts                  # alias @ y @resources; sirve recursos locales
├── tsconfig.json
├── .env.example                    # claves future (tiles, API chat)
├── ARQUITECTURA.md                 # este documento
│
├── resources/                      # DATOS LOCALES (fuera de src/, se reemplazan sin tocar código)
│   ├── guatemala-departments.geojson     # 22 polígonos (Natural Earth/GADM, dominio público)
│   ├── departamentos-data.example.json   # JSON con headers = nombre del departamento (mock)
│   └── README.md                         # cómo reemplazar los datos reales
│
└── src/
    ├── main.tsx                    # bootstrap React
    ├── App.tsx                     # composición de layout
    ├── app/
    │   └── layout.tsx              # Layout 3 columnas: [Chat | Mapa | Detalle]
    │
    ├── components/
    │   ├── map/
    │   │   ├── GuatemalaMap.tsx        # MapContainer (tiles OSM, estado de mapa)
    │   │   ├── DepartmentLayer.tsx     # <GeoJSON> → polígonos (color, hover, click)
    │   │   ├── DepartmentTooltip.tsx   # recuadro resumido al hacer hover (lee del JSON)
    │   │   ├── MapControls.tsx         # toggles: capa de datos, tooltips, reset, zoom
    │   │   └── Legend.tsx              # leyenda de la capa temática
    │   ├── panels/
    │   │   ├── ChatPanel.tsx           # sidebar izquierdo (chatbot, placeholder)
    │   │   └── InfoPanel.tsx           # sidebar derecho (detalle del departamento)
    │   └── ui/                         # primitivos reutilizables
    │       ├── Toggle.tsx              # switch mostrar/ocultar info
    │       ├── Card.tsx
    │       ├── Badge.tsx
    │       └── Spinner.tsx
    │
    ├── features/                       # módulos por funcionalidad
    │   ├── departments/
    │   │   ├── types.ts                # DepartmentData, Metrics, DepartmentFeature
    │   │   ├── lib/
    │   │   │   ├── normalizeName.ts        # normaliza tildes/mayúsculas para el join
    │   │   │   ├── parseDepartmentsJson.ts # JSON (headers→depto) → DepartmentData[]
    │   │   │   └── geoJoin.ts              # une GeoJSON feature ↔ data por nombre
    │   │   ├── hooks/
    │   │   │   ├── useDepartmentsData.ts   # carga desde resources/ + parseo + join
    │   │   │   └── useDepartmentMeta.ts    # metadatos del depto seleccionado
    │   │   └── index.ts                # barril de exportación del módulo
    │   ├── chat/
    │   │   ├── types.ts                # Message, ChatRequest, ChatResponse
    │   │   ├── ChatService.ts          # adaptador stub → futura API /api/chat (GrokBot)
    │   │   ├── useChat.ts              # estado del chat (mensajes, enviar, typing)
    │   │   └── index.ts
    │   └── mapui/
    │       ├── mapStore.ts             # Zustand: selected, hovered, visibilidades
    │       ├── selectors.ts            # selecciones derivadas
    │       └── index.ts
    │
    ├── store/
    │   └── uiStore.ts                  # colapso de paneles, toggles globales
    │
    ├── lib/
    │   └── cn.ts                       # clsx + tailwind-merge
    │
    └── styles/
        └── index.css                   # tokens (colores/tipografía), Tailwind v4
```

## 4. Contrato de datos (JSON ↔ GeoJSON en sincronía)

La **clave de unión es el nombre del departamento**. GeoJSON y JSON usan la misma
estructura semántica de cabecera; el join se hace por nombre normalizado.

### 4.1 JSON de datos — `resources/departamentos-data.example.json`

Formato **objeto keyed por nombre de departamento** (recomendado):

```json
{
  "Guatemala":      { "poblacion_2024": 3.5, "area_km2": 2126, "indice_educativo": 0.72 },
  "Petén":          { "poblacion_2024": 0.8, "area_km2": 35854, "indice_educativo": 0.61 }
}
```

El parser (`parseDepartmentsJson`) también acepta **arreglo con fila de headers**:

```json
[
  { "departamento": "Guatemala", "poblacion_2024": 3.5, "area_km2": 2126 },
  { "departamento": "Petén",     "poblacion_2024": 0.8, "area_km2": 35854 }
]
```

Ambos se normalizan a:

```ts
type DepartmentData = {
  nombre: string;                       // nombre del departamento (clave)
  metricas: Record<string, number | string>;
};
```

### 4.2 GeoJSON — `resources/guatemala-departments.geojson`

- `FeatureCollection` con 22 `Feature` (una por departamento).
- Cada feature lleva la propiedad `NOMBRE` (nombre del departamento, español) usada
  como clave para el join con el JSON. Se puede configurar otra propiedad (`labelKey`).

### 4.3 Join (`geoJoin.ts`)

- Normaliza nombres (`Peten` ↔ `Petén`, minúsculas, sin espacios extra) vía `normalizeName`.
- Indiza el JSON por nombre normalizado → búsqueda O(1) por polígono.
- Si un departamento no tiene datos → se pinta en color neutro (gris) y el `InfoPanel`
  muestra "sin datos" en vez de romper.

## 5. Interacciones

| Acción | Comportamiento |
|---|---|
| **Hover sobre polígono** | `DepartmentTooltip` con resumen breve (2–3 métricas top) leído del JSON. |
| **Click sobre polígono** | `mapStore.select(departamento)` → resalta el polígono + `InfoPanel` (sidebar derecho) con toda la info relevante. |
| **Chatbot (izquierda)** | `ChatPanel`: bienvenida + input. `ChatService.send()` es un stub que devuelve un mensaje de confirmación; contrato listo para `POST /api/chat` con `{ pregunta, contexto: [deptos seleccionados] }`. |
| **Toggles (barra de controles)** | Mostrar/ocultar **capa de datos** (coloreado/etiquetas), **tooltips**, y **colapsar** lado izquierdo/derecho. |
| **Reset** | Reencuadra mapa a Guatemala (bounding box de los 22 deptos). |

## 6. Estado global (Zustand)

- `features/mapui/mapStore.ts`
  - `hovered: string | null`
  - `selected: string | null`
  - `showDataLayer: boolean`
  - `showTooltips: boolean`
- `store/uiStore.ts`
  - `chatOpen`, `detailsOpen` (paneles colapsables)
- Regla: los componentes de mapa/paneles **no** guardan estado duplicado; todo deriva de los stores.

## 7. Configuración de Vite (recursos locales)

- Alias `@resources` → `resources/` para importar los JSON/GeoJSON desde `src/`.
- `resources/` se importa como módulo ES (Vite lo empaqueta) → **funciona sin servidor**.
- Opcional: `publicDir`/rutina de descarga (`npm run fetch:data`) para bajar el GeoJSON
  de Natural Earth y regenerar los datos locales.

## 8. Stack técnico y dependencias

- **React 18 + Vite + TypeScript** (scaffold `react-ts`)
- **Tailwind CSS v4** (`@tailwindcss/vite`) — tokens vía CSS variables
- **`react-leaflet` + `leaflet` + `@types/leaflet`**
- **Zustand** · **clsx + tailwind-merge** · **lucide-react** (iconos)
- Datos de polígonos: **Natural Earth admin-1** (dominio público; fallback **GADM 4.1**)
  → filtro `GTM` → 22 features en español. Validación de nombres con `normalizeName`.

## 9. Futuro (no incluido en la v1)

- **BD en servidor**: los JSON pasan a una base de datos servida. El módulo
  `useDepartmentsData` se reemplaza por un proveedor `fetch('/api/departamentos')`
  del **mismo contrato** → la UI no cambia.
- **PostGIS + GeoServer**: si se necesitan consultas espaciales (cercanía, intersección),
  se añade un backend (Node/Fastify o Java) que sirva WFS/WMS; otra implementación del
  mismo `types.ts`.
- **Chatbot real (GrokBot)**: `ChatService.send()` se conecta a `POST /api/chat`,
  enviando contexto del depto seleccionado y del JSON cargado.

## 10. Fases de implementación

1. **Instalar npm** (Node v26 presente, npm ausente) — tarball oficial de Node.
2. Scaffold Vite `react-ts` en `React-UI/` + Tailwind v4 + dependencias.
3. `resources/` con GeoJSON de Guatemala y JSON mock + parser + `geoJoin`.
4. Mapa (capa, tooltip, click, toggles, leyenda) + stores.
5. Paneles (ChatPanel, InfoPanel) + layout 3 columnas + estilos (skills de diseño).
6. Verificación: `tsc --noEmit`, `npm run build`, `npm run dev`, revisión visual.

## 11. Riesgos y notas

- **Nombres de departamento**: pueden diferir entre GeoJSON y JSON real → mitigado con
  `normalizeName` + tabla de alias.
- **Estética**: la elección final de tipografía/paleta se toma al implementar con la
  skill `frontend-design` (evitar estética genérica "AI slop").
- **Volumen de datos**: join O(n) con índice por nombre normalizado; sin impacto aun con
  JSONs grandes.
- **Tiles de OSM** requieren conexión; se deja la config de tiles intercambiable.