"""
Nihongo Mini App — FastAPI Backend
Run: uvicorn main:app --reload --port 8000

Vocabulary: data/jlpt_vocab.sqlite (read-only, JLPT N5–N1)   → vocab.py
User data:  data/users.sqlite (progress, reviews, settings)   → userdb.py
Login:      Telegram Mini App initData, verified in auth.py
"""
import asyncio, hashlib, hmac, os, random, re
from contextlib import asynccontextmanager
from collections import defaultdict
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import userdb, vocab
from auth import current_user, DEV_MODE
from vocab import WORDS, BY_ID, LEVELS, filter_words, public
from quizlib import norm, mode_pool, answer_of, make_choices

@asynccontextmanager
async def lifespan(_app):
    """With RUN_BOT=1 the Telegram bot runs inside this process, so one service
    (one machine, one users.sqlite) serves both the API and the bot."""
    tg = None
    if os.getenv("RUN_BOT") == "1":
        import bot
        tg = bot.build_app()
        await tg.initialize()
        await tg.start()
        await tg.updater.start_polling(allowed_updates=["message", "callback_query", "poll_answer"])
    yield
    if tg:
        await tg.updater.stop()
        await tg.stop()
        await tg.shutdown()


app = FastAPI(title="Nihongo API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

QUIZ_MODES = ("meaning", "reverse", "reading", "cloze")
quizzes: dict = {}          # active quiz per user (short-lived, in memory)


def me(tg_user: dict = Depends(current_user)) -> int:
    """Authenticated user id; also makes sure the user exists in the DB."""
    userdb.ensure_user(tg_user["id"], tg_user.get("first_name"), tg_user.get("username"))
    return tg_user["id"]

# ── Models ─────────────────────────────────────────────────────────────────────
class QuizStartRequest(BaseModel):
    level: Optional[str] = None
    topic: Optional[int] = None
    total: int = 10
    mode: str = "meaning"
    missed_only: bool = False

class AnswerRequest(BaseModel):
    answer: str

class GradeRequest(BaseModel):
    word_id: str
    grade: int

class WordIdRequest(BaseModel):
    word_id: str

class MyWordRequest(BaseModel):
    word: str
    reading: str = ""
    meaning: str

class SettingsRequest(BaseModel):
    level: Optional[str] = None
    new_per_day: Optional[int] = None
    word_time: Optional[str] = None
    reminder_time: Optional[str] = None
    notify: Optional[bool] = None
    tz: Optional[str] = None
    public_name: Optional[str] = None
    exam_date: Optional[str] = None

# ── Words ──────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    storage = "postgres" if userdb.IS_PG else ("temporary (/tmp)" if userdb.DB_PATH.startswith("/tmp") else "sqlite")
    return {"status": "ok", "words_loaded": len(WORDS), "dev_mode": DEV_MODE, "storage": storage,
            "bot_webhook_ready": bool(os.getenv("BOT_TOKEN") and os.getenv("CRON_SECRET"))}


@app.get("/levels")
def get_levels():
    counts = defaultdict(int)
    for w in WORDS:
        counts[w["level"]] += 1
    return {"levels": [{"level": lv, "count": counts[lv]} for lv in LEVELS if counts[lv]]}


@app.get("/topics")
def get_topics(level: str):
    topics = {}
    for w in filter_words(level):
        t = w["topic_no"]
        if t is None:
            continue
        e = topics.setdefault(t, {"topic_no": t, "topic_ja": w["topic_ja"],
                                  "topic_en": w["topic_en"], "count": 0})
        e["count"] += 1
    return {"level": level.upper(), "topics": [topics[k] for k in sorted(topics)]}


@app.get("/words")
def get_words(level: Optional[str] = None, topic: Optional[int] = None,
              search: Optional[str] = None, limit: int = 100, offset: int = 0,
              uid: int = Depends(me)):
    if level and level.upper() == "MY":
        words = userdb.my_words(uid)
        if search:
            q = search.lower()
            words = [w for w in words if q in w["kanji"] or q in w["reading"] or q in w["english"].lower()]
    elif search:
        words = vocab.search(search, level)
        if topic is not None:
            words = [w for w in words if w["topic_no"] == topic]
    else:
        words = filter_words(level, topic)
    limit = max(1, min(limit, 500))
    page = words[offset:offset + limit]
    ids = [w["id"] for w in page]
    in_reviews = set()
    if ids:
        with userdb.conn() as c:
            in_reviews = {r[0] for r in c.execute(
                f"SELECT word_id FROM cards WHERE user_id=? AND word_id IN ({','.join('?' * len(ids))})",
                (uid, *ids))}
    return {
        "words":  [{**public(w), "in_reviews": w["id"] in in_reviews} for w in page],
        "total":  len(words),
        "offset": offset,
    }


@app.get("/words/{word_id}")
def get_word(word_id: str, uid: int = Depends(me)):
    w = userdb.get_word(uid, word_id)
    if not w:
        raise HTTPException(404, "Word not found.")
    return public(w)

# ── Me / settings ──────────────────────────────────────────────────────────────
@app.get("/me")
def get_me(uid: int = Depends(me)):
    user = userdb.get_user(uid)
    q = userdb.queue(uid, limit=0)
    return {
        "user": {k: user[k] for k in ("user_id", "first_name", "level", "new_per_day", "word_time",
                                      "reminder_time", "notify", "tz", "public_name", "exam_date")},
        "today": {"due": q["due"], "new": q["new"], "done": q["done_today"]},
        "streak": userdb.streak(uid, user),
    }


@app.put("/me/settings")
def put_settings(req: SettingsRequest, uid: int = Depends(me)):
    values = req.model_dump(exclude_unset=True)
    try:
        user = userdb.update_settings(uid, **values)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "user": user}

