"""Las herramientas que el modelo puede usar, y quien las ejecuta.

Los esquemas se generan desde catalogo.py: si se agrega una dimension o una
metrica alla, el modelo la ve aqui sin tocar nada mas.

`ejecutar` nunca lanza: cualquier problema vuelve como {"error": ...} para que
el modelo lo lea, corrija la consulta o se lo explique a la persona.
"""

from __future__ import annotations

import json

import psycopg

from .catalogo import DIMENSIONES, LIMITE_MAXIMO, LIMITE_POR_DEFECTO, METRICAS
from .consultas import (
    ORDEN_POR_GRUPO,
    ConsultaInvalida,
    consultar,
    municipios_de,
    valores_de,
)

_DIMENSIONES = sorted(DIMENSIONES)
_METRICAS = list(METRICAS)
_GLOSARIO_DE_METRICAS = "\n".join(f"- {nombre}: {texto}" for nombre, (_, texto) in METRICAS.items())


def _funcion(nombre: str, descripcion: str, propiedades: dict) -> dict:
    """Esquema estricto: todos los campos son obligatorios; los opcionales aceptan null."""
    return {
        "type": "function",
        "function": {
            "name": nombre,
            "description": descripcion,
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": propiedades,
                "required": list(propiedades),
                "additionalProperties": False,
            },
        },
    }


HERRAMIENTAS: list[dict] = [
    _funcion(
        "consultar_inscripciones",
        "Calcula conteos y porcentajes sobre las 4.3 millones de inscripciones de 2024. "
        "Es la UNICA fuente de cifras: usala para cualquier numero que vayas a afirmar. "
        "Pide varias metricas en una sola llamada cuando se comparan.\n"
        f"Metricas:\n{_GLOSARIO_DE_METRICAS}",
        {
            "metricas": {
                "type": "array",
                "items": {"type": "string", "enum": _METRICAS},
                "description": "Que calcular. Al menos una.",
            },
            "agrupar_por": {
                "type": "array",
                "items": {"type": "string", "enum": _DIMENSIONES},
                "description": "Dimensiones por las que desagregar. Vacio = un solo total.",
            },
            "filtros": {
                "type": "array",
                "description": "Condiciones que deben cumplirse todas. Vacio = todo el pais.",
                "items": {
                    "type": "object",
                    "properties": {
                        "columna": {"type": "string", "enum": _DIMENSIONES},
                        "valores": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Valores aceptados, con el nombre legible "
                            "(p. ej. 'Alta Verapaz', 'Primaria', 'Mujer').",
                        },
                    },
                    "required": ["columna", "valores"],
                    "additionalProperties": False,
                },
            },
            "ordenar_por": {
                "type": ["string", "null"],
                "description": f"Una de las metricas pedidas, o '{ORDEN_POR_GRUPO}' para el "
                "orden natural (Preprimaria antes que Primaria). null = primera metrica.",
            },
            "descendente": {"type": "boolean", "description": "true = de mayor a menor."},
            "limite": {
                "type": ["integer", "null"],
                "description": f"Filas a devolver (por defecto {LIMITE_POR_DEFECTO}, "
                f"maximo {LIMITE_MAXIMO}).",
            },
        },
    ),
    _funcion(
        "listar_valores",
        "Lista los valores que existen en una dimension (p. ej. que jornadas o que "
        "municipios hay). Usala antes de filtrar cuando no estes seguro del nombre.",
        {
            "columna": {"type": "string", "enum": _DIMENSIONES},
            "departamento": {
                "type": ["string", "null"],
                "description": "Solo para 'municipio': limita la lista a un departamento.",
            },
        },
    ),
]


def _listar_valores(columna: str, departamento: str | None = None) -> dict:
    if columna == "municipio":
        return {"municipios": municipios_de(departamento)}
    return {"valores": list(valores_de(columna))}


_EJECUTORES = {
    "consultar_inscripciones": consultar,
    "listar_valores": _listar_valores,
}


def ejecutar(nombre: str, argumentos_json: str) -> dict:
    """Corre una herramienta con los argumentos que envio el modelo."""
    ejecutor = _EJECUTORES.get(nombre)
    if ejecutor is None:
        return {"error": f"La herramienta {nombre!r} no existe."}
    try:
        argumentos = json.loads(argumentos_json or "{}")
        return ejecutor(**argumentos)
    except (json.JSONDecodeError, TypeError) as error:
        return {"error": f"Argumentos invalidos para {nombre}: {error}"}
    except ConsultaInvalida as error:
        return {"error": str(error)}
    except psycopg.Error as error:
        return {"error": f"La base de datos no pudo responder: {error}".strip()}
