"""
Telegram Mini App authentication.

The frontend sends Telegram's signed `initData` in the X-Telegram-Init-Data
header. We verify its HMAC with the bot token, so a user can't pretend to be
someone else. See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

Local development without Telegram: set DEV_MODE=1 (or leave BOT_TOKEN unset);
then the X-Dev-User header (default 999999) is trusted.
"""
import hashlib, hmac, json, os, time
from typing import Optional
from urllib.parse import parse_qsl
from fastapi import Header, HTTPException

BOT_TOKEN   = os.getenv("BOT_TOKEN", "")
DEV_MODE    = os.getenv("DEV_MODE", "0") == "1" or not BOT_TOKEN
MAX_AGE_SEC = 7 * 24 * 3600


def verify_init_data(init_data: str, bot_token: str = None, max_age: int = MAX_AGE_SEC) -> Optional[dict]:
    """Return the Telegram user dict if init_data is valid, else None."""
    bot_token = bot_token or BOT_TOKEN
    if not init_data or not bot_token:
        return None
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received = pairs.pop("hash", None)
    if not received:
        return None
    check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        return None
    if max_age and time.time() - int(pairs.get("auth_date", 0)) > max_age:
        return None
    try:
        return json.loads(pairs.get("user", "{}")) or None
    except json.JSONDecodeError:
        return None


def current_user(
    x_telegram_init_data: Optional[str] = Header(default=None),
    x_dev_user: Optional[str] = Header(default=None),
) -> dict:
    """FastAPI dependency: the authenticated Telegram user."""
    if x_telegram_init_data:
        user = verify_init_data(x_telegram_init_data)
        if user and "id" in user:
            return user
        if not DEV_MODE:
            raise HTTPException(401, "Invalid Telegram login data.")
    if DEV_MODE:
        uid = int(x_dev_user) if (x_dev_user or "").isdigit() else 999999
        return {"id": uid, "first_name": "Dev"}
    raise HTTPException(401, "Open this app from Telegram.")
