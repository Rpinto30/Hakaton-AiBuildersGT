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

Las cinco primeras `agg_*` comparten la misma forma: `clave`, `etiqueta`,
`padre`, `orden`, los conteos y las tasas. La API puede servirlas con un solo
endpoint parametrizado.
