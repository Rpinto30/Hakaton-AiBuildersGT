"""API de Educación Formal 2024.

Sirve únicamente lo que las tablas `agg_*` ya tienen precalculado. No decodifica
nada (eso lo hizo la ingesta) ni calcula tasas al vuelo (eso lo hizo
`refresh_agregados()`), así que el dashboard, el mapa y el chat leen siempre la
misma cifra.

Levantar en desarrollo:
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agente import agente
from agente.configuracion import ErrorDeConfiguracion

from . import buscador, consultas, modelo
from .db import BaseNoDisponible, esta_viva
from .schemas import (
    Agregados,
    CruceNivel,
    Dimension,
    PreguntaChat,
    Prioridad,
    RespuestaChat,
    Resumen,
)

app = FastAPI(
    title="Educación Formal 2024 · API",
    version="1.0.0",
    description=(
        "Agregados precalculados del censo educativo 2024 de Guatemala "
        "(4,298,887 inscripciones). Todas las cifras salen de Postgres."
    ),
)

# El frontend corre en otro origen (Vite en :5173). En desarrollo se usa el
# proxy de Vite, así que CORS solo hace falta si se llama a la API directo.
_origenes = [
    origen.strip()
    for origen in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    if origen.strip()
]
app.add_middleware(
    CORSMiddleware, allow_origins=_origenes, allow_methods=["GET", "POST"], allow_headers=["*"]
)

registro = logging.getLogger("uvicorn.error")

# Los catálogos del agente tardan ~5 s en leerse de la base. Se cargan en segundo
# plano al arrancar para que no los pague la primera persona que pregunte.
threading.Thread(target=agente.precalentar, daemon=True).start()

MENSAJE_SIN_BASE = (
    "No hay conexión con la base de datos. Levántala con `docker compose up -d db` "
    "y carga los datos siguiendo LEEME.md."
)


def _sin_base(error: BaseNoDisponible) -> HTTPException:
    return HTTPException(status_code=503, detail=f"{MENSAJE_SIN_BASE} ({error})")


@app.get("/health", summary="Estado del servicio y de la base")
def health() -> dict[str, object]:
    viva = esta_viva()
    return {"status": "ok" if viva else "sin_base", "base_de_datos": viva}


@app.get("/api/resumen", response_model=Resumen, summary="KPIs nacionales")
def obtener_resumen() -> Resumen:
    try:
        datos = consultas.resumen_nacional()
    except BaseNoDisponible as error:
        raise _sin_base(error) from error
    if not datos:
        raise HTTPException(
            status_code=503,
            detail="La base está viva pero vacía. Carga inscripciones.csv (ver LEEME.md).",
        )
    return Resumen(**datos)


@app.get(
    "/api/agregados/{dimension}",
    response_model=Agregados,
    summary="Agregados por departamento, municipio, nivel, sector o área",
)
def obtener_agregados(dimension: Dimension) -> Agregados:
    try:
        filas = consultas.agregados(dimension.value)
    except BaseNoDisponible as error:
        raise _sin_base(error) from error
    if not filas:
        raise HTTPException(
            status_code=503,
            detail=f"No hay agregados de «{dimension.value}». ¿Corriste CALL refresh_agregados()?",
        )
    return Agregados(
        dimension=dimension,
        total_registros=sum(fila["total"] for fila in filas),
        filas=filas,
    )


@app.get(
    "/api/departamento-nivel",
    response_model=list[CruceNivel],
    summary="Cruce departamento × nivel",
)
def obtener_cruce() -> list[CruceNivel]:
    try:
        return [CruceNivel(**fila) for fila in consultas.departamento_nivel()]
    except BaseNoDisponible as error:
        raise _sin_base(error) from error


@app.get(
    "/api/prioridad",
    response_model=Prioridad,
    summary="Municipios que rinden por debajo de lo que su perfil hace esperar",
)
def obtener_prioridad() -> Prioridad:
    try:
        resultado = modelo.calcular()
    except BaseNoDisponible as error:
        raise _sin_base(error) from error
    if not resultado:
        raise HTTPException(
            status_code=503,
            detail="Faltan los perfiles de municipio. Corre tablas/05_perfil_municipio.sql "
            "y CALL refresh_perfil_municipio().",
        )
    return Prioridad(**resultado)


@app.post("/api/chat", response_model=RespuestaChat, summary="Preguntas sobre los datos")
def chat(entrada: PreguntaChat) -> RespuestaChat:
    if not entrada.pregunta.strip():
        raise HTTPException(status_code=422, detail="La pregunta viene vacía.")
    try:
        return _responder_con_agente(entrada)
    except (ErrorDeConfiguracion, agente.ErrorDelModelo) as error:
        # Sin llave de OpenAI, o con el modelo caído, el chat no se rompe:
        # responde el buscador determinista y `con_ia` lo dice.
        registro.warning("Chat sin IA, responde el buscador: %s", error)
    try:
        return RespuestaChat(**buscador.responder(entrada.pregunta, entrada.contexto))
    except BaseNoDisponible as error:
        raise _sin_base(error) from error


def _responder_con_agente(entrada: PreguntaChat) -> RespuestaChat:
    respuesta = agente.responder(
        entrada.pregunta,
        entrada.contexto,
        [mensaje.model_dump() for mensaje in entrada.historial],
    )
    return RespuestaChat(respuesta=respuesta.texto, con_ia=True, consultas=respuesta.consultas)
