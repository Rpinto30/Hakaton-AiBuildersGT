# Carga a Postgres — orden de ejecución

Los archivos se corren en orden. Todo desde `psql`, no desde el `initdb.d` de
Docker, porque el `\copy` necesita leer el CSV desde el cliente.

## 0. Entrar a psql

```bash
docker exec -it <nombre_del_contenedor> psql -U postgres -d <basededatos>
```

Si el contenedor no ve la carpeta del CSV, **usa `\copy` (con barra invertida)
y no `COPY`**: `\copy` lee desde el cliente, `COPY` desde el servidor.

## 1. Esquema

```
\i 01_schema.sql
```

## 2. Cargar el CSV

Primero con 1000 líneas para ver que no truene, y solo después el archivo
completo (681 MB, tarda varios minutos):

```bash
head -1001 datos/procesado/inscripciones.csv > /tmp/prueba.csv
```

```sql
\copy inscripciones FROM '/tmp/prueba.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
SELECT count(*), min(municipio_codigo) FROM inscripciones;
TRUNCATE inscripciones;
```

Si eso salió bien:

```sql
\copy inscripciones FROM 'datos/procesado/inscripciones.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
```

## 3. Índices (después de la carga, nunca antes)

```
\i 02_indices.sql
```

## 4. Agregados

```
\i 03_agregados.sql
CALL refresh_agregados();
```

`refresh_agregados()` tarda ~20 segundos: es la única vez que se recorren los
4.3 M de microdatos. Deja listas las seis tablas `agg_*` más `agg_resumen`, que
es lo único que la API consulta.

## 5. Validar

```
\i 04_validacion.sql
```

Tiene que dar **4,298,887** registros y **17** municipios en Guatemala. Si eso
sale, toda la cadena desde el `.xlsx` hasta Postgres está correcta.

## Tablas que quedan

| Tabla | Filas | Para qué |
|---|---|---|
| `inscripciones` | 4,298,887 | microdatos, consultas libres del agente |
| `agg_departamento` | 22 | vista general |
| `agg_municipio` | ~340 | **el mapa** |
| `agg_nivel` | ~5 | vista general |
| `agg_sector` | 4 | vista general |
| `agg_area` | 2 | vista general |
| `agg_departamento_nivel` | ~110 | la desagregación que pide el reto |
| `agg_resumen` | 1 | KPIs nacionales del dashboard |

Las cinco primeras `agg_*` comparten la misma forma: `clave`, `etiqueta`,
`padre`, `orden`, los conteos y las tasas. La API puede servirlas con un solo
endpoint parametrizado.

## Atajo: cargar con el script

Los pasos 2 y 4 se pueden hacer de una sola vez, sin entrar a `psql`:

```bash
python scripts/load_csv.py datos/procesado/inscripciones.csv
```

Valida el encabezado, hace el `COPY`, llama a `refresh_agregados()` y contrasta
el resultado. Todo en una transacción: si algo no cuadra, revierte y la base
queda como estaba. Necesita el esquema ya creado (pasos 1 y 3).

## Conectarse desde fuera del contenedor

Usa **`127.0.0.1`, no `localhost`**. El `docker-compose.yml` publica el puerto
solo en IPv4, y resolver `localhost` intenta primero `::1`, donde no hay nadie
escuchando: cada conexión espera a que venza el timeout antes de reintentar.
Medido en este proyecto: 130 s contra 0.013 s.

```
postgresql://educacion:TU_CONTRASEÑA@127.0.0.1:5432/educacion
```
