"""Data processing and transformation utilities."""

from __future__ import annotations

from typing import Any, Callable, Sequence


def flatten(nested: list) -> list:
    """Recursively flatten a nested list structure."""
    result: list = []
    for item in nested:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


def chunk(items: Sequence, size: int) -> list[list]:
    """Split *items* into chunks of *size*.

    Raises:
        ValueError: If *size* is not positive.
    """
    if size <= 0:
        raise ValueError("Chunk size must be positive")
    return [list(items[i : i + size]) for i in range(0, len(items), size)]


def unique(items: Sequence) -> list:
    """Return unique elements from *items*, preserving order."""
    seen: set = set()
    result: list = []
    for item in items:
        key = item if isinstance(item, (int, float, str, bool, type(None))) else id(item)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def group_by(items: Sequence, key_fn: Callable) -> dict:
    """Group elements of *items* by the value returned by *key_fn*."""
    groups: dict = {}
    for item in items:
        key = key_fn(item)
        groups.setdefault(key, []).append(item)
    return groups


def transform(items: Sequence, fn: Callable) -> list:
    """Apply *fn* to each element and return the results."""
    return [fn(item) for item in items]


def filter_by(items: Sequence, predicate: Callable) -> list:
    """Return elements for which *predicate* returns ``True``."""
    return [item for item in items if predicate(item)]


def reduce_values(items: Sequence[float]) -> dict[str, float]:
    """Compute basic aggregate statistics for a numeric sequence.

    Returns a dict with keys ``sum``, ``min``, ``max``, ``mean``.

    Raises:
        ValueError: If *items* is empty.
    """
    if not items:
        raise ValueError("Cannot reduce an empty sequence")
    total = sum(items)
    return {
        "sum": total,
        "min": min(items),
        "max": max(items),
        "mean": total / len(items),
    }


def merge_dicts(*dicts: dict) -> dict:
    """Merge multiple dicts left-to-right (later values win)."""
    result: dict = {}
    for d in dicts:
        result.update(d)
    return result


def invert_dict(d: dict) -> dict:
    """Swap keys and values.  Duplicate values cause later keys to win."""
    return {v: k for k, v in d.items()}


def deep_get(data: dict, path: str, default: Any = None) -> Any:
    """Retrieve a nested value using a dot-separated *path*.

    >>> deep_get({"a": {"b": 1}}, "a.b")
    1
    """
    keys = path.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default
    return current
