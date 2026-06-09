"""File-system helper utilities."""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path


def read_text(path: str | Path) -> str:
    """Read and return the full text content of *path*."""
    return Path(path).read_text(encoding="utf-8")


def write_text(path: str | Path, content: str) -> None:
    """Write *content* to *path*, creating parent directories as needed."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def read_json(path: str | Path) -> dict | list:
    """Parse and return the JSON content of *path*."""
    text = read_text(path)
    return json.loads(text)


def write_json(path: str | Path, data: dict | list, indent: int = 2) -> None:
    """Serialize *data* as JSON and write to *path*."""
    content = json.dumps(data, indent=indent, ensure_ascii=False) + "\n"
    write_text(path, content)


def read_csv(path: str | Path) -> list[dict[str, str]]:
    """Read a CSV file and return a list of row dicts."""
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        return list(reader)


def write_csv(path: str | Path, rows: list[dict], fieldnames: list[str] | None = None) -> None:
    """Write *rows* (list of dicts) to a CSV file."""
    if not rows:
        return
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    fields = fieldnames or list(rows[0].keys())
    with open(p, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def list_files(directory: str | Path, pattern: str = "*") -> list[Path]:
    """Return a sorted list of files matching *pattern* in *directory*."""
    return sorted(Path(directory).glob(pattern))


def file_size(path: str | Path) -> int:
    """Return the size of *path* in bytes.

    Raises:
        FileNotFoundError: If *path* does not exist.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"No such file: {path}")
    return p.stat().st_size


def ensure_dir(path: str | Path) -> Path:
    """Create the directory (and parents) if it does not exist. Return the Path."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def file_extension(path: str | Path) -> str:
    """Return the file extension (including the dot), or empty string if none."""
    return Path(path).suffix
