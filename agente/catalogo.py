"""Contrato del agente: que dimensiones y que metricas se pueden consultar.

Este modulo no ejecuta nada. Es la lista cerrada de lo que el modelo puede
pedir: si un nombre no esta aqui, la consulta se rechaza. Todo el SQL que llega
a Postgres se arma con fragmentos de este archivo, nunca con texto del modelo.

Las definiciones de las metricas son las mismas que usa tablas/03_agregados.sql
para que el chat y el dashboard den siempre la misma cifra.
"""

from __future__ import annotations

TABLA = "inscripciones"

# Los porcentajes se redondean UNA vez, en Postgres y sobre el valor exacto. Si el
# modelo recibiera 20.95 y lo llevara a un decimal diria 21.0, cuando el dato es 20.9.
DECIMALES_DE_PORCENTAJE = 1

# --- Dimensiones: nombre que ve el modelo -> columnas que se devuelven ---
# El municipio trae su codigo y su departamento porque hay nombres repetidos
# ("San Jose" existe en Peten y en Escuintla): el nombre solo no identifica.
DIMENSIONES: dict[str, tuple[str, ...]] = {
    "departamento": ("departamento",),
    "municipio": ("municipio_codigo", "municipio", "departamento"),
    "sector": ("sector",),
    "area": ("area",),
    "sexo": ("sexo",),
    "nivel": ("nivel",),
    "grado": ("grado",),
    "pueblo_pertenencia": ("pueblo_pertenencia",),
    "plan_estudio": ("plan_estudio",),
    "jornada": ("jornada",),
    "resultado_final": ("resultado_final",),
    "repitente": ("repitente",),
    "graduando": ("graduando",),
}

# Columnas que dan el orden natural (Preprimaria antes que Primaria). Se agregan
# al GROUP BY para poder ordenar por ellas, pero no se devuelven.
ORDEN_NATURAL: dict[str, tuple[str, ...]] = {
    "departamento": ("departamento_codigo",),
    "municipio": ("municipio_codigo",),
    "nivel": ("nivel_codigo",),
    "grado": ("nivel_codigo", "grado_codigo"),
}

# --- Condiciones con las que se construyen los conteos y las tasas ---
# 'Retirado definitivo' casi no aparece; se suma a 'Retirado' (ver decisiones.md).
# Las etiquetas 'Si' y 'Si es graduando' van sin tilde: asi vienen del INE.
_CONDICIONES: dict[str, tuple[str, str]] = {
    "promovidos": ("resultado_final = 'Promovido'", "aprobaron el ciclo"),
    "no_promovidos": ("resultado_final = 'No promovido'", "no aprobaron el ciclo"),
    "retirados": (
        "resultado_final IN ('Retirado', 'Retirado definitivo')",
        "se retiraron durante el ciclo",
    ),
    "repitentes": ("repitente = 'Si'", "estan repitiendo el grado"),
    "graduandos": ("graduando = 'Si es graduando'", "se graduan en 2024"),
}


def _metricas() -> dict[str, tuple[str, str]]:
    """Arma cada metrica una sola vez: nombre -> (expresion SQL, descripcion)."""
    metricas = {
        "inscripciones": ("count(*)", "Numero de inscripciones (filas) del grupo."),
        "establecimientos": (
            "count(DISTINCT cod_establecimiento_base)",
            "Numero de escuelas reales. Un centro con varios niveles cuenta una vez.",
        ),
        "pct_del_total": (
            f"round(100.0 * count(*) / sum(count(*)) OVER (), {DECIMALES_DE_PORCENTAJE})",
            "Porcentaje que representa cada grupo sobre la suma de todos los "
            "grupos devueltos, respetando los filtros.",
        ),
    }
    for nombre, (condicion, significado) in _CONDICIONES.items():
        metricas[nombre] = (
            f"count(*) FILTER (WHERE {condicion})",
            f"Inscripciones que {significado}.",
        )
        metricas[f"pct_{nombre}"] = (
            f"round(100.0 * count(*) FILTER (WHERE {condicion}) / NULLIF(count(*), 0), "
            f"{DECIMALES_DE_PORCENTAJE})",
            f"Porcentaje de las inscripciones del grupo que {significado}. "
            "El denominador es todo el grupo, incluidos Vigente e Ignorado.",
        )
    return metricas


METRICAS: dict[str, tuple[str, str]] = _metricas()

LIMITE_POR_DEFECTO = 25
LIMITE_MAXIMO = 340  # alcanza para listar todos los municipios del pais