# ── Spaced repetition ──────────────────────────────────────────────────────────
@app.get("/review/queue")
def review_queue(limit: int = 30, uid: int = Depends(me)):
    q = userdb.queue(uid, limit=max(1, min(limit, 100)))
    return {
        "due": q["due"], "new": q["new"], "done_today": q["done_today"],
        "items": [{"word": public(i["word"]), "is_new": i["is_new"],
                   "interval": (i["card"] or {}).get("interval", 0)} for i in q["items"]],
    }


@app.post("/review/grade")
def review_grade(req: GradeRequest, uid: int = Depends(me)):
    if not userdb.get_word(uid, req.word_id):
        raise HTTPException(404, "Word not found.")
    try:
        return userdb.grade(uid, req.word_id, req.grade)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/review/add")
def review_add(req: WordIdRequest, uid: int = Depends(me)):
    if not userdb.get_word(uid, req.word_id):
        raise HTTPException(404, "Word not found.")
    return {"added": userdb.add_card(uid, req.word_id)}

# ── Personal words ─────────────────────────────────────────────────────────────
@app.get("/mywords")
def list_my_words(uid: int = Depends(me)):
    return {"words": [public(w) for w in userdb.my_words(uid)]}


@app.post("/mywords")
def create_my_word(req: MyWordRequest, uid: int = Depends(me)):
    try:
        return public(userdb.add_my_word(uid, req.word, req.reading, req.meaning))
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/mywords/{word_id}")
def remove_my_word(word_id: str, uid: int = Depends(me)):
    if not userdb.delete_my_word(uid, word_id):
        raise HTTPException(404, "Word not found.")
    return {"deleted": True}

# ── Quiz ───────────────────────────────────────────────────────────────────────
def card_payload(w: dict, mode: str) -> dict:
    """Only what the question needs; the rest arrives with the answer."""
    base = {"id": w["id"], "level": w["level"], "pos": w["pos"], "topic_en": w["topic_en"], "mode": mode}
    if mode == "meaning":
        base.update(kanji=w["kanji"], reading=w["reading"], romaji=w["romaji"],
                    example_jp=w["example_jp"], example_target=w["example_target"])
    elif mode == "reverse":
        base.update(english=w["english"], hint=w["hint"])
    elif mode == "reading":
        base.update(kanji=w["kanji"])
    elif mode == "cloze":
        base.update(sentence=w["example_jp"].replace(w["example_target"], "＿＿", 1),
                    example_en=w["example_en"])
    return base


def pick_word(q: dict, words: list[dict]) -> dict:
    """Prefer words not seen in this quiz; words answered wrong before come up more often."""
    unseen = [w for w in words if w["id"] not in q["seen"]]
    pool = unseen or words
    weights = [min(1 + 2 * q["wrong"].get(w["id"], 0), 5) for w in pool]
    w = random.choices(pool, weights=weights, k=1)[0]
    q["seen"].add(w["id"])
    return w


def next_card(uid: int) -> dict:
    q = quizzes[uid]
    w = pick_word(q, q["pool"])
    q["word"] = w
    return {"card_number": q["done"] + 1, "quiz_total": q["total"],
            **card_payload(w, q["mode"]), "choices": make_choices(w, q["mode"])}


@app.post("/quiz/start")
def quiz_start(req: QuizStartRequest, uid: int = Depends(me)):
    if req.mode not in QUIZ_MODES:
        raise HTTPException(400, f"mode must be one of {', '.join(QUIZ_MODES)}")
    wrong = userdb.wrong_counts(uid)
    if req.missed_only:
        words = [w for wid in wrong if (w := BY_ID.get(wid))]
        if req.level:
            words = [w for w in words if w["level"] == req.level.upper()]
    else:
        words = filter_words(req.level, req.topic)
    pool = mode_pool(words, req.mode)
    if not pool:
        if req.mode == "cloze":
            raise HTTPException(404, "Fill-in-the-blank needs example sentences, which only N4 has for now.")
        if req.missed_only:
            raise HTTPException(404, "No missed words yet. Nice!")
        raise HTTPException(404, "No words found for this selection.")
    quizzes[uid] = {"mode": req.mode, "pool": pool, "total": max(1, min(req.total, 100)),
                    "done": 0, "correct": 0, "streak": 0, "seen": set(), "wrong": wrong, "word": None}
    return next_card(uid)


