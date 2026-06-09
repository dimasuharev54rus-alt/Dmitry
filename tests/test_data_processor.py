"""Tests for the data_processor module."""

import pytest

from src.data_processor import (
    chunk,
    deep_get,
    filter_by,
    flatten,
    group_by,
    invert_dict,
    merge_dicts,
    reduce_values,
    transform,
    unique,
)


class TestFlatten:
    def test_already_flat(self):
        assert flatten([1, 2, 3]) == [1, 2, 3]

    def test_nested(self):
        assert flatten([1, [2, 3], [4, [5]]]) == [1, 2, 3, 4, 5]

    def test_empty(self):
        assert flatten([]) == []

    def test_deeply_nested(self):
        assert flatten([[[1]], [[2, [3]]]]) == [1, 2, 3]


class TestChunk:
    def test_even_split(self):
        assert chunk([1, 2, 3, 4], 2) == [[1, 2], [3, 4]]

    def test_uneven_split(self):
        assert chunk([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]

    def test_single_chunk(self):
        assert chunk([1, 2], 5) == [[1, 2]]

    def test_invalid_size(self):
        with pytest.raises(ValueError):
            chunk([1, 2], 0)

    def test_negative_size(self):
        with pytest.raises(ValueError):
            chunk([1], -1)


class TestUnique:
    def test_with_duplicates(self):
        assert unique([1, 2, 2, 3, 1]) == [1, 2, 3]

    def test_no_duplicates(self):
        assert unique([1, 2, 3]) == [1, 2, 3]

    def test_empty(self):
        assert unique([]) == []

    def test_strings(self):
        assert unique(["a", "b", "a"]) == ["a", "b"]


class TestGroupBy:
    def test_basic(self):
        items = [1, 2, 3, 4, 5, 6]
        result = group_by(items, lambda x: "even" if x % 2 == 0 else "odd")
        assert result == {"odd": [1, 3, 5], "even": [2, 4, 6]}

    def test_empty(self):
        assert group_by([], lambda x: x) == {}

    def test_single_group(self):
        assert group_by([2, 4, 6], lambda x: "even") == {"even": [2, 4, 6]}


class TestTransform:
    def test_double(self):
        assert transform([1, 2, 3], lambda x: x * 2) == [2, 4, 6]

    def test_empty(self):
        assert transform([], lambda x: x) == []

    def test_strings(self):
        assert transform(["a", "b"], str.upper) == ["A", "B"]


class TestFilterBy:
    def test_basic(self):
        assert filter_by([1, 2, 3, 4, 5], lambda x: x > 3) == [4, 5]

    def test_none_match(self):
        assert filter_by([1, 2, 3], lambda x: x > 10) == []

    def test_all_match(self):
        assert filter_by([1, 2, 3], lambda x: x > 0) == [1, 2, 3]


class TestReduceValues:
    def test_basic(self):
        result = reduce_values([1, 2, 3, 4])
        assert result == {"sum": 10, "min": 1, "max": 4, "mean": 2.5}

    def test_single(self):
        result = reduce_values([5])
        assert result == {"sum": 5, "min": 5, "max": 5, "mean": 5.0}

    def test_empty(self):
        with pytest.raises(ValueError):
            reduce_values([])


class TestMergeDicts:
    def test_basic(self):
        assert merge_dicts({"a": 1}, {"b": 2}) == {"a": 1, "b": 2}

    def test_overlapping_keys(self):
        assert merge_dicts({"a": 1}, {"a": 2}) == {"a": 2}

    def test_empty(self):
        assert merge_dicts() == {}

    def test_three_dicts(self):
        assert merge_dicts({"a": 1}, {"b": 2}, {"c": 3}) == {"a": 1, "b": 2, "c": 3}


class TestInvertDict:
    def test_basic(self):
        assert invert_dict({"a": 1, "b": 2}) == {1: "a", 2: "b"}

    def test_empty(self):
        assert invert_dict({}) == {}

    def test_duplicate_values(self):
        result = invert_dict({"a": 1, "b": 1})
        assert result == {1: "b"}  # later key wins


class TestDeepGet:
    def test_simple(self):
        assert deep_get({"a": 1}, "a") == 1

    def test_nested(self):
        data = {"a": {"b": {"c": 42}}}
        assert deep_get(data, "a.b.c") == 42

    def test_missing_key(self):
        assert deep_get({"a": 1}, "b") is None

    def test_missing_nested(self):
        assert deep_get({"a": {"b": 1}}, "a.c") is None

    def test_custom_default(self):
        assert deep_get({}, "x.y", default="N/A") == "N/A"

    def test_non_dict_intermediate(self):
        assert deep_get({"a": 5}, "a.b") is None
