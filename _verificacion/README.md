# Educación Formal 2024 — Hackatón AI Builders GT

Herramienta para volver legible el dataset **Educación Formal 2024** del INE de
Guatemala: 4,298,887 inscripciones escolares publicadas como códigos numéricos.

El proyecto tiene tres componentes:

| Componente | Estado | Qué hace |
|---|---|---|
| **Ingesta** (`ingesta/`) | funcionando | Lee los 23 `.xlsx`, los decodifica y produce CSVs verificados |
| **Backend** (`backend/`) | de otro integrante | API FastAPI sobre Postgres + PostGIS |
| **Frontend** (`frontend/`) | de otro integrante | Dashboard React con mapa GeoJSON |

Este README cubre la **ingesta**. Las decisiones técnicas y el porqué de cada
una están en [`docs/decisiones.md`](docs/decisiones.md).

---

## Requisitos

- Python 3.11 o superior (probado en 3.14.6)
- ~1 GB libre en disco (225 MB de `.xlsx` + 681 MB de CSV)

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

El paso 4 tarda unos 7 minutos y escribe dos archivos en `datos/procesado/`.

Los `.xlsx` no se versionan: se bajan con el paso 3. El script es idempotente
—si un archivo ya está y abre correctamente, no lo vuelve a bajar— así que se
puede repetir sin miedo.

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
