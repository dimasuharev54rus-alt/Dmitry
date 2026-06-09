"""Chat bot configuration — loads settings from environment variables."""

from __future__ import annotations

import os

BOT_TOKEN: str = os.environ.get("CHATBOT_TOKEN", "")
GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")

# Groq model — Llama 3 is fast and speaks Russian well
GROQ_MODEL: str = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_API_URL: str = "https://api.groq.com/openai/v1/chat/completions"

# System prompt that defines the bot's personality
SYSTEM_PROMPT: str = (
    "Ты — дружелюбный и умный AI-ассистент в Telegram. "
    "Тебя зовут Дмитрий-бот. "
    "Ты отвечаешь на русском языке, помогаешь с домашкой, "
    "объясняешь сложные темы простыми словами, "
    "можешь шутить и поддерживать разговор. "
    "Отвечай кратко и по делу, но дружелюбно. "
    "Если не знаешь ответа — честно скажи об этом."
)

# Max conversation history per user (to manage context window)
MAX_HISTORY: int = 20
