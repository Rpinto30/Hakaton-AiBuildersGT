"""Acceso a Postgres.

Todas las consultas de la API van contra las tablas `agg_*`, que son chicas
(de 2 a 340 filas). Por eso no hace falta un pool: abrir una conexión por
petición es suficiente y mantiene el código simple.

La única consulta que toca los 4.3 M de microdatos es la de conteos globales
(municipios y escuelas distintas), y su resultado se cachea en memoria porque
el dataset no cambia mientras el servicio está arriba.
"""

from __future__ import annotations

import os
import re
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

VARIABLE_URL = "DATABASE_URL"

# 127.0.0.1 y no "localhost" a propósito. docker-compose publica el puerto solo
# en 127.0.0.1, así que ::1 (el localhost IPv6, que el sistema resuelve
# primero) no tiene nadie escuchando: cada conexión agota su timeout antes de
# reintentar por IPv4. Medido en esta máquina: 130 s con "localhost" contra
# 0.013 s con "127.0.0.1".
URL_POR_DEFECTO = "postgresql://educacion:password@127.0.0.1:5432/educacion"

RAIZ_REPO = Path(__file__).resolve().parent.parent
ARCHIVO_ENV = RAIZ_REPO / ".env"
_LINEA_ENV = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


class BaseNoDisponible(RuntimeError):
    """No se pudo hablar con Postgres."""


def _cargar_env() -> None:
    """Lee el .env de la raíz para no depender de que esté exportado.

    Hace falta porque `npm run dev` arranca uvicorn sin pasar por la shell donde
    estarían las variables. Lo que ya venga en el entorno real tiene prioridad,
    y se expanden referencias tipo ${POSTGRES_USER} como haría docker-compose.
    """
    if not ARCHIVO_ENV.exists():
        return

    valores: dict[str, str] = {}
    for linea in ARCHIVO_ENV.read_text(encoding="utf-8").splitlines():
        if not linea.strip() or linea.lstrip().startswith("#"):
            continue
        coincidencia = _LINEA_ENV.match(linea)
        if coincidencia is None:
            continue
        clave, crudo = coincidencia.groups()
        crudo = crudo.strip().strip('"').strip("'")
        valores[clave] = re.sub(
            r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}",
            lambda m: valores.get(m.group(1), os.getenv(m.group(1), "")),
            crudo,
        )

    for clave, valor in valores.items():
        os.environ.setdefault(clave, valor)


_cargar_env()


def url_conexion() -> str:
    return os.getenv(VARIABLE_URL) or URL_POR_DEFECTO


@contextmanager
def cursor() -> Iterator[psycopg.Cursor]:
    """Abre una conexión de solo lectura y devuelve filas como diccionarios."""
    try:
        with psycopg.connect(url_conexion(), connect_timeout=5) as conexion:
            with conexion.cursor(row_factory=dict_row) as cur:
                yield cur
    except psycopg.Error as error:
        raise BaseNoDisponible(str(error).strip()) from error


def consultar(sql: str, parametros: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    """Ejecuta una consulta y devuelve todas sus filas."""
    with cursor() as cur:
        cur.execute(sql, parametros)
        return cur.fetchall()


def consultar_una(sql: str, parametros: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with cursor() as cur:
        cur.execute(sql, parametros)
        return cur.fetchone()


def esta_viva() -> bool:
    """Para /health: responde sin lanzar."""
    try:
        return consultar_una("SELECT 1 AS uno") is not None
    except BaseNoDisponible:
        return False
