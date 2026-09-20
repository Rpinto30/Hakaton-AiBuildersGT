# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hackathon project (AI Builders GT) that makes the INE Guatemala dataset *Educación Formal 2024* readable: 4,298,887 school enrollments published as numeric codes across 23 `.xlsx` files. Data flows one way: `ingesta/` (xlsx → verified CSVs) → `tablas/*.sql` (Postgres + PostGIS, loaded per `LEEME.md`) → `api/` (FastAPI) → `React-UI/` (Vite dashboard), with `agente/` (OpenAI tool-calling agent behind `POST /api/chat`) answering questions from the same database. The contract between ingestion and everything downstream is the column layout of the output CSVs. Different team members own different components; keep changes inside the component you were asked about.

Requirements of the challenge (what is graded, what the agent must do) are summarized in `docs/agente.md` and `docs/decisiones.md`; no credentials may ever be committed (`.env` is gitignored, `env.example` is the template).

`docs/decisiones.md` explains the reasoning behind every non-obvious rule below, with the numbers that back it. Read it before changing transformation logic.

## Commands

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # single dependency: python-calamine

python -m ingesta.descargar              # download the 23 .xlsx (~225 MB) into datos/crudo/; idempotent
python -m ingesta.descargar --forzar     # re-download even if files are present

