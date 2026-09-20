# El agente: preguntas en lenguaje natural

Tercer componente del reto. Responde preguntas sobre los datos —y sobre el
análisis del dashboard— **sin inventar cifras** y diciendo cuándo algo no se
puede saber.

## Cómo se usa

Requiere Postgres cargado (ver el README) y una llave de OpenAI en `.env`
(ver `env.example`). La llave nunca va al repositorio: `.env` está en `.gitignore`.
**Sin llave el chat no se rompe:** responde el buscador determinista de
`api/buscador.py` y la respuesta trae `con_ia: false`.

```bash
pip install -r requirements.txt

# Desde la terminal, sin levantar nada más:
python -m agente "¿cuántos estudiantes de primaria hay en Alta Verapaz?"
python -m agente --contexto Quiché --ver-consultas "¿cuántas escuelas hay?"

# Como servicio, para el dashboard (levanta API + frontend):
cd React-UI && npm run dev             # chat en http://localhost:5173

# Preguntas de control (18 casos con respuesta conocida; gasta centavos):
python -m agente.evaluacion
```

Contrato del endpoint:

```
POST /api/chat
{ "pregunta": "...", "contexto": ["Quiché"], "historial": [{"role": "user", "content": "..."}] }
→ { "respuesta": "...", "con_ia": true, "cifras": [], "consultas": [{ "herramienta", "argumentos", "resultado" }] }
```

`con_ia` dice quién respondió. Con el agente, el rastro va en `consultas`; con el
buscador de respaldo, las filas usadas van en `cifras`.

`contexto` es lo que la persona tiene seleccionado en el mapa. `consultas` es el
rastro de lo que el agente le pidió a la base: de ahí sale cada cifra.

## Cómo funciona

```
pregunta → modelo → pide una herramienta → SQL parametrizado → Postgres
                  ← filas agregadas (pocas) ←
         → redacta la respuesta con esas cifras
```

El modelo **no ve las 4.3 millones de filas ni escribe SQL**. Elige qué consultar
de una lista cerrada; nuestro código arma la consulta, la ejecuta y le devuelve
unas pocas filas ya agregadas. Los números los calcula Postgres; el modelo solo
los explica.

| Módulo | Responsabilidad |
|---|---|
| `catalogo.py` | Lista cerrada de dimensiones y métricas. No ejecuta nada. |
| `consultas.py` | Valida, arma el SQL parametrizado y lo ejecuta en solo lectura. |
| `herramientas.py` | Lo que el modelo puede pedir (esquemas) y quién lo ejecuta. |
| `instrucciones.py` | Qué debe saber el modelo del dataset y cómo debe hablar. |
| `agente.py` | El bucle modelo ↔ herramientas. |
| `evaluacion.py` | Preguntas de control con respuesta conocida. |
| `api/main.py` (`/api/chat`) | Capa HTTP delgada: llama a `agente.responder()` y, si no hay llave o falla el modelo, cae a `api/buscador.py`. |

## Decisiones y por qué

**Solo responde con los datos cargados.** El agente no tiene herramientas de
internet: las dos que tiene consultan nuestro Postgres, así que no puede traer
nada de afuera. Lo que sí podría hacer es contestar con el conocimiento general
del modelo, y las instrucciones se lo prohíben aunque sepa la respuesta, aunque
el tema sea Guatemala y aunque la persona insista o le pida ignorar sus reglas;
tampoco recomienda sitios web. Esta parte es una regla de comportamiento, no una
garantía de código, por eso `evaluacion.py` la vigila con cinco casos (el
Mundial, una capital, la población del país, una multiplicación con intento de
saltarse las reglas y un poema) que fallan si aparece la respuesta.

**Herramienta parametrizada en vez de SQL libre.** Dejar que el modelo escriba SQL
es más flexible, pero puede inventar columnas, olvidar un filtro o calcular mal
una tasa, y el error no se nota. Con una lista cerrada, una consulta que no
existe se rechaza y el modelo lo sabe. Costo: solo responde lo que el catálogo
contempla (13 dimensiones, 13 métricas, cualquier combinación de filtros).

**Las tasas las calcula Postgres, no el modelo.** Los modelos de lenguaje se
equivocan dividiendo. Cada porcentaje es una métrica con su fórmula en
`catalogo.py`, la misma de `tablas/03_agregados.sql`, para que el chat y el
dashboard den siempre la misma cifra.

**Un solo redondeo, y lo hace Postgres.** Los porcentajes salen de SQL ya con un
decimal. Si el modelo recibiera `20.95` y lo llevara a un decimal diría `21.0`,
cuando el dato exacto (20.9457) redondea a `20.9`, que es la cifra publicada.

