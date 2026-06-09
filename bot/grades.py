"""Grade persistence — read/write exam grades as JSON."""

from __future__ import annotations

import json
import os

from bot.config import GRADES_FILE


def load_grades(path: str | None = None) -> dict[str, int]:
    """Load grades from disk. Returns an empty dict when the file is missing."""
    p = path or GRADES_FILE
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_grade(exam_name: str, grade: int, path: str | None = None) -> None:
    """Persist a single exam grade (merges with existing data)."""
    p = path or GRADES_FILE
    grades = load_grades(p)
    grades[exam_name] = grade
    with open(p, "w", encoding="utf-8") as f:
        json.dump(grades, f, ensure_ascii=False, indent=2)
