# Decisiones técnicas de la ingesta

Documento de apoyo para el pitch. Cada sección explica **qué decidimos, por qué,
y cómo lo sabemos** — con los números que respaldan cada afirmación.

---

## En una frase

Los datos vienen como códigos numéricos en 23 hojas de Excel. La ingesta los
traduce a palabras y produce dos CSV verificados; **no confía en sí misma**:
contrasta sus propios resultados contra las cifras que publicó la organización
y se detiene si algo no cuadra.

Las 15 verificaciones pasan al decimal, sobre las 4,298,887 filas.

---

## 1. Por qué la ingesta es un módulo aparte y no parte del backend

**La decisión:** la ingesta es un programa independiente que produce archivos.
El backend lee de Postgres y no sabe que los `.xlsx` existen.

**Por qué:**

- **Se ejecuta una vez, no en cada request.** Procesar 4.3 millones de filas
  toma 7 minutos. Eso no puede pasar mientras alguien espera una respuesta HTTP.
  Se corre una vez, se carga a Postgres, y de ahí en adelante todo es SQL.
- **Podemos reprocesar sin tocar la interfaz.** Cuando descubrimos el problema
  del prefijo `00-` (sección 2), corregimos la ingesta y volvimos a generar el
  CSV. El backend y el frontend no se enteraron. Si la lógica de decodificación
  viviera dentro de la API, ese cambio habría tocado tres componentes.
- **Permite trabajar en paralelo.** Somos cuatro con cuatro horas. El contrato
  entre componentes son las columnas del CSV; una vez acordadas, cada quien
  avanza sin bloquear a los demás.
- **Aísla el riesgo.** Si la ingesta se equivoca, todo lo demás muestra cifras
  incorrectas con total confianza. Por eso es la pieza que concentra las
  validaciones, y por eso conviene que sea auditable por separado.

**Cómo decirlo en el pitch:** *"Separamos la ingesta del backend porque podíamos
reprocesar sin tocar la interfaz — y lo necesitamos: encontramos un error en los
datos a mitad del hackatón y solo hubo que volver a correr un módulo."*

---

## 2. El hallazgo del prefijo `00-`

Esta es la parte técnica más importante del proyecto.

### Qué decía la documentación

La documentación del reto advierte que cerca del 36% de los registros del
departamento de Guatemala usan `00-` como primer segmento del código de
establecimiento en lugar de `01-`, que corresponden a establecimientos de la
capital, y que hay que **normalizar el prefijo antes de derivar el municipio**.
Advierte que si no se hace, a Guatemala le salen ~39 municipios en vez de 17 y
unos 310 mil registros quedan mal atribuidos.

### Qué hicimos primero

Implementamos exactamente eso: reemplazar `00` por `01` y leer el segundo
segmento como municipio.

**El validador de la ingesta lo rechazó en la primera corrida**, con 73,173
filas apuntando al municipio `0118`, que no existe. Guatemala tiene 17
municipios: `0101` a `0117`.

### Qué encontramos en los datos

Al separar `guatemala.xlsx` por prefijo:

| Prefijo | Registros | Valores del 2º segmento |
|---|---:|---|
| `01-` | 553,960 | `01`–`17` — los 17 municipios reales |
| `00-` | 309,919 | `01`–`19`, `21`, `24`, `25` — **22 valores distintos** |

El segundo segmento del bloque `00-` **no es un municipio**. Es una **zona de la
Ciudad de Guatemala**.

### Las tres verificaciones que lo confirman

1. **La lista de zonas es exacta.** Los 22 valores observados son `01` a `19`,
   más `21`, `24` y `25`. Esas son precisamente las zonas que existen en la
   Ciudad de Guatemala: no hay zona 20, ni 22, ni 23. Una coincidencia así no es
   casualidad — si fueran municipios mal numerados, no habría razón para que
   faltaran justo esos tres números.

2. **El perfil es de capital.** El bloque `00-` es **97% urbano**
   (300,807 de 309,919) y **59% privado** (183,226). Ningún departamento
   completo tiene ese perfil; la Ciudad de Guatemala sí.

3. **`01-01` está prácticamente vacío.** El municipio `0101` es la capital, la
   más poblada del país. Bajo el prefijo `01-` tiene solo **323 registros y 6
   establecimientos**. Es un residuo: la capital real está codificada bajo `00-`.

Como control adicional: los números de establecimiento de los dos bloques casi
no se solapan (solo 1 en común), o sea son espacios de numeración distintos.

### Por qué esos códigos van al municipio `0101`

Si el segundo segmento es una zona de la capital, entonces **todo código
`00-NN-...` pertenece al municipio de Guatemala (`0101`), sin importar `NN`**.
Las zonas son subdivisiones *dentro* del municipio, no municipios.

Reemplazar `00` por `01` y leer el segundo segmento como municipio hace dos
daños a la vez:

- **inventa cinco municipios que no existen** (`0118`, `0119`, `0121`, `0124`,
  `0125`), y
- **reparte 236,746 inscripciones de la capital entre los otros 16 municipios**,
  inflándolos a todos.

