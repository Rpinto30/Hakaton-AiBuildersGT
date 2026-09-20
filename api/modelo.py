"""Modelo de prioridad: qué municipios rinden por debajo de lo esperado.

Qué hace
--------
Ajusta una regresión lineal que predice la tasa de promoción de un municipio a
partir de su composición observable (qué tan rural es, qué mezcla de sectores y
niveles tiene, qué pueblos de pertenencia). Después compara lo observado contra
lo predicho:

    brecha = tasa_promocion_real - tasa_promocion_esperada

Una brecha negativa significa que el municipio promueve menos de lo que
promueven otros municipios *parecidos*. Eso es una señal de dónde mirar, porque
descuenta lo que el municipio no elige: su ruralidad o su mezcla de niveles.

Qué NO hace
-----------
* No establece causas. Una regresión sobre un solo ciclo muestra asociación, no
  causalidad. Que `pct_rural` tenga coeficiente negativo no dice que la
  ruralidad cause no promoción.
* No predice el futuro. El dataset trae únicamente 2024; no hay serie temporal
  que permita proyectar 2025.
* No explica los resultados de PISA. Esos datos no están en el dataset.

Decisiones
----------
* Mínimos cuadrados ponderados por matrícula. Sin ponderar, un municipio de 300
  inscripciones pesa igual que uno de 300 mil y el ajuste se va detrás del ruido
  de los chicos.
* Se excluyen municipios muy pequeños del AJUSTE (ver MATRICULA_MINIMA): sus
  tasas son inestables. Sí reciben predicción y brecha.
* Las variables se eligen para no ser redundantes entre sí: de cada grupo que
  suma 100 % se deja fuera una categoría (el sector público, el nivel primaria),
  que queda absorbida por el intercepto.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from .db import consultar

# Composición que entra al modelo. De sector se omite `pct_publico` y de nivel
# `pct_primaria`: son las categorías de referencia.
VARIABLES: tuple[str, ...] = (
    "pct_privado",
    "pct_cooperativa",
    "pct_municipal",
    "pct_rural",
    "pct_mujer",
    "pct_preprimaria",
    "pct_basico",
    "pct_diversificado",
    "pct_maya",
)

OBJETIVO = "tasa_promocion"

# Bajo esta matrícula la tasa de un municipio es demasiado ruidosa para ajustar.
MATRICULA_MINIMA = 500


def _filas() -> list[dict[str, Any]]:
    return consultar(
        """
        SELECT municipio_codigo, municipio, departamento, departamento_codigo,
               total, pct_privado, pct_cooperativa, pct_municipal, pct_rural,
               pct_mujer, pct_preprimaria, pct_basico, pct_diversificado,
               pct_maya, tasa_promocion, tasa_no_promocion, tasa_retiro,
               tasa_repitencia
        FROM agg_municipio_perfil
        ORDER BY municipio_codigo
        """
    )


def _matriz(filas: list[dict[str, Any]]) -> np.ndarray:
    """Matriz de diseño: una columna por variable más el intercepto."""
    datos = np.array(
        [[float(fila[variable]) for variable in VARIABLES] for fila in filas],
        dtype=float,
    )
    return np.hstack([np.ones((len(filas), 1)), datos])


def _r2_ponderado(y: np.ndarray, predicho: np.ndarray, peso: np.ndarray) -> float:
    """Proporción de la varianza explicada, con el mismo peso del ajuste."""
    media = float(np.average(y, weights=peso))
    residual = float(np.sum(peso * (y - predicho) ** 2))
    total = float(np.sum(peso * (y - media) ** 2))
    return 0.0 if total == 0 else round(1 - residual / total, 4)


def calcular() -> dict[str, Any]:
    """Ajusta el modelo y devuelve los municipios ordenados por brecha."""
    filas = _filas()
    if len(filas) <= len(VARIABLES) + 1:
        return {}

    X = _matriz(filas)
    y = np.array([float(fila[OBJETIVO]) for fila in filas])
    matricula = np.array([float(fila["total"]) for fila in filas])

    # El ajuste solo usa los municipios con matrícula suficiente; todos reciben
    # predicción después.
    entrenables = matricula >= MATRICULA_MINIMA
    if int(entrenables.sum()) <= len(VARIABLES) + 1:
        entrenables = np.ones_like(entrenables, dtype=bool)

    peso = matricula[entrenables]
    raiz = np.sqrt(peso)[:, None]
    coeficientes, *_ = np.linalg.lstsq(X[entrenables] * raiz, y[entrenables] * raiz.ravel(), rcond=None)

    predicho = X @ coeficientes
    brecha = y - predicho

    municipios = []
    for i, fila in enumerate(filas):
        # Inscripciones que separan a este municipio de su nivel esperado.
        # Solo tiene sentido leerlo cuando la brecha es negativa.
        faltantes = int(round(fila["total"] * max(0.0, -brecha[i]) / 100))
        municipios.append(
            {
                "municipio_codigo": fila["municipio_codigo"],
                "municipio": fila["municipio"],
                "departamento": fila["departamento"],
                "departamento_codigo": fila["departamento_codigo"],
                "total": fila["total"],
                "tasa_promocion": float(fila["tasa_promocion"]),
                "tasa_no_promocion": float(fila["tasa_no_promocion"]),
                "tasa_retiro": float(fila["tasa_retiro"]),
                "tasa_repitencia": float(fila["tasa_repitencia"]),
                "pct_rural": float(fila["pct_rural"]),
                "esperado": round(float(predicho[i]), 2),
                "brecha": round(float(brecha[i]), 2),
                "estudiantes_bajo_lo_esperado": faltantes,
                "en_el_ajuste": bool(entrenables[i]),
            }
        )

    municipios.sort(key=lambda m: m["brecha"])

    return {
        "r2": _r2_ponderado(y[entrenables], predicho[entrenables], peso),
        "municipios_ajustados": int(entrenables.sum()),
        "municipios_totales": len(filas),
        "matricula_minima": MATRICULA_MINIMA,
        "coeficientes": [
            {"variable": nombre, "coeficiente": round(float(valor), 4)}
            for nombre, valor in zip(VARIABLES, coeficientes[1:])
        ],
        "intercepto": round(float(coeficientes[0]), 2),
        "municipios": municipios,
    }
