"""
bot.py — Nihongo Telegram bot

Runs on its own (`python bot.py`) or inside the API process (set RUN_BOT=1 for
uvicorn, see main.py). Either way it shares data/users.sqlite with the API.

What it does
  • Opens the Mini App
  • Word of the day at each user's chosen time
  • Evening reminder when reviews are due / the streak is at risk
  • Quiz polls right in the chat (/quiz)
  • Dictionary: send any word (日本語, kana, romaji or English) to look it up
  • Personal words (/add), stats, leaderboard, settings
"""
import html, logging, os, random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import (BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo)
from telegram.constants import ParseMode
from telegram.ext import (Application, ApplicationBuilder, CallbackQueryHandler, CommandHandler,
                          ContextTypes, MessageHandler, PollAnswerHandler, filters)

load_dotenv()
import userdb, vocab                                     # noqa: E402  (after load_dotenv)
from quizlib import make_choices                         # noqa: E402

logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("bot")

TOKEN      = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-frontend-domain.com")
NOTIFY_WINDOW = timedelta(hours=3)   # send a scheduled message at most this late
E = html.escape

COMMANDS = [
    ("start",       "Open the app"),
    ("today",       "Today's reviews and streak"),
    ("word",        "A new word now"),
    ("quiz",        "Quiz in the chat, e.g. /quiz 5"),
    ("stats",       "Your progress"),
    ("leaderboard", "This week's top learners"),
    ("add",         "Add your own word: /add 猫舌 ねこじた can't handle hot food"),
    ("mywords",     "Your own words"),
    ("settings",    "Level, times, reminders"),
    ("help",        "All commands"),
]

# ── Helpers ────────────────────────────────────────────────────────────────────
def open_app_button(text="🇯🇵 Open Nihongo", path=""):
    return InlineKeyboardButton(text, web_app=WebAppInfo(url=WEBAPP_URL + path))


def user_of(update: Update) -> dict:
    u = update.effective_user
    chat = update.effective_chat
    return userdb.ensure_user(u.id, u.first_name, u.username,
                              chat.id if chat and chat.type == "private" else None)


def word_card(w: dict, title: str = "") -> str:
    lines = []
    if title:
        lines.append(f"<b>{E(title)}</b>\n")
    head = f"<b>{E(w['kanji'])}</b>"
    if w["reading"]:
        head += f"  【{E(w['reading'])}】"
    if w.get("romaji"):
        head += f"  <i>{E(w['romaji'])}</i>"
    lines.append(head)
    meaning = E(w["english"])
    if w.get("hint"):
        meaning += f"  <i>({E(w['hint'])})</i>"
    lines.append(f"→ {meaning}")
    meta = " · ".join(x for x in (w["level"], w.get("pos"), w.get("topic_en")) if x)
    if meta:
        lines.append(f"<code>{E(meta)}</code>")
    if w.get("example_jp"):
        ex = E(w["example_jp"])
        t = w.get("example_target")
        if t and t in w["example_jp"]:
            ex = ex.replace(E(t), f"<u>{E(t)}</u>", 1)
        lines.append(f"\n📝 {ex}\n<i>{E(w['example_en'])}</i>")
    return "\n".join(lines)


def add_button(word_id: str):
    return InlineKeyboardButton("➕ Add to my reviews", callback_data=f"add:{word_id}")


def pick_new_word(user: dict) -> dict:
    """A word from the user's level they haven't started yet (falls back to any)."""
    with userdb.conn() as c:
        known = {r[0] for r in c.execute("SELECT word_id FROM cards WHERE user_id=?", (user["user_id"],))}
    pool = [w for w in vocab.filter_words(user["level"]) if w["id"] not in known]
    pool = pool or vocab.filter_words(user["level"])
    with_ex = [w for w in pool if w["example_jp"]]
    return random.choice(with_ex or pool)