@app.post("/quiz/answer")
def quiz_answer(req: AnswerRequest, uid: int = Depends(me)):
    q = quizzes.get(uid)
    if not q or not q["word"]:
        raise HTTPException(400, "No active quiz.")
    w, mode = q["word"], q["mode"]
    answer = answer_of(w, mode)
    ok = norm(req.answer) == norm(answer)
    userdb.record_quiz(uid, w["id"], ok, f"quiz:{mode}")
    q["done"] += 1
    if ok:
        q["correct"] += 1
        q["streak"] += 1
    else:
        q["streak"] = 0
        q["wrong"][w["id"]] = q["wrong"].get(w["id"], 0) + 1
    finished = q["done"] >= q["total"]
    result = {
        "correct": ok, "answer": answer, "word": public(w),
        "streak": q["streak"], "quiz_done": q["done"], "quiz_total": q["total"],
        "quiz_correct": q["correct"], "finished": finished,
    }
    if finished:
        result["summary"] = {"correct": q["correct"], "total": q["total"],
                             "pct": round(q["correct"] / q["total"] * 100)}
        quizzes.pop(uid, None)
    else:
        result["next_card"] = next_card(uid)
    return result


@app.post("/quiz/stop")
def quiz_stop(uid: int = Depends(me)):
    q = quizzes.pop(uid, None) or {"correct": 0, "done": 0}
    return {"stopped": True, "summary": {
        "correct": q["correct"], "total": q["done"],
        "pct": round(q["correct"] / q["done"] * 100) if q["done"] else 0}}

# ── Stats ──────────────────────────────────────────────────────────────────────
@app.get("/stats")
def get_stats(uid: int = Depends(me)):
    return userdb.stats(uid)


@app.get("/leaderboard")
def get_leaderboard(uid: int = Depends(me)):
    return userdb.leaderboard(uid)


@app.post("/reset")
def reset(uid: int = Depends(me)):
    """Delete all of this user's progress (keeps settings and personal words)."""
    with userdb._lock, userdb.conn() as c:
        for t in ("cards", "reviews", "activity"):
            c.execute(f"DELETE FROM {t} WHERE user_id=?", (uid,))
    quizzes.pop(uid, None)
    return {"reset": True}


# ── Telegram webhook + scheduled messages (free serverless hosting) ───────────
# 1. Set BOT_TOKEN and CRON_SECRET.  2. Open /telegram/setup?key=<CRON_SECRET> once.
# 3. Have something call /cron?key=<CRON_SECRET> every ~15 min (GitHub Actions: .github/workflows/cron.yml).
CRON_SECRET = os.getenv("CRON_SECRET", "")
_tg = {"app": None, "loop": None}


def _webhook_secret() -> str:
    return hashlib.sha256(("webhook:" + os.getenv("BOT_TOKEN", "")).encode()).hexdigest()[:48]


def _check_key(key: Optional[str], request: Request):
    auth = request.headers.get("authorization", "")
    given = key or (auth[7:] if auth.lower().startswith("bearer ") else "")
    if not CRON_SECRET or not hmac.compare_digest(given, CRON_SECRET):
        raise HTTPException(403, "Wrong or missing key.")


async def _bot_app():
    """The bot in webhook mode, created once per running instance."""
    loop = asyncio.get_running_loop()
    if _tg["app"] is None or _tg["loop"] is not loop:
        import bot
        app_ = bot.build_app(polling=False)
        await app_.initialize()
        _tg.update(app=app_, loop=loop)
    return _tg["app"]


@app.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    secret = request.headers.get("x-telegram-bot-api-secret-token", "")
    if not hmac.compare_digest(secret, _webhook_secret()):
        raise HTTPException(403, "Bad secret.")
    from telegram import Update
    app_ = await _bot_app()
    await app_.process_update(Update.de_json(await request.json(), app_.bot))
    return {"ok": True}


@app.get("/telegram/setup")
async def telegram_setup(request: Request, key: Optional[str] = None):
    """Point Telegram at this server's webhook and register the bot's commands."""
    _check_key(key, request)
    import bot
    app_ = await _bot_app()
    base = os.getenv("PUBLIC_URL") or str(request.base_url).rstrip("/")
    base = base.replace("http://", "https://") if "localhost" not in base else base
    url = f"{base}/telegram/webhook"
    await app_.bot.set_webhook(url, secret_token=_webhook_secret(),
                               allowed_updates=["message", "callback_query", "poll_answer"],
                               drop_pending_updates=True)
    await bot.post_init(app_)
    info = await app_.bot.get_webhook_info()
    return {"ok": True, "webhook": info.url, "pending_updates": info.pending_update_count}


@app.get("/cron")
async def cron(request: Request, key: Optional[str] = None):
    """Send words of the day and reminders that are due. Call every ~15 minutes."""
    _check_key(key, request)
    import bot
    app_ = await _bot_app()
    return {"ok": True, **(await bot.run_scheduled(app_.bot))}
