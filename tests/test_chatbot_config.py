"""Tests for chatbot.config — verify defaults and structure."""

from chatbot.config import (
    GROQ_API_URL,
    GROQ_MODEL,
    MAX_HISTORY,
    SYSTEM_PROMPT,
)


class TestConfig:
    def test_groq_model_default(self):
        assert "llama" in GROQ_MODEL.lower() or "mixtral" in GROQ_MODEL.lower()

    def test_groq_api_url(self):
        assert GROQ_API_URL.startswith("https://")
        assert "groq.com" in GROQ_API_URL

    def test_system_prompt_not_empty(self):
        assert len(SYSTEM_PROMPT) > 20

    def test_system_prompt_russian(self):
        assert "русском" in SYSTEM_PROMPT.lower() or "ассистент" in SYSTEM_PROMPT.lower()

    def test_max_history_positive(self):
        assert MAX_HISTORY > 0