Con la corrección, la capital queda con **310,242 inscripciones** (323 del
bloque `01-` más 309,919 del bloque `00-`), que la vuelve el municipio más
grande del país — consistente con Mixco (112,168) y Villa Nueva (105,078) como
segundo y tercero.

**Decidimos conservar el código original tal cual** (`00-18-0001-43`) en vez de
reescribirlo. Reescribirlo destruiría la zona, que es información real y
potencialmente útil. El municipio se deriva; el código se preserva.

**Cómo decirlo en el pitch:** *"La documentación decía que normalizáramos el
prefijo `00-` a `01-`. Lo hicimos y nuestro validador lo rechazó: producía
municipios inexistentes. Investigamos y resultó que ese segmento no es un
municipio, son las zonas de la capital — las 22 que existen, sin la 20, 22 ni
23. Lo confirmamos por tres vías. La corrección de la documentación estaba
incompleta, y lo detectamos porque la ingesta se valida a sí misma."*

> Si preguntan "¿y cómo saben que su interpretación es la correcta y no otra
> más?": la respuesta honesta es que las tres señales apuntan al mismo lugar y
> que, con la corrección, las cinco distribuciones publicadas por la
> organización cuadran al decimal. Con la interpretación anterior, no cuadraban.

---

## 3. Por qué el `9` (Ignorado) se conserva como etiqueta y no como nulo

**La decisión:** el código `9` se traduce a la palabra `"Ignorado"` y se queda
en la tabla. Nunca se convierte en nulo ni se descarta la fila.

**Por qué:**

- **No es un dato faltante, es una respuesta.** Los archivos no tienen celdas
  vacías. Cuando algo no se registró, el propio dataset escribe `9`. Es un valor
  deliberado del catálogo, igual que `1` o `2`.
- **Convertirlo en nulo borra filas reales.** Hay **178,091 celdas** con
  `Ignorado` en el dataset:

  | Columna | Filas con `Ignorado` |
  |---|---:|
  | `jornada` | 110,753 |
  | `graduando` | 67,168 |
  | `pueblo_pertenencia` | 118 |
  | `area` | 52 |

  Si se descartaran las filas con algún `Ignorado`, perderíamos ~4% de las
  inscripciones — y no al azar: esas inscripciones existen, el estudiante existe,
  solo falta un atributo.
- **Nos deja reportarlo honestamente.** El dashboard puede mostrar "Jornada:
  Matutina 62%, Vespertina 18%, …, Ignorado 2.6%". Eso es más honesto que un
  total que no suma o un nulo que el lector no sabe interpretar.
- **La decisión es explícita y está documentada**, que es justamente lo que pide
  el reto. Quien consuma el CSV ve `Ignorado` y sabe qué significa.

**Cómo decirlo en el pitch:** *"El 9 es un dato, no un hueco. Lo dejamos como
etiqueta 'Ignorado' para no borrar 178 mil registros reales y para poder
reportarlo en vez de esconderlo."*

---

## 4. Por qué el municipio sale del código del establecimiento y no de `Depto_mupio`

**La decisión:** el municipio se deriva del 2º segmento de
`CodEstablecimiento`. La columna `Depto_mupio` se descarta por completo.

**Por qué:** `Depto_mupio` **no varía dentro de cada archivo**. En
`el_progreso.xlsx`, las 49,803 filas traen el mismo valor: `201`. En los 22
archivos pasa lo mismo. Es un identificador del archivo, no de la fila, así que
es inútil para desagregar por municipio: usarlo daría un solo municipio por
departamento.

Además llega como **entero**, así que pierde el cero a la izquierda (`201`, no
`'0201'`) y ni siquiera cuadra de formato con el catálogo de municipios del
diccionario, que sí es texto de 4 dígitos.

El código de establecimiento, en cambio, codifica la jerarquía real:

```
02 - 01 - 0001 - 42
│    │     │      └── nivel educativo que ofrece
│    │     └───────── número del establecimiento
│    └─────────────── municipio dentro del departamento
└──────────────────── departamento
```

**Cómo lo verificamos:** en El Progreso, los 49,803 códigos dan exactamente 8
municipios (`01`–`08`), que es justo lo que el diccionario lista para ese
departamento. A nivel nacional, los 340 municipios derivados coinciden uno a uno
con los 340 del catálogo: **cero huérfanos y cero municipios sin inscripciones**.

---

## 5. Por qué existe `cod_establecimiento_base`

**La decisión:** además del código completo, emitimos sus 3 primeros segmentos
(`02-01-0001`).

**Por qué:** el 4º segmento del código **es el nivel educativo**. Un mismo
colegio que atiende primaria y básico aparece con dos códigos distintos. Contar
códigos únicos no es contar escuelas.

Los números reales:

| Medida | Valor |
|---|---:|
| Códigos completos distintos | 51,528 |
| Establecimientos distintos (`cod_establecimiento_base`) | **51,081** |
| Diferencia | 447 |