**Respuestas con estructura fija, en Markdown.** Toda respuesta sigue el mismo
orden: la respuesta directa con la cifra clave en negrita; el detalle (lista si
son dos grupos, tabla de máximo tres columnas si son más, porque el panel mide
~350 px); y, rara vez, una nota. Para comparar lugares de distinto tamaño se
ordena por porcentaje y no por conteo: por número de retirados "gana" Guatemala
solo por ser el departamento más grande, cuando la tasa más alta es la de Petén.
La UI lo dibuja con `react-markdown` (`ChatMarkdown.tsx`), que no interpreta HTML
y en el que desactivamos enlaces e imágenes.

**Un filtro que no existe es un error, no un cero.** Si el modelo filtra por
`"Kiche"`, SQL devolvería 0 filas y el agente diría "hay 0 estudiantes": una
cifra inventada por accidente. `consultas.py` corrige solo las diferencias de
tildes y mayúsculas (`quiche` → `Quiché`) y rechaza lo demás con sugerencias.

**Municipios con nombre repetido.** Hay al menos seis ("San José" está en Petén y
en Escuintla). Filtrar solo por nombre sumaría dos municipios distintos, así que
se exige el departamento y el agente se lo pregunta a la persona.

**Solo lectura y con límites.** La conexión va con
`default_transaction_read_only=on` y 15 s de tiempo máximo; el bucle tiene un tope
de 6 vueltas para que una pregunta no pueda gastar saldo sin fin.

**Los catálogos van en las instrucciones, leídos de la base.** Al arrancar, una
sola consulta (`GROUPING SETS`) trae los valores reales de cada dimension
—departamentos, niveles, jornadas...— y se los da al modelo. Antes los pedía con
`listar_valores` y cada pregunta tardaba 17 s; ahora filtra bien al primer
intento y responde en ~5 s. Los 340 municipios no caben ahí: para esos sigue la
herramienta. Como salen de la base y no del código, no se pueden desincronizar.

**Esfuerzo de razonamiento bajo.** Elegir una consulta no requiere razonar mucho;
`OPENAI_REASONING_EFFORT=low` reduce la espera sin que fallen las preguntas de
control.

**El agente es independiente de la API.** `agente/` no importa FastAPI ni `api/`:
se prueba desde la terminal y el endpoint solo traduce HTTP. Por eso lee `.env`
con `python-dotenv` en vez de reutilizar el cargador de `api/db.py`.

**Degradación en vez de caída.** Sin llave de OpenAI, o con el modelo caído, el
endpoint responde con el buscador determinista sobre las tablas `agg_*` y marca
`con_ia: false`. Quien clone el repo sin llave igual ve un chat que funciona, y
la demo no depende de que OpenAI esté arriba.

**Consulta `inscripciones` directamente.** Las tablas `agg_*` sirven al dashboard,
pero no pueden cruzar, por ejemplo, sexo × nivel × departamento. Un agregado
sobre los 4.3 M de filas tarda ~1 s con los índices actuales.

## Limitaciones conocidas

- **El modelo puede equivocarse al elegir la consulta** (por ejemplo, olvidar un
  filtro). El campo `consultas` de la respuesta permite auditarlo, y
  `evaluacion.py` lo vigila con casos conocidos, pero no lo impide.
- **No explica causas.** Los datos dicen qué pasa y dónde, no por qué; las
  instrucciones le piden decirlo así.
- **Un decimal contra dos.** El agente redondea los porcentajes a un decimal y las
  tablas `agg_*` a dos (`11.2%` y `11.20%`). Misma definición, distinta precisión.
- **El análisis del dashboard no se lee de una fuente común.** Cuando le preguntan
  "por qué señalas ese nivel como el más crítico", el agente recalcula el criterio
  con sus herramientas. Si el dashboard cambia de criterio, hay que alinear
  `instrucciones.py`.
- **La evaluación es por coincidencia de texto.** Atrapa cifras equivocadas, no
  juzga la calidad de la redacción.
- **Latencia de ~5 s por pregunta** (una llamada al modelo para elegir la consulta,
  ~1 s de Postgres y otra para redactar). No hay respuesta en streaming.
- **Memoria corta:** se envían los últimos 10 mensajes de la conversación.

## Herramientas de IA

- **OpenAI (`gpt-5-mini` por defecto, configurable con `OPENAI_MODEL`)** es el
  modelo del agente, vía el SDK oficial `openai` con llamadas a funciones.
- **Claude Code** se usó como asistente para escribir estos módulos. El diseño
  —herramienta cerrada, tasas en SQL, errores en vez de ceros— se decidió antes
  de escribir código y se verificó contra cifras conocidas de la base.
