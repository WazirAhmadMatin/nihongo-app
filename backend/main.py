"""
Nihongo Mini App — FastAPI Backend
Run: uvicorn main:app --reload --port 8000

Vocabulary comes from data/jlpt_vocab.sqlite (JLPT N5–N1, 9,205 words).
The database is read once at startup and kept in memory; it is read-only.
"""
import os, random, re, sqlite3
from collections import defaultdict
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────────
_BASE   = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("VOCAB_DB", os.path.join(_BASE, "data", "jlpt_vocab.sqlite"))
LEVELS  = ["N5", "N4", "N3", "N2", "N1"]

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Nihongo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ─────────────────────────────────────────────────────────────────────
class QuizStartRequest(BaseModel):
    user_id: int
    level: Optional[str] = None
    topic: Optional[int] = None
    total: int = 10

class AnswerRequest(BaseModel):
    user_id: int
    answer: str

class ResetRequest(BaseModel):
    user_id: int

# ── Data ───────────────────────────────────────────────────────────────────────
def _int(v):
    return int(v) if v not in (None, "") else None

def _split(v):
    return [p for p in (v or "").split(";") if p]

def _load_db() -> list[dict]:
    if not os.path.exists(DB_PATH):
        return []
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT * FROM vocab").fetchall()
    con.close()
    words = []
    for r in rows:
        d = dict(r)
        words.append({
            "id":             d["id"],
            "level":          d["level"],
            "kanji":          d["word"],               # kept as "kanji" for the frontend
            # kana-only words: no separate reading to show
            "reading":        "" if (d["reading"] or "") == d["word"] else (d["reading"] or ""),
            "romaji":         d["romaji"] or "",
            "english":        d["meaning"] or "",
            "hint":           d["hint"] or "",
            "pos":            ", ".join(_split(d["pos"])),
            "pos_list":       _split(d["pos"]),
            "verb_group":     _int(d["verb_group"]),
            "transitivity":   d["transitivity"] or "",
            "suru_verb":      bool(d["suru_verb"]),
            "topic_no":       _int(d["topic_no"]),
            "topic_ja":       d["topic_ja"] or "",
            "topic_en":       d["topic_en"] or "",
            "example_jp":     d["example_ja"] or "",
            "example_en":     d["example_en"] or "",
            "example_target": d["example_target"] or "",
            "also_in":        _split(d["also_in"]),
            "book_entry":     _int(d["book_entry"]),
        })
    order = {lv: i for i, lv in enumerate(LEVELS)}
    words.sort(key=lambda w: (order.get(w["level"], 99), w["id"]))
    return words

WORDS: list[dict]       = _load_db()
BY_ID: dict[str, dict]  = {w["id"]: w for w in WORDS}
sessions: dict          = {}

def filter_words(level: Optional[str] = None, topic: Optional[int] = None) -> list[dict]:
    out = WORDS
    if level:
        out = [w for w in out if w["level"] == level.upper()]
    if topic is not None:
        out = [w for w in out if w["topic_no"] == topic]
    return out

# ── Quiz helpers ───────────────────────────────────────────────────────────────
def get_session(uid: int) -> dict:
    return sessions.setdefault(uid, {
        "score": 0, "total": 0, "streak": 0, "best_streak": 0,
        "seen": [], "word": None, "answer": None, "wrong": defaultdict(int),
        "level": None, "topic": None, "quiz_total": 0, "quiz_done": 0,
        "quiz_correct": 0, "in_quiz": False,
    })

