"""Exporta la tabla de municipios: la llave de join con el GeoJSON del mapa.

Sale del mismo catalogo que usa la ingesta, asi que el codigo de municipio de
este CSV y el de inscripciones.csv son el mismo por construccion: no hay forma
de que se desincronicen.

El codigo se escribe como texto de 4 digitos con cero a la izquierda ('0101').
Si algo lo convierte a numero, '0101' se vuelve 101 y el join se rompe en
silencio para los 17 municipios del departamento de Guatemala.
"""

from __future__ import annotations

import csv
from pathlib import Path

from .diccionario import Catalogos
from .validacion import Validador

COLUMNAS_MUNICIPIOS: tuple[str, ...] = (
    "municipio_codigo",
    "municipio",
    "departamento_codigo",
    "departamento",
)

LARGO_CODIGO_MUNICIPIO = 4
MUNICIPIOS_ESPERADOS = 340


def _filas(catalogos: Catalogos, validador: Validador) -> list[tuple[str, str, int, str]]:
    """Arma las filas ordenadas por codigo, validando cada una."""
    filas = []
    for codigo, nombre in sorted(catalogos.municipios.items()):
        if len(codigo) != LARGO_CODIGO_MUNICIPIO or not codigo.isdigit():
            validador.anotar(
                "codigo de municipio malformado", f"{codigo!r} ({nombre})"
            )
            continue
        # Los dos primeros digitos del municipio son su departamento.
        departamento_codigo = int(codigo[:2])
        departamento = catalogos.departamentos.get(departamento_codigo)
        if departamento is None:
            validador.anotar(
                "municipio cuyo departamento no esta en el catalogo",
                f"{codigo} ({nombre}) -> departamento {departamento_codigo}",
            )
            continue
        filas.append((codigo, nombre, departamento_codigo, departamento))
    return filas


def exportar_municipios(catalogos: Catalogos, destino: Path) -> int:
    """Escribe municipios.csv y devuelve cuantas filas quedaron."""
    validador = Validador()
    filas = _filas(catalogos, validador)

    if len(filas) != MUNICIPIOS_ESPERADOS:
        validador.anotar(
            "la tabla de municipios no tiene el total esperado",
            f"obtenidos {len(filas)}, esperados {MUNICIPIOS_ESPERADOS}",
        )
    validador.exigir_ok("exportacion de municipios")

    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")
    with parcial.open("w", encoding="utf-8", newline="") as salida:
        escritor = csv.writer(salida, lineterminator="\n")
        escritor.writerow(COLUMNAS_MUNICIPIOS)
        escritor.writerows(filas)
    parcial.replace(destino)
    return len(filas)
