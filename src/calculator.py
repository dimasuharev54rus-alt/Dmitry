"""Basic arithmetic and mathematical operations."""

from __future__ import annotations

import math


def add(a: float, b: float) -> float:
    """Return the sum of two numbers."""
    return a + b


def subtract(a: float, b: float) -> float:
    """Return the difference of two numbers."""
    return a - b


def multiply(a: float, b: float) -> float:
    """Return the product of two numbers."""
    return a * b


def divide(a: float, b: float) -> float:
    """Return the quotient of two numbers.

    Raises:
        ZeroDivisionError: If *b* is zero.
    """
    if b == 0:
        raise ZeroDivisionError("Cannot divide by zero")
    return a / b


def power(base: float, exponent: float) -> float:
    """Raise *base* to *exponent*."""
    return base ** exponent


def sqrt(value: float) -> float:
    """Return the square root of *value*.

    Raises:
        ValueError: If *value* is negative.
    """
    if value < 0:
        raise ValueError("Cannot compute square root of a negative number")
    return math.sqrt(value)


def factorial(n: int) -> int:
    """Return *n*! (n factorial).

    Raises:
        ValueError: If *n* is negative.
        TypeError: If *n* is not an integer.
    """
    if not isinstance(n, int):
        raise TypeError("n must be an integer")
    if n < 0:
        raise ValueError("n must be non-negative")
    return math.factorial(n)


def gcd(a: int, b: int) -> int:
    """Return the greatest common divisor of *a* and *b*."""
    return math.gcd(a, b)


def lcm(a: int, b: int) -> int:
    """Return the least common multiple of *a* and *b*."""
    return abs(a * b) // math.gcd(a, b) if a and b else 0