async def send_word(bot, chat_id: int, w: dict, title: str):
    await bot.send_message(chat_id, word_card(w, title), parse_mode=ParseMode.HTML,
                           reply_markup=InlineKeyboardMarkup([[add_button(w["id"])]]))
    if w.get("audio"):
        path = os.path.join(vocab.AUDIO_DIR, f"{w['id']}.mp3")
        with open(path, "rb") as f:
            await bot.send_audio(chat_id, f, title=w["kanji"])


def today_text(user: dict) -> str:
    q = userdb.queue(user["user_id"], limit=0)
    s = userdb.streak(user["user_id"], user)
    lines = [f"📅 <b>Today</b>  ({E(user['level'])})",
             f"• Reviews due: <b>{q['due']}</b>",
             f"• New words left: <b>{q['new']}</b>",
             f"• Done today: <b>{q['done_today']}</b>",
             f"🔥 Streak: <b>{s['current']}</b> day{'s' if s['current'] != 1 else ''}"
             + ("" if s["studied_today"] or not s["current"] else "  (study today to keep it!)")]
    if user.get("exam_date"):
        left = (datetime.fromisoformat(user["exam_date"]).date() - userdb.today(user)).days
        if left >= 0:
            lines.append(f"🎯 Exam in <b>{left}</b> day{'s' if left != 1 else ''}")
    return "\n".join(lines)

# ── Commands ───────────────────────────────────────────────────────────────────
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    name = E(update.effective_user.first_name or "")
    await update.message.reply_text(
        f"🌸 <b>こんにちは {name}!</b>\n\n"
        "I'm your Japanese vocabulary coach (JLPT N5–N1, 9,000+ words).\n\n"
        "• Tap <b>Open Nihongo</b> for reviews, quizzes and stats\n"
        f"• Every day at {user['word_time']} I'll send you a new word\n"
        f"• At {user['reminder_time']} I'll remind you if reviews are waiting\n"
        "• Send me any word — 財布, さいふ, saifu or wallet — to look it up\n"
        "• /quiz for a quick quiz right here\n\n"
        f"Your level is <b>{user['level']}</b>. Change it with /settings.",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[open_app_button()]]),
    )


async def help_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user_of(update)
    text = "\n".join(f"/{c} — {E(d)}" for c, d in COMMANDS)
    text += ("\n\n<b>Settings</b>\n/level N3\n/time word 08:00\n/time reminder 20:30\n"
             "/reminders on|off\n/name Matin  (show on leaderboard; /name off to hide)\n"
             "/exam 2026-12-06\n/perday 15  (new words per day)\n\n"
             "Send any word to look it up.")
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


async def today_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    await update.message.reply_text(today_text(user), parse_mode=ParseMode.HTML,
                                     reply_markup=InlineKeyboardMarkup([[open_app_button("▶️ Start reviews", "#review")]]))


async def word_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    await send_word(ctx.bot, update.effective_chat.id, pick_new_word(user), "✨ New word")


async def stats_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    s = userdb.stats(user["user_id"])
    lines = [f"📊 <b>Your progress</b>",
             f"🔥 Streak {s['streak']['current']} (best {s['streak']['best']})",
             f"✅ {s['total_reviews']} answers · {s['accuracy']}% correct", ""]
    for lv in s["levels"]:
        if lv["learning"] or lv["mastered"] or lv["level"] == user["level"]:
            done = lv["learning"] + lv["mastered"]
            bar = "▓" * round(10 * done / lv["total"]) + "░" * (10 - round(10 * done / lv["total"]))
            lines.append(f"<code>{lv['level']} {bar}</code> {lv['mastered']} mastered · {lv['learning']} learning / {lv['total']}")
    if s["most_missed"]:
        lines.append("\n<b>Needs practice:</b> " + "、".join(E(m["kanji"]) for m in s["most_missed"][:6]))
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML,
                                    reply_markup=InlineKeyboardMarkup([[open_app_button("📈 Full stats", "#stats")]]))


