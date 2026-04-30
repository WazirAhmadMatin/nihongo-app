# 日本語 — Nihongo Mini App

A polished Telegram Mini App for JLPT vocabulary practice.

```
nihongo-app/
├── backend/
│   ├── main.py                      ← FastAPI REST API
│   ├── bot.py                       ← Telegram bot (Mini App launcher)
│   ├── requirements.txt
│   └── jlpt_vocabulary_enriched.csv ← your existing CSV (copy here)
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

# Copy your CSV
cp /path/to/jlpt_vocabulary_enriched.csv .

# Install dependencies
pip install -r requirements.txt

# Run the API
uvicorn main:app --reload --port 8000
```

Test it:
```
GET http://localhost:8000/health
GET http://localhost:8000/words?level=N5&limit=10
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
| GET | `/words?level=N5&search=mizu&limit=100` | Word list |
| GET | `/levels` | Level counts |
| GET | `/score/{user_id}` | User score + wrong words |
| POST | `/quiz/start` | Start quiz `{user_id, level, total}` |
| POST | `/quiz/answer` | Submit answer `{user_id, answer}` |
| POST | `/quiz/hint` | Get hint `{user_id}` |
| POST | `/quiz/stop` | Stop quiz `{user_id}` |
| POST | `/reset` | Reset session `{user_id}` |

---

## 6. CSV Format

Your existing `jlpt_vocabulary_enriched.csv` columns used:

| Column | Description |
|--------|-------------|
| `kanji_final` | Japanese word |
| `romaji_final` | Romanisation |
| `english_ai` | English meaning(s), `/`-separated |
| `level` | N5, N4, EXTRA (or 0 = EXTRA) |
| `pos` | Part of speech (optional) |
| `example_jp` | Example sentence Japanese (optional) |
| `example_en` | Example sentence English (optional) |

---

## Notes

- **Sessions** are in-memory. Restart the server = sessions cleared.
  For persistence, replace `sessions: dict` in `main.py` with Redis or SQLite.
- The Telegram `user_id` is read from `window.Telegram.WebApp.initDataUnsafe.user.id`
  in dev mode it falls back to `999999`.
- HTTPS is **required** by Telegram for Mini Apps. Both frontend and backend must be on HTTPS.
