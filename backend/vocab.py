"""
Read-only JLPT vocabulary (N5–N1), shared by the API and the bot.
Source: data/jlpt_vocab.sqlite (table `vocab`).
"""
import os, re, sqlite3
from typing import Optional

_BASE     = os.path.dirname(os.path.abspath(__file__))
DB_PATH   = os.environ.get("VOCAB_DB", os.path.join(_BASE, "data", "jlpt_vocab.sqlite"))
LEVELS    = ["N5", "N4", "N3", "N2", "N1"]

_KANJI_RE = re.compile(r"[一-鿿々]")


def _int(v):
    return int(v) if v not in (None, "") else None


def _split(v):
    return [p for p in (v or "").split(";") if p]


def _load() -> list[dict]:
    if not os.path.exists(DB_PATH):
        return []
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT * FROM vocab").fetchall()
    con.close()
    words = []
    for r in rows:
        d = dict(r)
        reading = d["reading"] or ""
        if reading == d["word"]:
            reading = ""
        words.append({
            "id":             d["id"],
            "level":          d["level"],
            "kanji":          d["word"],
            "reading":        reading,
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
            "has_kanji":      bool(_KANJI_RE.search(d["word"] or "")),
            "custom":         False,
        })
    order = {lv: i for i, lv in enumerate(LEVELS)}
    words.sort(key=lambda w: (order.get(w["level"], 99), w["id"]))
    return words


WORDS: list[dict]      = _load()
BY_ID: dict[str, dict] = {w["id"]: w for w in WORDS}


def filter_words(level: Optional[str] = None, topic: Optional[int] = None) -> list[dict]:
    out = WORDS
    if level:
        out = [w for w in out if w["level"] == level.upper()]
    if topic is not None:
        out = [w for w in out if w["topic_no"] == topic]
    return out


def search(q: str, level: Optional[str] = None, limit: int = 0) -> list[dict]:
    """Exact matches first, then prefix, then substring matches."""
    q = (q or "").strip().lower()
    if not q:
        return []
    exact, prefix, part = [], [], []
    for w in filter_words(level):
        fields = [w["kanji"], w["reading"], w["romaji"].lower()]
        meanings = [m.strip() for m in re.split(r"[,/;]", w["english"].lower())]
        if q in fields or q in meanings:
            exact.append(w)
        elif any(f.startswith(q) for f in fields if f) or any(m.startswith(q) for m in meanings):
            prefix.append(w)
        elif q in w["kanji"] or q in w["reading"] or q in w["english"].lower():
            part.append(w)
    out = exact + prefix + part
    return out[:limit] if limit else out


def public(w: dict) -> dict:
    """Word as sent to clients."""
    return {k: v for k, v in w.items() if k != "pos_list"}
