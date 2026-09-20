"""Convierte una fila cruda en una fila decodificada, validando por el camino.

Decisiones de tratamiento que quedan fijadas aqui:

* El codigo 9 ("Ignorado") es un dato real, no un faltante: se traduce a la
  etiqueta "Ignorado" y nunca se convierte en nulo ni se descarta.
* El municipio sale del 2o segmento de CodEstablecimiento, no de Depto_mupio
  (que es constante dentro de cada archivo). Se conserva como texto de 4
  digitos con cero a la izquierda para poder cruzarlo con el GeoJSON.
* El prefijo irregular "00-" de guatemala.xlsx se resuelve ANTES de derivar el
  municipio; sin eso Guatemala reporta 39 municipios en vez de 17. Ahi el 2o
  segmento es una zona de la capital, no un municipio (ver esquema.py), asi que
  esas filas se atribuyen al municipio 0101 y el codigo original se conserva
  tal cual para no perder la zona.
* Donde el orden importa (departamento, nivel, grado) se emite el codigo
  numerico ademas de la etiqueta.
* El 4o segmento del codigo repite el nivel: se usa como control cruzado.
"""

from __future__ import annotations

from collections import Counter

from .diccionario import Catalogos
from .esquema import (
    ANIO_ESPERADO,
    COLUMNAS_CRUDAS,
    DEPARTAMENTO_DE_LA_CAPITAL,
    MUNICIPIO_DE_LA_CAPITAL,
    PREFIJO_CAPITAL_POR_ZONA,
    RANGOS_GRADO,
    SEGMENTO_NIVEL_A_NIVEL,
    ZONAS_CAPITAL,
)
from .validacion import Validador

# Indices de la fila cruda, derivados del contrato para no usar numeros magicos.
_I = {nombre: posicion for posicion, nombre in enumerate(COLUMNAS_CRUDAS)}

# Columnas que se traducen con el catalogo del diccionario.
COLUMNAS_A_DECODIFICAR: tuple[tuple[str, str], ...] = (
    ("Sector", "sector"),
    ("Área", "area"),
    ("Sexo", "sexo"),
    ("Pueblo_Per", "pueblo_pertenencia"),
    ("Plan_Est", "plan_estudio"),
    ("Jornada_Est", "jornada"),
    ("Resultado_F", "resultado_final"),
    ("Repitente", "repitente"),
    ("Graduando", "graduando"),
)

SEGMENTOS_ESPERADOS = 4


