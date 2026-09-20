"""Contrato del dataset: nombres, mapeos y valores esperados.

Este modulo no ejecuta nada. Concentra todo lo que "sabemos" del dataset para
que las reglas vivan en un solo lugar y el resto de modulos no tenga literales
sueltos. Si el INE republica los archivos con otro formato, se corrige aqui.
"""

from __future__ import annotations

# --- Columnas tal como vienen en los .xlsx (orden exacto del encabezado) ---
COLUMNAS_CRUDAS: tuple[str, ...] = (
    "Año", "CodEstablecimiento", "Departamento_F", "Depto_mupio", "Sector",
    "Área", "Sexo", "Grado", "Nivel", "Pueblo_Per", "Plan_Est",
    "Jornada_Est", "Resultado_F", "Repitente", "Graduando",
)

# --- Crudo -> nombre normalizado (sin acentos ni ñ, apto para Postgres) ---
RENOMBRES: dict[str, str] = {
    "Año": "anio",
    "CodEstablecimiento": "cod_establecimiento",
    "Departamento_F": "departamento",
    "Depto_mupio": "depto_mupio",          # se descarta: constante por archivo
    "Sector": "sector",
    "Área": "area",
    "Sexo": "sexo",
    "Grado": "grado",
    "Nivel": "nivel",
    "Pueblo_Per": "pueblo_pertenencia",
    "Plan_Est": "plan_estudio",
    "Jornada_Est": "jornada",
    "Resultado_F": "resultado_final",
    "Repitente": "repitente",
    "Graduando": "graduando",
}

# Columna que existe en los datos pero no aporta (valor constante por archivo).
COLUMNAS_DESCARTADAS: frozenset[str] = frozenset({"depto_mupio"})

# --- Mapeo explicito: bloque del diccionario -> columna normalizada ---
# Los nombres NO coinciden entre el diccionario y los datos, asi que se declara
# a mano. Un bloque que no aparezca aqui hace fallar la carga a proposito.
VARIABLE_DICC_A_COLUMNA: dict[str, str] = {
    "Sector": "sector",
    "Área": "area",
    "Sexo": "sexo",
    "Nivel": "nivel",
    "Pueblo de Pertenencia": "pueblo_pertenencia",
    "Plan de estudio": "plan_estudio",
    "Jornada": "jornada",
    "Resultado Final": "resultado_final",
    "Repitente": "repitente",
    "Graduando": "graduando",
}

# Bloques del diccionario que se ignoran deliberadamente:
#  - "Modalidad": documentada pero ausente en los 22 archivos de datos.
#  - "Año": su unica fila es 2024 -> "Año", una etiqueta sin valor informativo.
VARIABLES_DICC_IGNORADAS: frozenset[str] = frozenset({"Modalidad", "Año"})

# Encabezado de las dos hojas del diccionario.
ENCABEZADO_DICCIONARIO: tuple[str, str, str] = ("Valor", "Código", "Etiqueta")
HOJA_VARIABLES = "Variables"
HOJA_GEOGRAFIA = "Departamentos y municipios"
BLOQUE_DEPARTAMENTOS = "Departamentos"
BLOQUE_MUNICIPIOS = "Municipios"

# --- Codigo de establecimiento: DD-MM-NNNN-SS ---
# El 4o segmento repite el nivel educativo. Sirve de control cruzado.
SEGMENTO_NIVEL_A_NIVEL: dict[str, int] = {
    "40": 1, "41": 1, "42": 1,   # preprimaria
    "43": 2,                     # primaria
    "44": 5,                     # primaria de adultos
    "45": 3,                     # basico
    "46": 4,                     # diversificado
}

# Prefijo irregular de guatemala.xlsx (~36% de sus filas, 309,919 registros).
#
# NO es un "01" mal escrito. Verificado sobre los datos: cuando el 1er segmento
# es "00", el 2o segmento NO es un municipio sino una ZONA de la Ciudad de
# Guatemala. Los valores observados son {01..19, 21, 24, 25}, que son
# exactamente las zonas que existen en la capital (no hay zona 20, 22 ni 23).
# Ese bloque es 97% urbano y 59% privado: perfil de capital.
#
# Por eso todo codigo "00-NN-..." pertenece al municipio 0101 (Guatemala),
# sin importar NN. Reemplazar "00" por "01" y leer el 2o segmento como
# municipio produce municipios inexistentes (0118, 0119, 0121, 0124, 0125) y
# atribuye mal ~310 mil registros.
PREFIJO_CAPITAL_POR_ZONA = "00"
DEPARTAMENTO_DE_LA_CAPITAL = 1
MUNICIPIO_DE_LA_CAPITAL = "0101"
ZONAS_CAPITAL: frozenset[str] = frozenset(
    {f"{n:02d}" for n in range(1, 20)} | {"21", "24", "25"}
)

# --- Rangos validos de Grado segun Nivel (el grado solo se lee con el nivel) ---
RANGOS_GRADO: dict[int, tuple[int, int]] = {
    1: (0, 6),   # preprimaria
    2: (1, 6),   # primaria
    3: (1, 3),   # basico
    4: (4, 7),   # diversificado
    5: (1, 4),   # primaria de adultos
}

ANIO_ESPERADO = 2024

# --- Cifras de control publicadas por la organizacion ---
REGISTROS_ESPERADOS: dict[str, int] = {
    "alta_verapaz": 391085, "baja_verapaz": 81736, "chimaltenango": 166965,
    "chiquimula": 127409, "el_progreso": 49803, "escuintla": 207618,
    "guatemala": 863879, "huehuetenango": 316771, "izabal": 120326,
    "jalapa": 99625, "jutiapa": 134571, "peten": 169629,
    "quetzaltenango": 232627, "quiche": 268998, "retalhuleu": 98128,
    "sacatepequez": 91552, "san_marcos": 303565, "santa_rosa": 108264,
    "solola": 122831, "suchitepequez": 159287, "totonicapan": 113139,
    "zacapa": 71079,
}
TOTAL_ESPERADO = 4_298_887
MUNICIPIOS_GUATEMALA_ESPERADOS = 17

# Distribuciones publicadas (porcentaje). Se comparan al final con tolerancia.
DISTRIBUCIONES_ESPERADAS: dict[str, dict[str, float]] = {
    "sector": {"Público": 74.7, "Privado": 20.9, "Cooperativa": 4.0, "Municipal": 0.3},
    "area": {"Rural": 61.4, "Urbana": 38.6},
    "sexo": {"Hombre": 50.7, "Mujer": 49.3},
    "nivel": {"Primaria": 56.4, "Básico": 17.8, "Preprimaria": 17.1, "Diversificado": 8.5},
    "resultado_final": {"Promovido": 85.2, "No promovido": 9.2, "Retirado": 5.5},
}
TOLERANCIA_PORCENTUAL = 0.15  # puntos porcentuales

# --- Columnas del CSV de salida, en orden ---
# Donde el orden importa (departamento, nivel, grado) se conserva el codigo
# numerico ademas de la etiqueta, para poder ordenar sin reinventar el catalogo.
COLUMNAS_SALIDA: tuple[str, ...] = (
    "anio",
    "cod_establecimiento",
    "cod_establecimiento_base",
    "departamento_codigo",
    "departamento",
    "municipio_codigo",
    "municipio",
    "sector",
    "area",
    "sexo",
    "nivel_codigo",
    "nivel",
    "grado_codigo",
    "grado",
    "pueblo_pertenencia",
    "plan_estudio",
    "jornada",
    "resultado_final",
    "repitente",
    "graduando",
)
