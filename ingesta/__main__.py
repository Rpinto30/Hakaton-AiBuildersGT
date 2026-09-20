"""Orquestador de la ingesta: lee los 22 archivos y escribe un CSV para Postgres.

    python -m ingesta --crudo datos/crudo --salida datos/procesado/inscripciones.csv

El CSV se escribe primero a un archivo .parcial y solo se renombra al destino
final si TODAS las verificaciones pasan. Asi nunca queda en disco un CSV a
medias que alguien pueda cargar a Postgres por error.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from collections import Counter
from pathlib import Path

from .diccionario import cargar_catalogos
from .esquema import (
    COLUMNAS_SALIDA,
    DISTRIBUCIONES_ESPERADAS,
    MUNICIPIOS_GUATEMALA_ESPERADOS,
    REGISTROS_ESPERADOS,
    TOLERANCIA_PORCENTUAL,
    TOTAL_ESPERADO,
)
from .libro import abrir_hoja_de_datos
from .municipios import exportar_municipios
from .transformacion import Transformador
from .validacion import ErrorDeIngesta, Validador

NOMBRE_DICCIONARIO = "diccionario_de_variables.xlsx"
PREFIJO_MUNICIPIOS_GUATEMALA = "01"


def _procesar_archivo(ruta, catalogos, validador, escritor) -> Transformador:
    """Vuelca un .xlsx decodificado al CSV y devuelve sus contadores."""
    inicio = time.perf_counter()
    hoja = abrir_hoja_de_datos(ruta)
    transformador = Transformador(catalogos, validador, ruta.stem)

    for numero, fila_cruda in enumerate(hoja, start=2):  # 1 es el encabezado
        fila = transformador.transformar(fila_cruda, numero)
        if fila is not None:
            escritor.writerow(fila)

    esperadas = REGISTROS_ESPERADOS.get(ruta.stem)
    if esperadas is not None and hoja.filas_de_datos != esperadas:
        validador.anotar(
            f"{ruta.stem}: el archivo no trae el numero de filas publicado",
            f"leidas {hoja.filas_de_datos:,}, esperadas {esperadas:,}",
        )

    segundos = time.perf_counter() - inicio
    por_zona = transformador.codigos_por_zona
    nota = f" | {por_zona:,} codificados por zona de la capital" if por_zona else ""
    print(
        f"  {ruta.stem:<16} hoja={hoja.nombre_hoja:<12} "
        f"{transformador.filas_validas:>9,} filas  {segundos:5.1f}s{nota}"
    )
    return transformador


def _verificar_totales(total: int, municipios: set[str], validador: Validador) -> None:
    """Contrasta los agregados contra las cifras publicadas por la organizacion."""
    if total != TOTAL_ESPERADO:
        validador.anotar(
            "el total nacional no coincide con la cifra publicada",
            f"escritas {total:,}, esperadas {TOTAL_ESPERADO:,}",
        )

    en_guatemala = sum(
        1 for codigo in municipios if codigo.startswith(PREFIJO_MUNICIPIOS_GUATEMALA)
    )
    if en_guatemala != MUNICIPIOS_GUATEMALA_ESPERADOS:
        validador.anotar(
            "el departamento de Guatemala no tiene 17 municipios",
            f"derivados {en_guatemala} (senal de que el prefijo irregular no se normalizo)",
        )


def _verificar_distribuciones(
    distribuciones: dict[str, Counter[str]], total: int, validador: Validador
) -> list[str]:
    """Compara los porcentajes obtenidos contra los publicados."""
    lineas = []
    for columna, esperadas in DISTRIBUCIONES_ESPERADAS.items():
        conteo = distribuciones.get(columna, Counter())
        for etiqueta, porcentaje_esperado in esperadas.items():
            obtenido = 100 * conteo.get(etiqueta, 0) / total if total else 0.0
            diferencia = abs(obtenido - porcentaje_esperado)
            marca = "ok " if diferencia <= TOLERANCIA_PORCENTUAL else "MAL"
            lineas.append(
                f"  {marca} {columna:<16} {etiqueta:<16} "
                f"obtenido {obtenido:5.1f}%  publicado {porcentaje_esperado:5.1f}%"
            )
            if diferencia > TOLERANCIA_PORCENTUAL:
                validador.anotar(
                    f"distribucion de {columna} fuera de tolerancia",
                    f"{etiqueta}: {obtenido:.2f}% vs {porcentaje_esperado:.1f}% publicado",
                )
    return lineas


def ejecutar(
    directorio_crudo: Path,
    destino: Path,
    destino_municipios: Path,
    solo: list[str] | None,
    solo_municipios: bool,
) -> int:
    """Corre la ingesta completa. Devuelve el codigo de salida del proceso."""
    ruta_diccionario = directorio_crudo / NOMBRE_DICCIONARIO
    if not ruta_diccionario.exists():
        raise ErrorDeIngesta(f"No se encontro el diccionario en {ruta_diccionario}")

    print(f"Diccionario: {ruta_diccionario.name}")
    catalogos = cargar_catalogos(ruta_diccionario)
    print(
        f"  {len(catalogos.departamentos)} departamentos, "
        f"{len(catalogos.municipios)} municipios, "
        f"{len(catalogos.por_columna)} variables categoricas"
    )

    # Se exporta antes de la pasada larga: es la llave de join del mapa y sale
    # del mismo catalogo, asi que no hace falta esperar los 22 archivos.
    total_municipios = exportar_municipios(catalogos, destino_municipios)
    print(f"  tabla de municipios -> {destino_municipios} ({total_municipios} filas)\n")
    if solo_municipios:
        return 0

    archivos = sorted(
        ruta
        for ruta in directorio_crudo.glob("*.xlsx")
        if ruta.name != NOMBRE_DICCIONARIO and (not solo or ruta.stem in solo)
    )
    if not archivos:
        raise ErrorDeIngesta(f"No hay archivos de datos que procesar en {directorio_crudo}")

    validador = Validador()
    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")

    total = 0
    municipios: set[str] = set()
    distribuciones: dict[str, Counter[str]] = {}

    print(f"Procesando {len(archivos)} archivos:")
    with parcial.open("w", encoding="utf-8", newline="") as salida:
        escritor = csv.writer(salida, lineterminator="\n")
        escritor.writerow(COLUMNAS_SALIDA)
        for ruta in archivos:
            transformador = _procesar_archivo(ruta, catalogos, validador, escritor)
            municipios |= transformador.municipios_vistos
            for columna, conteo in transformador.distribuciones.items():
                distribuciones.setdefault(columna, Counter()).update(conteo)
            total += transformador.filas_validas

    procesado_completo = solo is None
    print(f"\nTotal escrito: {total:,} filas | municipios distintos: {len(municipios)}")

    if procesado_completo:
        _verificar_totales(total, municipios, validador)
        print("\nContraste contra las cifras publicadas:")
        for linea in _verificar_distribuciones(distribuciones, total, validador):
            print(linea)
    else:
        print("(corrida parcial: se omiten las verificaciones de total nacional)")

    try:
        validador.exigir_ok(f"{len(archivos)} archivo(s) procesado(s)")
    except ErrorDeIngesta:
        parcial.unlink(missing_ok=True)
        raise

    parcial.replace(destino)
    tamanio_mb = destino.stat().st_size / 1_048_576
    print(f"\nOK. CSV escrito en {destino} ({tamanio_mb:,.0f} MB)")
    return 0


def main(argv: list[str] | None = None) -> int:
    analizador = argparse.ArgumentParser(
        prog="python -m ingesta",
        description="Decodifica el dataset Educacion Formal 2024 a un CSV para Postgres.",
    )
    analizador.add_argument("--crudo", type=Path, default=Path("datos/crudo"))
    analizador.add_argument(
        "--salida", type=Path, default=Path("datos/procesado/inscripciones.csv")
    )
    analizador.add_argument(
        "--salida-municipios",
        type=Path,
        default=Path("datos/procesado/municipios.csv"),
        help="Tabla de municipios (llave de join del mapa).",
    )
    analizador.add_argument(
        "--solo",
        nargs="+",
        metavar="ARCHIVO",
        help="Procesa solo estos archivos (sin extension), para pruebas rapidas.",
    )
    analizador.add_argument(
        "--solo-municipios",
        action="store_true",
        help="Escribe solo la tabla de municipios y termina (no lee los 22 archivos).",
    )
    argumentos = analizador.parse_args(argv)

    try:
        return ejecutar(
            argumentos.crudo,
            argumentos.salida,
            argumentos.salida_municipios,
            argumentos.solo,
            argumentos.solo_municipios,
        )
    except ErrorDeIngesta as error:
        print(f"\n{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
