"""
Nihongo Mini App — FastAPI Backend
Run: uvicorn main:app --reload --port 8000
"""
import csv, os, random, re, time
from collections import defaultdict
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────────
_BASE       = os.path.dirname(os.path.abspath(__file__))
CSV_PATH    = os.path.join(_BASE, "jlpt_vocabulary_enriched.csv")
COL_KANJI   = "kanji_final"
COL_ROMAJI  = "romaji_final"
COL_ENGLISH = "english_ai"

# ── In-memory state ────────────────────────────────────────────────────────────
_word_cache: list  = []
_cache_time: float = 0.0
CACHE_TTL          = 300
sessions: dict     = {}

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
    total: int = 10

class AnswerRequest(BaseModel):
    user_id: int
    answer: str

class ResetRequest(BaseModel):
    user_id: int

# ── Data helpers ───────────────────────────────────────────────────────────────
def load_words() -> list[dict]:
    global _word_cache, _cache_time
    if _word_cache and (time.time() - _cache_time) < CACHE_TTL:
        return _word_cache
    words = []
    try:
        with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                kanji     = row.get(COL_KANJI,   "").strip()
                romaji    = row.get(COL_ROMAJI,  "").strip()
                english   = row.get(COL_ENGLISH, "").strip()
                raw_level = row.get("level", "").strip().upper()
                if raw_level == "0":
                    raw_level = "EXTRA"

                kanji = kanji.strip('"\'`+ ')
                kanji = kanji.split("\n")[0].strip()
                kanji = re.sub(r"[①②③④⑤⑥⑦⑧⑨⑩]", "", kanji)
                kanji = re.sub(r"\[[^\]]*\]", "", kanji)
                kanji = re.sub(r"\s*[\u2013\u2014-]\s*[a-zA-Z\u0100-\u024f~\s]+$", "", kanji)
                if romaji:
                    rom = romaji.strip().split()[0]
                    pat = rf"\s*[\u2013\-~]?\s*{re.escape(rom)}[\w\-~]*$"
                    kanji = re.sub(pat, "", kanji, flags=re.IGNORECASE)
                    kanji = re.sub(pat, "", kanji, flags=re.IGNORECASE)
                kanji = re.sub(r"\s+[a-zA-Z\u0100-\u024f]{2,}[\w\s~\-]*$", "", kanji)
                kanji = re.sub(r"(?<=[぀-鿿゠-ヿ一-鿿])[a-zA-Z\u0100-\u024f]+[\w~\-]*$", "", kanji)
                kanji = re.sub(r"[（(][a-zA-Z\u0100-\u024f\s\[\]~〜_\-]+[）)]", "", kanji)
                kanji = re.sub(r"^\d+,\s*", "", kanji)
                if " – " in kanji:
                    kanji = kanji.split(" – ")[0]
                kanji = re.sub(r"[~～][a-zA-Z]+$", "", kanji)
                kanji = re.sub(r"  +", " ", kanji).strip().rstrip("、。,. \u2013\u2014-")

                jp_chars    = sum(1 for c in kanji if "\u3040" <= c <= "\u9fff" or "\uf900" <= c <= "\ufaff")
                GARBAGE     = set("丁卋朝會化日晥芬零求常")
                garbage     = sum(1 for c in kanji if c in GARBAGE)
                ascii_ratio = sum(1 for c in kanji if ord(c) < 128) / max(len(kanji), 1)

                bad_row = (
                    not kanji
                    or not english
                    or jp_chars == 0
                    or garbage >= 2
                    or (garbage >= 1 and jp_chars <= 1)
                    or len(kanji) > 50
                    or (ascii_ratio > 0.75 and jp_chars < 3)
                )

                if not bad_row:
                    rc = dict(row)
                    rc["_level_clean"] = raw_level
                    words.append({"kanji": kanji, "romaji": romaji, "english": english, "_raw": rc})

        _word_cache = words
        _cache_time = time.time()
    except FileNotFoundError:
        pass
    return _word_cache

def words_for_level(level: Optional[str]) -> list[dict]:
    all_w = load_words()
    if not level:
        return all_w
    return [w for w in all_w if w["_raw"]["_level_clean"] == level.upper()]

def get_session(uid: int) -> dict:
    return sessions.setdefault(uid, {
        "score": 0, "total": 0, "streak": 0, "best_streak": 0,
        "seen": [], "word": None, "wrong": defaultdict(int),
        "level": None, "quiz_total": 0, "quiz_done": 0,
        "quiz_correct": 0, "in_quiz": False,
    })

def pick_word(uid: int, words: list[dict]) -> dict:
    s      = get_session(uid)
    unseen = [w for w in words if w["kanji"] not in s["seen"]]
    pool   = unseen if unseen else words
    weighted = []
    for w in pool:
        weight = 1 + 2 * s["wrong"].get(w["kanji"], 0)
        weighted.extend([w] * min(weight, 5))
    word = random.choice(weighted)
    s["seen"].append(word["kanji"])
    if len(s["seen"]) > 50:
        s["seen"].pop(0)
    return word

def clean_answer(s: str) -> str:
    return re.sub(r"\(.*?\)", "", s).strip().lower()

