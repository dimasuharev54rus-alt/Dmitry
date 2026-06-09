"""Tests for the string_utils module."""

import pytest

from src.string_utils import (
    camel_to_snake,
    capitalize_words,
    char_frequency,
    count_words,
    is_anagram,
    is_palindrome,
    remove_duplicates,
    reverse,
    snake_to_camel,
    truncate,
)


class TestReverse:
    def test_simple(self):
        assert reverse("hello") == "olleh"

    def test_empty(self):
        assert reverse("") == ""

    def test_single_char(self):
        assert reverse("x") == "x"

    def test_palindrome(self):
        assert reverse("racecar") == "racecar"


class TestIsPalindrome:
    def test_true(self):
        assert is_palindrome("racecar") is True

    def test_false(self):
        assert is_palindrome("hello") is False

    def test_case_insensitive(self):
        assert is_palindrome("RaceCar") is True

    def test_ignores_spaces(self):
        assert is_palindrome("nurses run") is True

    def test_empty(self):
        assert is_palindrome("") is True


class TestCountWords:
    def test_normal(self):
        assert count_words("hello world foo") == 3

    def test_empty(self):
        assert count_words("") == 0

    def test_whitespace_only(self):
        assert count_words("   ") == 0

    def test_single_word(self):
        assert count_words("hello") == 1


class TestCapitalizeWords:
    def test_normal(self):
        assert capitalize_words("hello world") == "Hello World"

    def test_already_capitalized(self):
        assert capitalize_words("Hello World") == "Hello World"

    def test_single_word(self):
        assert capitalize_words("python") == "Python"


class TestTruncate:
    def test_no_truncation_needed(self):
        assert truncate("hi", 10) == "hi"

    def test_truncated_with_suffix(self):
        assert truncate("hello world", 8) == "hello..."

    def test_max_length_less_than_suffix(self):
        assert truncate("hello world", 2) == "he"

    def test_negative_max_length(self):
        with pytest.raises(ValueError):
            truncate("hello", -1)

    def test_custom_suffix(self):
        assert truncate("abcdefghij", 7, suffix="~") == "abcdef~"


class TestCharFrequency:
    def test_simple(self):
        result = char_frequency("aab")
        assert result == {"a": 2, "b": 1}

    def test_empty(self):
        assert char_frequency("") == {}


class TestIsAnagram:
    def test_true(self):
        assert is_anagram("listen", "silent") is True

    def test_false(self):
        assert is_anagram("hello", "world") is False

    def test_case_insensitive(self):
        assert is_anagram("Tea", "Eat") is True

    def test_ignores_spaces(self):
        assert is_anagram("a gentleman", "elegant man") is True


class TestSnakeToCamel:
    def test_basic(self):
        assert snake_to_camel("hello_world") == "helloWorld"

    def test_single_word(self):
        assert snake_to_camel("hello") == "hello"

    def test_multiple_parts(self):
        assert snake_to_camel("one_two_three") == "oneTwoThree"


class TestCamelToSnake:
    def test_basic(self):
        assert camel_to_snake("helloWorld") == "hello_world"

    def test_single_word(self):
        assert camel_to_snake("hello") == "hello"

    def test_starts_with_upper(self):
        assert camel_to_snake("HelloWorld") == "hello_world"


class TestRemoveDuplicates:
    def test_basic(self):
        assert remove_duplicates("aabbcc") == "abc"

    def test_no_duplicates(self):
        assert remove_duplicates("abc") == "abc"

    def test_empty(self):
        assert remove_duplicates("") == ""

    def test_preserves_order(self):
        assert remove_duplicates("banana") == "ban"
