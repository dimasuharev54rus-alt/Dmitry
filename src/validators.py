"""Input validation helpers."""

from __future__ import annotations

import re


def is_email(value: str) -> bool:
    """Return ``True`` if *value* looks like a valid e-mail address."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, value))


def is_url(value: str) -> bool:
    """Return ``True`` if *value* looks like a valid HTTP(S) URL."""
    pattern = r"^https?://[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})(?:/[^\s]*)?$"
    return bool(re.match(pattern, value))


def is_phone(value: str) -> bool:
    """Return ``True`` if *value* matches a common phone number format."""
    cleaned = re.sub(r"[\s\-().]+", "", value)
    return bool(re.match(r"^\+?\d{7,15}$", cleaned))


def is_strong_password(value: str) -> bool:
    """Check whether *value* meets minimum password-strength criteria.

    Criteria: ≥ 8 chars, at least one uppercase, one lowercase, one digit,
    and one special character.
    """
    if len(value) < 8:
        return False
    if not re.search(r"[A-Z]", value):
        return False
    if not re.search(r"[a-z]", value):
        return False
    if not re.search(r"\d", value):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
        return False
    return True


def is_ipv4(value: str) -> bool:
    """Return ``True`` if *value* is a valid IPv4 address."""
    parts = value.split(".")
    if len(parts) != 4:
        return False
    for part in parts:
        if not part.isdigit():
            return False
        num = int(part)
        if num < 0 or num > 255:
            return False
        if part != str(num):  # reject leading zeros
            return False
    return True


def is_hex_color(value: str) -> bool:
    """Return ``True`` if *value* is a valid hex colour code (#RGB or #RRGGBB)."""
    return bool(re.match(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", value))


def is_uuid(value: str) -> bool:
    """Return ``True`` if *value* looks like a UUID (v1–v5, case-insensitive)."""
    pattern = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    return bool(re.match(pattern, value))


def is_credit_card(value: str) -> bool:
    """Return ``True`` if *value* passes the Luhn check (basic credit-card validation)."""
    digits = re.sub(r"[\s-]", "", value)
    if not digits.isdigit() or len(digits) < 13 or len(digits) > 19:
        return False
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0
