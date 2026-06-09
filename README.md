# Dmitry

Python utility library + **AI чат-бот** для Telegram на базе Groq (Llama 3).

## 🤖 AI Чат-бот

Telegram-бот, который отвечает на вопросы, помогает с домашкой и поддерживает разговор.
Работает на модели Llama 3 через Groq API (бесплатно и быстро).

### Команды бота

| Команда   | Описание                        |
|-----------|---------------------------------|
| `/start`  | Приветствие                     |
| `/help`   | Список команд                   |
| `/clear`  | Очистить историю разговора      |
| `/model`  | Информация о модели             |

Просто напиши любое сообщение — бот ответит!

### Запуск бота

```bash
# 1. Установи зависимости
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r chatbot/requirements.txt

# 2. Задай переменные окружения
export CHATBOT_TOKEN="твой-токен-от-BotFather"
export GROQ_API_KEY="твой-ключ-от-groq"

# Windows PowerShell:
# $env:CHATBOT_TOKEN="твой-токен-от-BotFather"
# $env:GROQ_API_KEY="твой-ключ-от-groq"

# 3. Запусти
python -m chatbot.main
```

### Где взять ключи

- **Telegram Bot Token**: напиши @BotFather в Telegram → `/newbot`
- **Groq API Key** (бесплатно): https://console.groq.com/keys

## Утилиты (src/)

```
src/
  calculator.py      – арифметика и математические функции
  string_utils.py    – работа со строками
  data_processor.py  – обработка данных
  validators.py      – валидация ввода
  file_utils.py      – работа с файлами
```

## Тесты

```bash
pytest
ruff check src/ tests/ chatbot/
```
