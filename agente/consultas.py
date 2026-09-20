"""Arma y ejecuta las consultas agregadas sobre la tabla de inscripciones.

Reglas que este modulo garantiza:

* El modelo nunca escribe SQL. Pide dimensiones, filtros y metricas por nombre;
  los nombres se validan contra catalogo.py y los VALORES viajan siempre como
  parametros, asi que no hay forma de inyectar SQL.
* La conexion es de solo lectura y cada consulta tiene un tiempo maximo.
* Un valor de filtro que no existe NO devuelve cero filas en silencio: se
  rechaza con sugerencias. "Quiche" se corrige solo a "Quiché"; "Kiche" falla
  y dice cuales son los valores validos. Un cero falso seria una cifra inventada.
* Un nombre de municipio repetido en varios departamentos se rechaza hasta que
  se indique el departamento, para no sumar dos municipios distintos.
"""

from __future__ import annotations

import difflib
import unicodedata
from decimal import Decimal
from functools import cache

import psycopg
from psycopg import sql

from .catalogo import (
    DIMENSIONES,
    LIMITE_MAXIMO,
    LIMITE_POR_DEFECTO,
    METRICAS,
    ORDEN_NATURAL,
    TABLA,
)
from .configuracion import SEGUNDOS_POR_CONSULTA_SQL, url_base_de_datos

ORDEN_POR_GRUPO = "grupo"
SUGERENCIAS_MAXIMAS = 5


class ConsultaInvalida(ValueError):
    """La consulta pedida no se puede ejecutar. El mensaje se le devuelve al
    modelo para que la corrija o le explique el problema a la persona."""


def _conectar() -> psycopg.Connection:
    opciones = (
        "-c default_transaction_read_only=on "
        f"-c statement_timeout={SEGUNDOS_POR_CONSULTA_SQL * 1000}"
    )
    return psycopg.connect(url_base_de_datos(), options=opciones)


def _sin_tildes(texto: str) -> str:
    """'Quiché' y 'quiche' deben compararse como iguales."""
    descompuesto = unicodedata.normalize("NFD", texto.strip().casefold())
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


# -- valores validos de cada dimension ------------------------------------------


@cache
def _municipios() -> tuple[tuple[str, str, str], ...]:
    """(codigo, municipio, departamento) de los municipios con datos."""
    consulta = sql.SQL(
        "SELECT DISTINCT municipio_codigo, municipio, departamento FROM {} ORDER BY 1"
    ).format(sql.Identifier(TABLA))
    with _conectar() as conexion:
        return tuple(conexion.execute(consulta).fetchall())


@cache
def _catalogos() -> dict[str, tuple[str, ...]]:
    """Valores de todas las dimensiones menos municipio, en una sola pasada.

    GROUPING SETS agrupa por cada dimension por separado dentro de la misma
    consulta: un recorrido de la tabla en vez de doce.
    """
    dimensiones = [d for d in DIMENSIONES if d != "municipio"]
    columnas = list(dict.fromkeys(c for d in dimensiones for c in (d, *ORDEN_NATURAL.get(d, ()))))
    conjuntos = sql.SQL(", ").join(
        sql.SQL("({})").format(
            sql.SQL(", ").join(map(sql.Identifier, (d, *ORDEN_NATURAL.get(d, ()))))
        )
        for d in dimensiones
    )
    consulta = sql.SQL("SELECT {} FROM {} GROUP BY GROUPING SETS ({})").format(
        sql.SQL(", ").join(map(sql.Identifier, columnas)), sql.Identifier(TABLA), conjuntos
    )
    with _conectar() as conexion:
        filas = [dict(zip(columnas, fila)) for fila in conexion.execute(consulta).fetchall()]

    catalogos = {}
    for dimension in dimensiones:
        orden = ORDEN_NATURAL.get(dimension, (dimension,))
        # En cada conjunto, las columnas de las demas dimensiones vienen en NULL.
        propias = [f for f in filas if f[dimension] is not None]
        propias.sort(key=lambda f: tuple(f[c] for c in orden))
        catalogos[dimension] = tuple(f[dimension] for f in propias)
    return catalogos


def valores_de(dimension: str) -> tuple[str, ...]:
    """Valores distintos de una dimension. Se consultan una vez y se recuerdan."""
    _exigir_dimension(dimension)
    if dimension == "municipio":
        return tuple(sorted({municipio for _, municipio, _ in _municipios()}))
    return _catalogos()[dimension]


def catalogos_pequenos() -> dict[str, tuple[str, ...]]:
    """Las dimensiones cuyos valores caben en las instrucciones del modelo."""
    return _catalogos()


def municipios_de(departamento: str | None = None) -> list[dict[str, str]]:
    """Municipios con su departamento; opcionalmente los de uno solo."""
    elegido = _resolver_valor("departamento", departamento) if departamento else None
    return [
        {"municipio_codigo": codigo, "municipio": municipio, "departamento": depto}
        for codigo, municipio, depto in _municipios()
        if elegido is None or depto == elegido
    ]


# -- validacion --------------------------------------------------------------------


def _exigir_dimension(nombre: str) -> None:
    if nombre not in DIMENSIONES:
        raise ConsultaInvalida(
            f"La dimension {nombre!r} no existe. Validas: {sorted(DIMENSIONES)}."
        )


