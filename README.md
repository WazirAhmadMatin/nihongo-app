# 日本語 — Nihongo Mini App

A polished Telegram Mini App for JLPT vocabulary practice.

```
nihongo-app/
├── backend/
│   ├── main.py                      ← FastAPI REST API
│   ├── bot.py                       ← Telegram bot (Mini App launcher)
│   ├── requirements.txt
│   └── data/jlpt_vocab.sqlite       ← vocabulary database (N5–N1)
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── api.js
    │   ├── hooks/useTelegram.js
    │   └── tabs/
    │       ├── QuizTab.jsx
    │       ├── ScoreTab.jsx
    │       └── WordsTab.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the API
uvicorn main:app --reload --port 8000
```

Test it:
```
GET http://localhost:8000/health
GET http://localhost:8000/words?level=N4&limit=10
```

---

## 2. Frontend Setup

```bash
cd frontend

npm install

# Configure API URL
cp .env.example .env
# Edit .env → set VITE_API_URL=https://your-api-domain.com

npm run dev       # dev server on http://localhost:5173
npm run build     # production build → dist/
```

---

## 3. Deployment

### Backend → any Python host (Railway, Render, Fly.io)

```bash
# Railway example
railway init
railway up
# Note the deployed URL, e.g. https://nihongo-api.up.railway.app
```

Set env var: `PORT=8000`

Make sure CORS in `main.py` allows your frontend domain:
```python
allow_origins=["https://your-frontend.vercel.app"]
```

### Frontend → Vercel (recommended)

```bash
cd frontend
npm run build
npx vercel --prod
# Deployed to https://nihongo-xxx.vercel.app
```

Set env var in Vercel:
```
VITE_API_URL = https://nihongo-api.up.railway.app
```

---

## 4. Telegram Bot Setup

```bash
cd backend
```

Create `.env`:
```
BOT_TOKEN=your_bot_token_from_botfather
WEBAPP_URL=https://nihongo-xxx.vercel.app
```

Run the bot:
```bash
python bot.py
```

### BotFather commands

1. `/newbot` — create your bot if you haven't
2. `/mybots` → your bot → **Menu Button** → set URL to your frontend URL
3. `/setmenubutton` → set the button text to "Open App"

Now users tap the menu button inside Telegram to open the Mini App.

---

## 5. API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + word count |
| GET | `/levels` | Word count per level (N5–N1) |
| GET | `/topics?level=N4` | The book's topics for a level, with word counts |
| GET | `/words?level=N4&topic=3&search=saifu&limit=50&offset=0` | Paged word list (all filters optional) |
| GET | `/words/{id}` | One word with every field, e.g. `/words/N4-0322` |
| GET | `/score/{user_id}` | User score + most-missed words |
| POST | `/quiz/start` | Start quiz `{user_id, level, topic?, total}` |
| POST | `/quiz/answer` | Submit answer `{user_id, answer}` |
| POST | `/quiz/stop` | Stop quiz `{user_id}` |
| POST | `/reset` | Reset session `{user_id}` |

---

## 6. Vocabulary database

Words come from `backend/data/jlpt_vocab.sqlite` (table `vocab`): 9,205 JLPT words
(N5 1,011 · N4 1,155 · N3 2,113 · N2 2,357 · N1 2,569), grouped by the topics of the
*ミニストーリーで覚える JLPT ベスト単語* books. N4 words have original example sentences;
the example columns are empty for the other levels until sentences are added.

To update the words, replace the `.sqlite` file and restart the API. To use a different
path, set the `VOCAB_DB` environment variable.

| Column | Description |
|--------|-------------|
| `id` | Stable ID, e.g. `N4-0322` |
| `level` | N5 … N1 |
| `word`, `reading`, `romaji` | Word, kana reading, romanization |
| `meaning`, `hint` | English meaning and a short hint for look-alike words |
| `pos` | Part(s) of speech, `;`-separated |
| `topic_no`, `topic_ja`, `topic_en` | The book's topic |
| `example_ja`, `example_en`, `example_target` | Example sentence, translation, and the word as it appears in the sentence |

The old `jlpt_vocabulary_enriched.csv` is no longer read by the API.

---

## Notes

- **Sessions** are in-memory. Restart the server = sessions cleared.
  For persistence, replace `sessions: dict` in `main.py` with Redis or SQLite.
- The Telegram `user_id` is read from `window.Telegram.WebApp.initDataUnsafe.user.id`
  in dev mode it falls back to `999999`.
- HTTPS is **required** by Telegram for Mini Apps. Both frontend and backend must be on HTTPS.
