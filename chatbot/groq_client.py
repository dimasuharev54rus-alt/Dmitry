"""Groq API client — sends messages and returns AI responses."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from chatbot.config import GROQ_API_KEY, GROQ_API_URL, GROQ_MODEL, SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def ask_groq(
    messages: list[dict[str, str]],
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    """Send a conversation to Groq and return the assistant's reply.

    Parameters are injectable for testability.

    Raises:
        RuntimeError: If the API request fails.
    """
    key = api_key or GROQ_API_KEY
    mdl = model or GROQ_MODEL

    if not key:
        return "⚠️ GROQ_API_KEY не установлен. Задай переменную окружения."

    # Prepend system prompt
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    payload = json.dumps({
        "model": mdl,
        "messages": full_messages,
        "max_tokens": 1024,
        "temperature": 0.7,
    }).encode("utf-8")

    req = urllib.request.Request(
        GROQ_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("Groq API error %d: %s", e.code, body)
        if e.code == 429:
            return "⏳ Слишком много запросов. Подожди немного и попробуй снова."
        if e.code == 401:
            return "🔑 Неверный API ключ Groq. Проверь GROQ_API_KEY."
        return f"❌ Ошибка API (код {e.code}). Попробуй позже."
    except Exception as e:
        logger.error("Groq request failed: %s", e)
        return "❌ Не удалось связаться с AI. Попробуй позже."
