"""Consultas a las tablas de agregados.

La API no calcula nada: lee lo que `refresh_agregados()` dejó precalculado. Así
el dashboard, el mapa y el agente leen siempre la misma cifra, y ninguna
petición escanea los 4.3 millones de microdatos.
"""

from __future__ import annotations

from typing import Any

from .db import consultar, consultar_una

# Dimensión expuesta por la API -> tabla que la respalda.
TABLAS_POR_DIMENSION: dict[str, str] = {
    "departamento": "agg_departamento",
    "nivel": "agg_nivel",
    "sector": "agg_sector",
    "area": "agg_area",
    "municipio": "agg_municipio",
}

# Se ordena por `orden` cuando existe (departamento, nivel, municipio) y por
# tamaño cuando no (sector, área), para que las listas salgan siempre igual.
_SQL_AGREGADOS = """
    SELECT clave, etiqueta, padre, orden, total,
           promovidos, no_promovidos, retirados, vigentes, ignorados,
           repitentes, graduandos,
           tasa_promocion, tasa_no_promocion, tasa_retiro, tasa_repitencia
    FROM {tabla}
    ORDER BY orden NULLS LAST, total DESC
"""


def agregados(dimension: str) -> list[dict[str, Any]]:
    """Filas de una dimensión, ya ordenadas."""
    tabla = TABLAS_POR_DIMENSION[dimension]
    # `tabla` sale del diccionario de arriba, nunca del usuario.
    return consultar(_SQL_AGREGADOS.format(tabla=tabla))


def departamento_nivel() -> list[dict[str, Any]]:
    """El cruce departamento × nivel: la desagregación que pide el reto."""
    return consultar(
        """
        SELECT departamento_codigo, departamento, nivel_codigo, nivel,
               total, promovidos, no_promovidos, retirados, tasa_promocion
        FROM agg_departamento_nivel
        ORDER BY departamento_codigo, nivel_codigo NULLS LAST
        """
    )


def resumen_nacional() -> dict[str, Any]:
    """KPIs de portada. Es una sola fila precalculada, no un recuento al vuelo."""
    fila = consultar_una(
        """
        SELECT inscripciones, departamentos, municipios, escuelas,
               tasa_promocion, tasa_no_promocion, tasa_retiro, tasa_repitencia
        FROM agg_resumen
        """
    )
    return dict(fila) if fila else {}
