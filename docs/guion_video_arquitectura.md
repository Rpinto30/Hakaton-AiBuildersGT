# Guion — Video 1: Arquitectura del proyecto (máx. 3:00)

**Ritmo objetivo:** ~420 palabras habladas en 180 segundos (~140 palabras/min).
Deja aire; si te apuras se nota.

**Lo que el reto pide de este video:** qué componentes hay, cómo se conectan,
por dónde fluyen los datos desde el archivo original hasta el dashboard y el
agente, y qué tecnologías eligieron. Y sobre todo: **que se note que entiendes
tu propio diseño** — no describas lo que hace, explica *por qué así*.

> **Marcado con ⚠️ = necesitas confirmarlo con tus compañeros antes de grabar.**
> Yo solo puedo respaldar lo de la ingesta.

---

## 0:00 – 0:15 · El problema (≈35 palabras)

**En pantalla:** una fila cruda del `.xlsx`, con los códigos numéricos visibles.

> "El INE publica cada año los datos de educación de Guatemala: cuatro millones
> trescientas mil inscripciones. Pero vienen como códigos numéricos repartidos
> en veintitrés hojas de Excel. Nuestra herramienta los vuelve legibles."

*No te alargues aquí. El problema lo conocen: son los jueces del reto.*

---

## 0:15 – 0:45 · Los tres componentes y por qué están separados (≈70 palabras)

**En pantalla:** el diagrama de arquitectura (los tres bloques con flechas).

> "La solución tiene tres piezas, separadas a propósito: una **ingesta** que
> decodifica, una **API en FastAPI sobre Postgres** que sirve los agregados, y
> un **dashboard en React** con el agente que explica. ⚠️
>
> Las separamos porque hacen cosas distintas en tiempos distintos: la ingesta
> corre una vez y tarda siete minutos; la API responde en milisegundos. Si la
> decodificación viviera dentro de la API, cada consulta pagaría ese costo."

⚠️ **Ajusta la lista de tecnologías** con lo que realmente quedó. Si usaron
PostGIS para el mapa, dilo aquí en tres palabras.

---

## 0:45 – 1:35 · La ingesta (≈115 palabras) — *el tramo con más peso técnico*

**En pantalla:** el árbol de módulos de `ingesta/`, y luego un vistazo a
`esquema.py`.

> "Empiezo por la ingesta, porque si esta pieza interpreta mal, todo lo demás
> muestra cifras equivocadas con total confianza.
>
> Lee los veintitrés archivos, los decodifica contra el diccionario de variables
> y escribe dos CSV.
>
> Está partida en módulos con una responsabilidad cada uno: **esquema** guarda
> el contrato del dataset; **diccionario** construye los catálogos de códigos;
> **libro** encuentra la hoja correcta —no la primera, porque Sololá trae hojas
> vacías—; **transformación** decodifica fila por fila; y **validación** acumula
> todo lo que no cuadra.
>
> Todo lo que sabemos del dataset vive en un solo archivo. Si el INE republica
> con otro formato, se corrige ahí y nada más."

*Este es tu terreno. Habla con seguridad y sin leer.*

---

## 1:35 – 2:05 · El recorrido de un dato, de punta a punta (≈70 palabras)

**En pantalla:** la fila cruda y la fila decodificada, lado a lado. Después, la
flecha completa: `.xlsx → CSV → Postgres → API → dashboard / agente`.

> "Este es el camino de un dato. En el Excel, una fila dice: sector uno, área
> dos, resultado cinco. Sin el diccionario al lado, no comunica nada.
>
> La ingesta lo convierte en: público, rural, no promovido. Y deriva el
> municipio del código del establecimiento.
>
> Eso entra a Postgres, la API lo agrega por departamento o por nivel, el
> dashboard lo grafica, y el agente responde sobre esas mismas cifras
> agregadas — no sobre el Excel." ⚠️

⚠️ La última frase es importante y hay que verificar que sea cierta: **el agente
debe consultar los datos ya procesados, no razonar sobre texto.** Si terminó
funcionando de otra forma, dilo como es.

---

## 2:05 – 2:45 · La decisión que sostiene el diseño (≈95 palabras)

**En pantalla:** primero la corrida fallando con el reporte de error; después,
las quince líneas `ok` del contraste.

> "La decisión de diseño de la que más orgullosos estamos: **la ingesta no
> confía en sí misma.** Valida mientras procesa y al final contrasta sus propios
> resultados contra las cifras que publicó la organización. Si algo no cuadra,
> se detiene y ni siquiera deja el CSV en disco.
>
> Eso nos salvó. La documentación del reto decía que normalizáramos un prefijo
> del código de establecimiento en Guatemala. Lo implementamos tal cual, y el
> validador lo rechazó: producía municipios que no existen.
>
> Investigamos: ese segmento no es un municipio, son las **zonas de la capital**.
> Trescientas diez mil inscripciones estaban mal atribuidas."

*Si tienes que sacrificar un tramo por tiempo, **no sacrifiques este**. Es el
que demuestra criterio propio.*

---

## 2:45 – 3:00 · Cierre (≈35 palabras)

**En pantalla:** el bloque completo de `ok` y luego el README.

> "Las quince verificaciones pasan al decimal sobre los cuatro millones de
> filas. Y todo el proyecto se levanta con cuatro comandos desde un clon limpio."

---

## Notas de producción

- **Ensáyalo con reloj al menos una vez completo.** Es la diferencia entre
  cerrar holgado y quedarte a medias.
- **Ten todo abierto antes de grabar:** el `.xlsx`, el árbol de módulos, la
  corrida con error, la corrida con los `ok`, el README. Cambiar de ventana
  buscando algo cuesta cinco segundos que no tienes.
- **El texto del terminal tiene que leerse.** Sube el tamaño de fuente antes de
  grabar, no después.
- **No leas el guion de corrido.** Aprende la idea de cada tramo y dilo con tus
  palabras; se nota muchísimo la diferencia y el criterio que más pesa es que
  comprendas lo que construiste.
- **Si te sobran segundos**, úsalos en el tramo 2:05–2:45 (el hallazgo), no en
  la introducción.
- **Si te faltan**, recorta el tramo 0:45–1:35: menciona tres módulos en vez de
  cinco.

## Lo que este video NO es

No es la demo. Mostrar el dashboard funcionando y hacerle preguntas al agente va
en el **Video 2**. Aquí solo se muestra código, diagrama y terminal — lo justo
para que se entienda el diseño.