async def leaderboard_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    lb = userdb.leaderboard(user["user_id"])
    if not lb["board"]:
        text = "🏆 Nobody is on the leaderboard yet.\nJoin with /name YourName"
    else:
        medals = {1: "🥇", 2: "🥈", 3: "🥉"}
        rows = [f"{medals.get(e['rank'], str(e['rank']) + '.')} {E(e['name'])} — {e['week']} answers · 🔥{e['streak']}"
                + (" ← you" if e["me"] else "") for e in lb["board"]]
        text = "🏆 <b>This week</b>\n" + "\n".join(rows)
        if lb["me"] and not lb["me"]["public"]:
            text += "\n\nYou're hidden. Join with /name YourName"
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


async def settings_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    u = user_of(update)
    text = (f"⚙️ <b>Settings</b>\n"
            f"Level: <b>{u['level']}</b>  → /level N3\n"
            f"New words/day: <b>{u['new_per_day']}</b>  → /perday 15\n"
            f"Word of the day: <b>{u['word_time']}</b>  → /time word 08:00\n"
            f"Reminder: <b>{u['reminder_time']}</b>  → /time reminder 20:00\n"
            f"Notifications: <b>{'on' if u['notify'] else 'off'}</b>  → /reminders on|off\n"
            f"Leaderboard name: <b>{E(u['public_name'] or 'hidden')}</b>  → /name Matin\n"
            f"Exam date: <b>{u['exam_date'] or 'not set'}</b>  → /exam 2026-12-06")
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


async def _set(update: Update, ok_text: str, **values):
    user = user_of(update)
    try:
        userdb.update_settings(user["user_id"], **values)
        await update.message.reply_text(f"✅ {ok_text}")
    except ValueError:
        await update.message.reply_text("Hmm, that value doesn't look right. See /settings for examples.")


async def level_cmd(update, ctx):
    if not ctx.args or ctx.args[0].upper() not in vocab.LEVELS:
        return await update.message.reply_text("Usage: /level N5 | N4 | N3 | N2 | N1")
    await _set(update, f"Level set to {ctx.args[0].upper()}", level=ctx.args[0].upper())


async def perday_cmd(update, ctx):
    if not ctx.args or not ctx.args[0].isdigit():
        return await update.message.reply_text("Usage: /perday 10")
    await _set(update, f"{int(ctx.args[0])} new words per day", new_per_day=int(ctx.args[0]))


async def time_cmd(update, ctx):
    if len(ctx.args) != 2 or ctx.args[0] not in ("word", "reminder"):
        return await update.message.reply_text("Usage: /time word 08:00  or  /time reminder 20:30")
    field = "word_time" if ctx.args[0] == "word" else "reminder_time"
    await _set(update, f"{ctx.args[0].title()} time set to {ctx.args[1]}", **{field: ctx.args[1]})


async def reminders_cmd(update, ctx):
    if not ctx.args or ctx.args[0] not in ("on", "off"):
        return await update.message.reply_text("Usage: /reminders on  or  /reminders off")
    await _set(update, f"Notifications {ctx.args[0]}", notify=ctx.args[0] == "on")


async def name_cmd(update, ctx):
    if not ctx.args:
        return await update.message.reply_text("Usage: /name YourName  (or /name off to hide)")
    name = " ".join(ctx.args)
    if name.lower() == "off":
        return await _set(update, "You're hidden from the leaderboard", public_name=None)
    await _set(update, f"You're on the leaderboard as {name[:24]}", public_name=name)


async def exam_cmd(update, ctx):
    if not ctx.args:
        return await update.message.reply_text("Usage: /exam 2026-12-06  (or /exam off)")
    if ctx.args[0] == "off":
        return await _set(update, "Exam countdown removed", exam_date=None)
    await _set(update, f"Exam date set to {ctx.args[0]}", exam_date=ctx.args[0])