def check_answer(user_answer: str, word: dict) -> bool:
    def norm(s):
        s = clean_answer(s)
        return re.sub(r"^(a|an|the)\s+", "", s)
    user     = norm(user_answer)
    variants = [norm(v) for v in word["english"].split("/")]
    variants.append(word["romaji"].lower().strip())
    return user in variants

def make_choices(correct_word: dict, all_words: list[dict], n_choices: int = 4) -> list[str]:
    correct_english = clean_answer(correct_word["english"].split("/")[0])
    pool = [
        clean_answer(w["english"].split("/")[0])
        for w in all_words
        if w["kanji"] != correct_word["kanji"]
    ]
    pool        = list({e for e in pool if e and e != correct_english})
    distractors = random.sample(pool, min(n_choices - 1, len(pool)))
    choices     = distractors + [correct_english]
    random.shuffle(choices)
    return choices

def card_payload(word: dict) -> dict:
    raw = word["_raw"]
    return {
        "kanji":      word["kanji"],
        "romaji":     word["romaji"],
        "level":      raw["_level_clean"],
        "pos":        raw.get("pos", ""),
        "example_jp": raw.get("example_jp", ""),
        "example_en": raw.get("example_en", ""),
    }

# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/words")
def get_words(level: Optional[str] = None, search: Optional[str] = None, limit: int = 100):
    words = words_for_level(level)
    if search:
        q     = search.lower()
        words = [w for w in words if q in w["kanji"] or q in w["romaji"].lower() or q in w["english"].lower()]
    return {
        "words": [
            {
                "kanji":   w["kanji"],
                "romaji":  w["romaji"],
                "english": w["english"],
                "level":   w["_raw"]["_level_clean"],
                "pos":     w["_raw"].get("pos", ""),
            }
            for w in words[:limit]
        ],
        "total": len(words),
    }

@app.get("/levels")
def get_levels():
    all_w  = load_words()
    counts = defaultdict(int)
    for w in all_w:
        counts[w["_raw"]["_level_clean"]] += 1
    return {"levels": [{"level": k, "count": v} for k, v in sorted(counts.items())]}

@app.post("/quiz/start")
def quiz_start(req: QuizStartRequest):
    s = get_session(req.user_id)
    if s["in_quiz"]:
        raise HTTPException(400, "Quiz already in progress. Stop it first.")
    words = words_for_level(req.level)
    if not words:
        raise HTTPException(404, "No words found for this level.")
    s.update({
        "level": req.level, "quiz_total": req.total, "quiz_done": 0,
        "quiz_correct": 0, "in_quiz": True, "word": None,
    })
    word      = pick_word(req.user_id, words)
    s["word"] = word
    return {
        "card_number": 1,
        "quiz_total":  req.total,
        **card_payload(word),
        "choices":     make_choices(word, words),
    }

@app.post("/quiz/answer")
def quiz_answer(req: AnswerRequest):
    s = get_session(req.user_id)
    if not s["in_quiz"] or not s["word"]:
        raise HTTPException(400, "No active quiz.")
    word       = s["word"]
    is_correct = check_answer(req.answer, word)
    s["total"] += 1
    if is_correct:
        s["score"]        += 1
        s["quiz_correct"] += 1
        s["streak"]        = s.get("streak", 0) + 1
        if s["streak"] > s.get("best_streak", 0):
            s["best_streak"] = s["streak"]
    else:
        s["streak"] = 0
        s["wrong"][word["kanji"]] = s["wrong"].get(word["kanji"], 0) + 1
    s["quiz_done"] += 1
    finished = s["quiz_done"] >= s["quiz_total"]
    result = {
        "correct":      is_correct,
        "answer":       clean_answer(word["english"].split("/")[0]),
        "romaji":       word["romaji"],
        "streak":       s["streak"],
        "quiz_done":    s["quiz_done"],
        "quiz_total":   s["quiz_total"],
        "quiz_correct": s["quiz_correct"],
        "finished":     finished,
    }
    if finished:
        s["in_quiz"] = False
        s["word"]    = None
        result["summary"] = {
            "correct": s["quiz_correct"],
            "total":   s["quiz_total"],
            "pct":     round(s["quiz_correct"] / s["quiz_total"] * 100),
        }
    else:
        words          = words_for_level(s["level"])
        next_word      = pick_word(req.user_id, words)
        s["word"]      = next_word
        result["next_card"] = {
            "card_number": s["quiz_done"] + 1,
            "quiz_total":  s["quiz_total"],
            **card_payload(next_word),
            "choices":     make_choices(next_word, words),
        }
    return result

@app.post("/quiz/stop")
def quiz_stop(req: ResetRequest):
    s       = get_session(req.user_id)
    summary = {
        "correct": s["quiz_correct"],
        "total":   s["quiz_total"],
        "pct":     round(s["quiz_correct"] / s["quiz_total"] * 100) if s["quiz_total"] else 0,
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
        "best_streak": s.get("best_streak", 0),
        "wrong_words": [{"kanji": k, "count": v} for k, v in wrong_words],
    }

@app.post("/reset")
def reset(req: ResetRequest):
    sessions.pop(req.user_id, None)
    return {"reset": True}

@app.get("/health")
def health():
    words = load_words()
    return {"status": "ok", "words_loaded": len(words)}