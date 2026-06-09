"""Conversation history manager — stores per-user message history in memory."""

from __future__ import annotations

from chatbot.config import MAX_HISTORY


class ConversationHistory:
    """In-memory conversation history, keyed by user ID."""

    def __init__(self, max_messages: int | None = None) -> None:
        self._history: dict[int, list[dict[str, str]]] = {}
        self._max = max_messages or MAX_HISTORY

    def add_user_message(self, user_id: int, text: str) -> None:
        """Record a user message."""
        self._ensure_user(user_id)
        self._history[user_id].append({"role": "user", "content": text})
        self._trim(user_id)

    def add_assistant_message(self, user_id: int, text: str) -> None:
        """Record an assistant reply."""
        self._ensure_user(user_id)
        self._history[user_id].append({"role": "assistant", "content": text})
        self._trim(user_id)

    def get_messages(self, user_id: int) -> list[dict[str, str]]:
        """Return the full message history for *user_id*."""
        return list(self._history.get(user_id, []))

    def clear(self, user_id: int) -> None:
        """Clear conversation history for *user_id*."""
        self._history.pop(user_id, None)

    def _ensure_user(self, user_id: int) -> None:
        if user_id not in self._history:
            self._history[user_id] = []

    def _trim(self, user_id: int) -> None:
        """Keep only the last *max_messages* messages."""
        msgs = self._history[user_id]
        if len(msgs) > self._max:
            self._history[user_id] = msgs[-self._max :]
