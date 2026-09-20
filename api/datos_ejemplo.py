"""Datos de EJEMPLO para que el frontend avance sin esperar a la base de datos.

Sirven para dar forma a las gráficas, no para sacar conclusiones:
  * Totales por departamento: los publicados en la documentación del hackatón.
  * Totales por nivel, sector y área: porcentajes nacionales de esa misma documentación
    aplicados a 4,298,887 registros (aproximados por el redondeo).
  * Desglose por resultado: el porcentaje nacional aplicado igual a TODAS las filas, por eso
    todas tienen la misma tasa. Repitentes y graduandos son valores puramente ilustrativos.

La respuesta lleva `es_ejemplo = true`. Para pasar a datos reales solo hay que reemplazar
`agregados()` por una consulta a las tablas `agg_*`; el contrato (schemas.py) no cambia.
"""
from .schemas import Agregado, Agregados, Dimension

TOTAL_NACIONAL = 4_298_887

# Proporciones nacionales de resultado (documentación del hackatón).
_P_NO_PROMOVIDOS = 0.092
_P_RETIRADOS = 0.055
_P_VIGENTES = 0.001
# Ilustrativas: la documentación no publica cifras de repitencia ni de graduandos.
_P_REPITENTES = 0.05
_P_GRADUANDOS = 0.03

# codigo -> (etiqueta, total de inscripciones)
_DEPARTAMENTOS = {
    1: ("Guatemala", 863_879),
    2: ("El Progreso", 49_803),
    3: ("Sacatepéquez", 91_552),
    4: ("Chimaltenango", 166_965),
    5: ("Escuintla", 207_618),
    6: ("Santa Rosa", 108_264),
    7: ("Sololá", 122_831),
    8: ("Totonicapán", 113_139),
    9: ("Quetzaltenango", 232_627),
    10: ("Suchitepéquez", 159_287),
    11: ("Retalhuleu", 98_128),
    12: ("San Marcos", 303_565),
    13: ("Huehuetenango", 316_771),
    14: ("Quiché", 268_998),
    15: ("Baja Verapaz", 81_736),
    16: ("Alta Verapaz", 391_085),
    17: ("Petén", 169_629),
    18: ("Izabal", 120_326),
    19: ("Zacapa", 71_079),
    20: ("Chiquimula", 127_409),
    21: ("Jalapa", 99_625),
    22: ("Jutiapa", 134_571),
}

# codigo -> (etiqueta, proporción nacional)
_NIVELES = {
    1: ("Preprimaria", 0.171),
    2: ("Primaria", 0.564),
    3: ("Básico", 0.178),
    4: ("Diversificado", 0.085),
    5: ("Primaria de adultos", 0.002),  # lo que resta para completar 100%
}
_SECTORES = {
    1: ("Público", 0.747),
    2: ("Privado", 0.209),
    3: ("Municipal", 0.003),
    4: ("Cooperativa", 0.040),
}
_AREAS = {
    1: ("Urbana", 0.386),
    2: ("Rural", 0.614),
}


def _por_proporcion(catalogo: dict[int, tuple[str, float]]) -> list[tuple[int, str, int]]:
    """Convierte proporciones en totales; la primera fila absorbe el residuo del redondeo
    para que las filas sumen exactamente TOTAL_NACIONAL."""
    totales = {codigo: round(TOTAL_NACIONAL * p) for codigo, (_, p) in catalogo.items()}
    primero = next(iter(totales))
    totales[primero] += TOTAL_NACIONAL - sum(totales.values())
    return [(codigo, etiqueta, totales[codigo]) for codigo, (etiqueta, _) in catalogo.items()]


_FILAS: dict[Dimension, list[tuple[int, str, int]]] = {
    Dimension.departamento: [(c, nombre, total) for c, (nombre, total) in _DEPARTAMENTOS.items()],
    Dimension.nivel: _por_proporcion(_NIVELES),
    Dimension.sector: _por_proporcion(_SECTORES),
    Dimension.area: _por_proporcion(_AREAS),
}


def _tasa(parte: int, total: int) -> float:
    return round(100 * parte / total, 2) if total else 0.0


def _fila(codigo: int, etiqueta: str, total: int) -> Agregado:
    no_promovidos = round(total * _P_NO_PROMOVIDOS)
    retirados = round(total * _P_RETIRADOS)
    vigentes = round(total * _P_VIGENTES)
    promovidos = total - no_promovidos - retirados - vigentes  # el resto, para que cuadre
    return Agregado(
        codigo=codigo,
        etiqueta=etiqueta,
        total=total,
        promovidos=promovidos,
        no_promovidos=no_promovidos,
        retirados=retirados,
        vigentes=vigentes,
        ignorados=0,
        repitentes=round(total * _P_REPITENTES),
        graduandos=round(total * _P_GRADUANDOS),
        tasa_promocion=_tasa(promovidos, total),
        tasa_no_promocion=_tasa(no_promovidos, total),
        tasa_retiro=_tasa(retirados, total),
    )


def agregados(dimension: Dimension) -> Agregados:
    filas = [_fila(*datos) for datos in _FILAS[dimension]]
    return Agregados(
        dimension=dimension,
        es_ejemplo=True,
        total_registros=sum(f.total for f in filas),
        filas=filas,
    )
