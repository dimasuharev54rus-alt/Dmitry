"""Message builders — pure functions that return formatted strings."""

from __future__ import annotations

import random
from datetime import date, datetime

from bot.config import EXAMS, MOVING_DATE, NSK_TZ

MOTIVATIONAL_QUOTES = [
    "💡 «Образование — самое мощное оружие для изменения мира.» — Нельсон Мандела",
    "🔥 «Секрет успеха — начать.» — Марк Твен",
    "🚀 «Будущее принадлежит тем, кто верит в красоту своей мечты.» — Элеонора Рузвельт",
    "⭐ «Трудности — это не препятствия, а ступеньки.»",
    "📖 «Учись так, будто тебе предстоит жить вечно.» — Махатма Ганди",
    "🏆 «Победа — это не главное. Главное — это стремление к победе.»",
    "💪 «Не бойся идти медленно, бойся стоять на месте.»",
    "🎯 «Единственный способ делать великие дела — любить то, что делаешь.» — Стив Джобс",
]


def random_quote() -> str:
    """Return a random motivational quote."""
    return random.choice(MOTIVATIONAL_QUOTES)


def build_daily_message(
    now: datetime | None = None,
    grades: dict[str, int] | None = None,
) -> str:
    """Build the daily status message.

    Parameters are injectable for testability; defaults use live clock and
    empty grades.
    """
    if now is None:
        now = datetime.now(NSK_TZ)
    if grades is None:
        grades = {}

    today = now.date()

    # --- countdown to move ---
    delta = MOVING_DATE - now
    days_left = delta.days
    hours_left = delta.seconds // 3600

    if days_left > 0:
        moving_line = f"🚚 До переезда в Новосибирск: **{days_left} дн. {hours_left} ч.**"
    elif days_left == 0:
        moving_line = (
            f"🚚 СЕГОДНЯ ПЕРЕЕЗД! Через {hours_left} ч. — удачи в дороге! 🎉"
        )
    else:
        moving_line = "✅ Переезд уже состоялся! Добро пожаловать в Новосибирск! 🏙️"

    # --- exams ---
    exam_lines = ["\n📚 **Экзамены ОГЭ:**"]
    today_exam = None

    for i, exam in enumerate(EXAMS, 1):
        exam_date: date = exam["date"]
        name: str = exam["name"]
        grade = grades.get(name)

        if today == exam_date:
            today_exam = exam
            status = f"📍 СЕГОДНЯ в {exam['time']}!"
        elif grade is not None:
            status = f"✅ Сдан — оценка: **{grade}**"
        elif exam_date < today:
            status = "⏳ Прошёл (оценка не указана)"
        else:
            days_to = (exam_date - today).days
            status = f"через {days_to} дн. ({exam_date.strftime('%d.%m')})"

        exam_lines.append(f"  {i}. {name} — {status}")

    exams_block = "\n".join(exam_lines)

    # --- average grade ---
    avg_line = _average_grade_line(grades)

    # --- assemble ---
    lines = [
        f"☀️ Доброе утро! {today.strftime('%d.%m.%Y')}",
        "",
        moving_line,
        exams_block,
    ]

    if avg_line:
        lines.append(avg_line)

    if today_exam:
        lines.append(
            f"\n🔔 Сегодня **{today_exam['name']}** в {today_exam['time']} — удачи! 💪"
        )
        lines.append("После экзамена напиши боту оценку цифрой (например: 4)")

    lines.append(f"\n{random_quote()}")

    return "\n".join(lines)


def build_grades_message(grades: dict[str, int]) -> str:
    """Format the grades summary."""
    if not grades:
        return "Оценок пока нет."

    lines = ["📊 **Твои оценки ОГЭ:**"]
    for exam in EXAMS:
        name = exam["name"]
        g = grades.get(name, "—")
        lines.append(f"  • {name}: {g}")

    avg_line = _average_grade_line(grades)
    if avg_line:
        lines.append(avg_line)

    return "\n".join(lines)


def build_help_message() -> str:
    """Return the help / command list text."""
    return (
        "🤖 **Доступные команды:**\n\n"
        "/start — приветствие\n"
        "/status — текущий отчёт\n"
        "/grades — все оценки\n"
        "/quote — мотивационная цитата\n"
        "/help — список команд\n\n"
        "Чтобы записать оценку — просто отправь цифру (2, 3, 4 или 5) после экзамена."
    )


def _average_grade_line(grades: dict[str, int]) -> str:
    """Return a formatted average-grade line, or empty string if no grades."""
    if not grades:
        return ""
    values = list(grades.values())
    avg = sum(values) / len(values)
    return f"\n📈 Средний балл: **{avg:.1f}** ({len(values)}/{len(EXAMS)} экзаменов)"
