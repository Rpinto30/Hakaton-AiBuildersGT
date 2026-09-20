"""Respuestas del chat, por ahora sin modelo de lenguaje.

Busca en las etiquetas de los agregados las que aparecen en la pregunta y
devuelve sus cifras exactas. No redacta números: los lee de las mismas tablas
que alimentan el dashboard, así que el chat y las gráficas nunca se contradicen.

Cuando se conecte el modelo de lenguaje, lo que cambia es la redacción: las
cifras deben seguir saliendo de `buscar_filas()`, nunca del modelo.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from .consultas import TABLAS_POR_DIMENSION, agregados, resumen_nacional

# Dimensiones en las que se busca, de la más específica a la más general.
ORDEN_DE_BUSQUEDA = ("municipio", "departamento", "nivel", "sector", "area")
MAXIMO_COINCIDENCIAS = 3
LARGO_MINIMO_ETIQUETA = 4  # evita que "Si" o "No" disparen coincidencias


def _normalizar(texto: str) -> str:
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^a-z0-9 ]", " ", sin_tildes.lower())


def buscar_filas(pregunta: str, contexto: list[str]) -> tuple[str | None, list[dict[str, Any]]]:
    """Devuelve (dimensión, filas) cuyas etiquetas aparecen en la pregunta."""
    agujas = _normalizar(" ".join([pregunta, *contexto]))

    for dimension in ORDEN_DE_BUSQUEDA:
        if dimension not in TABLAS_POR_DIMENSION:
            continue
        encontradas = [
            fila
            for fila in agregados(dimension)
            if len(fila["etiqueta"]) >= LARGO_MINIMO_ETIQUETA
            and _normalizar(fila["etiqueta"]) in agujas
        ]
        if encontradas:
            return dimension, encontradas[:MAXIMO_COINCIDENCIAS]
    return None, []


def _miles(numero: int) -> str:
    """Separador de miles con espacio, sin tocar las comas de la frase."""
    return f"{numero:,}".replace(",", " ")


def _describir(fila: dict[str, Any]) -> str:
    return (
        f"{fila['etiqueta']}: {_miles(fila['total'])} inscripciones en 2024. "
        f"Promoción {fila['tasa_promocion']}%, no promoción {fila['tasa_no_promocion']}%, "
        f"retiro {fila['tasa_retiro']}%, repitencia {fila['tasa_repitencia']}%."
    )


def responder(pregunta: str, contexto: list[str]) -> dict[str, Any]:
    """Arma la respuesta del chat a partir de cifras reales."""
    _dimension, filas = buscar_filas(pregunta, contexto)

    if filas:
        cuerpo = " ".join(_describir(fila) for fila in filas)
        nota = (
            " (Respuesta armada directamente de los agregados; el asistente con "
            "IA todavía no está conectado.)"
        )
        return {"respuesta": cuerpo + nota, "con_ia": False, "cifras": filas}

    resumen = resumen_nacional()
    if not resumen:
        return {
            "respuesta": "Todavía no hay datos cargados en la base.",
            "con_ia": False,
            "cifras": [],
        }

    return {
        "respuesta": (
            "No identifiqué un departamento, municipio, nivel, sector ni área en tu "
            "pregunta, así que no puedo responderla con datos. A nivel nacional hay "
            f"{_miles(resumen['inscripciones'])} inscripciones en 2024 con "
            f"{resumen['tasa_promocion']}% de promoción. "
            "Prueba nombrando un lugar, por ejemplo «¿cómo va Alta Verapaz?»."
        ),
        "con_ia": False,
        "cifras": [],
    }
