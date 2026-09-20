"""Prueba el agente desde la terminal, sin levantar la API.

    python -m agente "cuantos estudiantes de primaria hay en Alta Verapaz"
    python -m agente --contexto Quiché --ver-consultas "cuantas escuelas hay"
"""

from __future__ import annotations

import argparse
import json
import sys

from .agente import ErrorDelModelo, responder
from .configuracion import ErrorDeConfiguracion


def main(argv: list[str] | None = None) -> int:
    analizador = argparse.ArgumentParser(
        prog="python -m agente",
        description="Pregunta en lenguaje natural sobre Educacion Formal 2024.",
    )
    analizador.add_argument("pregunta")
    analizador.add_argument(
        "--contexto", nargs="*", default=[], metavar="LUGAR",
        help="Lo que estaria seleccionado en el mapa (p. ej. un departamento).",
    )
    analizador.add_argument(
        "--ver-consultas", action="store_true",
        help="Muestra que consulto el agente para llegar a la respuesta.",
    )
    argumentos = analizador.parse_args(argv)

    try:
        respuesta = responder(argumentos.pregunta, argumentos.contexto)
    except (ErrorDeConfiguracion, ErrorDelModelo) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    if argumentos.ver_consultas:
        for consulta in respuesta.consultas:
            print(f"[{consulta['herramienta']}] {consulta['argumentos']}")
            print(f"  -> {json.dumps(consulta['resultado'], ensure_ascii=False)[:400]}\n")
    print(respuesta.texto)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