def _entero(valor: object) -> int | None:
    """Las celdas numericas llegan como float desde calamine (2024.0)."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return int(valor)
    try:
        return int(float(str(valor).strip()))
    except (TypeError, ValueError):
        return None


class Transformador:
    """Transforma filas de un archivo y acumula lo que no cuadra."""

    def __init__(self, catalogos: Catalogos, validador: Validador, archivo: str) -> None:
        self.catalogos = catalogos
        self.validador = validador
        self.archivo = archivo
        self.filas_validas = 0
        self.codigos_por_zona = 0
        self.municipios_vistos: set[str] = set()
        self.departamentos_vistos: set[int] = set()
        self.distribuciones: dict[str, Counter[str]] = {}

    # -- helpers de registro -------------------------------------------------

    def _anotar(self, clave: str, fila: int, detalle: str) -> None:
        self.validador.anotar(f"{self.archivo}: {clave}", f"fila {fila}: {detalle}")

    def _contar(self, columna: str, etiqueta: str) -> None:
        self.distribuciones.setdefault(columna, Counter())[etiqueta] += 1

    # -- pasos de transformacion --------------------------------------------

    def _partir_codigo(self, codigo: str, fila: int) -> list[str] | None:
        """Parte CodEstablecimiento en sus 4 segmentos."""
        segmentos = codigo.split("-")
        if len(segmentos) != SEGMENTOS_ESPERADOS:
            self._anotar("CodEstablecimiento sin 4 segmentos", fila, repr(codigo))
            return None
        return segmentos

    def _municipio_de(
        self, segmentos: list[str], departamento: int, fila: int
    ) -> str | None:
        """Deriva el municipio del codigo, resolviendo el caso de la capital."""
        prefijo, segundo = segmentos[0], segmentos[1]
        codigo = "-".join(segmentos)

        if prefijo == PREFIJO_CAPITAL_POR_ZONA:
            # Aqui el 2o segmento es una zona de la capital, no un municipio.
            if departamento != DEPARTAMENTO_DE_LA_CAPITAL:
                self._anotar(
                    "prefijo de capital fuera del departamento de Guatemala",
                    fila,
                    f"{codigo} con Departamento_F={departamento}",
                )
                return None
            if segundo not in ZONAS_CAPITAL:
                self._anotar(
                    "zona de la capital desconocida", fila, f"zona {segundo!r} en {codigo}"
                )
                return None
            self.codigos_por_zona += 1
            return MUNICIPIO_DE_LA_CAPITAL

        if prefijo != f"{departamento:02d}":
            self._anotar(
                "prefijo del codigo no coincide con Departamento_F",
                fila,
                f"{codigo} con Departamento_F={departamento}",
            )
            return None
        return prefijo + segundo

    def _revisar_nivel_contra_codigo(self, segmento: str, nivel: int, fila: int) -> None:
        """Control cruzado: el 4o segmento debe corresponder al Nivel."""
        nivel_del_codigo = SEGMENTO_NIVEL_A_NIVEL.get(segmento)
        if nivel_del_codigo is None:
            self._anotar("4o segmento desconocido", fila, f"segmento {segmento!r}")
        elif nivel_del_codigo != nivel:
            self._anotar(
                "4o segmento no coincide con Nivel",
                fila,
                f"segmento {segmento} implica nivel {nivel_del_codigo}, "
                f"la columna dice {nivel}",
            )

    def _revisar_grado(self, grado: int, nivel: int, fila: int) -> None:
        """El grado solo tiene sentido dentro de su nivel."""
        rango = RANGOS_GRADO.get(nivel)
        if rango is None:
            return  # nivel Ignorado: no hay rango declarado
        minimo, maximo = rango
        if not minimo <= grado <= maximo:
            self._anotar(
                "grado fuera del rango del nivel",
                fila,
                f"grado {grado} con nivel {nivel} (rango {minimo}-{maximo})",
            )

    def _decodificar(self, fila_cruda: list[object], fila: int) -> dict[str, str] | None:
        """Traduce las columnas categoricas; 9 -> 'Ignorado', nunca nulo."""
        etiquetas: dict[str, str] = {}
        for columna_cruda, columna in COLUMNAS_A_DECODIFICAR:
            crudo = fila_cruda[_I[columna_cruda]]
            codigo = _entero(crudo)
            if codigo is None:
                self._anotar(f"{columna}: valor no numerico", fila, repr(crudo))
                return None
            etiqueta = self.catalogos.etiqueta(columna, codigo)
            if etiqueta is None:
                self._anotar(
                    f"{columna}: codigo fuera del diccionario", fila, f"codigo {codigo}"
                )
                return None
            etiquetas[columna] = etiqueta
            self._contar(columna, etiqueta)
        return etiquetas

    # -- entrada publica -----------------------------------------------------

    def transformar(self, fila_cruda: list[object], fila: int) -> list[object] | None:
        """Devuelve la fila lista para el CSV, o None si hubo que descartarla."""
        anio = _entero(fila_cruda[_I["Año"]])
        if anio != ANIO_ESPERADO:
            self._anotar("anio distinto de 2024", fila, repr(fila_cruda[_I["Año"]]))
            return None

        departamento = _entero(fila_cruda[_I["Departamento_F"]])
        nombre_departamento = self.catalogos.departamentos.get(departamento)
        if nombre_departamento is None:
            self._anotar("departamento fuera del catalogo", fila, repr(departamento))
            return None
        self.departamentos_vistos.add(departamento)

        codigo = str(fila_cruda[_I["CodEstablecimiento"]]).strip()
        segmentos = self._partir_codigo(codigo, fila)
        if segmentos is None:
            return None

        municipio_codigo = self._municipio_de(segmentos, departamento, fila)
        if municipio_codigo is None:
            return None
        nombre_municipio = self.catalogos.municipios.get(municipio_codigo)
        if nombre_municipio is None:
            self._anotar(
                "municipio fuera del catalogo",
                fila,
                f"{municipio_codigo} derivado de {codigo}",
            )
            return None
        self.municipios_vistos.add(municipio_codigo)

        nivel = _entero(fila_cruda[_I["Nivel"]])
        nombre_nivel = self.catalogos.etiqueta("nivel", nivel)
        if nombre_nivel is None:
            self._anotar("nivel fuera del diccionario", fila, repr(nivel))
            return None
        self._contar("nivel", nombre_nivel)
        self._revisar_nivel_contra_codigo(segmentos[3], nivel, fila)

        grado = _entero(fila_cruda[_I["Grado"]])
        if grado is None:
            self._anotar("grado no numerico", fila, repr(fila_cruda[_I["Grado"]]))
            return None
        self._revisar_grado(grado, nivel, fila)

        etiquetas = self._decodificar(fila_cruda, fila)
        if etiquetas is None:
            return None

        self.filas_validas += 1
        return [
            anio,
            "-".join(segmentos),
            # Mismo centro sin el nivel: contar escuelas exige agrupar por aqui,
            # porque un establecimiento con varios niveles tiene varios codigos.
            "-".join(segmentos[:3]),
            departamento,
            nombre_departamento,
            municipio_codigo,
            nombre_municipio,
            etiquetas["sector"],
            etiquetas["area"],
            etiquetas["sexo"],
            nivel,
            nombre_nivel,
            grado,
            # El diccionario no trae etiqueta de grado: se arma con el nivel
            # porque un "1" de primaria no es un "1" de basico.
            f"{grado} {nombre_nivel}",
            etiquetas["pueblo_pertenencia"],
            etiquetas["plan_estudio"],
            etiquetas["jornada"],
            etiquetas["resultado_final"],
            etiquetas["repitente"],
            etiquetas["graduando"],
        ]
