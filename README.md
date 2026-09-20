# Educación Formal 2024 — Hackatón AI Builders GT

Herramienta para volver legible el dataset **Educación Formal 2024** del INE de
Guatemala: 4,298,887 inscripciones escolares publicadas como códigos numéricos.

| Componente | Qué hace |
|---|---|
| **Ingesta** (`ingesta/`) | Lee los 23 `.xlsx`, los decodifica y produce CSVs verificados |
| **Base de datos** (`tablas/`, `docker-compose.yml`) | Postgres 17 + PostGIS; agregados precalculados |
| **API** (`api/`) | FastAPI: sirve los agregados y el modelo de prioridad |
| **Agente** (`agente/`) | Responde `POST /api/chat` consultando la base, nunca de memoria |
| **Frontend** (`React-UI/`) | React + Leaflet: mapa, dashboard, comparador y chat |

Las decisiones técnicas y el porqué de cada una están en
[`docs/decisiones.md`](docs/decisiones.md); el agente, en
[`docs/agente.md`](docs/agente.md).

## Puesta en marcha completa

```bash
# 1. Entorno de Python y dependencias
python -m venv .venv
.venv/Scripts/activate          # Windows · source .venv/bin/activate en Unix
pip install -r requirements.txt

# 2. Datos: descargar, procesar y cargar
python -m ingesta.descargar                    # ~225 MB del S3 público
python -m ingesta                              # ~7 min -> datos/procesado/
cp env.example .env                            # y cambia la contraseña
docker compose up -d db
docker exec -i educacion-db psql -U educacion -d educacion < tablas/01_schema.sql
docker exec -i educacion-db psql -U educacion -d educacion < tablas/03_agregados.sql
python scripts/load_csv.py datos/procesado/inscripciones.csv   # ~3 min
docker exec -i educacion-db psql -U educacion -d educacion < tablas/02_indices.sql
docker exec -i educacion-db psql -U educacion -d educacion < tablas/05_perfil_municipio.sql
docker exec -i educacion-db psql -U educacion -d educacion -c "CALL refresh_perfil_municipio();"
docker exec -i educacion-db psql -U educacion -d educacion < tablas/04_validacion.sql

# 3. Levantar API + frontend
cd React-UI
npm install
npm run dev
```

`npm run dev` levanta **las dos cosas**: la API en <http://127.0.0.1:8000> y el
frontend en <http://localhost:5173>. Las rutas `/api/*` las reenvía el proxy de
Vite, así que no hace falta configurar CORS ni URLs.

> Si el dashboard dice que no pudo cargar las cifras, es que la API o la base no
> están arriba. `curl http://127.0.0.1:8000/health` lo confirma en un segundo.

---

## Carga a Postgres, paso a paso

Los comandos de arriba hacen todo esto de corrido. Esta sección explica cada
paso por si algo falla o se quiere correr a mano desde `psql`.

| # | Archivo | Qué deja | Cuánto tarda |
|---|---|---|---|
| 1 | `tablas/01_schema.sql` | tabla `inscripciones` vacía | instantáneo |
| 2 | `tablas/03_agregados.sql` | tablas `agg_*` y `refresh_agregados()` | instantáneo |
| 3 | `scripts/load_csv.py` | los 4.3 M de filas + agregados | ~3 min |
| 4 | `tablas/02_indices.sql` | índices y `ANALYZE` | ~12 s |
| 5 | `tablas/05_perfil_municipio.sql` | `agg_municipio_perfil` para el modelo | ~5 s |
| 6 | `tablas/04_validacion.sql` | el reporte de verificación | instantáneo |

**El orden importa en dos puntos.** Los índices van *después* del `COPY`:
mantenerlos vivos durante la carga de 4.3 M de filas la hace varias veces más
lenta. Y los agregados (`03`) se crean *antes* de cargar, porque `load_csv.py`
llama a `refresh_agregados()` al terminar.

### Con el script (recomendado)

```bash
python scripts/load_csv.py datos/procesado/inscripciones.csv
```

Valida el encabezado, hace el `COPY`, reconstruye los agregados y contrasta el
resultado contra las cifras publicadas. Todo en una transacción: si algo no
cuadra, revierte y la base queda como estaba.

### A mano desde psql

```bash
docker exec -it educacion-db psql -U educacion -d educacion
```

