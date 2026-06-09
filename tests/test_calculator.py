"""Tests for the calculator module."""

import pytest

from src.calculator import (
    add,
    divide,
    factorial,
    gcd,
    lcm,
    multiply,
    power,
    sqrt,
    subtract,
)


class TestAdd:
    def test_positive(self):
        assert add(2, 3) == 5

    def test_negative(self):
        assert add(-1, -2) == -3

    def test_zero(self):
        assert add(0, 0) == 0


class TestSubtract:
    def test_basic(self):
        assert subtract(10, 4) == 6

    def test_negative_result(self):
        assert subtract(3, 7) == -4


class TestMultiply:
    def test_basic(self):
        assert multiply(3, 7) == 21

    def test_by_zero(self):
        assert multiply(5, 0) == 0


class TestDivide:
    def test_basic(self):
        assert divide(10, 2) == 5.0

    def test_fraction(self):
        assert divide(1, 3) == pytest.approx(0.3333, rel=1e-3)

    def test_divide_by_zero(self):
        with pytest.raises(ZeroDivisionError):
            divide(1, 0)


class TestPower:
    def test_square(self):
        assert power(3, 2) == 9

    def test_zero_exponent(self):
        assert power(5, 0) == 1

    def test_negative_exponent(self):
        assert power(2, -1) == 0.5


class TestSqrt:
    def test_perfect_square(self):
        assert sqrt(16) == 4.0

    def test_zero(self):
        assert sqrt(0) == 0.0

    def test_negative(self):
        with pytest.raises(ValueError):
            sqrt(-1)


class TestFactorial:
    def test_zero(self):
        assert factorial(0) == 1

    def test_five(self):
        assert factorial(5) == 120

    def test_negative(self):
        with pytest.raises(ValueError):
            factorial(-1)

    def test_non_integer(self):
        with pytest.raises(TypeError):
            factorial(3.5)


class TestGcd:
    def test_basic(self):
        assert gcd(12, 8) == 4

    def test_coprime(self):
        assert gcd(7, 13) == 1


class TestLcm:
    def test_basic(self):
        assert lcm(4, 6) == 12

    def test_with_zero(self):
        assert lcm(0, 5) == 0
