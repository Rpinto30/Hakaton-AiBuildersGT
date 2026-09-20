"""Carga diccionario_de_variables.xlsx y lo vuelve catalogos consultables.

Particularidades reales del archivo que este modulo resuelve:

* Las dos hojas tienen tres filas de titulo antes del encabezado
  "Valor | Código | Etiqueta", asi que la fila de encabezado se BUSCA, no se
  asume por posicion.
* La columna "Valor" solo trae el nombre de la variable en la primera fila de
  cada bloque; el resto viene vacio -> se arrastra hacia abajo (forward fill).
* La columna "Código" es de tipo mixto: unos codigos llegan como texto ('1') y
  otros como float (9.0). Los de municipio son texto con cero a la izquierda
  ('0101') y ese cero hay que conservarlo.
* Las etiquetas traen espacios al final ('Guatemala  ').
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from python_calamine import CalamineWorkbook

from .esquema import (
    BLOQUE_DEPARTAMENTOS,
    BLOQUE_MUNICIPIOS,
    ENCABEZADO_DICCIONARIO,
    HOJA_GEOGRAFIA,
    HOJA_VARIABLES,
    VARIABLE_DICC_A_COLUMNA,
    VARIABLES_DICC_IGNORADAS,
)
from .validacion import ErrorDeIngesta


@dataclass(frozen=True)
class Catalogos:
    """Traducciones codigo -> etiqueta, ya normalizadas."""

    por_columna: dict[str, dict[int, str]]
    departamentos: dict[int, str]
    municipios: dict[str, str]

    def etiqueta(self, columna: str, codigo: int) -> str | None:
        """Etiqueta de un codigo, o None si el catalogo no lo contempla."""
        return self.por_columna.get(columna, {}).get(codigo)


def _texto(valor: object) -> str:
    """Normaliza una celda a texto sin espacios sobrantes."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    return str(valor).strip()


def _codigo_entero(valor: object) -> int | None:
    """Convierte la celda 'Código' a entero, tolerando texto y float."""
    texto = _texto(valor)
    try:
        return int(float(texto))
    except ValueError:
        return None


def _fila_de_encabezado(filas: list[list[object]], hoja: str) -> int:
    """Indice de la fila que contiene 'Valor | Código | Etiqueta'."""
    esperado = tuple(c.casefold() for c in ENCABEZADO_DICCIONARIO)
    for indice, fila in enumerate(filas):
        if tuple(_texto(c).casefold() for c in fila[:3]) == esperado:
            return indice
    raise ErrorDeIngesta(
        f"En la hoja {hoja!r} del diccionario no se encontro el encabezado "
        f"{ENCABEZADO_DICCIONARIO}."
    )


def _bloques(filas: list[list[object]], hoja: str) -> dict[str, list[tuple[object, str]]]:
    """Agrupa las filas por bloque, arrastrando el nombre de la variable."""
    inicio = _fila_de_encabezado(filas, hoja) + 1
    agrupado: dict[str, list[tuple[object, str]]] = {}
    bloque_actual = ""
    for fila in filas[inicio:]:
        nombre = _texto(fila[0])
        if nombre:
            bloque_actual = nombre
        codigo_crudo, etiqueta = fila[1], _texto(fila[2])
        if not bloque_actual or not etiqueta or not _texto(codigo_crudo):
            continue
        agrupado.setdefault(bloque_actual, []).append((codigo_crudo, etiqueta))
    return agrupado


def cargar_catalogos(ruta: Path) -> Catalogos:
    """Lee el diccionario completo y devuelve los catalogos listos para usar."""
    libro = CalamineWorkbook.from_path(str(ruta))
    faltantes = {HOJA_VARIABLES, HOJA_GEOGRAFIA} - set(libro.sheet_names)
    if faltantes:
        raise ErrorDeIngesta(
            f"Al diccionario le faltan hojas: {sorted(faltantes)}. "
            f"Trae {libro.sheet_names}."
        )

    bloques_variables = _bloques(
        libro.get_sheet_by_name(HOJA_VARIABLES).to_python(), HOJA_VARIABLES
    )
    _exigir_mapeo_completo(bloques_variables)

    por_columna: dict[str, dict[int, str]] = {}
    for bloque, entradas in bloques_variables.items():
        if bloque in VARIABLES_DICC_IGNORADAS:
            continue
        columna = VARIABLE_DICC_A_COLUMNA[bloque]
        traduccion: dict[int, str] = {}
        for codigo_crudo, etiqueta in entradas:
            codigo = _codigo_entero(codigo_crudo)
            if codigo is None:
                raise ErrorDeIngesta(
                    f"Codigo no numerico en el bloque {bloque!r}: {codigo_crudo!r}"
                )
            traduccion[codigo] = etiqueta
        por_columna[columna] = traduccion

    bloques_geo = _bloques(
        libro.get_sheet_by_name(HOJA_GEOGRAFIA).to_python(), HOJA_GEOGRAFIA
    )
    departamentos = {
        codigo: etiqueta
        for codigo_crudo, etiqueta in bloques_geo.get(BLOQUE_DEPARTAMENTOS, [])
        if (codigo := _codigo_entero(codigo_crudo)) is not None
    }
    # El codigo de municipio se conserva como texto de 4 digitos: '0101', no 101.
    municipios = {
        _texto(codigo_crudo).zfill(4): etiqueta
        for codigo_crudo, etiqueta in bloques_geo.get(BLOQUE_MUNICIPIOS, [])
        if _codigo_entero(codigo_crudo) is not None
    }
    if not departamentos or not municipios:
        raise ErrorDeIngesta(
            f"La hoja {HOJA_GEOGRAFIA!r} no produjo catalogos: "
            f"{len(departamentos)} departamentos, {len(municipios)} municipios."
        )
    return Catalogos(por_columna, departamentos, municipios)


def _exigir_mapeo_completo(bloques: dict[str, list[tuple[object, str]]]) -> None:
    """Falla si el diccionario trae bloques que el mapeo explicito no contempla."""
    conocidos = set(VARIABLE_DICC_A_COLUMNA) | set(VARIABLES_DICC_IGNORADAS)
    desconocidos = sorted(set(bloques) - conocidos)
    ausentes = sorted(set(VARIABLE_DICC_A_COLUMNA) - set(bloques))
    problemas = []
    if desconocidos:
        problemas.append(f"bloques nuevos sin mapear: {desconocidos}")
    if ausentes:
        problemas.append(f"bloques esperados que ya no estan: {ausentes}")
    if problemas:
        raise ErrorDeIngesta(
            "El diccionario cambio respecto a lo declarado en esquema.py -> "
            + "; ".join(problemas)
        )