```sql
\i tablas/01_schema.sql
\i tablas/03_agregados.sql
\copy inscripciones FROM 'datos/procesado/inscripciones.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
\i tablas/02_indices.sql
CALL refresh_agregados();
\i tablas/05_perfil_municipio.sql
CALL refresh_perfil_municipio();
\i tablas/04_validacion.sql
```

> Usa **`\copy` con barra invertida, no `COPY`**. `\copy` lee el archivo desde
> el cliente; `COPY` lo busca dentro del contenedor, donde no está.

Para probar sin cargar 681 MB, primero mil líneas:

```bash
head -1001 datos/procesado/inscripciones.csv > /tmp/prueba.csv
```

La validación tiene que dar **4,298,887** registros y **17** municipios en
Guatemala. Si eso sale, toda la cadena desde el `.xlsx` hasta Postgres está bien.

### Tablas que quedan

| Tabla | Filas | Para qué |
|---|---:|---|
| `inscripciones` | 4,298,887 | microdatos; es lo que consulta el agente |
| `agg_departamento` | 22 | vista general |
| `agg_municipio` | 340 | **el mapa** |
| `agg_nivel` | 5 | vista general |
| `agg_sector` | 4 | vista general |
| `agg_area` | 3 | vista general |
| `agg_departamento_nivel` | ~110 | la desagregación que pide el reto |
| `agg_resumen` | 1 | KPIs nacionales del dashboard |
| `agg_municipio_perfil` | 340 | composición de cada municipio, para el modelo |

Las cinco `agg_*` de dimensión comparten la misma forma (`clave`, `etiqueta`,
`padre`, `orden`, conteos y tasas), y por eso un solo endpoint las sirve todas.

### Conectarse desde fuera del contenedor

Usa **`127.0.0.1`, no `localhost`**. `docker-compose.yml` publica el puerto solo
en IPv4, y resolver `localhost` intenta primero `::1`, donde no escucha nadie:
cada conexión espera a que venza el timeout antes de reintentar. Medido en este
proyecto: **130 s contra 0.013 s**.

```
postgresql://educacion:TU_CONTRASEÑA@127.0.0.1:5432/educacion
```

---

El resto de este README cubre la **ingesta**.

---

## Requisitos

- **Python 3.14.6** — es la versión en la que está probado. El código no usa
  nada posterior a 3.10, pero no verificamos versiones anteriores.
- **~1 GB libre en disco** (225 MB de `.xlsx` + 681 MB de CSV).
- **Conexión a internet** para el paso 3, que descarga el dataset.

No hace falta nada más: ni base de datos ni credenciales.

## Instalación y uso

```bash
# 1. Entorno virtual
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# 2. Dependencias
pip install -r requirements.txt

# 3. Descargar el dataset (~225 MB desde el S3 público de la organización)
python -m ingesta.descargar

# 4. Procesar
python -m ingesta
```

El paso 3 baja ~225 MB y el paso 4 tarda unos 7 minutos. Al final quedan dos
archivos en `datos/procesado/`.

Los `.xlsx` no se versionan: se bajan con el paso 3. El script es idempotente
—si un archivo ya está y abre correctamente, no lo vuelve a bajar— así que se
puede repetir sin miedo.

> **Verificado de punta a punta.** Copiamos a un directorio vacío solo los
> archivos que el repositorio versiona y seguimos estos pasos desde cero: el
> entorno se creó, las dependencias se instalaron, los 23 archivos se
> descargaron y la ingesta produjo los 4,298,887 registros con las 15
> verificaciones en verde.

## Qué produce

### `datos/procesado/inscripciones.csv` — 4,298,887 filas, 681 MB

Una fila por inscripción, con todos los códigos ya traducidos a palabras.

| Columna | Ejemplo | Nota |
|---|---|---|
| `anio` | `2024` | |
| `cod_establecimiento` | `02-01-0001-42` | código original, sin modificar |
| `cod_establecimiento_base` | `02-01-0001` | mismo centro sin el nivel — **úsalo para contar escuelas** |
| `departamento_codigo` / `departamento` | `2` / `El Progreso` | |
| `municipio_codigo` / `municipio` | `0201` / `Guastatoya` | **texto de 4 dígitos**, no número |
| `sector`, `area`, `sexo` | `Público`, `Urbana`, `Hombre` | |
| `nivel_codigo` / `nivel` | `1` / `Preprimaria` | |
| `grado_codigo` / `grado` | `4` / `4 Preprimaria` | el grado solo se lee junto al nivel |
| `pueblo_pertenencia`, `plan_estudio`, `jornada` | `Ladino/Mestizo`, `Diario`, `Matutina` | |
| `resultado_final`, `repitente`, `graduando` | `Promovido`, `No`, `No es graduando` | |

