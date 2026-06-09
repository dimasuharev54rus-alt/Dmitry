"""Telegram command and message handlers."""

from __future__ import annotations

import logging
from datetime import datetime

from telegram import Update
from telegram.ext import ContextTypes

from bot.config import CHAT_ID, EXAMS, NSK_TZ
from bot.grades import load_grades, save_grade
from bot.messages import (
    build_daily_message,
    build_grades_message,
    build_help_message,
    random_quote,
)

logger = logging.getLogger(__name__)


# ---------- scheduled job ----------

async def send_daily(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Job callback: send the daily report at 08:00 NSK."""
    grades = load_grades()
    msg = build_daily_message(grades=grades)
    await context.bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode="Markdown")


# ---------- commands ----------

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Привет! 👋 Я буду каждый день в 8:00 НСК присылать отчёт.\n"
        "После каждого экзамена просто напиши мне оценку цифрой (например: 4)\n\n"
        "Используй /help для списка команд."
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    grades = load_grades()
    msg = build_daily_message(grades=grades)
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_grades(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    grades = load_grades()
    msg = build_grades_message(grades)
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(build_help_message(), parse_mode="Markdown")


async def cmd_quote(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(random_quote())


# ---------- plain-text handler ----------

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle a plain-text message — expect an exam grade digit."""
    text = update.message.text.strip()

    if text not in ("2", "3", "4", "5"):
        await update.message.reply_text(
            "Напиши оценку цифрой (2, 3, 4 или 5) после экзамена.\n"
            "Или используй /help для списка команд."
        )
        return

    grade = int(text)
    grades = load_grades()
    today = datetime.now(NSK_TZ).date()

    # Find the most recent past exam without a grade
    target = None
    for exam in EXAMS:
        if exam["date"] <= today and exam["name"] not in grades:
            target = exam
            break

    if target is None:
        await update.message.reply_text(
            "Не нашёл экзамен, для которого записать оценку. "
            "Используй /grades чтобы посмотреть что уже есть."
        )
        return

    save_grade(target["name"], grade)
    await update.message.reply_text(
        f"✅ Записал! {target['name']} — оценка **{grade}** 🎉",
        parse_mode="Markdown",
    )
    logger.info("Saved grade %d for %s", grade, target["name"])