def _resolver_valor(dimension: str, valor: str) -> str:
    """Devuelve el valor tal como esta escrito en la base, o falla con sugerencias."""
    validos = valores_de(dimension)
    por_forma_simple = {_sin_tildes(v): v for v in validos}
    encontrado = por_forma_simple.get(_sin_tildes(str(valor)))
    if encontrado is not None:
        return encontrado

    parecidos = difflib.get_close_matches(
        _sin_tildes(str(valor)), list(por_forma_simple), n=SUGERENCIAS_MAXIMAS, cutoff=0.6
    )
    if parecidos:
        pista = f"Quizas: {[por_forma_simple[p] for p in parecidos]}."
    elif len(validos) <= 30:
        pista = f"Valores validos: {list(validos)}."
    else:
        pista = "Usa listar_valores para ver los valores validos."
    raise ConsultaInvalida(f"{valor!r} no existe en {dimension}. {pista}")


def _exigir_municipio_sin_ambiguedad(municipios: list[str], filtros: dict[str, list[str]]) -> None:
    if "departamento" in filtros:
        return
    for municipio in municipios:
        departamentos = sorted(d for _, m, d in _municipios() if m == municipio)
        if len(departamentos) > 1:
            raise ConsultaInvalida(
                f"Hay {len(departamentos)} municipios llamados {municipio!r}, en "
                f"{departamentos}. Agrega un filtro de departamento."
            )


def _resolver_filtros(filtros: list[dict]) -> dict[str, list[str]]:
    resueltos: dict[str, list[str]] = {}
    for filtro in filtros:
        dimension, valores = filtro.get("columna"), filtro.get("valores") or []
        _exigir_dimension(dimension)
        if not valores:
            raise ConsultaInvalida(f"El filtro de {dimension!r} no trae valores.")
        resueltos[dimension] = [_resolver_valor(dimension, v) for v in valores]
    if "municipio" in resueltos:
        _exigir_municipio_sin_ambiguedad(resueltos["municipio"], resueltos)
    return resueltos


# -- consulta ----------------------------------------------------------------------


def _a_json(valor: object) -> object:
    """Postgres devuelve los porcentajes como Decimal, que json no sabe escribir."""
    return float(valor) if isinstance(valor, Decimal) else valor


def consultar(
    metricas: list[str],
    agrupar_por: list[str] | None = None,
    filtros: list[dict] | None = None,
    ordenar_por: str | None = None,
    descendente: bool = True,
    limite: int | None = None,
) -> dict:
    """Ejecuta un agregado y devuelve las filas junto con lo que se aplico."""
    agrupar_por = list(dict.fromkeys(agrupar_por or []))
    for dimension in agrupar_por:
        _exigir_dimension(dimension)
    desconocidas = [m for m in metricas if m not in METRICAS]
    if desconocidas or not metricas:
        raise ConsultaInvalida(
            f"Metricas no validas: {desconocidas}. Validas: {sorted(METRICAS)}."
        )
    metricas = list(dict.fromkeys(metricas))
    filtros_resueltos = _resolver_filtros(filtros or [])

    ordenar_por = ordenar_por or metricas[0]
    if ordenar_por != ORDEN_POR_GRUPO and ordenar_por not in metricas:
        raise ConsultaInvalida(
            f"ordenar_por debe ser {ORDEN_POR_GRUPO!r} o una de las metricas pedidas: {metricas}."
        )
    limite = max(1, min(limite or LIMITE_POR_DEFECTO, LIMITE_MAXIMO))

    columnas_visibles = [c for d in agrupar_por for c in DIMENSIONES[d]]
    columnas_de_orden = [c for d in agrupar_por for c in ORDEN_NATURAL.get(d, DIMENSIONES[d])]
    columnas_del_grupo = list(dict.fromkeys(columnas_visibles + columnas_de_orden))

    seleccion = [sql.Identifier(c) for c in columnas_visibles] + [
        sql.SQL("{} AS {}").format(sql.SQL(METRICAS[m][0]), sql.Identifier(m)) for m in metricas
    ]
    partes = [
        sql.SQL("SELECT {}").format(sql.SQL(", ").join(seleccion)),
        sql.SQL("FROM {}").format(sql.Identifier(TABLA)),
    ]
    if filtros_resueltos:
        condiciones = [
            sql.SQL("{} = ANY(%s)").format(sql.Identifier(d)) for d in filtros_resueltos
        ]
        partes.append(sql.SQL("WHERE {}").format(sql.SQL(" AND ").join(condiciones)))
    if columnas_del_grupo:
        partes.append(
            sql.SQL("GROUP BY {}").format(sql.SQL(", ").join(map(sql.Identifier, columnas_del_grupo)))
        )
    sentido = sql.SQL("DESC" if descendente else "ASC")
    if ordenar_por == ORDEN_POR_GRUPO:
        if columnas_de_orden:
            orden = sql.SQL(", ").join(
                sql.SQL("{} {}").format(sql.Identifier(c), sentido) for c in columnas_de_orden
            )
            partes.append(sql.SQL("ORDER BY {}").format(orden))
    else:
        partes.append(
            sql.SQL("ORDER BY {} {} NULLS LAST").format(sql.Identifier(ordenar_por), sentido)
        )
    # Se pide una fila de mas para saber si el limite corto el resultado.
    partes.append(sql.SQL("LIMIT {}").format(sql.Literal(limite + 1)))

    with _conectar() as conexion:
        cursor = conexion.execute(sql.SQL(" ").join(partes), list(filtros_resueltos.values()))
        nombres = [columna.name for columna in cursor.description]
        filas = cursor.fetchall()

    truncado = len(filas) > limite
    return {
        "filtros_aplicados": filtros_resueltos,
        "columnas": nombres,
        "filas": [[_a_json(v) for v in fila] for fila in filas[:limite]],
        "truncado": truncado,
        "nota": (
            f"Hay mas filas que las {limite} devueltas (el limite pedido)." if truncado else None
        ),
    }
