"""Descarga los 23 archivos del dataset desde el S3 publico de la organizacion.

    python -m ingesta.descargar

Los .xlsx no se versionan (son ~225 MB y se regeneran bajandolos), asi que este
script es el paso 1 de cualquier instalacion limpia.

Es idempotente: si un archivo ya esta y es un .xlsx valido, no se vuelve a
bajar. Usa solo la biblioteca estandar para no agregar dependencias a un paso
que corre antes de instalar nada.
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from .esquema import REGISTROS_ESPERADOS

URL_BASE = "https://hackaton-aibuildersgt-datos.s3.us-east-1.amazonaws.com"
NOMBRE_DICCIONARIO = "diccionario_de_variables.xlsx"

# El diccionario primero: sin el, los datos no se interpretan.
ARCHIVOS: tuple[str, ...] = (NOMBRE_DICCIONARIO,) + tuple(
    f"{nombre}.xlsx" for nombre in sorted(REGISTROS_ESPERADOS)
)


def _es_xlsx_valido(ruta: Path) -> bool:
    """Un .xlsx es un zip. Si no abre como zip, la descarga quedo truncada."""
    return ruta.exists() and ruta.stat().st_size > 0 and zipfile.is_zipfile(ruta)


def _descargar(nombre: str, destino: Path) -> None:
    """Baja a un archivo temporal y lo mueve solo si quedo integro."""
    parcial = destino.with_suffix(destino.suffix + ".parcial")
    try:
        with urllib.request.urlopen(f"{URL_BASE}/{nombre}", timeout=120) as respuesta:
            parcial.write_bytes(respuesta.read())
    except (urllib.error.URLError, TimeoutError) as error:
        parcial.unlink(missing_ok=True)
        raise RuntimeError(f"no se pudo descargar {nombre}: {error}") from error

    if not _es_xlsx_valido(parcial):
        parcial.unlink(missing_ok=True)
        raise RuntimeError(f"{nombre} se descargo corrupto (no abre como .xlsx)")
    parcial.replace(destino)


def descargar_dataset(directorio: Path, forzar: bool = False) -> int:
    """Asegura que los 23 archivos esten en `directorio`. Devuelve cuantos bajo."""
    directorio.mkdir(parents=True, exist_ok=True)
    descargados = 0

    for numero, nombre in enumerate(ARCHIVOS, start=1):
        destino = directorio / nombre
        etiqueta = f"[{numero:>2}/{len(ARCHIVOS)}] {nombre:<32}"

        if not forzar and _es_xlsx_valido(destino):
            mb = destino.stat().st_size / 1_048_576
            print(f"{etiqueta} ya esta ({mb:,.1f} MB)")
            continue

        print(f"{etiqueta} descargando...", end="", flush=True)
        _descargar(nombre, destino)
        descargados += 1
        mb = destino.stat().st_size / 1_048_576
        print(f" listo ({mb:,.1f} MB)")

    faltantes = [n for n in ARCHIVOS if not _es_xlsx_valido(directorio / n)]
    if faltantes:
        raise RuntimeError(f"quedaron archivos invalidos o ausentes: {faltantes}")
    return descargados


def main(argv: list[str] | None = None) -> int:
    analizador = argparse.ArgumentParser(
        prog="python -m ingesta.descargar",
        description="Descarga el dataset Educacion Formal 2024 desde el S3 de la organizacion.",
    )
    analizador.add_argument("--destino", type=Path, default=Path("datos/crudo"))
    analizador.add_argument(
        "--forzar", action="store_true", help="Vuelve a bajar aunque el archivo ya este."
    )
    argumentos = analizador.parse_args(argv)

    try:
        descargados = descargar_dataset(argumentos.destino, argumentos.forzar)
    except RuntimeError as error:
        print(f"\nError: {error}", file=sys.stderr)
        return 1

    print(
        f"\nOK. {len(ARCHIVOS)} archivos disponibles en {argumentos.destino} "
        f"({descargados} descargados en esta corrida)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
