"""Tests for bot.messages — pure message-building functions."""

from datetime import datetime

from bot.config import NSK_TZ
from bot.messages import (
    _average_grade_line,
    build_daily_message,
    build_grades_message,
    build_help_message,
    random_quote,
)


class TestBuildDailyMessage:
    def test_defaults(self):
        msg = build_daily_message()
        assert "Доброе утро" in msg

    def test_contains_date(self):
        now = datetime(2026, 5, 20, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        assert "20.05.2026" in msg

    def test_moving_countdown_future(self):
        now = datetime(2026, 5, 1, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        assert "До переезда" in msg
        assert "дн." in msg

    def test_moving_day(self):
        now = datetime(2026, 8, 31, 10, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        assert "СЕГОДНЯ ПЕРЕЕЗД" in msg

    def test_moving_past(self):
        now = datetime(2026, 9, 5, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        assert "Переезд уже состоялся" in msg

    def test_exam_today(self):
        now = datetime(2026, 6, 2, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        assert "СЕГОДНЯ" in msg
        assert "Математика" in msg
        assert "удачи" in msg

    def test_exam_future(self):
        now = datetime(2026, 5, 20, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        assert "через" in msg
        assert "дн." in msg

    def test_exam_passed_no_grade(self):
        now = datetime(2026, 6, 5, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        assert "Прошёл (оценка не указана)" in msg

    def test_exam_with_grade(self):
        now = datetime(2026, 6, 5, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={"Математика": 5})
        assert "Сдан — оценка: **5**" in msg

    def test_contains_quote(self):
        now = datetime(2026, 5, 20, 8, 0, tzinfo=NSK_TZ)
        msg = build_daily_message(now=now, grades={})
        # Message should end with a motivational quote (contains an emoji)
        assert "«" in msg

    def test_average_grade_shown(self):
        now = datetime(2026, 6, 20, 8, 0, tzinfo=NSK_TZ)
        grades = {"Математика": 5, "Информатика": 4}
        msg = build_daily_message(now=now, grades=grades)
        assert "Средний балл" in msg
        assert "4.5" in msg


class TestBuildGradesMessage:
    def test_empty(self):
        assert build_grades_message({}) == "Оценок пока нет."

    def test_with_grades(self):
        grades = {"Математика": 5, "Информатика": 4}
        msg = build_grades_message(grades)
        assert "Математика: 5" in msg
        assert "Информатика: 4" in msg
        assert "Русский язык: —" in msg
        assert "Средний балл" in msg

    def test_all_exams(self):
        grades = {
            "Математика": 5,
            "Информатика": 4,
            "Русский язык": 5,
            "Обществознание": 4,
        }
        msg = build_grades_message(grades)
        assert "4.5" in msg
        assert "4/4" in msg


class TestBuildHelpMessage:
    def test_contains_commands(self):
        msg = build_help_message()
        assert "/start" in msg
        assert "/status" in msg
        assert "/grades" in msg
        assert "/quote" in msg
        assert "/help" in msg


class TestRandomQuote:
    def test_returns_string(self):
        q = random_quote()
        assert isinstance(q, str)
        assert len(q) > 10

    def test_contains_quote_mark(self):
        q = random_quote()
        assert "«" in q


class TestAverageGradeLine:
    def test_empty(self):
        assert _average_grade_line({}) == ""

    def test_single(self):
        line = _average_grade_line({"Математика": 5})
        assert "5.0" in line
        assert "1/4" in line

    def test_multiple(self):
        line = _average_grade_line({"Математика": 5, "Информатика": 3})
        assert "4.0" in line
        assert "2/4" in line
