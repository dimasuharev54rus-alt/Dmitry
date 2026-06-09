"""Bot configuration — loads settings from environment variables."""

from __future__ import annotations

import os
from datetime import date, datetime

import pytz

NSK_TZ = pytz.timezone("Asia/Novosibirsk")

BOT_TOKEN: str = os.environ.get("BOT_TOKEN", "")
CHAT_ID: int = int(os.environ.get("CHAT_ID", "0"))

# Дата и время переезда
MOVING_DATE = datetime(2026, 8, 31, 16, 0, tzinfo=NSK_TZ)

# Экзамены ОГЭ
EXAMS: list[dict] = [
    {"date": date(2026, 6, 2), "name": "Математика", "time": "10:00"},
    {"date": date(2026, 6, 6), "name": "Информатика", "time": "10:00"},
    {"date": date(2026, 6, 9), "name": "Русский язык", "time": "10:00"},
    {"date": date(2026, 6, 16), "name": "Обществознание", "time": "10:00"},
]

GRADES_FILE: str = os.environ.get("GRADES_FILE", "grades.json")
