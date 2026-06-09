"""Entry-point — build the Application and start polling."""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime

import pytz
from telegram.ext import Application, CommandHandler, MessageHandler, filters

from bot.config import BOT_TOKEN
from bot.handlers import (
    cmd_grades,
    cmd_help,
    cmd_quote,
    cmd_start,
    cmd_status,
    handle_message,
    send_daily,
)

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def main() -> None:
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN is not set. Export it as an environment variable.")
        sys.exit(1)

    app = Application.builder().token(BOT_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("grades", cmd_grades))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("quote", cmd_quote))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Daily job at 08:00 NSK = 01:00 UTC
    app.job_queue.run_daily(
        send_daily,
        time=datetime.strptime("01:00", "%H:%M").replace(tzinfo=pytz.utc).timetz(),
        days=(0, 1, 2, 3, 4, 5, 6),
        name="daily_report",
    )

    logger.info("Бот запущен! Ежедневный отчёт в 8:00 НСК.")

    async with app:
        await app.start()
        await app.updater.start_polling()
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
