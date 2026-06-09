"""Tests for chatbot.groq_client — Groq API client."""

import json
from unittest.mock import MagicMock, patch

from chatbot.groq_client import ask_groq


class TestAskGroq:
    def test_missing_api_key(self):
        result = ask_groq([{"role": "user", "content": "hi"}], api_key="")
        assert "GROQ_API_KEY" in result

    def test_successful_response(self):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "choices": [{"message": {"content": "Привет! Чем могу помочь?"}}]
        }).encode("utf-8")
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("chatbot.groq_client.urllib.request.urlopen", return_value=mock_response):
            result = ask_groq(
                [{"role": "user", "content": "привет"}],
                api_key="test-key",
            )
        assert result == "Привет! Чем могу помочь?"

    def test_rate_limit_error(self):
        import urllib.error

        error = urllib.error.HTTPError(
            url="", code=429, msg="", hdrs=None, fp=MagicMock(read=lambda: b"rate limit")
        )
        with patch("chatbot.groq_client.urllib.request.urlopen", side_effect=error):
            result = ask_groq(
                [{"role": "user", "content": "hi"}],
                api_key="test-key",
            )
        assert "Слишком много запросов" in result

    def test_auth_error(self):
        import urllib.error

        error = urllib.error.HTTPError(
            url="", code=401, msg="", hdrs=None, fp=MagicMock(read=lambda: b"unauthorized")
        )
        with patch("chatbot.groq_client.urllib.request.urlopen", side_effect=error):
            result = ask_groq(
                [{"role": "user", "content": "hi"}],
                api_key="bad-key",
            )
        assert "Неверный API ключ" in result

    def test_other_http_error(self):
        import urllib.error

        error = urllib.error.HTTPError(
            url="", code=500, msg="", hdrs=None, fp=MagicMock(read=lambda: b"server error")
        )
        with patch("chatbot.groq_client.urllib.request.urlopen", side_effect=error):
            result = ask_groq(
                [{"role": "user", "content": "hi"}],
                api_key="test-key",
            )
        assert "Ошибка API" in result
        assert "500" in result

    def test_network_error(self):
        with patch(
            "chatbot.groq_client.urllib.request.urlopen",
            side_effect=ConnectionError("no network"),
        ):
            result = ask_groq(
                [{"role": "user", "content": "hi"}],
                api_key="test-key",
            )
        assert "Не удалось связаться" in result
