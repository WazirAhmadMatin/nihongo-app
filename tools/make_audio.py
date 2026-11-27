"""
Generate pronunciation audio for the vocabulary with VOICEVOX (free, offline).

1. Open the VOICEVOX app (it starts the engine on http://127.0.0.1:50021)
2. Install ffmpeg (for mp3 conversion)
3. Run, from the repo root:

       python tools/make_audio.py --level N4              # words only
       python tools/make_audio.py --level N4 --examples   # + example sentences
       python tools/make_audio.py --speaker 2             # another voice (see --list)

Files go to backend/data/audio/<id>.mp3 and <id>_ex.mp3. Existing files are
skipped, so you can stop and resume. Restart the API afterwards; it picks up
whatever audio exists. Without audio files the app falls back to the browser's
built-in Japanese voice.

Credit the voice as VOICEVOX requires, e.g. "VOICEVOX:四国めたん" in the app's about text.
"""
import argparse, json, os, sqlite3, subprocess, sys, tempfile, urllib.parse, urllib.request

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB      = os.path.join(ROOT, "backend", "data", "jlpt_vocab.sqlite")
OUT     = os.path.join(ROOT, "backend", "data", "audio")
ENGINE  = os.environ.get("VOICEVOX_URL", "http://127.0.0.1:50021")


def call(path, params=None, body=None, method="POST"):
    url = f"{ENGINE}{path}" + ("?" + urllib.parse.urlencode(params) if params else "")
    data = None if method == "GET" else json.dumps(body).encode() if body is not None else b""
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def synth(text: str, speaker: int, speed: float) -> bytes:
    query = json.loads(call("/audio_query", {"text": text, "speaker": speaker}))
    query["speedScale"] = speed
    return call("/synthesis", {"speaker": speaker}, query)


def to_mp3(wav: bytes, path: str):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav)
        tmp = f.name
    try:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ac", "1",
                        "-b:a", "48k", path], check=True)
    finally:
        os.remove(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", help="N5…N1 (default: all)")
    ap.add_argument("--examples", action="store_true", help="also the example sentences")
    ap.add_argument("--speaker", type=int, default=3, help="VOICEVOX speaker id (default 3)")
    ap.add_argument("--speed", type=float, default=0.95)
    ap.add_argument("--list", action="store_true", help="list speakers and exit")
    a = ap.parse_args()

    try:
        speakers = json.loads(call("/speakers", method="GET"))
    except Exception:
        sys.exit(f"Can't reach VOICEVOX at {ENGINE}. Open the VOICEVOX app first.")
    if a.list:
        for s in speakers:
            for st in s["styles"]:
                print(f"{st['id']:>3}  {s['name']} ({st['name']})")
        return

    os.makedirs(OUT, exist_ok=True)
    con = sqlite3.connect(DB)
    sql = "SELECT id, word, reading, example_ja FROM vocab" + (" WHERE level=?" if a.level else "")
    rows = con.execute(sql, (a.level.upper(),) if a.level else ()).fetchall()
    jobs = []
    for wid, word, reading, ex in rows:
        jobs.append((f"{wid}.mp3", reading or word.strip("〜~()（）")))
        if a.examples and ex:
            jobs.append((f"{wid}_ex.mp3", ex))
    todo = [(f, t) for f, t in jobs if not os.path.exists(os.path.join(OUT, f))]
    print(f"{len(jobs)} files, {len(todo)} to make → {OUT}")
    for i, (fname, text) in enumerate(todo, 1):
        try:
            to_mp3(synth(text, a.speaker, a.speed), os.path.join(OUT, fname))
        except Exception as e:
            print(f"  ! {fname}: {e}")
        if i % 50 == 0 or i == len(todo):
            print(f"  {i}/{len(todo)}")


if __name__ == "__main__":
    main()
