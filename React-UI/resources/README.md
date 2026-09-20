# Carpeta `resources/`

Datos locales del mapa de Guatemala. **Viven fuera de `src/`** para que el equipo
pueda reemplazarlos sin tocar código: al cambiar estos archivos y recargar, la app
refleja los datos nuevos.

## Archivos

| Archivo | Qué es |
|---|---|
| `guatemala-departments.geojson` | 22 polígonos (uno por departamento). Cada feature tiene `properties.NOMBRE` (nombre en español) = **clave de unión** con el JSON de datos. |
| `departamentos-data.example.json` | Datos de ejemplo/metricas por departamento. Reemplazar por los datos reales del parseo. |
| `README.md` | Este archivo. |

## Cómo reemplazar los datos reales

1. Sustituir `departamentos-data.example.json` por el JSON que resulte del parseo.
2. El JSON debe usar el **nombre del departamento como cabecera/clave** (los 22
   nombres canónicos están listados abajo). Dos formatos aceptados:

   - **Objeto keyed por nombre** (recomendado):

     ```json
     { "Guatemala": { "poblacion_2024": 3.4, "area_km2": 2126, "indice_educativo": 0.72 } }
     ```

   - **Arreglo con fila de headers** (una columna `departamento` con el nombre):

     ```json
     [ { "departamento": "Guatemala", "poblacion_2024": 3.4, "area_km2": 2126 } ]
     ```

3. Los nombres se normalizan al unir (`normalizeName`): minúsculas, sin tildes, sin
   espacios extra. `Peten` ↔ `Petén`, `Huehuetenango` ↔ `huehuetenango` son lo mismo.
   Si faltara alguna variante, añadirla a la tabla de alias en `normalizeName.ts`.
4. Un departamento sin datos en el JSON se pinta **gris** y el panel derecho muestra
   "sin datos".

## Nombres canónicos (claves del JSON)

```
Alta Verapaz, Baja Verapaz, Chimaltenango, Chiquimula, El Progreso, Escuintla,
Guatemala, Huehuetenango, Izabal, Jalapa, Jutiapa, Petén, Quetzaltenango, Quiché,
Retalhuleu, Sacatepéquez, San Marcos, Santa Rosa, Sololá, Suchitepéquez,
Totonicapán, Zacapa
```

## Origen y licencia de los polígonos

- Fuente: **GADM 4.1** (`gadm41_GTM_1.json`, nivel departamental), descargado de
  https://gadm.org y filtrado a las 22 features con `adm0 = Guatemala`.
- **Atribución**: al publicar/hackathon, citar
  > GADM 4.1, Univ. of Berkeley et al. (https://gadm.org) — datos para uso
  > académico/no comercial.
- Natural Earth (dominio público) no incluye Guatemala a 50 m; la versión 10 m sí,
  pero se distribuye como shapefile (requiere convertir con `ogr2ogr`/GDAL). Si se
  prefiere, se puede regenerar con el comando correspondiente y reemplazar el archivo
  manteniendo la propiedad `NOMBRE`.

## Notas

- El GeoJSON se importa como módulo ES desde `src/` vía el alias `@resources` (ver
  `vite.config.ts`) → no necesita servidor.
- `gadm41_GTM_1.json` original trae `NAME_1` sin espacios ("AltaVerapaz") y
  "Quezaltenango"; aquí se normalizó a los nombres canónicos en `NOMBRE`.