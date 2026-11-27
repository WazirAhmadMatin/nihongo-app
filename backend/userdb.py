"""
Per-user data: settings, spaced-repetition cards, review log, daily activity,
personal words. Stored in data/users.sqlite (set USER_DB to move it).

Used by both the API (main.py) and the bot (bot.py), so both must point at
the same file (run them on the same machine / volume).
"""
import os, sqlite3, threading, time
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

import vocab

_BASE   = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("USER_DB", os.path.join(_BASE, "data", "users.sqlite"))
DEFAULT_TZ   = "Asia/Tokyo"
MASTERED_DAYS = 21          # interval at which a word counts as "mastered"
_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id        INTEGER PRIMARY KEY,
    first_name     TEXT,
    username       TEXT,
    created_at     REAL,
    level          TEXT    DEFAULT 'N4',
    new_per_day    INTEGER DEFAULT 10,
    word_time      TEXT    DEFAULT '08:00',
    reminder_time  TEXT    DEFAULT '20:00',
    notify         INTEGER DEFAULT 1,
    tz             TEXT    DEFAULT 'Asia/Tokyo',
    public_name    TEXT,
    exam_date      TEXT,
    chat_id        INTEGER,
    last_word_day  TEXT,
    last_remind_day TEXT
);
CREATE TABLE IF NOT EXISTS cards (
    user_id     INTEGER,
    word_id     TEXT,
    reps        INTEGER DEFAULT 0,
    interval    REAL    DEFAULT 0,
    ease        REAL    DEFAULT 2.5,
    due         TEXT,
    lapses      INTEGER DEFAULT 0,
    added       TEXT,
    last_review REAL,
    PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS ix_cards_due ON cards(user_id, due);
CREATE TABLE IF NOT EXISTS reviews (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER,
    word_id  TEXT,
    ts       REAL,
    day      TEXT,
    kind     TEXT,
    grade    INTEGER,
    correct  INTEGER
);
CREATE INDEX IF NOT EXISTS ix_reviews_user ON reviews(user_id, day);
CREATE TABLE IF NOT EXISTS activity (
    user_id  INTEGER,
    day      TEXT,
    reviews  INTEGER DEFAULT 0,
    correct  INTEGER DEFAULT 0,
    new_words INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS my_words (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    word       TEXT,
    reading    TEXT,
    meaning    TEXT,
    created_at REAL
);
"""

SETTINGS = {
    "level":         lambda v: v if v in vocab.LEVELS else None,
    "new_per_day":   lambda v: max(0, min(int(v), 100)),
    "word_time":     lambda v: _hhmm(v),
    "reminder_time": lambda v: _hhmm(v),
    "notify":        lambda v: 1 if v else 0,
    "tz":            lambda v: v if _valid_tz(v) else None,
    "public_name":   lambda v: (str(v).strip()[:24] or None) if v else None,
    "exam_date":     lambda v: date.fromisoformat(v).isoformat() if v else None,
}


def _hhmm(v):
    h, m = str(v).split(":")
    return f"{int(h) % 24:02d}:{int(m) % 60:02d}"


def _valid_tz(v):
    try:
        ZoneInfo(v)
        return True
    except Exception:
        return False


@contextmanager
def conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init():
    with _lock, conn() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(SCHEMA)


init()

# ── Users ──────────────────────────────────────────────────────────────────────
def ensure_user(user_id: int, first_name: str = None, username: str = None,
                chat_id: int = None) -> dict:
    with _lock, conn() as c:
        row = c.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
        if not row:
            c.execute("INSERT INTO users(user_id, first_name, username, created_at, chat_id) "
                      "VALUES (?,?,?,?,?)", (user_id, first_name, username, time.time(), chat_id))
        else:
            sets, args = [], []
            for k, v in (("first_name", first_name), ("username", username), ("chat_id", chat_id)):
                if v is not None and row[k] != v:
                    sets.append(f"{k}=?"); args.append(v)
            if sets:
                c.execute(f"UPDATE users SET {', '.join(sets)} WHERE user_id=?", (*args, user_id))
        return dict(c.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone())


def get_user(user_id: int) -> Optional[dict]:
    with conn() as c:
        row = c.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
        return dict(row) if row else None


def update_settings(user_id: int, **values) -> dict:
    clean = {}
    for k, v in values.items():
        if k in SETTINGS:
            try:
                clean[k] = SETTINGS[k](v)
            except Exception:
                raise ValueError(f"Invalid value for {k}")
            if clean[k] is None and k in ("level", "tz"):
                raise ValueError(f"Invalid value for {k}")
    if clean:
        with _lock, conn() as c:
            c.execute(f"UPDATE users SET {', '.join(f'{k}=?' for k in clean)} WHERE user_id=?",
                      (*clean.values(), user_id))
    return get_user(user_id)


def mark_sent(user_id: int, field: str, day: str):
    assert field in ("last_word_day", "last_remind_day")
    with _lock, conn() as c:
        c.execute(f"UPDATE users SET {field}=? WHERE user_id=?", (day, user_id))


def all_users() -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM users")]


def today(user: dict) -> date:
    return datetime.now(ZoneInfo(user.get("tz") or DEFAULT_TZ)).date()


def now_hhmm(user: dict) -> str:
    return datetime.now(ZoneInfo(user.get("tz") or DEFAULT_TZ)).strftime("%H:%M")

# ── Personal words ─────────────────────────────────────────────────────────────
def _custom_word(row) -> dict:
    return {
        "id": f"U{row['id']}", "level": "MY", "kanji": row["word"],
        "reading": row["reading"] or "", "romaji": "", "english": row["meaning"],
        "hint": "", "pos": "", "pos_list": [], "topic_no": None, "topic_ja": "",
        "topic_en": "My words", "example_jp": "", "example_en": "", "example_target": "",
        "also_in": [], "has_kanji": bool(vocab._KANJI_RE.search(row["word"])),
        "audio": False, "audio_ex": False, "custom": True,
        "verb_group": None, "transitivity": "", "suru_verb": False,
    }


def my_words(user_id: int) -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM my_words WHERE user_id=? ORDER BY id", (user_id,)).fetchall()
    return [_custom_word(r) for r in rows]


def add_my_word(user_id: int, word: str, reading: str, meaning: str) -> dict:
    word, meaning = (word or "").strip(), (meaning or "").strip()
    if not word or not meaning:
        raise ValueError("Word and meaning are required.")
    with _lock, conn() as c:
        cur = c.execute("INSERT INTO my_words(user_id, word, reading, meaning, created_at) "
                        "VALUES (?,?,?,?,?)", (user_id, word[:40], (reading or "").strip()[:40],
                                               meaning[:120], time.time()))
        row = c.execute("SELECT * FROM my_words WHERE id=?", (cur.lastrowid,)).fetchone()
    w = _custom_word(row)
    add_card(user_id, w["id"])          # new personal words go straight into reviews
    return w


def delete_my_word(user_id: int, word_id: str) -> bool:
    if not word_id.startswith("U"):
        return False
    with _lock, conn() as c:
        n = c.execute("DELETE FROM my_words WHERE id=? AND user_id=?",
                      (int(word_id[1:]), user_id)).rowcount
        c.execute("DELETE FROM cards WHERE user_id=? AND word_id=?", (user_id, word_id))
    return n > 0


def get_word(user_id: int, word_id: str) -> Optional[dict]:
    if word_id in vocab.BY_ID:
        return vocab.BY_ID[word_id]
    if word_id.startswith("U") and word_id[1:].isdigit():
        with conn() as c:
            row = c.execute("SELECT * FROM my_words WHERE id=? AND user_id=?",
                            (int(word_id[1:]), user_id)).fetchone()
        return _custom_word(row) if row else None
    return None

# ── Spaced repetition (SM-2 style, grades 0 Again · 1 Hard · 2 Good · 3 Easy) ─
def _card(c, user_id, word_id):
    row = c.execute("SELECT * FROM cards WHERE user_id=? AND word_id=?", (user_id, word_id)).fetchone()
    return dict(row) if row else None


def add_card(user_id: int, word_id: str) -> bool:
    """Put a word into the review queue (due today). False if already there."""
    user = get_user(user_id) or ensure_user(user_id)
    with _lock, conn() as c:
        if _card(c, user_id, word_id):
            return False
        c.execute("INSERT INTO cards(user_id, word_id, due) VALUES (?,?,?)",
                  (user_id, word_id, today(user).isoformat()))
    return True


def schedule(card: Optional[dict], grade: int) -> dict:
    """Return the new card state after a grade. Pure function (easy to test)."""
    c = dict(card or {"reps": 0, "interval": 0.0, "ease": 2.5, "lapses": 0})
    ease, ivl = c["ease"], c["interval"]
    if grade == 0:
        c["lapses"] += 1 if c["reps"] > 0 else 0
        c["ease"] = max(1.3, ease - 0.2)
        c["interval"] = 0.0
        c["reps"] = 0
        return c
    if ivl < 1:                      # new or relearning
        ivl = {1: 1.0, 2: 1.0, 3: 4.0}[grade]
    elif grade == 1:
        ivl, ease = max(ivl * 1.2, ivl + 1), ease - 0.15
    elif grade == 2:
        ivl = max(ivl * ease, ivl + 1)
    else:
        ivl, ease = max(ivl * ease * 1.3, ivl + 2), ease + 0.15
    c["ease"] = round(min(max(ease, 1.3), 3.5), 3)
    c["interval"] = round(min(ivl, 3650), 2)
    c["reps"] += 1
    return c


def grade(user_id: int, word_id: str, g: int) -> dict:
    if g not in (0, 1, 2, 3):
        raise ValueError("grade must be 0–3")
    user = get_user(user_id) or ensure_user(user_id)
    day = today(user)
    with _lock, conn() as c:
        old = _card(c, user_id, word_id)
        is_new = old is None or (old["reps"] == 0 and old["lapses"] == 0 and not old["last_review"])
        new = schedule(old, g)
        due = day + timedelta(days=round(new["interval"]))
        c.execute("""INSERT INTO cards(user_id, word_id, reps, interval, ease, due, lapses, added, last_review)
                     VALUES (?,?,?,?,?,?,?,?,?)
                     ON CONFLICT(user_id, word_id) DO UPDATE SET
                       reps=excluded.reps, interval=excluded.interval, ease=excluded.ease,
                       due=excluded.due, lapses=excluded.lapses, last_review=excluded.last_review,
                       added=COALESCE(cards.added, excluded.added)""",
                  (user_id, word_id, new["reps"], new["interval"], new["ease"], due.isoformat(),
                   new["lapses"], day.isoformat(), time.time()))
        _log(c, user_id, word_id, day, "srs", g, int(g > 0), is_new)
    return {"word_id": word_id, "interval": new["interval"], "due": due.isoformat(),
            "again": g == 0, "is_new": is_new}


def _log(c, user_id, word_id, day, kind, grade_, correct, is_new=False):
    c.execute("INSERT INTO reviews(user_id, word_id, ts, day, kind, grade, correct) VALUES (?,?,?,?,?,?,?)",
              (user_id, word_id, time.time(), day.isoformat(), kind, grade_, correct))
    c.execute("""INSERT INTO activity(user_id, day, reviews, correct, new_words) VALUES (?,?,1,?,?)
                 ON CONFLICT(user_id, day) DO UPDATE SET reviews=reviews+1,
                 correct=correct+excluded.correct, new_words=new_words+excluded.new_words""",
              (user_id, day.isoformat(), correct, int(is_new)))


def record_quiz(user_id: int, word_id: str, correct: bool, kind: str = "quiz"):
    user = get_user(user_id) or ensure_user(user_id)
    with _lock, conn() as c:
        _log(c, user_id, word_id, today(user), kind, None, int(correct))


def queue(user_id: int, limit: int = 50) -> dict:
    """Today's review queue: due cards first, then new words up to the daily limit."""
    user = get_user(user_id) or ensure_user(user_id)
    day = today(user).isoformat()
    with conn() as c:
        due_rows = c.execute("SELECT * FROM cards WHERE user_id=? AND due<=? ORDER BY due, last_review",
                             (user_id, day)).fetchall()
        known = {r["word_id"] for r in c.execute("SELECT word_id FROM cards WHERE user_id=?", (user_id,))}
        new_today = c.execute("SELECT COALESCE(new_words,0) FROM activity WHERE user_id=? AND day=?",
                              (user_id, day)).fetchone()
        done_today = c.execute("SELECT COALESCE(reviews,0) FROM activity WHERE user_id=? AND day=?",
                               (user_id, day)).fetchone()
    new_left = max(0, (user["new_per_day"] or 0) - (new_today[0] if new_today else 0))
    new_words = []
    if new_left:
        for w in vocab.filter_words(user["level"]):
            if w["id"] not in known:
                new_words.append(w)
                if len(new_words) >= new_left:
                    break
    due = []
    for r in due_rows:
        w = get_word(user_id, r["word_id"])
        if w:
            due.append((w, dict(r)))
    items = [{"word": w, "card": card, "is_new": card["reps"] == 0 and not card["last_review"]}
             for w, card in due[:limit]]
    for w in new_words[:max(0, limit - len(items))]:
        items.append({"word": w, "card": None, "is_new": True})
    return {"due": len(due), "new": len(new_words), "done_today": done_today[0] if done_today else 0,
            "items": items}

# ── Stats ──────────────────────────────────────────────────────────────────────
def streak(user_id: int, user: dict = None) -> dict:
    user = user or get_user(user_id) or ensure_user(user_id)
    with conn() as c:
        days = [date.fromisoformat(r[0]) for r in c.execute(
            "SELECT day FROM activity WHERE user_id=? AND reviews>0 ORDER BY day", (user_id,))]
    s = set(days)
    t = today(user)
    cur, d = 0, t if t in s else t - timedelta(days=1)
    while d in s:
        cur += 1
        d -= timedelta(days=1)
    best = run = 0
    prev = None
    for d in days:
        run = run + 1 if prev and d - prev == timedelta(days=1) else 1
        best, prev = max(best, run), d
    return {"current": cur, "best": max(best, cur), "studied_today": t in s}


def stats(user_id: int) -> dict:
    user = get_user(user_id) or ensure_user(user_id)
    t = today(user)
    with conn() as c:
        cards = [dict(r) for r in c.execute("SELECT word_id, interval, reps FROM cards WHERE user_id=?", (user_id,))]
        act = [dict(r) for r in c.execute(
            "SELECT day, reviews, correct FROM activity WHERE user_id=? AND day>=? ORDER BY day",
            (user_id, (t - timedelta(days=364)).isoformat()))]
        tot = c.execute("SELECT COALESCE(SUM(reviews),0), COALESCE(SUM(correct),0) FROM activity WHERE user_id=?",
                        (user_id,)).fetchone()
        missed = c.execute("""SELECT word_id, COUNT(*) n FROM reviews WHERE user_id=? AND correct=0
                              GROUP BY word_id ORDER BY n DESC, MAX(ts) DESC LIMIT 10""", (user_id,)).fetchall()
    per = {lv: {"level": lv, "total": len(vocab.filter_words(lv)), "learning": 0, "mastered": 0}
           for lv in vocab.LEVELS}
    for cd in cards:
        w = vocab.BY_ID.get(cd["word_id"])
        if not w or (cd["reps"] == 0 and cd["interval"] == 0):
            continue
        per[w["level"]]["mastered" if cd["interval"] >= MASTERED_DAYS else "learning"] += 1
    exam = user.get("exam_date")
    return {
        "streak": streak(user_id, user),
        "total_reviews": tot[0], "total_correct": tot[1],
        "accuracy": round(tot[1] / tot[0] * 100) if tot[0] else 0,
        "levels": list(per.values()),
        "heatmap": act,
        "exam_date": exam,
        "exam_days_left": (date.fromisoformat(exam) - t).days if exam else None,
        "most_missed": [
            {**{k: w[k] for k in ("id", "kanji", "reading", "english", "level")}, "count": m["n"]}
            for m in missed if (w := get_word(user_id, m["word_id"]))
        ],
        "today": t.isoformat(),
    }


def leaderboard(user_id: int, limit: int = 20) -> dict:
    since = (date.today() - timedelta(days=6)).isoformat()
    with conn() as c:
        rows = c.execute("""SELECT u.user_id, u.public_name, COALESCE(SUM(a.reviews),0) week
                            FROM users u LEFT JOIN activity a ON a.user_id=u.user_id AND a.day>=?
                            WHERE u.public_name IS NOT NULL OR u.user_id=?
                            GROUP BY u.user_id ORDER BY week DESC""", (since, user_id)).fetchall()
    board, me = [], None
    for i, r in enumerate(rows, 1):
        entry = {"rank": i, "name": r["public_name"] or "You (hidden)", "week": r["week"],
                 "streak": streak(r["user_id"])["current"], "me": r["user_id"] == user_id,
                 "public": r["public_name"] is not None}
        if entry["me"]:
            me = entry
        if entry["public"] and len(board) < limit:
            board.append(entry)
    return {"board": board, "me": me}


def wrong_counts(user_id: int) -> dict:
    with conn() as c:
        return {r[0]: r[1] for r in c.execute(
            "SELECT word_id, COUNT(*) FROM reviews WHERE user_id=? AND correct=0 GROUP BY word_id", (user_id,))}
