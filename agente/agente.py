"""El bucle del agente: pregunta -> modelo -> herramientas -> respuesta.

El modelo decide que consultar; este modulo ejecuta lo que pide, le devuelve el
resultado y repite hasta que el modelo responde con texto. Cada consulta queda
registrada en la respuesta para que se pueda ver de donde salio cada cifra.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import openai

from .configuracion import SEGUNDOS_POR_LLAMADA_AL_MODELO, Configuracion, cargar
from .herramientas import HERRAMIENTAS, ejecutar
from .instrucciones import instrucciones, nota_de_contexto

# Una pregunta normal usa 1 o 2 vueltas. El tope evita un bucle sin fin (y su costo).
VUELTAS_MAXIMAS = 6
MENSAJES_DE_HISTORIAL = 10
ROLES_DE_HISTORIAL = ("user", "assistant")


class ErrorDelModelo(RuntimeError):
    """OpenAI no pudo atender la solicitud (llave invalida, limite, red...)."""


@dataclass(frozen=True)
class Respuesta:
    texto: str
    consultas: list[dict] = field(default_factory=list)


def _mensajes_iniciales(pregunta: str, contexto: list[str], historial: list[dict]) -> list[dict]:
    mensajes = [{"role": "system", "content": instrucciones()}]
    nota = nota_de_contexto(contexto)
    if nota:
        mensajes.append({"role": "system", "content": nota})
    for mensaje in historial[-MENSAJES_DE_HISTORIAL:]:
        if mensaje.get("role") in ROLES_DE_HISTORIAL and mensaje.get("content"):
            mensajes.append({"role": mensaje["role"], "content": mensaje["content"]})
    mensajes.append({"role": "user", "content": pregunta})
    return mensajes


def _pedir_al_modelo(
    cliente: openai.OpenAI, configuracion: Configuracion, mensajes: list[dict], con_herramientas: bool
):
    modelo = configuracion.modelo
    opcionales = {"reasoning_effort": configuracion.esfuerzo} if configuracion.esfuerzo else {}
    try:
        respuesta = cliente.chat.completions.create(
            model=modelo,
            messages=mensajes,
            tools=HERRAMIENTAS,
            tool_choice="auto" if con_herramientas else "none",
            **opcionales,
        )
    except openai.AuthenticationError as error:
        raise ErrorDelModelo("La llave OPENAI_API_KEY no es valida.") from error
    except openai.RateLimitError as error:
        raise ErrorDelModelo("OpenAI rechazo la solicitud por limite de uso o saldo.") from error
    except openai.NotFoundError as error:
        raise ErrorDelModelo(f"El modelo {modelo!r} no existe o tu cuenta no lo tiene.") from error
    except openai.APIConnectionError as error:
        raise ErrorDelModelo("No se pudo conectar con OpenAI.") from error
    except openai.APIStatusError as error:
        raise ErrorDelModelo(f"OpenAI respondio con error {error.status_code}.") from error
    return respuesta.choices[0].message


def precalentar() -> None:
    """Lee los catalogos de la base por adelantado (tarda unos segundos, una vez).

    Si falla no pasa nada: se volvera a intentar, y a reportar, en la primera pregunta.
    """
    try:
        instrucciones()
    except Exception:  # noqa: BLE001 - es solo una optimizacion, nunca debe tumbar el arranque
        pass


def responder(
    pregunta: str,
    contexto: list[str] | None = None,
    historial: list[dict] | None = None,
) -> Respuesta:
    """Responde una pregunta en lenguaje natural usando solo cifras consultadas."""
    configuracion = cargar()
    cliente = openai.OpenAI(
        api_key=configuracion.llave_openai, timeout=SEGUNDOS_POR_LLAMADA_AL_MODELO
    )
    mensajes = _mensajes_iniciales(pregunta, contexto or [], historial or [])
    consultas: list[dict] = []

    for vuelta in range(VUELTAS_MAXIMAS + 1):
        # En la ultima vuelta se le quitan las herramientas: tiene que responder ya.
        quedan_vueltas = vuelta < VUELTAS_MAXIMAS
        mensaje = _pedir_al_modelo(cliente, configuracion, mensajes, quedan_vueltas)
        llamadas = [l for l in (mensaje.tool_calls or []) if l.type == "function"]
        if not llamadas:
            return Respuesta(texto=(mensaje.content or "").strip(), consultas=consultas)

        mensajes.append(mensaje.model_dump(exclude_none=True))
        for llamada in llamadas:
            resultado = ejecutar(llamada.function.name, llamada.function.arguments)
            consultas.append(
                {
                    "herramienta": llamada.function.name,
                    "argumentos": llamada.function.arguments,
                    "resultado": resultado,
                }
            )
            mensajes.append(
                {
                    "role": "tool",
                    "tool_call_id": llamada.id,
                    "content": json.dumps(resultado, ensure_ascii=False),
                }
            )

    raise ErrorDelModelo("El modelo no llego a una respuesta.")
