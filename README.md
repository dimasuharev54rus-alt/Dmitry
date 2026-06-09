# Dmitry

A starter Python utility library with modules for arithmetic, string manipulation,
data processing, input validation, and file-system helpers.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Running tests

```bash
pytest
```

## Linting

```bash
ruff check src/ tests/
```

## Project structure

```
src/
  calculator.py      – arithmetic & math helpers
  string_utils.py    – string manipulation utilities
  data_processor.py  – data transformation functions
  validators.py      – input validation helpers
  file_utils.py      – file-system utilities
tests/
  test_calculator.py – unit tests for calculator
```
