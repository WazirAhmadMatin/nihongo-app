"""Question building shared by the API quiz and the bot's quiz polls."""
import random, re

from vocab import WORDS, LEVELS, filter_words


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def mode_pool(words: list[dict], mode: str) -> list[dict]:
    if mode == "reading":
        return [w for w in words if w["has_kanji"] and w["reading"]]
    if mode == "cloze":
        return [w for w in words if w["example_jp"] and w["example_target"]
                and w["example_target"] in w["example_jp"]]
    return [w for w in words if w["english"]]


def answer_of(w: dict, mode: str) -> str:
    return {"meaning": w["english"], "reverse": w["kanji"],
            "reading": w["reading"], "cloze": w["example_target"]}[mode]


def make_choices(word: dict, mode: str, n: int = 4) -> list[str]:
    """Distractors from the same level, preferring the same part of speech
    (and for readings, a similar length), so the answer can't be guessed from its form."""
    correct = answer_of(word, mode)
    level = word["level"] if word["level"] in LEVELS else "N4"
    same_lv = mode_pool([w for w in filter_words(level) if w["id"] != word["id"]], mode)
    same_pos = [w for w in same_lv if set(w["pos_list"]) & set(word["pos_list"])]
    pools = [same_pos, same_lv, mode_pool(WORDS, mode)]
    if mode == "cloze":
        # match inflected vs dictionary form, so the odd one out isn't the answer
        inflected = word["example_target"] != word["kanji"].strip("〜~")
        pools.insert(0, [w for w in same_pos if (w["example_target"] != w["kanji"].strip("〜~")) == inflected])
    if mode == "reading":
        n_chars = len(correct)
        pools.insert(0, [w for w in same_lv if abs(len(w["reading"]) - n_chars) <= 1
                         and set(w["reading"]) & set(correct)])
    choices, used = [], {norm(correct)}
    for pool in pools:
        pool = list(pool)
        random.shuffle(pool)
        for w in pool:
            if len(choices) >= n - 1:
                break
            key = norm(answer_of(w, mode))
            if key and key not in used:
                used.add(key)
                choices.append(answer_of(w, mode))
        if len(choices) >= n - 1:
            break
    choices.append(correct)
    random.shuffle(choices)
    return choices
