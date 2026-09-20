"""Lee la configuracion del agente desde el entorno (o desde .env).

Nada de esto se escribe en el codigo: la llave de OpenAI y la URL de la base
viven en .env, que no se versiona. Ver env.example.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

RAIZ_DEL_REPOSITORIO = Path(__file__).resolve().parent.parent

MODELO_POR_DEFECTO = "gpt-5-mini"
# Elegir una consulta no requiere razonar mucho, y "low" responde bastante mas rapido.
# Vacio = no se envia (para modelos que no aceptan el parametro).
ESFUERZO_POR_DEFECTO = "low"
SEGUNDOS_POR_CONSULTA_SQL = 15
SEGUNDOS_POR_LLAMADA_AL_MODELO = 60


class ErrorDeConfiguracion(RuntimeError):
    """Falta una variable de entorno sin la cual el agente no puede trabajar."""


@dataclass(frozen=True)
class Configuracion:
    url_base_de_datos: str
    llave_openai: str
    modelo: str
    esfuerzo: str | None


def _exigir(nombre: str) -> str:
    valor = os.getenv(nombre, "").strip()
    if not valor:
        raise ErrorDeConfiguracion(
            f"Falta la variable {nombre}. Copia env.example a .env y completala."
        )
    return valor


def url_base_de_datos() -> str:
    """URL de Postgres. Se pide aparte porque las consultas no necesitan la llave."""
    load_dotenv(RAIZ_DEL_REPOSITORIO / ".env")
    return _exigir("DATABASE_URL")


def cargar() -> Configuracion:
    """Configuracion completa; falla con un mensaje claro si algo falta."""
    load_dotenv(RAIZ_DEL_REPOSITORIO / ".env")
    return Configuracion(
        url_base_de_datos=_exigir("DATABASE_URL"),
        llave_openai=_exigir("OPENAI_API_KEY"),
        modelo=os.getenv("OPENAI_MODEL", "").strip() or MODELO_POR_DEFECTO,
        esfuerzo=os.getenv("OPENAI_REASONING_EFFORT", ESFUERZO_POR_DEFECTO).strip() or None,
    )