def pick_word(uid: int, words: list[dict]) -> dict:
    """Prefer words not seen recently; words answered wrong come up more often."""
    s      = get_session(uid)
    unseen = [w for w in words if w["id"] not in s["seen"]]
    pool   = unseen or words
    weights = [min(1 + 2 * s["wrong"].get(w["id"], 0), 5) for w in pool]
    word = random.choices(pool, weights=weights, k=1)[0]
    s["seen"].append(word["id"])
    if len(s["seen"]) > max(50, len(words) // 2):
        s["seen"].pop(0)
    return word

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()

def make_choices(word: dict, n: int = 4) -> list[str]:
    """Distractors from the same level, preferring the same part of speech,
    so the right answer can't be guessed from its form."""
    correct = word["english"]
    same_lv = [w for w in WORDS if w["level"] == word["level"] and w["id"] != word["id"]]
    same_pos = [w for w in same_lv if set(w["pos_list"]) & set(word["pos_list"])]
    choices, used = [], {norm(correct)}
    for pool in (same_pos, same_lv, WORDS):
        random.shuffle(pool := list(pool))
        for w in pool:
            if len(choices) >= n - 1:
                break
            key = norm(w["english"])
            if key and key not in used:
                used.add(key)
                choices.append(w["english"])
        if len(choices) >= n - 1:
            break
    choices.append(correct)
    random.shuffle(choices)
    return choices

def card_payload(word: dict) -> dict:
    """What the card shows before answering. The English translation of the
    example is held back until after the answer so it can't give it away."""
    return {
        "id":             word["id"],
        "kanji":          word["kanji"],
        "reading":        word["reading"],
        "romaji":         word["romaji"],
        "level":          word["level"],
        "pos":            word["pos"],
        "topic_en":       word["topic_en"],
        "topic_ja":       word["topic_ja"],
        "example_jp":     word["example_jp"],
        "example_target": word["example_target"],
    }

def next_card(uid: int) -> dict:
    s     = get_session(uid)
    words = filter_words(s["level"], s["topic"])
    word  = pick_word(uid, words)
    s["word"], s["answer"] = word, word["english"]
    return {
        "card_number": s["quiz_done"] + 1,
        "quiz_total":  s["quiz_total"],
        **card_payload(word),
        "choices":     make_choices(word),
    }

# ── Endpoints ──────────────────────────────────────────────────────────────────
def word_list_item(w: dict) -> dict:
    keys = ("id", "kanji", "reading", "romaji", "english", "hint", "level", "pos",
            "topic_no", "topic_ja", "topic_en", "example_jp", "example_en", "example_target")
    return {k: w[k] for k in keys}

@app.get("/words")
def get_words(level: Optional[str] = None, topic: Optional[int] = None,
              search: Optional[str] = None, limit: int = 100, offset: int = 0):
    words = filter_words(level, topic)
    if search:
        q = search.strip().lower()
        words = [w for w in words
                 if q in w["kanji"] or q in w["reading"] or q in w["romaji"].lower()
                 or q in w["english"].lower()]
    limit = max(1, min(limit, 500))
    return {
        "words":  [word_list_item(w) for w in words[offset:offset + limit]],
        "total":  len(words),
        "offset": offset,
    }

@app.get("/words/{word_id}")
def get_word(word_id: str):
    w = BY_ID.get(word_id)
    if not w:
        raise HTTPException(404, "Word not found.")
    return {k: v for k, v in w.items() if k != "pos_list"}

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

@app.post("/quiz/start")
def quiz_start(req: QuizStartRequest):
    s = get_session(req.user_id)
    if s["in_quiz"]:
        # Starting again simply replaces an unfinished quiz.
        s["in_quiz"] = False
    if not filter_words(req.level, req.topic):
        raise HTTPException(404, "No words found for this selection.")
    s.update({
        "level": req.level, "topic": req.topic, "quiz_total": max(1, req.total),
        "quiz_done": 0, "quiz_correct": 0, "in_quiz": True,
    })
    return next_card(req.user_id)

@app.post("/quiz/answer")
def quiz_answer(req: AnswerRequest):
    s = get_session(req.user_id)
    if not s["in_quiz"] or not s["word"]:
        raise HTTPException(400, "No active quiz.")
    word       = s["word"]
    is_correct = norm(req.answer) == norm(s["answer"])
    s["total"] += 1
    if is_correct:
        s["score"]        += 1
        s["quiz_correct"] += 1
        s["streak"]       += 1
        s["best_streak"]   = max(s["best_streak"], s["streak"])
    else:
        s["streak"] = 0
        s["wrong"][word["id"]] += 1
    s["quiz_done"] += 1
    finished = s["quiz_done"] >= s["quiz_total"]
    result = {
        "correct":      is_correct,
        "answer":       word["english"],
        "reading":      word["reading"],
        "romaji":       word["romaji"],
        "hint":         word["hint"],
        "example_en":   word["example_en"],
        "streak":       s["streak"],
        "quiz_done":    s["quiz_done"],
        "quiz_total":   s["quiz_total"],
        "quiz_correct": s["quiz_correct"],
        "finished":     finished,
    }
    if finished:
        s["in_quiz"], s["word"] = False, None
        result["summary"] = {
            "correct": s["quiz_correct"],
            "total":   s["quiz_total"],
            "pct":     round(s["quiz_correct"] / s["quiz_total"] * 100),
        }
    else:
        result["next_card"] = next_card(req.user_id)
    return result

@app.post("/quiz/stop")
def quiz_stop(req: ResetRequest):
    s       = get_session(req.user_id)
    summary = {
        "correct": s["quiz_correct"],
        "total":   s["quiz_done"],
        "pct":     round(s["quiz_correct"] / s["quiz_done"] * 100) if s["quiz_done"] else 0,
    }
    s.update({"in_quiz": False, "word": None, "quiz_total": 0, "quiz_done": 0, "quiz_correct": 0})
    return {"stopped": True, "summary": summary}

@app.get("/score/{user_id}")
def get_score(user_id: int):
    s           = get_session(user_id)
    pct         = round(s["score"] / s["total"] * 100) if s["total"] else 0
    wrong_words = sorted(s["wrong"].items(), key=lambda x: -x[1])[:10]
    return {
        "score":       s["score"],
        "total":       s["total"],
        "pct":         pct,
        "streak":      s["streak"],
        "best_streak": s["best_streak"],
        "wrong_words": [
            {"id": wid, "kanji": BY_ID[wid]["kanji"], "reading": BY_ID[wid]["reading"],
             "english": BY_ID[wid]["english"], "level": BY_ID[wid]["level"], "count": n}
            for wid, n in wrong_words if wid in BY_ID
        ],
    }

@app.post("/reset")
def reset(req: ResetRequest):
    sessions.pop(req.user_id, None)
    return {"reset": True}

@app.get("/health")
def health():
    return {"status": "ok", "words_loaded": len(WORDS), "database": os.path.basename(DB_PATH)}
