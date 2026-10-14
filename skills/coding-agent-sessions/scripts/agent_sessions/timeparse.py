from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path


def date_bound(value: str | None, end: bool = False) -> datetime | None:
    if value is None:
        return None
    text = value.strip().lower()
    now = datetime.now(timezone.utc)
    is_day_unit = False
    try:
        if text == "today":
            base = now.replace(hour=0, minute=0, second=0, microsecond=0)
            is_day_unit = True
        elif text == "yesterday":
            base = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            is_day_unit = True
        elif text.endswith("days") and text[:-4].strip().isdigit():
            base = (now - timedelta(days=int(text[:-4].strip()))).replace(hour=0, minute=0, second=0, microsecond=0)
            is_day_unit = True
        elif text.endswith("d") and text[:-1].strip().isdigit():
            base = (now - timedelta(days=int(text[:-1].strip()))).replace(hour=0, minute=0, second=0, microsecond=0)
            is_day_unit = True
        elif text.endswith("w") and text[:-1].strip().isdigit():
            base = (now - timedelta(weeks=int(text[:-1].strip()))).replace(hour=0, minute=0, second=0, microsecond=0)
            is_day_unit = True
        elif text.endswith("h") and text[:-1].strip().isdigit():
            base = now - timedelta(hours=int(text[:-1].strip()))
            if end:
                return base + timedelta(hours=1)
            return base
        elif "t" in text or ":" in text:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            base = parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            return base
        else:
            parts = [int(part) for part in text.split("-")]
            if not (1 <= len(parts) <= 3):
                raise ValueError(value)
            base = datetime(parts[0], parts[1] if len(parts) > 1 else 1, parts[2] if len(parts) > 2 else 1, tzinfo=timezone.utc)
    except ValueError as exc:
        raise SystemExit(f"invalid date bound: {value}") from exc
    if not end:
        return base
    if is_day_unit or len(text.split("-")) == 3:
        return base + timedelta(days=1)
    if len(text.split("-")) == 2:
        return datetime(base.year + (base.month // 12), (base.month % 12) + 1, 1, tzinfo=timezone.utc)
    return datetime(base.year + 1, 1, 1, tzinfo=timezone.utc)


def parse_stamp(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def unix_seconds(value: int | float | None) -> str | None:
    return datetime.fromtimestamp(value, timezone.utc).isoformat() if value is not None else None


def unix_millis(value: int | None) -> str | None:
    return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat() if value is not None else None


def file_time(path: Path) -> str | None:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
    except OSError:
        return None
