# Dmitry

Python utility library + Telegram-бот для отслеживания экзаменов ОГЭ и переезда в Новосибирск.

## Telegram-бот

Бот каждый день в 8:00 (НСК) присылает отчёт: обратный отсчёт до переезда,
статус экзаменов ОГЭ, оценки и мотивационную цитату.

### Команды бота

| Команда    | Описание                       |
|------------|--------------------------------|
| `/start`   | Приветствие                    |
| `/status`  | Текущий отчёт                  |
| `/grades`  | Все оценки                     |
| `/quote`   | Мотивационная цитата           |
| `/help`    | Список команд                  |

Чтобы записать оценку — просто отправь цифру (2, 3, 4 или 5) после экзамена.

### Запуск бота

```bash
# 1. Установи зависимости
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
pip install -r bot/requirements.txt

# 2. Настрой переменные окружения
cp .env.example .env
# Отредактируй .env — впиши свой BOT_TOKEN и CHAT_ID

# 3. Загрузи переменные и запусти
export $(cat .env | xargs)         # Windows PowerShell: Get-Content .env | ForEach { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }
python -m bot.main
```

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
pytest                            # все тесты + покрытие
ruff check src/ tests/ bot/       # линтер
```
