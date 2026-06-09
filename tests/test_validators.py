"""Tests for the validators module."""

from src.validators import (
    is_credit_card,
    is_email,
    is_hex_color,
    is_ipv4,
    is_phone,
    is_strong_password,
    is_url,
    is_uuid,
)


class TestIsEmail:
    def test_valid(self):
        assert is_email("user@example.com") is True

    def test_with_dots(self):
        assert is_email("first.last@example.org") is True

    def test_missing_at(self):
        assert is_email("userexample.com") is False

    def test_missing_domain(self):
        assert is_email("user@") is False

    def test_empty(self):
        assert is_email("") is False


class TestIsUrl:
    def test_http(self):
        assert is_url("http://example.com") is True

    def test_https(self):
        assert is_url("https://example.com") is True

    def test_with_path(self):
        assert is_url("https://example.com/path/to/page") is True

    def test_ftp(self):
        assert is_url("ftp://example.com") is False

    def test_missing_scheme(self):
        assert is_url("example.com") is False


class TestIsPhone:
    def test_international(self):
        assert is_phone("+1234567890") is True

    def test_with_dashes(self):
        assert is_phone("123-456-7890") is True

    def test_with_spaces(self):
        assert is_phone("123 456 7890") is True

    def test_with_parens(self):
        assert is_phone("(123) 456-7890") is True

    def test_too_short(self):
        assert is_phone("12345") is False

    def test_letters(self):
        assert is_phone("abc-def-ghij") is False


class TestIsStrongPassword:
    def test_strong(self):
        assert is_strong_password("Str0ng!Pass") is True

    def test_too_short(self):
        assert is_strong_password("S1!a") is False

    def test_no_uppercase(self):
        assert is_strong_password("str0ng!pass") is False

    def test_no_lowercase(self):
        assert is_strong_password("STR0NG!PASS") is False

    def test_no_digit(self):
        assert is_strong_password("Strong!Pass") is False

    def test_no_special(self):
        assert is_strong_password("Str0ngPass1") is False


class TestIsIpv4:
    def test_valid(self):
        assert is_ipv4("192.168.1.1") is True

    def test_zeros(self):
        assert is_ipv4("0.0.0.0") is True

    def test_max(self):
        assert is_ipv4("255.255.255.255") is True

    def test_out_of_range(self):
        assert is_ipv4("256.0.0.1") is False

    def test_leading_zeros(self):
        assert is_ipv4("01.02.03.04") is False

    def test_too_few_octets(self):
        assert is_ipv4("192.168.1") is False

    def test_non_numeric(self):
        assert is_ipv4("a.b.c.d") is False


class TestIsHexColor:
    def test_six_digit(self):
        assert is_hex_color("#ff00aa") is True

    def test_three_digit(self):
        assert is_hex_color("#abc") is True

    def test_uppercase(self):
        assert is_hex_color("#FF00AA") is True

    def test_no_hash(self):
        assert is_hex_color("ff00aa") is False

    def test_wrong_length(self):
        assert is_hex_color("#abcd") is False


class TestIsUuid:
    def test_valid_v4(self):
        assert is_uuid("550e8400-e29b-41d4-a716-446655440000") is True

    def test_invalid(self):
        assert is_uuid("not-a-uuid") is False

    def test_wrong_version(self):
        assert is_uuid("550e8400-e29b-61d4-a716-446655440000") is False

    def test_uppercase(self):
        assert is_uuid("550E8400-E29B-41D4-A716-446655440000") is True


class TestIsCreditCard:
    def test_valid_visa(self):
        assert is_credit_card("4111111111111111") is True

    def test_valid_with_spaces(self):
        assert is_credit_card("4111 1111 1111 1111") is True

    def test_valid_with_dashes(self):
        assert is_credit_card("4111-1111-1111-1111") is True

    def test_invalid_luhn(self):
        assert is_credit_card("4111111111111112") is False

    def test_too_short(self):
        assert is_credit_card("411111") is False

    def test_non_numeric(self):
        assert is_credit_card("abcdefghijklm") is False

    def test_valid_mastercard(self):
        # 5500 0000 0000 0004 — Mastercard test number; exercises n > 9 Luhn branch
        assert is_credit_card("5500000000000004") is True
