"""Contrato de la API. El frontend se apoya en estos modelos.

La forma de `Fila` es la misma de las tablas `agg_*`, que comparten columnas a
propósito. Por eso un solo endpoint sirve las cinco dimensiones.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

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


class MensajePrevio(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class PreguntaChat(BaseModel):
    pregunta: str = Field(max_length=1000)
    contexto: list[str] = Field(
        default_factory=list, description="Departamentos seleccionados en el mapa."
    )
    historial: list[MensajePrevio] = Field(
        default_factory=list,
        max_length=40,
        description="Mensajes anteriores, para entender preguntas de seguimiento.",
    )


class ConsultaDelAgente(BaseModel):
    herramienta: str
    argumentos: str
    resultado: dict


class RespuestaChat(BaseModel):
    respuesta: str
    con_ia: bool = Field(
        description="True si respondió el agente (modelo de lenguaje + consultas a la "
        "base). False si respondió el buscador determinista, que es el respaldo "
        "cuando no hay llave de OpenAI o el modelo no está disponible."
    )
    cifras: list[Fila] = Field(
        default_factory=list,
        description="Filas exactas en las que se basa la respuesta. Nunca se "
        "generan cifras: salen de las mismas tablas que el dashboard.",
    )
    consultas: list[ConsultaDelAgente] = Field(
        default_factory=list,
        description="Con el agente: qué le pidió a la base para responder. El modelo "
        "no escribe cifras por su cuenta; todas salen de estas consultas.",
    )


class MunicipioPriorizado(BaseModel):
    """Un municipio con su tasa observada y la que su perfil hacía esperar."""

    municipio_codigo: str
    municipio: str
    departamento: str
    departamento_codigo: int
    total: int
    tasa_promocion: float
    tasa_no_promocion: float
    tasa_retiro: float
    tasa_repitencia: float
    pct_rural: float
    esperado: float = Field(description="Promoción que el modelo predice para este perfil.")
    brecha: float = Field(
        description="Observado menos esperado. Negativo = rinde por debajo de "
        "municipios con composición parecida."
    )
    estudiantes_bajo_lo_esperado: int = Field(
        description="Inscripciones que separan al municipio de su nivel esperado. "
        "Solo se interpreta cuando la brecha es negativa."
    )
    en_el_ajuste: bool


class Coeficiente(BaseModel):
    variable: str
    coeficiente: float


class Prioridad(BaseModel):
    """Resultado del modelo, ordenado de la peor brecha a la mejor.

    Es un modelo descriptivo de asociación sobre un solo ciclo escolar: señala
    dónde mirar, no por qué pasa. El dataset no permite atribuir causas, ni
    proyectar otros años, ni decir nada sobre PISA.
    """

    r2: float = Field(description="Varianza de la promoción que explica la composición.")
    municipios_ajustados: int
    municipios_totales: int
    matricula_minima: int
    intercepto: float
    coeficientes: list[Coeficiente]
    municipios: list[MunicipioPriorizado]
