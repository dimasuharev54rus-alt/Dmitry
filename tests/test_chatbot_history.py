"""Tests for chatbot.history — conversation history manager."""

from chatbot.history import ConversationHistory


class TestConversationHistory:
    def test_empty_history(self):
        h = ConversationHistory()
        assert h.get_messages(123) == []

    def test_add_user_message(self):
        h = ConversationHistory()
        h.add_user_message(1, "привет")
        msgs = h.get_messages(1)
        assert len(msgs) == 1
        assert msgs[0] == {"role": "user", "content": "привет"}

    def test_add_assistant_message(self):
        h = ConversationHistory()
        h.add_assistant_message(1, "Привет! Чем помочь?")
        msgs = h.get_messages(1)
        assert len(msgs) == 1
        assert msgs[0]["role"] == "assistant"

    def test_conversation_flow(self):
        h = ConversationHistory()
        h.add_user_message(1, "привет")
        h.add_assistant_message(1, "Привет!")
        h.add_user_message(1, "как дела?")
        h.add_assistant_message(1, "Отлично!")
        msgs = h.get_messages(1)
        assert len(msgs) == 4
        assert msgs[0]["role"] == "user"
        assert msgs[1]["role"] == "assistant"
        assert msgs[2]["role"] == "user"
        assert msgs[3]["role"] == "assistant"

    def test_separate_users(self):
        h = ConversationHistory()
        h.add_user_message(1, "от первого")
        h.add_user_message(2, "от второго")
        assert len(h.get_messages(1)) == 1
        assert len(h.get_messages(2)) == 1
        assert h.get_messages(1)[0]["content"] == "от первого"
        assert h.get_messages(2)[0]["content"] == "от второго"

    def test_clear(self):
        h = ConversationHistory()
        h.add_user_message(1, "привет")
        h.add_assistant_message(1, "Привет!")
        h.clear(1)
        assert h.get_messages(1) == []

    def test_clear_nonexistent_user(self):
        h = ConversationHistory()
        h.clear(999)  # should not raise

    def test_trim_history(self):
        h = ConversationHistory(max_messages=4)
        for i in range(6):
            h.add_user_message(1, f"msg {i}")
        msgs = h.get_messages(1)
        assert len(msgs) == 4
        assert msgs[0]["content"] == "msg 2"
        assert msgs[-1]["content"] == "msg 5"

    def test_get_messages_returns_copy(self):
        h = ConversationHistory()
        h.add_user_message(1, "test")
        msgs = h.get_messages(1)
        msgs.clear()
        assert len(h.get_messages(1)) == 1
