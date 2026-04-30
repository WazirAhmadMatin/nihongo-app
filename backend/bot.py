"""
bot.py  —  Nihongo Bot (Mini App launcher)
The heavy logic now lives in the FastAPI backend.
This file just launches the Mini App and keeps /add working.
"""
import csv, logging, os
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=logging.INFO)
log = logging.getLogger(__name__)

load_dotenv()
TOKEN       = os.getenv("BOT_TOKEN")
WEBAPP_URL  = os.getenv("WEBAPP_URL", "https://your-frontend-domain.com")  # Set this!
CSV_PATH    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jlpt_vocabulary_enriched.csv")
COL_KANJI   = "kanji_final"
COL_ROMAJI  = "romaji_final"
COL_ENGLISH = "english_ai"


async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            "🇯🇵  Open Nihongo App",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )]
    ])
    await update.message.reply_text(
        "🌸 *Nihongo — Japanese Vocabulary*\n\n"
        "Tap below to open the app and start practising JLPT vocabulary.",
        parse_mode="Markdown",
        reply_markup=keyboard,
    )


async def add_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    """Usage: /add 水 mizu water"""
    try:
        _, kanji, romaji, english = update.message.text.split(" ", 3)
    except ValueError:
        await update.message.reply_text("Usage: /add <kanji> <romaji> <english>\nExample: /add 水 mizu water")
        return

    file_exists = os.path.isfile(CSV_PATH)
    fieldnames  = [COL_KANJI, COL_ROMAJI, COL_ENGLISH]
    if file_exists:
        with open(CSV_PATH, newline="", encoding="utf-8-sig") as rf:
            fieldnames = csv.DictReader(rf).fieldnames or fieldnames

    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        if not file_exists or os.path.getsize(CSV_PATH) == 0:
            writer.writeheader()
        writer.writerow({COL_KANJI: kanji, COL_ROMAJI: romaji, COL_ENGLISH: english})

    await update.message.reply_text(f"✅ Added *{kanji}* ({romaji}) = {english}", parse_mode="Markdown")


def main() -> None:
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("add",   add_cmd))
    log.info("Nihongo Bot running — Mini App mode")
    app.run_polling()


if __name__ == "__main__":
    main()
