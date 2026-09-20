"""Contrato de la API. El frontend se apoya en estos modelos.

La forma de `Fila` es la misma de las tablas `agg_*`, que comparten columnas a
propósito. Por eso un solo endpoint sirve las cinco dimensiones.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Dimension(StrEnum):
    departamento = "departamento"
    nivel = "nivel"
    sector = "sector"
    area = "area"
    municipio = "municipio"


class Fila(BaseModel):
    """Un departamento, municipio, nivel, sector o área."""

    # `clave` es TEXTO, no entero: en departamento/nivel es el código numérico
    # del INE ("1"), en municipio el código de 4 dígitos ("0101") y en
    # sector/área la etiqueta misma ("Público"), porque el dataset decodificado
    # no conserva códigos numéricos para esas dos dimensiones.
    clave: str
    etiqueta: str = Field(description="Nombre legible que ve el usuario final.")
    padre: str | None = Field(default=None, description="Departamento, solo en municipios.")
    orden: int | None = Field(default=None, description="Para ordenar de forma natural.")

    total: int = Field(description="Inscripciones del grupo.")
    promovidos: int
    no_promovidos: int
    retirados: int = Field(description="'Retirado' + 'Retirado Definitivo'.")
    vigentes: int
    ignorados: int = Field(description="Resultado final 'Ignorado'. Es dato real, no un nulo.")
    repitentes: int
    graduandos: int

    # El denominador es el total del grupo, incluidas vigentes e ignoradas, así
    # que promoción + no promoción + retiro puede sumar menos de 100%.
    tasa_promocion: float
    tasa_no_promocion: float
    tasa_retiro: float
    tasa_repitencia: float


class Agregados(BaseModel):
    dimension: Dimension
    total_registros: int = Field(description="Suma de `total` de todas las filas.")
    filas: list[Fila]


class CruceNivel(BaseModel):
    """Una celda del cruce departamento × nivel."""

    departamento_codigo: int
    departamento: str
    nivel_codigo: int | None
    nivel: str
    total: int
    promovidos: int
    no_promovidos: int
    retirados: int
    tasa_promocion: float


class Resumen(BaseModel):
    """KPIs nacionales para la portada del dashboard."""

    inscripciones: int
    departamentos: int
    municipios: int
    escuelas: int = Field(
        description="Establecimientos distintos agrupando por los 3 primeros "
        "segmentos del código: el 4.º es el nivel y duplicaría escuelas."
    )
    tasa_promocion: float
    tasa_no_promocion: float
    tasa_retiro: float
    tasa_repitencia: float


class PreguntaChat(BaseModel):
    pregunta: str
    contexto: list[str] = Field(
        default_factory=list, description="Departamentos seleccionados en el mapa."
    )


class RespuestaChat(BaseModel):
    respuesta: str
    con_ia: bool = Field(
        description="False mientras responda el buscador determinista sobre los "
        "agregados, sin modelo de lenguaje."
    )
    cifras: list[Fila] = Field(
        default_factory=list,
        description="Filas exactas en las que se basa la respuesta. Nunca se "
        "generan cifras: salen de las mismas tablas que el dashboard.",
    )
