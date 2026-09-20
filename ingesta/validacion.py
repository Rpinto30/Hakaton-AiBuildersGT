"""Acumulador de problemas: junta todo lo que no cuadra y revienta al final.

Fallar en el primer error obliga a ejecutar la ingesta una vez por cada
problema. Este validador registra cada hallazgo con un conteo y unos pocos
ejemplos, y solo entonces lanza la excepcion. Una corrida = la lista completa.
"""

from __future__ import annotations

from collections import Counter, defaultdict

EJEMPLOS_POR_PROBLEMA = 3


class ErrorDeIngesta(RuntimeError):
    """Los datos no cumplen el contrato declarado en esquema.py."""


class Validador:
    """Registra problemas por clave y decide si la corrida puede continuar."""

    def __init__(self) -> None:
        self._conteos: Counter[str] = Counter()
        self._ejemplos: dict[str, list[str]] = defaultdict(list)

    def anotar(self, clave: str, ejemplo: str) -> None:
        """Registra una ocurrencia del problema `clave`."""
        self._conteos[clave] += 1
        ejemplos = self._ejemplos[clave]
        if len(ejemplos) < EJEMPLOS_POR_PROBLEMA:
            ejemplos.append(ejemplo)

    @property
    def hay_problemas(self) -> bool:
        return bool(self._conteos)

    def reporte(self) -> str:
        """Texto legible con cada problema, su conteo y ejemplos."""
        lineas = []
        for clave, total in self._conteos.most_common():
            lineas.append(f"  [{total:,} vez/veces] {clave}")
            for ejemplo in self._ejemplos[clave]:
                lineas.append(f"      p.ej. {ejemplo}")
        return "\n".join(lineas)

    def exigir_ok(self, contexto: str) -> None:
        """Lanza ErrorDeIngesta si se registro cualquier problema."""
        if self.hay_problemas:
            raise ErrorDeIngesta(
                f"La ingesta se detuvo: los datos no cuadran ({contexto}).\n"
                f"{self.reporte()}"
            )
