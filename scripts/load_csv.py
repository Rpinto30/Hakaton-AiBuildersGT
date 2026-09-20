#!/usr/bin/env python3
"""Carga inscripciones.csv en Postgres con COPY y reconstruye los agregados.

Uso:
    python scripts/load_csv.py datos/procesado/inscripciones.csv

Automatiza el mismo camino que LEEME.md describe a mano. Espera el CSV que
produce `python -m ingesta`: 20 columnas YA DECODIFICADAS (palabras, no códigos)
y el municipio resuelto. No es el archivo crudo del INE.

Antes de correrlo hay que crear el esquema:
    \\i tablas/01_schema.sql
    \\i tablas/03_agregados.sql

Es idempotente: vacía `inscripciones` y recarga todo en UNA transacción. Si algo
falla, se revierte y la base queda como estaba.
"""
import argparse
import csv
import os
import sys
import unicodedata
from pathlib import Path

import psycopg
from psycopg import sql

TABLA = "inscripciones"

# COPY es posicional: esta lista es la única fuente de verdad del orden y debe
# coincidir exactamente con ingesta/esquema.py:COLUMNAS_SALIDA.
COLUMNAS = [
    "anio",
    "cod_establecimiento",
    "cod_establecimiento_base",
    "departamento_codigo",
    "departamento",
    "municipio_codigo",
    "municipio",
    "sector",
    "area",
    "sexo",
    "nivel_codigo",
    "nivel",
    "grado_codigo",
    "grado",
    "pueblo_pertenencia",
    "plan_estudio",
    "jornada",
    "resultado_final",
    "repitente",
    "graduando",
]

TABLAS_AGREGADOS = ("agg_departamento", "agg_nivel", "agg_sector", "agg_area", "agg_municipio")

TOTAL_ESPERADO = 4_298_887
MUNICIPIOS_GUATEMALA_ESPERADOS = 17
BLOQUE = 1 << 20  # 1 MiB por escritura al stream de COPY


def _normalizar(columnas: list[str]) -> list[str]:
    """NFC evita falsos negativos si alguna tilde viene descompuesta."""
    return [unicodedata.normalize("NFC", c.strip()) for c in columnas]


def validar_encabezado(ruta: Path, delimitador: str) -> None:
    """COPY mapea por posición: otro orden cargaría datos en la columna equivocada."""
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        encontrado = next(csv.reader(f, delimiter=delimitador), [])
    if _normalizar(encontrado) != _normalizar(COLUMNAS):
        raise SystemExit(
            f"{ruta}: el encabezado no coincide con el esquema.\n"
            f"  esperado:   {COLUMNAS}\n"
            f"  encontrado: {encontrado}\n"
            "¿Estás cargando el CSV crudo del INE en vez del que genera `python -m ingesta`?"
        )


def sentencia_copy(delimitador: str) -> sql.Composed:
    columnas = sql.SQL(", ").join(sql.Identifier(c) for c in COLUMNAS)
    return sql.SQL(
        "COPY {tabla} ({columnas}) FROM STDIN "
        "WITH (FORMAT csv, HEADER true, DELIMITER {delimitador}, ENCODING 'UTF8')"
    ).format(
        tabla=sql.Identifier(TABLA),
        columnas=columnas,
        delimitador=sql.Literal(delimitador),
    )


def verificar(cur: psycopg.Cursor) -> None:
    """Contrasta la carga contra las cifras publicadas. Si algo falla, revierte."""
    cur.execute(
        sql.SQL(
            """
            SELECT count(*),
                   count(DISTINCT municipio_codigo) FILTER (WHERE departamento_codigo = 1),
                   count(DISTINCT municipio_codigo)
            FROM {}
            """
        ).format(sql.Identifier(TABLA))
    )
    total, municipios_guatemala, municipios = cur.fetchone()
    print(f"Registros:            {total:>10,}  (esperado {TOTAL_ESPERADO:,})")
    print(f"Municipios Guatemala: {municipios_guatemala:>10}  (esperado {MUNICIPIOS_GUATEMALA_ESPERADOS})")
    print(f"Municipios en total:  {municipios:>10}  (esperado ~340)")

    if total == TOTAL_ESPERADO and municipios_guatemala != MUNICIPIOS_GUATEMALA_ESPERADOS:
        raise SystemExit(
            f"El departamento de Guatemala tiene {municipios_guatemala} municipios y "
            f"debería tener {MUNICIPIOS_GUATEMALA_ESPERADOS}. Carga revertida."
        )

    for tabla in TABLAS_AGREGADOS:
        cur.execute(sql.SQL("SELECT COALESCE(sum(total), 0) FROM {}").format(sql.Identifier(tabla)))
        (suma,) = cur.fetchone()
        if suma != total:
            raise SystemExit(f"{tabla}: suma {suma:,} != {total:,} registros. Carga revertida.")
    print("Agregados:            cada tabla suma el total de registros")

    # Las etiquetas del INE van sin tilde ('Si', 'Si es graduando'). Si alguien
    # las escribe con tilde en 03_agregados.sql, el conteo da cero en silencio.
    cur.execute("SELECT SUM(repitentes), SUM(graduandos) FROM agg_departamento")
    repitentes, graduandos = cur.fetchone()
    if not repitentes or not graduandos:
        raise SystemExit(
            f"Repitentes={repitentes}, graduandos={graduandos}: alguno quedó en cero. "
            "Revisa las etiquetas que filtra 03_agregados.sql. Carga revertida."
        )
    print(f"Repitencia:           {100 * repitentes / total:>9.1f}%  (esperado ~8.3%)")
    print(f"Graduandos:           {100 * graduandos / total:>9.1f}%  (esperado ~3.7%)")


def cargar(archivos: list[Path], delimitador: str, url: str) -> None:
    for ruta in archivos:
        validar_encabezado(ruta, delimitador)

    copy_sql = sentencia_copy(delimitador)
    # `with connect()` hace commit al salir sin error y rollback si algo lanza.
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(sql.SQL("TRUNCATE {}").format(sql.Identifier(TABLA)))
        for ruta in archivos:
            print(f"Cargando {ruta} ...", flush=True)
            # COPY ... FROM STDIN: el cliente envía el archivo por streaming.
            # No requiere que el CSV esté dentro del contenedor ni ser superusuario.
            with cur.copy(copy_sql) as copy, ruta.open("rb") as f:
                while bloque := f.read(BLOQUE):
                    copy.write(bloque)
        cur.execute(sql.SQL("ANALYZE {}").format(sql.Identifier(TABLA)))
        print("Recalculando agregados ...", flush=True)
        cur.execute("CALL refresh_agregados()")
        verificar(cur)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("archivos", nargs="+", type=Path, help="uno o más CSV")
    parser.add_argument("--delimiter", default=",", help="separador del CSV (por defecto ',')")
    args = parser.parse_args()

    faltantes = [str(a) for a in args.archivos if not a.is_file()]
    if faltantes:
        sys.exit(f"No existen estos archivos: {', '.join(faltantes)}")

    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("Falta DATABASE_URL. Copia env.example a .env y cárgalo (ver LEEME.md).")

    try:
        cargar(args.archivos, args.delimiter, url)
    except psycopg.Error as error:
        # El mensaje de Postgres ya indica archivo/línea y el valor problemático.
        sys.exit(f"Carga revertida, no se modificó la base.\n{error}")


if __name__ == "__main__":
    main()