python -m ingesta                        # full run, ~7 min, writes datos/procesado/{inscripciones,municipios}.csv
python -m ingesta --solo el_progreso     # fast iteration: one or more files by stem (el_progreso is the smallest, ~50k rows)
python -m ingesta --solo-municipios      # only regenerate municipios.csv (~1 s, reads just the dictionary)
```

Other flags: `--crudo`, `--salida`, `--salida-municipios` override the default paths.

Rest of the stack (needs `.env` copied from `env.example`):

```bash
docker compose up -d db                    # Postgres 17 + PostGIS on 127.0.0.1:5432 (Apple Silicon needs a local docker-compose.override.yml with platform: linux/amd64)
# load data: README "Puesta en marcha completa" / LEEME.md (tablas/01 → 03 → scripts/load_csv.py → 02 → 04)
cd React-UI && npm install && npm run dev  # starts BOTH uvicorn (:8000, via scripts/dev-api.mjs using ../.venv) and Vite (:5173, proxies /api)
npm run lint ; npx tsc -b --noEmit         # frontend checks (from React-UI/)
python -m agente "pregunta"                # agent from the terminal; --ver-consultas shows the queries it ran
python -m agente.evaluacion                # 18 control questions with known answers, incl. off-topic refusals (spends OpenAI credit, ~2 min)
```

After `npm install` adds a dependency while a browser tab is open, Vite re-optimizes deps and the tab throws "Invalid hook call"; reload the tab. Use `127.0.0.1`, not `localhost`, in `DATABASE_URL` (IPv6 lookup timeouts, see `api/db.py`).

There is no test suite, linter, or build step. The "tests" are the validations built into the pipeline, which run against the real data: a full `python -m ingesta` exiting 0 with all 15 distribution checks printing `ok` is the pass condition. `--solo` runs skip the national-total and distribution checks (they only make sense over all 22 files) but still run every per-row check and the per-file row-count check, so it is the closest thing to running a single test.

`datos/` is gitignored; nothing works until `ingesta.descargar` has been run.

## Architecture

Data flow: `descargar` → `diccionario` (catalogs) → per file: `libro` (find sheet) → `transformacion` (row by row) → CSV, with `validacion` collecting problems throughout and `__main__` orchestrating.

**`esquema.py` is the single source of truth.** It executes nothing; it holds every fact "known" about the dataset: raw column order, dictionary-block → column mapping, the establishment-code rules, grade ranges per level, and the published control figures (per-file row counts, national total, percentage distributions). Other modules must not carry dataset literals. If the INE republishes with a different format, the fix goes here.

**Fail loudly, but all at once.** `Validador.anotar()` accumulates problems by key with a count and up to 3 examples; nothing raises mid-run. `exigir_ok()` raises `ErrorDeIngesta` at the end with the full report, so one run surfaces every problem. New checks should call `anotar` rather than raise. Structural failures that make continuing meaningless (missing dictionary sheet, no sheet with the expected header, unmapped dictionary block) raise `ErrorDeIngesta` immediately. `main()` turns `ErrorDeIngesta` into exit code 1.

**Never leave a half-written output.** CSVs and downloads are written to `<name>.parcial` and renamed only after every check passes; on failure the partial file is deleted.

**Strict by design.** An unknown dictionary block, an uncatalogued code, or an unknown capital zone stops the run instead of being guessed. `_exigir_mapeo_completo` fails if the dictionary gains or loses a block relative to `VARIABLE_DICC_A_COLUMNA` / `VARIABLES_DICC_IGNORADAS`.

**Streaming.** Rows are iterated from calamine and written straight to the CSV; only counters (`Counter` per column, set of municipios) are kept in memory. Keep it that way: the full dataset is 4.3M rows.

## Agent (`agente/`)

The model never sees rows and never writes SQL. It calls `consultar_inscripciones` / `listar_valores`; `consultas.py` validates every name against the closed lists in `catalogo.py`, builds parametrized SQL with `psycopg.sql`, and runs it read-only with a timeout. Percentages are SQL metrics, never model arithmetic, and use the same definitions as `tablas/03_agregados.sql` so chat and dashboard agree. A filter value that does not exist is an error with suggestions, not a silent zero (accent/case differences are auto-corrected); an ambiguous municipio name requires a departamento. `herramientas.ejecutar` never raises: errors go back to the model as `{"error": ...}`. `agente/` must not import FastAPI or `api/`; the `/api/chat` endpoint in `api/main.py` is a thin HTTP layer that falls back to the deterministic `api/buscador.py` (`con_ia: false`) when there is no OpenAI key or the model call fails. The rest of `api/` serves only the precomputed `agg_*` tables. Labels in the data are unaccented where the INE wrote them so (`repitente = 'Si'`, `'Si es graduando'`).

## Dataset rules that are easy to get wrong

- **`municipio_codigo` is 4-digit text with a leading zero (`'0101'`), never a number.** It is the join key with the map's GeoJSON; as an integer, `0101` becomes `101` and the join silently breaks for departments 1–9. This applies in Python, in the CSV, and in the Postgres DDL (`char(4)`).
- **The municipio comes from the 2nd segment of `CodEstablecimiento` (`DD-MM-NNNN-SS`), not from `Depto_mupio`**, which is constant within each file and is discarded.
- **The `00-` prefix in `guatemala.xlsx` (~310k rows) is not a mistyped `01-`.** When the 1st segment is `00`, the 2nd segment is a *zone of Guatemala City* (`01`–`19`, `21`, `24`, `25`), so every `00-NN-…` row belongs to municipio `0101`. The challenge documentation says to rewrite `00`→`01`; that produces nonexistent municipios (`0118`…) and was rejected by the validator. The original code is preserved unmodified in the output so the zone is not lost.
- **Code `9` ("Ignorado") is a real value, not a missing one.** It is translated to the label `Ignorado` and kept; never convert it to null or drop the row (178k cells would be affected).
- **The 4th code segment encodes the education level** and is cross-checked against the `Nivel` column (`SEGMENTO_NIVEL_A_NIVEL`). Because of it, one school offering several levels has several codes: count schools by `cod_establecimiento_base` (first 3 segments), not by `cod_establecimiento`.
- **`grado` only has meaning together with `nivel`**; the grade label (`"4 Preprimaria"`) is constructed here, not taken from the dictionary.
- **Don't pick the first sheet.** `solola.xlsx` has empty extra sheets; `libro.py` selects the unique sheet whose first row exactly matches `COLUMNAS_CRUDAS`.
- **The dictionary file is irregular**: three title rows before the header (the header row is searched, not assumed), variable names only on the first row of each block (forward-filled), mixed-type codes (`'1'` vs `9.0`), trailing spaces in labels. Dictionary block names do not match the data column names, hence the explicit mapping in `esquema.py`. `Modalidad` is in the dictionary but absent from the data and is deliberately ignored.
- Numeric cells arrive from calamine as floats (`2024.0`); go through `_entero()`.

## Conventions

- Code is written in Spanish: identifiers, docstrings, comments, CLI flags and user-facing messages. Comments and identifiers are ASCII-only (`anio`, `codigo`, no accents); accents appear only in data strings that must match the source files (`"Año"`, `"Área"`, `"Público"`).
- Standard library plus `python-calamine` only. `descargar.py` intentionally uses only the standard library.
- `_verificacion/` is a gitignored scratch directory from the README's clean-room check; never edit or import it.