La inflación es pequeña —0.9%— pero es un error silencioso: nadie lo nota
mirando el dashboard, y es exactamente el tipo de cifra que un juez puede
cuestionar. Con la columna ahí, "cuántas escuelas hay" tiene una sola respuesta
defendible.

Es también la razón por la que el 4º segmento nos sirve de **control de
integridad**: debe corresponder al `Nivel` declarado en la fila
(`43`→Primaria, `45`→Básico, `46`→Diversificado, `44`→Primaria de adultos,
`40`/`41`/`42`→Preprimaria). La ingesta lo verifica en las 4,298,887 filas y
**no encontró ni una sola inconsistencia**. Es un buen dato para el pitch: dos
campos independientes del dataset concuerdan al 100%, lo que da confianza en que
estamos leyendo bien.

---

## 6. Qué herramientas de IA usamos y para qué

> Esta sección cubre el trabajo de ingesta. Los demás integrantes deben agregar
> lo suyo antes de entregar.

**Herramienta:** Claude Code (modelo Opus), usado como asistente de desarrollo
en terminal, con acceso a los archivos del proyecto.

**Para qué la usamos:**

| Tarea | Papel de la IA | Papel humano |
|---|---|---|
| Leer la documentación del reto | Resumir las 5 secciones y extraer las trampas del dataset | Definir el alcance |
| Inspeccionar los `.xlsx` | Ejecutar el perfilado de columnas, tipos y hojas | Pedir ver el esquema real **antes** de escribir código |
| Diseñar la arquitectura | Proponer la separación en módulos | Elegir el stack y aprobar el diseño |
| Escribir los 8 módulos | Redactar el código | Fijar los requisitos y revisar |
| Investigar el prefijo `00-` | Ejecutar los tres análisis de confirmación | Pedir investigar en vez de parchar |

**Lo que conviene contar tal cual, porque juega a favor:**

La IA implementó primero la regla del prefijo `00-` **tal como la documentación
del reto la describía** — y estaba mal. No lo detectó ella: lo detectó el
validador que habíamos decidido meter dentro del parser. La instrucción explícita
fue *"que falle ruidosamente si algo no cuadra"*, y esa decisión de diseño es la
que atrapó el error.

Es decir: el valor no estuvo en que la IA escribiera el código, sino en que el
diseño que le pedimos obligara a comprobar sus propios resultados.

**Cómo decirlo en el pitch:** *"Usamos Claude Code para escribir el módulo. Lo
que nos salvó no fue la IA sino una decisión de diseño: exigimos que el parser
validara contra las cifras publicadas y se detuviera si no cuadraban. La primera
versión, escrita siguiendo la documentación al pie de la letra, no pasó esa
validación — y por eso encontramos el error."*

---

## 7. Limitaciones conocidas

### Del dataset (no las podemos resolver)

- **Solo el ciclo 2024.** No hay comparación entre años, ni tendencias, ni
  "creció o cayó". Cualquier afirmación de cambio en el tiempo sería inventada.
- **No hay identificador de estudiante.** Imposible seguir una trayectoria o
  saber si quien se retiró volvió. Una fila es una inscripción, no una persona:
  si alguien se inscribió en dos establecimientos, son dos filas.
- **No incluye** calificaciones, edad, discapacidad, datos socioeconómicos, ni
  información de docentes o infraestructura.
- **`Modalidad` (bilingüe/monolingüe) está en el diccionario pero no en los
  datos.** La ingesta la ignora explícitamente. No se puede derivar.
- **No trae geometría.** No hay coordenadas ni polígonos; el mapa necesita un
  GeoJSON de fuente externa, pública y citada.
- **El retiro se concentra en un solo código.** `Resultado_F = 4` ("Retirado
  definitivo") casi no aparece; el retiro real está en el código `3`. Al hablar
  de deserción hay que decir qué se está contando.

### De nuestra implementación (decisiones que pueden revisarse)

- **Las zonas de la capital se pierden en el agregado por municipio.** Las
  conservamos dentro de `cod_establecimiento`, pero no las expusimos como
  columna propia. Si se quisiera un mapa por zonas de la Ciudad de Guatemala,
  habría que extraerlas — el dato está ahí.
- **Los códigos `00-` y `01-` se tratan como espacios de numeración separados.**
  Un establecimiento que apareciera en ambos se contaría dos veces. Medimos el
  solapamiento: solo 1 número de establecimiento en común, así que el efecto es
  despreciable, pero no es cero.
- **La etiqueta de grado la construimos nosotros** (`"4 Preprimaria"`). El
  diccionario no trae nombres de grado; combinamos el número con el nivel porque
  un "1" de primaria no es un "1" de básico. Es una decisión de presentación, no
  un dato oficial.
- **La validación es estricta por diseño.** Si el INE republica los archivos con
  una zona nueva o un código no catalogado, la ingesta se detiene en vez de
  adivinar. Es intencional, pero significa que hay que mantener `esquema.py`.
- **No hay pruebas automatizadas** en el sentido clásico. Las verificaciones
  viven dentro del parser y corren sobre los datos reales; con más tiempo, valdría
  separarlas en un set de pruebas con archivos pequeños de ejemplo.
