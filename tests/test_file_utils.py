"""Tests for the file_utils module."""


import pytest

from src.file_utils import (
    ensure_dir,
    file_extension,
    file_size,
    list_files,
    read_csv,
    read_json,
    read_text,
    write_csv,
    write_json,
    write_text,
)


class TestReadWriteText:
    def test_round_trip(self, tmp_path):
        p = tmp_path / "test.txt"
        write_text(p, "hello world")
        assert read_text(p) == "hello world"

    def test_creates_parent_dirs(self, tmp_path):
        p = tmp_path / "sub" / "dir" / "test.txt"
        write_text(p, "nested")
        assert read_text(p) == "nested"

    def test_unicode(self, tmp_path):
        p = tmp_path / "uni.txt"
        write_text(p, "Привет мир 🌍")
        assert read_text(p) == "Привет мир 🌍"


class TestReadWriteJson:
    def test_dict_round_trip(self, tmp_path):
        p = tmp_path / "data.json"
        data = {"name": "Dmitry", "age": 30}
        write_json(p, data)
        assert read_json(p) == data

    def test_list_round_trip(self, tmp_path):
        p = tmp_path / "list.json"
        data = [1, 2, 3]
        write_json(p, data)
        assert read_json(p) == data

    def test_custom_indent(self, tmp_path):
        p = tmp_path / "indented.json"
        write_json(p, {"a": 1}, indent=4)
        content = read_text(p)
        assert '    "a": 1' in content


class TestReadWriteCsv:
    def test_round_trip(self, tmp_path):
        p = tmp_path / "data.csv"
        rows = [{"name": "Alice", "age": "30"}, {"name": "Bob", "age": "25"}]
        write_csv(p, rows)
        result = read_csv(p)
        assert result == rows

    def test_custom_fieldnames(self, tmp_path):
        p = tmp_path / "custom.csv"
        rows = [{"x": "1", "y": "2"}]
        write_csv(p, rows, fieldnames=["y", "x"])
        content = read_text(p)
        assert content.startswith("y,x")

    def test_empty_rows(self, tmp_path):
        p = tmp_path / "empty.csv"
        write_csv(p, [])
        assert not p.exists()  # write_csv returns early for empty rows


class TestListFiles:
    def test_basic(self, tmp_path):
        (tmp_path / "a.txt").touch()
        (tmp_path / "b.txt").touch()
        (tmp_path / "c.py").touch()
        result = list_files(tmp_path, "*.txt")
        assert len(result) == 2

    def test_no_match(self, tmp_path):
        (tmp_path / "a.txt").touch()
        result = list_files(tmp_path, "*.py")
        assert result == []

    def test_all_files(self, tmp_path):
        (tmp_path / "a.txt").touch()
        (tmp_path / "b.py").touch()
        result = list_files(tmp_path)
        assert len(result) == 2


class TestFileSize:
    def test_basic(self, tmp_path):
        p = tmp_path / "test.txt"
        p.write_text("hello")
        assert file_size(p) == 5

    def test_not_found(self):
        with pytest.raises(FileNotFoundError):
            file_size("/nonexistent/path/file.txt")


class TestEnsureDir:
    def test_creates_dir(self, tmp_path):
        target = tmp_path / "a" / "b" / "c"
        result = ensure_dir(target)
        assert result.is_dir()

    def test_existing_dir(self, tmp_path):
        result = ensure_dir(tmp_path)
        assert result.is_dir()


class TestFileExtension:
    def test_python(self):
        assert file_extension("script.py") == ".py"

    def test_no_extension(self):
        assert file_extension("Makefile") == ""

    def test_multiple_dots(self):
        assert file_extension("archive.tar.gz") == ".gz"
