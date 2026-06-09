"""Tests for bot.grades — grade persistence."""

import json

from bot.grades import load_grades, save_grade


class TestLoadGrades:
    def test_missing_file(self, tmp_path):
        path = str(tmp_path / "missing.json")
        assert load_grades(path) == {}

    def test_existing_file(self, tmp_path):
        path = tmp_path / "grades.json"
        path.write_text(json.dumps({"Математика": 5}), encoding="utf-8")
        result = load_grades(str(path))
        assert result == {"Математика": 5}


class TestSaveGrade:
    def test_creates_file(self, tmp_path):
        path = str(tmp_path / "grades.json")
        save_grade("Математика", 5, path)
        result = load_grades(path)
        assert result == {"Математика": 5}

    def test_merges_grades(self, tmp_path):
        path = str(tmp_path / "grades.json")
        save_grade("Математика", 5, path)
        save_grade("Информатика", 4, path)
        result = load_grades(path)
        assert result == {"Математика": 5, "Информатика": 4}

    def test_overwrites_grade(self, tmp_path):
        path = str(tmp_path / "grades.json")
        save_grade("Математика", 3, path)
        save_grade("Математика", 5, path)
        result = load_grades(path)
        assert result == {"Математика": 5}
