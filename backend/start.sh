#!/bin/sh
# One process for the API and the Telegram bot (they share data/users.sqlite).
cd "$(dirname "$0")"
export RUN_BOT=${RUN_BOT:-1}
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
