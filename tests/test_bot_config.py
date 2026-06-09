"""Tests for bot.config — verify defaults and structure."""

from datetime import date, datetime

from bot.config import EXAMS, MOVING_DATE, NSK_TZ


class TestConfig:
    def test_moving_date_has_timezone(self):
        assert MOVING_DATE.tzinfo is not None

    def test_exams_not_empty(self):
        assert len(EXAMS) > 0

    def test_exam_structure(self):
        for exam in EXAMS:
            assert "date" in exam
            assert "name" in exam
            assert "time" in exam
            assert isinstance(exam["date"], date)
            assert isinstance(exam["name"], str)

    def test_exams_sorted_by_date(self):
        dates = [e["date"] for e in EXAMS]
        assert dates == sorted(dates)

    def test_nsk_timezone(self):
        dt = datetime(2026, 6, 1, 12, 0, tzinfo=NSK_TZ)
        assert "Novosibirsk" in str(dt.tzinfo)
