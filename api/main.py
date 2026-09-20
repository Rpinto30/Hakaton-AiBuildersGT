"""API de Educación Formal 2024. Por ahora sirve datos de ejemplo (ver datos_ejemplo.py)."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import datos_ejemplo
from .schemas import Agregados, Dimension

app = FastAPI(
    title="Educación Formal 2024 · API",
    version="0.1.0",
    description="Agregados precalculados por departamento, nivel, sector y área. "
    "**Mientras `es_ejemplo` sea `true`, las cifras NO son reales.**",
)

# El frontend corre en otro origen (p. ej. Vite en :5173), así que el navegador exige CORS.
_origenes = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=_origenes, allow_methods=["GET"], allow_headers=["*"])


@app.get("/health", summary="Estado del servicio")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/agregados/{dimension}",
    response_model=Agregados,
    summary="Agregados por departamento, nivel, sector o área",
)
def obtener_agregados(dimension: Dimension) -> Agregados:
    return datos_ejemplo.agregados(dimension)