async def add_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/add 猫舌 ねこじた can't handle hot food   or   /add 猫舌 | ねこじた | can't handle hot food"""
    user = user_of(update)
    raw = update.message.text.partition(" ")[2].strip()
    if "|" in raw:
        parts = [p.strip() for p in raw.split("|")]
        if len(parts) >= 3:
            word, reading, meaning = parts[0], parts[1], " | ".join(parts[2:])
        else:
            word, reading, meaning = parts[0], "", parts[-1] if len(parts) > 1 else ""
    else:
        bits = raw.split(" ", 2)
        if len(bits) < 2:
            return await update.message.reply_text(
                "Usage: /add 猫舌 ねこじた can't handle hot food\n(the reading is optional: /add 猫舌 can't handle hot food)")
        if len(bits) == 3 and all("぀" <= ch <= "ヿ" for ch in bits[1]):
            word, reading, meaning = bits
        else:
            word, reading, meaning = bits[0], "", raw.partition(" ")[2]
    try:
        w = userdb.add_my_word(user["user_id"], word, reading, meaning)
    except ValueError as e:
        return await update.message.reply_text(str(e))
    await update.message.reply_text(
        f"✅ Added <b>{E(w['kanji'])}</b>{' 【' + E(w['reading']) + '】' if w['reading'] else ''} = {E(w['english'])}\n"
        "It's in today's reviews.", parse_mode=ParseMode.HTML)


async def mywords_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    words = userdb.my_words(user["user_id"])
    if not words:
        return await update.message.reply_text("No personal words yet. Add one: /add 猫舌 ねこじた can't handle hot food")
    lines = [f"• <b>{E(w['kanji'])}</b>{' 【' + E(w['reading']) + '】' if w['reading'] else ''} — {E(w['english'])}"
             for w in words[-40:]]
    await update.message.reply_text(f"📒 <b>My words</b> ({len(words)})\n" + "\n".join(lines),
                                    parse_mode=ParseMode.HTML)

# ── Dictionary lookup (any plain text) ────────────────────────────────────────
async def lookup(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    q = update.message.text.strip()
    if len(q) > 40:
        return
    hits = vocab.search(q, limit=3)
    mine = [w for w in userdb.my_words(user["user_id"]) if q in (w["kanji"], w["reading"])]
    hits = (mine + hits)[:3]
    if not hits:
        return await update.message.reply_text(
            f"🔍 No match for “{q}”.\nAdd it yourself: /add {q} <reading> <meaning>")
    for w in hits:
        markup = None if w.get("custom") else InlineKeyboardMarkup([[add_button(w["id"])]])
        await update.message.reply_text(word_card(w), parse_mode=ParseMode.HTML, reply_markup=markup)


async def on_button(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = user_of(update)
    kind, _, arg = q.data.partition(":")
    if kind == "add":
        added = userdb.add_card(user["user_id"], arg)
        await q.answer("Added to today's reviews ✅" if added else "Already in your reviews")
    elif kind == "quiz":
        await q.answer()
        await send_quiz_poll(ctx, update.effective_chat.id, user, left=int(arg or 5))
    else:
        await q.answer()

# ── Quiz polls ─────────────────────────────────────────────────────────────────
async def send_quiz_poll(ctx, chat_id: int, user: dict, left: int):
    pool = [w for w in vocab.filter_words(user["level"]) if len(w["english"]) <= 100]
    w = random.choice(pool)
    choices = [c[:100] for c in make_choices(w, "meaning")]
    correct = choices.index(w["english"][:100])
    question = f"What does {w['kanji']}" + (f"【{w['reading']}】" if w["reading"] else "") + " mean?"
    msg = await ctx.bot.send_poll(
        chat_id, question, choices, type="quiz", correct_option_id=correct, is_anonymous=False,
        explanation=(w["example_jp"] + "\n" + w["example_en"])[:200] if w["example_jp"] else None,
    )
    ctx.bot_data.setdefault("polls", {})[msg.poll.id] = {
        "user_id": user["user_id"], "chat_id": chat_id, "word_id": w["id"],
        "correct": correct, "left": left - 1,
    }


async def quiz_cmd(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = user_of(update)
    n = int(ctx.args[0]) if ctx.args and ctx.args[0].isdigit() else 5
    n = max(1, min(n, 20))
    await update.message.reply_text(f"🃏 {n} question{'s' if n > 1 else ''} from {user['level']}. Go!")
    await send_quiz_poll(ctx, update.effective_chat.id, user, left=n)


async def on_poll_answer(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ans = update.poll_answer
    info = ctx.bot_data.get("polls", {}).pop(ans.poll_id, None)
    if not info or not ans.option_ids:
        return
    ok = ans.option_ids[0] == info["correct"]
    userdb.record_quiz(info["user_id"], info["word_id"], ok, "bot:poll")
    if info["left"] > 0:
        user = userdb.get_user(info["user_id"])
        await send_quiz_poll(ctx, info["chat_id"], user, info["left"])
    else:
        await ctx.bot.send_message(info["chat_id"], "🎉 Quiz done! Another round?",
                                   reply_markup=InlineKeyboardMarkup([[
                                       InlineKeyboardButton("🃏 5 more", callback_data="quiz:5"),
                                       open_app_button("📈 Stats", "#stats")]]))

# ── Scheduled messages ─────────────────────────────────────────────────────────
def _due_now(user: dict, hhmm: str) -> bool:
    """True if the user's local time is within NOTIFY_WINDOW after hhmm."""
    now = datetime.strptime(userdb.now_hhmm(user), "%H:%M")
    at = datetime.strptime(hhmm, "%H:%M")
    return timedelta(0) <= now - at < NOTIFY_WINDOW


