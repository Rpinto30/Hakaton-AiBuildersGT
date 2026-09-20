"""Apertura de un .xlsx de datos y localizacion de la hoja correcta.

No se toma la primera hoja por posicion: solola.xlsx trae 'Sheet1' con los
datos y ademas 'Sheet2' y 'Sheet3' vacias. La hoja buena se identifica porque
su primera fila es exactamente el encabezado de 15 columnas declarado en
esquema.COLUMNAS_CRUDAS.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from python_calamine import CalamineWorkbook

from .esquema import COLUMNAS_CRUDAS
from .validacion import ErrorDeIngesta


@dataclass
class HojaDeDatos:
    """La hoja elegida junto con su iterador de filas (sin el encabezado)."""

    archivo: str
    nombre_hoja: str
    filas_de_datos: int
    _filas: Iterator[list[object]]

    def __iter__(self) -> Iterator[list[object]]:
        return self._filas


def _encabezado_coincide(fila: list[object]) -> bool:
    leido = tuple(str(c).strip() for c in fila[: len(COLUMNAS_CRUDAS)])
    return leido == COLUMNAS_CRUDAS


def abrir_hoja_de_datos(ruta: Path) -> HojaDeDatos:
    """Devuelve la unica hoja del archivo cuyo encabezado cumple el contrato."""
    libro = CalamineWorkbook.from_path(str(ruta))
    candidatas: list[str] = []
    encabezados_vistos: dict[str, list[str]] = {}

    for metadatos in libro.sheets_metadata:
        hoja = libro.get_sheet_by_name(metadatos.name)
        if hoja.start is None or hoja.height < 2:
            continue  # hoja vacia o solo encabezado
        primera_fila = next(iter(hoja.iter_rows()), [])
        if _encabezado_coincide(primera_fila):
            candidatas.append(metadatos.name)
        else:
            encabezados_vistos[metadatos.name] = [str(c) for c in primera_fila[:5]]

    if not candidatas:
        raise ErrorDeIngesta(
            f"{ruta.name}: ninguna hoja tiene el encabezado esperado.\n"
            f"  esperado: {COLUMNAS_CRUDAS}\n"
            f"  encontrado: {encabezados_vistos}"
        )
    if len(candidatas) > 1:
        raise ErrorDeIngesta(
            f"{ruta.name}: {len(candidatas)} hojas con el mismo encabezado "
            f"({candidatas}); no se puede elegir sin ambiguedad."
        )

    elegida = libro.get_sheet_by_name(candidatas[0])
    filas = elegida.iter_rows()
    next(filas)  # descarta el encabezado
    return HojaDeDatos(
        archivo=ruta.stem,
        nombre_hoja=candidatas[0],
        filas_de_datos=elegida.height - 1,
        _filas=filas,
    )
