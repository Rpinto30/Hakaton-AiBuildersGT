"""Contrato de la API. El frontend se apoya en estos modelos; no cambian cuando los datos
pasen de ejemplo a reales."""
from enum import StrEnum

from pydantic import BaseModel, Field


class Dimension(StrEnum):
    departamento = "departamento"
    nivel = "nivel"
    sector = "sector"
    area = "area"


class Agregado(BaseModel):
    """Una fila de agregados: un departamento, un nivel, un sector o un área."""

    codigo: int = Field(description="Código original del dataset (p. ej. Sector 1 = Público).")
    etiqueta: str = Field(description="Nombre legible del código.")
    total: int = Field(description="Inscripciones (filas) del grupo.")
    promovidos: int
    no_promovidos: int
    retirados: int = Field(description="Resultado 3 (Retirado) + 4 (Retirado definitivo).")
    vigentes: int
    ignorados: int = Field(description="Inscripciones con Resultado = 9 (Ignorado).")
    repitentes: int
    graduandos: int
    tasa_promocion: float = Field(description="% de promovidos sobre el total de inscripciones.")
    tasa_no_promocion: float = Field(description="% de no promovidos sobre el total.")
    tasa_retiro: float = Field(description="% de retirados sobre el total.")


class Agregados(BaseModel):
    dimension: Dimension
    es_ejemplo: bool = Field(
        description="True mientras la API devuelva datos de muestra. NO son cifras reales."
    )
    total_registros: int = Field(description="Suma de `total` de todas las filas.")
    filas: list[Agregado]
