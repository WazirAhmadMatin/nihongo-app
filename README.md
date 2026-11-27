# 日本語 — Nihongo

A Telegram bot + Mini App for learning JLPT vocabulary (N5–N1, 9,205 words).

**In the app**
- **Daily reviews (spaced repetition).** New words every day; words you know come back after days or weeks, words you miss come back tomorrow.
- **5 quiz types:** Meaning · Reverse (English → Japanese) · Reading (kanji → hiragana, like the JLPT) · Fill-in-the-blank · Listening.
- **Word list** with search, levels, the book's topics, example sentences, audio, and "add to reviews".
- **Stats:** streak, study calendar, progress per level, most-missed words, exam countdown, weekly leaderboard.
- **Settings and personal words ("My words").**

**In the chat (bot)**
- **Word of the day** at your chosen time, and an evening reminder when reviews are waiting or your streak is at risk.
- **`/quiz`:** quiz polls right in the chat.
- **Dictionary:** send `財布`, `さいふ`, `saifu` or `wallet` to look it up, then tap ➕ to add it to your reviews.
- **Other commands:** `/add`, `/mywords`, `/today`, `/stats`, `/leaderboard`, `/settings`.

```
nihongo-app/
├── backend/
│   ├── main.py          ← FastAPI REST API (and the bot, with RUN_BOT=1)
│   ├── bot.py           ← Telegram bot
│   ├── vocab.py         ← reads the vocabulary database
│   ├── userdb.py        ← user progress, spaced repetition, stats
│   ├── quizlib.py       ← quiz questions and wrong answers
│   ├── auth.py          ← verifies Telegram Mini App logins
│   ├── start.sh         ← runs API + bot together
│   └── data/
│       ├── jlpt_vocab.sqlite   ← vocabulary (read-only)
│       ├── users.sqlite        ← created automatically: everyone's progress
│       └── audio/              ← optional VOICEVOX mp3s (tools/make_audio.py)
├── frontend/            ← React (Vite) Mini App
└── tools/make_audio.py  ← generate pronunciation audio with VOICEVOX
```

---

## 1. Run locally

**Backend**

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # fill in BOT_TOKEN and WEBAPP_URL
./start.sh                    # API on :8000 + bot
```

To try the API without Telegram, run `DEV_MODE=1 uvicorn main:app --reload` and open `http://localhost:8000/docs`.

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
```

In a normal browser (outside Telegram), the backend must run with `DEV_MODE=1`. You are then logged in as test user 999999.

---

## 2. Deploy

Telegram requires **HTTPS** for both the frontend and the API.

### Backend (Railway / Render / Fly.io / a VPS)
- **Start command:** `sh start.sh`. This runs the API and the bot in **one** process, so they share the same `users.sqlite`.
- **Environment variables:** `BOT_TOKEN`, `WEBAPP_URL`, and optionally `CORS_ORIGINS` (your frontend URL).
- **Persistent storage:** user progress is saved in a SQLite file, so give the service a **persistent volume** and set `USER_DB=/data/users.sqlite` (the path on the volume). Without a volume, progress is lost on every redeploy.
- **Never set `DEV_MODE=1` in production.**
- **Run only one copy of the bot.** If you used to run `python bot.py` separately, stop that copy; two copies of one bot conflict.

### Frontend (Vercel)
```bash
cd frontend
npm run build
npx vercel --prod
```
Set `VITE_API_URL` to your API's URL.

### BotFather
1. `/mybots` → your bot → **Bot Settings → Menu Button** → set it to your frontend URL.
2. The bot registers its command list by itself when it starts.

---

## 3. Pronunciation audio (optional)

Without audio files the app uses the phone's built-in Japanese voice. For better audio, generate it with [VOICEVOX](https://voicevox.hiroshiba.jp/) on your PC:

```bash
# open the VOICEVOX app first; ffmpeg must be installed
python tools/make_audio.py --level N4 --examples
python tools/make_audio.py --list            # choose a voice with --speaker
```

The files go to `backend/data/audio/`. Copy them to the server, then restart the API. When you use VOICEVOX audio, credit the voice (e.g. `VOICEVOX:ずんだもん`) as its terms require.

---

## 4. API

All endpoints except `/health`, `/levels` and `/topics` need the `X-Telegram-Init-Data` header. The frontend sends it automatically.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Status and word count |
| GET | `/levels` | Words per level |
| GET | `/topics?level=N4` | The book's topics for a level |
| GET | `/words?level=N4&topic=3&search=saifu&limit=50&offset=0` | Paged word list (`level=MY` = personal words) |
| GET | `/words/{id}` | One word |
| GET | `/me` | Settings, today's counts, streak |
| PUT | `/me/settings` | `{level, new_per_day, word_time, reminder_time, notify, public_name, exam_date, tz}` |
| GET | `/review/queue` | Today's cards (due first, then new) |
| POST | `/review/grade` | `{word_id, grade}`, where grade 0 = Again, 1 = Hard, 2 = Good, 3 = Easy |
| POST | `/review/add` | `{word_id}`: put a word in the reviews |
| GET/POST/DELETE | `/mywords` | Personal words |
| POST | `/quiz/start` | `{level, topic?, total, mode, missed_only}`; mode is one of meaning, reverse, reading, cloze, listening |
| POST | `/quiz/answer` | `{answer}` |
| POST | `/quiz/stop` | Stop the current quiz |
| GET | `/stats` | Streak, calendar, per-level progress, most missed, exam countdown |
| GET | `/leaderboard` | This week's ranking (only users who chose a display name) |
| POST | `/reset` | Delete your progress |

---

## 5. Data

`backend/data/jlpt_vocab.sqlite` (table `vocab`) holds 9,205 words: N5 1,011 · N4 1,155 · N3 2,113 · N2 2,357 · N1 2,569. They are grouped by the topics of the *ミニストーリーで覚える JLPT ベスト単語* books. N4 has original example sentences; the example columns are still empty for the other levels.

| Column | Description |
|--------|-------------|
| `id` | Stable ID, e.g. `N4-0322` |
| `level` | N5 … N1 |
| `word`, `reading`, `romaji` | Word, kana reading, romanization |
| `meaning`, `hint` | English meaning, and a short hint that tells similar words apart |
| `pos` | Part(s) of speech, separated by `;` |
| `topic_no`, `topic_ja`, `topic_en` | The book's topic |
| `example_ja`, `example_en`, `example_target` | Example sentence, its translation, and the word as it appears in the sentence |

To update the words, replace the file and restart the API. The old `jlpt_vocabulary_enriched.csv`, `image_mapping.csv` and `word_images/` are no longer used.
