"""Telegram command and message handlers for the AI chat bot."""

from __future__ import annotations

import logging

from telegram import Update
from telegram.ext import ContextTypes

from chatbot.groq_client import ask_groq
from chatbot.history import ConversationHistory

logger = logging.getLogger(__name__)

# Shared conversation history instance
history = ConversationHistory()


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    await update.message.reply_text(
        f"Привет, {user.first_name}! 👋\n\n"
        "Я Дмитрий-бот — AI-ассистент на базе Groq.\n"
        "Просто напиши мне что угодно, и я отвечу!\n\n"
        "Команды:\n"
        "/help — список команд\n"
        "/clear — очистить историю разговора\n"
        "/model — какая модель используется"
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "🤖 **Дмитрий-бот — AI-ассистент**\n\n"
        "Просто напиши сообщение — я отвечу!\n\n"
        "**Команды:**\n"
        "/start — приветствие\n"
        "/help — эта справка\n"
        "/clear — забыть историю разговора\n"
        "/model — информация о модели\n\n"
        "💡 Я помню контекст разговора, так что можешь "
        "задавать уточняющие вопросы!",
        parse_mode="Markdown",
    )


async def cmd_clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    history.clear(user_id)
    await update.message.reply_text("🧹 История разговора очищена! Начинаем с чистого листа.")


async def cmd_model(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    from chatbot.config import GROQ_MODEL

    await update.message.reply_text(
        f"🧠 Текущая модель: **{GROQ_MODEL}**\n"
        "⚡ Провайдер: Groq (быстрый inference)\n"
        "🌐 Поддержка русского языка: да",
        parse_mode="Markdown",
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle a plain-text message — send it to Groq and reply."""
    user_id = update.effective_user.id
    user_text = update.message.text.strip()

    if not user_text:
        return

    # Show "typing" indicator while waiting for AI
    await update.message.chat.send_action("typing")

    # Add user message to history
    history.add_user_message(user_id, user_text)

    # Get AI response
    messages = history.get_messages(user_id)
    reply = ask_groq(messages)

    # Save assistant reply to history
    history.add_assistant_message(user_id, reply)

    # Send reply (split if too long for Telegram's 4096 char limit)
    if len(reply) <= 4096:
        await update.message.reply_text(reply)
    else:
        for i in range(0, len(reply), 4096):
            await update.message.reply_text(reply[i : i + 4096])

    logger.info("User %d: %s -> %d chars reply", user_id, user_text[:50], len(reply))
