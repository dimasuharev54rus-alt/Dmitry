"""Entry-point — build the Application and start polling."""

from __future__ import annotations

import asyncio
import logging
import sys

from telegram.ext import Application, CommandHandler, MessageHandler, filters

from chatbot.config import BOT_TOKEN, GROQ_API_KEY
from chatbot.handlers import cmd_clear, cmd_help, cmd_model, cmd_start, handle_message

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def main() -> None:
    if not BOT_TOKEN:
        logger.error("CHATBOT_TOKEN не задан. Экспортируй переменную окружения.")
        sys.exit(1)

    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY не задан — бот не сможет отвечать на сообщения.")

    app = Application.builder().token(BOT_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("clear", cmd_clear))
    app.add_handler(CommandHandler("model", cmd_model))

    # Plain text → AI
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("🤖 Дмитрий-бот запущен! Модель: %s", "Groq")

    async with app:
        await app.start()
        await app.updater.start_polling()
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