### `datos/procesado/municipios.csv` — 340 filas

Tabla de referencia y **llave de join para el mapa**: `municipio_codigo`,
`municipio`, `departamento_codigo`, `departamento`.

Se puede regenerar sola, en un segundo, sin correr la ingesta completa:

```bash
python -m ingesta --solo-municipios
```

## Verificaciones automáticas

La ingesta no confía en sí misma: valida mientras procesa y **se detiene si algo
no cuadra**, sin dejar un CSV a medias en disco (escribe a `.parcial` y solo
renombra al final si todo pasó).

Por fila comprueba que el año sea 2024, que el departamento y el municipio
existan en el catálogo, que el código de establecimiento tenga sus 4 segmentos y
que su prefijo coincida con el departamento, que el 4º segmento del código
corresponda al `Nivel` declarado, que el grado caiga en el rango de su nivel, y
que todo código categórico exista en el diccionario.

Al terminar contrasta contra las cifras publicadas por la organización:

```
Total escrito: 4,298,887 filas | municipios distintos: 340

Contraste contra las cifras publicadas:
  ok  sector           Público          obtenido  74.7%  publicado  74.7%
  ok  area             Rural            obtenido  61.4%  publicado  61.4%
  ok  sexo             Hombre           obtenido  50.7%  publicado  50.7%
  ok  nivel            Primaria         obtenido  56.4%  publicado  56.4%
  ok  resultado_final  Promovido        obtenido  85.2%  publicado  85.2%
  ...
```

Los 15 contrastes pasan al decimal. Si alguno falla, el proceso termina con
código 1 y un reporte con el conteo y ejemplos de cada problema — todos de una
vez, no de uno en uno.

## Estructura

```
ingesta/
├── esquema.py         el contrato del dataset: nombres, mapeos, cifras de control
├── descargar.py       baja los 23 .xlsx del S3 público
├── diccionario.py     diccionario_de_variables.xlsx → catálogos de códigos
├── libro.py           abre un .xlsx y localiza la hoja con datos
├── transformacion.py  fila cruda → fila decodificada, con los controles cruzados
├── municipios.py      exporta la tabla de municipios
├── validacion.py      acumula los problemas y detiene la corrida
└── __main__.py        orquesta todo y escribe los CSVs
```

Todo lo que "sabemos" del dataset vive en `esquema.py`. Si el INE republica los
archivos con otro formato, se corrige ahí y nada más.

## Carga a Postgres

```sql
CREATE TABLE municipios (
  municipio_codigo     char(4) PRIMARY KEY,
  municipio            text     NOT NULL,
  departamento_codigo  smallint NOT NULL,
  departamento         text     NOT NULL
);

CREATE TABLE inscripciones (
  anio                      smallint    NOT NULL,
  cod_establecimiento       varchar(16) NOT NULL,
  cod_establecimiento_base  varchar(12) NOT NULL,
  departamento_codigo       smallint    NOT NULL,
  departamento              text        NOT NULL,
  municipio_codigo          char(4)     NOT NULL REFERENCES municipios,
  municipio                 text        NOT NULL,
  sector text, area text, sexo text,
  nivel_codigo smallint, nivel text,
  grado_codigo smallint, grado text,
  pueblo_pertenencia text, plan_estudio text, jornada text,
  resultado_final text, repitente text, graduando text
);

\copy municipios    FROM 'datos/procesado/municipios.csv'    WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
\copy inscripciones FROM 'datos/procesado/inscripciones.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
```

> **`municipio_codigo` debe ser `char(4)` o `text`, nunca `integer`.** Si se
> declara numérico, `0101` se convierte en `101` y el join con el GeoJSON se
> rompe en silencio para los 136 municipios de los departamentos 1 al 9.
>
> Por la misma razón, **no abras los CSV en Excel**: convierte `0101` a `101` y
> si guardas, corrompe el archivo.

## Fuente

Instituto Nacional de Estadística de Guatemala — *Educación Formal 2024*,
publicado como dato abierto: <https://datos.ine.gob.gt/dataset/educacion-formal-2024>

Los archivos se descargan del espejo en S3 que provee la organización del
hackatón.
