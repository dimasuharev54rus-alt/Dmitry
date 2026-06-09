"""String manipulation and analysis utilities."""

from __future__ import annotations

import re
from collections import Counter


def reverse(text: str) -> str:
    """Return *text* reversed."""
    return text[::-1]


def is_palindrome(text: str) -> bool:
    """Check whether *text* is a palindrome (case-insensitive, ignoring spaces)."""
    cleaned = re.sub(r"\s+", "", text.lower())
    return cleaned == cleaned[::-1]


def count_words(text: str) -> int:
    """Return the number of whitespace-delimited words in *text*."""
    return len(text.split()) if text.strip() else 0


def capitalize_words(text: str) -> str:
    """Capitalize the first letter of every word."""
    return " ".join(word.capitalize() for word in text.split())


def truncate(text: str, max_length: int, suffix: str = "...") -> str:
    """Truncate *text* to *max_length* characters, appending *suffix* if truncated."""
    if max_length < 0:
        raise ValueError("max_length must be non-negative")
    if len(text) <= max_length:
        return text
    if max_length <= len(suffix):
        return text[:max_length]
    return text[: max_length - len(suffix)] + suffix


def char_frequency(text: str) -> dict[str, int]:
    """Return a mapping of each character to its frequency in *text*."""
    return dict(Counter(text))


def is_anagram(a: str, b: str) -> bool:
    """Check whether *a* and *b* are anagrams (case-insensitive, ignoring spaces)."""
    normalize = lambda s: sorted(re.sub(r"\s+", "", s.lower()))  # noqa: E731
    return normalize(a) == normalize(b)


def snake_to_camel(text: str) -> str:
    """Convert a snake_case string to camelCase."""
    parts = text.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


def camel_to_snake(text: str) -> str:
    """Convert a camelCase string to snake_case."""
    result = re.sub(r"([A-Z])", r"_\1", text)
    return result.lower().lstrip("_")


def remove_duplicates(text: str) -> str:
    """Remove duplicate characters from *text*, preserving first occurrence order."""
    seen: set[str] = set()
    result: list[str] = []
    for ch in text:
        if ch not in seen:
            seen.add(ch)
            result.append(ch)
    return "".join(result)
