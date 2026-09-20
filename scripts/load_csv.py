#!/usr/bin/env python3
"""Carga CSV de Educación Formal 2024 en Postgres con COPY y reconstruye los agregados.

Uso:
    python scripts/load_csv.py data/*.csv
    python scripts/load_csv.py --delimiter ";" data/educacion.csv

Requisitos de cada CSV: UTF-8, fila de encabezado y las 15 columnas del INE en su orden original.
Es idempotente: vacía `educacion` y recarga todo en UNA transacción. Si algo falla
(encabezado distinto, fila corrupta, agregados que no cuadran) no queda nada a medias.
"""
import argparse
import csv
import os
import sys
import unicodedata
from pathlib import Path

import psycopg
from psycopg import sql

# (encabezado en el CSV, columna en la tabla). COPY es posicional, así que esta lista es la
# única fuente de verdad del orden: se usa para validar el encabezado y para armar el COPY.
COLUMNAS = [
    ("Año", "anio"),
    ("CodEstablecimiento", "cod_establecimiento"),
    ("Departamento_F", "departamento"),
    ("Depto_mupio", "depto_mupio"),
    ("Sector", "sector"),
    ("Área", "area"),
    ("Sexo", "sexo"),
    ("Grado", "grado"),
    ("Nivel", "nivel"),
    ("Pueblo_Per", "pueblo"),
    ("Plan_Est", "plan_estudios"),
    ("Jornada_Est", "jornada"),
    ("Resultado_F", "resultado"),
    ("Repitente", "repitente"),
    ("Graduando", "graduando"),
]
TABLAS_AGREGADOS = ("agg_departamento", "agg_nivel", "agg_sector", "agg_area")
BLOQUE = 1 << 20  # 1 MiB por escritura al stream de COPY


def _normalizar(columnas: list[str]) -> list[str]:
    # NFC evita falsos negativos si "Año"/"Área" vienen con la tilde descompuesta.
    return [unicodedata.normalize("NFC", c.strip()) for c in columnas]


def validar_encabezado(ruta: Path, delimitador: str) -> None:
    """COPY mapea por posición: un CSV con otro orden cargaría datos en la columna equivocada."""
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        encontrado = next(csv.reader(f, delimiter=delimitador), [])
    esperado = [nombre for nombre, _ in COLUMNAS]
    if _normalizar(encontrado) != _normalizar(esperado):
        raise SystemExit(
            f"{ruta}: el encabezado no coincide.\n"
            f"  esperado:   {esperado}\n"
            f"  encontrado: {encontrado}\n"
            "Revisa el delimitador (--delimiter) y el orden de columnas."
        )


def sentencia_copy(delimitador: str) -> sql.Composed:
    columnas = sql.SQL(", ").join(sql.Identifier(col) for _, col in COLUMNAS)
    return sql.SQL(
        "COPY educacion ({columnas}) FROM STDIN "
        "WITH (FORMAT csv, HEADER true, DELIMITER {delimitador}, ENCODING 'UTF8')"
    ).format(columnas=columnas, delimitador=sql.Literal(delimitador))


def verificar(cur: psycopg.Cursor) -> None:
    """Comprueba que la carga tenga sentido; si no, lanza y la transacción se revierte."""
    cur.execute(
        """
        SELECT count(*),
               count(DISTINCT municipio) FILTER (WHERE departamento = 1),
               count(DISTINCT municipio)
        FROM educacion
        """
    )
    total, municipios_guatemala, municipios = cur.fetchone()
    print(f"Registros:               {total:,}  (dataset completo: 4,298,887)")
    print(f"Municipios Guatemala:    {municipios_guatemala}  (dataset completo: 17)")
    print(f"Municipios en total:     {municipios}  (dataset completo: ~340)")

    for tabla in TABLAS_AGREGADOS:
        cur.execute(sql.SQL("SELECT COALESCE(sum(total), 0) FROM {}").format(sql.Identifier(tabla)))
        (suma,) = cur.fetchone()
        if suma != total:
            raise SystemExit(f"{tabla}: suma {suma:,} != {total:,} registros. Carga revertida.")
    print("Agregados:               OK (cada tabla suma el total de registros)")


def cargar(archivos: list[Path], delimitador: str, url: str) -> None:
    for ruta in archivos:
        validar_encabezado(ruta, delimitador)

    copy_sql = sentencia_copy(delimitador)
    # `with connect()` hace commit al salir sin error y rollback si algo lanza.
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE educacion")
        for ruta in archivos:
            print(f"Cargando {ruta} ...", flush=True)
            # COPY ... FROM STDIN: el cliente envía el archivo por streaming a Postgres.
            # No requiere que el archivo esté dentro del contenedor ni permisos de superusuario.
            with cur.copy(copy_sql) as copy, ruta.open("rb") as f:
                while bloque := f.read(BLOQUE):
                    copy.write(bloque)
        cur.execute("ANALYZE educacion")
        print("Recalculando agregados ...", flush=True)
        cur.execute("CALL refresh_aggregates()")
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
        sys.exit("Falta DATABASE_URL. Copia .env.example a .env y cárgalo (ver instrucciones).")

    try:
        cargar(args.archivos, args.delimiter, url)
    except psycopg.Error as error:
        # El mensaje de Postgres ya indica archivo/línea y el valor problemático.
        sys.exit(f"Carga revertida, no se modificó la base.\n{error}")


if __name__ == "__main__":
    main()