async def scheduler(ctx: ContextTypes.DEFAULT_TYPE):
    for user in userdb.all_users():
        if not user["notify"] or not user["chat_id"]:
            continue
        day = userdb.today(user).isoformat()
        try:
            if user["last_word_day"] != day and _due_now(user, user["word_time"]):
                userdb.mark_sent(user["user_id"], "last_word_day", day)
                await send_word(ctx.bot, user["chat_id"], pick_new_word(user), "🌅 Word of the day")

            if user["last_remind_day"] != day and _due_now(user, user["reminder_time"]):
                userdb.mark_sent(user["user_id"], "last_remind_day", day)
                q = userdb.queue(user["user_id"], limit=0)
                s = userdb.streak(user["user_id"], user)
                if q["due"] or (s["current"] and not s["studied_today"]):
                    parts = []
                    if q["due"]:
                        parts.append(f"🔔 You have <b>{q['due']}</b> review{'s' if q['due'] != 1 else ''} waiting.")
                    if s["current"] and not s["studied_today"]:
                        parts.append(f"🔥 Your {s['current']}-day streak ends tonight. A few reviews will keep it!")
                    await ctx.bot.send_message(
                        user["chat_id"], "\n".join(parts), parse_mode=ParseMode.HTML,
                        reply_markup=InlineKeyboardMarkup([[open_app_button("▶️ Review now", "#review")]]))
        except Exception as e:                     # blocked bot, deleted chat, etc.
            log.warning("notify %s failed: %s", user["user_id"], e)

# ── Setup ──────────────────────────────────────────────────────────────────────
async def post_init(app: Application):
    await app.bot.set_my_commands([BotCommand(c, d[:256]) for c, d in COMMANDS])


def build_app() -> Application:
    if not TOKEN:
        raise RuntimeError("BOT_TOKEN is not set")
    app = ApplicationBuilder().token(TOKEN).post_init(post_init).build()
    handlers = {
        "start": start, "help": help_cmd, "today": today_cmd, "word": word_cmd, "quiz": quiz_cmd,
        "stats": stats_cmd, "leaderboard": leaderboard_cmd, "settings": settings_cmd,
        "level": level_cmd, "perday": perday_cmd, "time": time_cmd, "reminders": reminders_cmd,
        "name": name_cmd, "exam": exam_cmd, "add": add_cmd, "mywords": mywords_cmd,
    }
    for name, fn in handlers.items():
        app.add_handler(CommandHandler(name, fn))
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(PollAnswerHandler(on_poll_answer))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND & filters.ChatType.PRIVATE, lookup))
    app.job_queue.run_repeating(scheduler, interval=60, first=10)
    return app


def main():
    log.info("Nihongo bot running")
    build_app().run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
