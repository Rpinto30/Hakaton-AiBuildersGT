# resources

| Archivo | Para qué |
|---|---|
| `guatemala-departments.geojson` | Polígonos de los 22 departamentos. Es lo único estático que queda aquí. |

Las cifras **ya no viven en este directorio**: las sirve la API desde Postgres
(`GET /api/agregados/departamento`). El join con el GeoJSON es por el nombre del
departamento (`properties.NOMBRE`), y los 22 coinciden exactamente con los del
diccionario del INE, tildes incluidas.

El GeoJSON es de fuente externa y no forma parte del dataset del reto, que no
trae geometría.
