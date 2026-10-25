
import math
from typing import Any


def calculate_metrics(pairs: list[dict[str, Any]]) -> dict:
    """
    Each pair must contain numeric 'forecast' and 'actual' values.
    Error convention: forecast - actual.
    """
    valid = []

    for row in pairs:
        forecast = row.get("forecast")
        actual = row.get("actual")

        if forecast is None or actual is None:
            continue

        try:
            forecast = float(forecast)
            actual = float(actual)
        except (TypeError, ValueError):
            continue

        if not math.isfinite(forecast) or not math.isfinite(actual):
            continue

        valid.append((forecast, actual))

    if not valid:
        return {
            "matched_periods": 0,
            "mae_mw": None,
            "rmse_mw": None,
            "bias_mw": None,
        }

    errors = [forecast - actual for forecast, actual in valid]
    count = len(errors)

    return {
        "matched_periods": count,
        "mae_mw": sum(abs(e) for e in errors) / count,
        "rmse_mw": math.sqrt(sum(e * e for e in errors) / count),
        "bias_mw": sum(errors) / count,
    }


def select_forecasts(
    forecasts: list[dict],
    cutoff_iso: str,
) -> list[dict]:
    """
    Select the latest forecast published at or before the cutoff
    for each delivery startTime.

    Both timestamps must be ISO-8601 and timezone-aware.
    """
    from datetime import datetime, timezone

    def parse_timestamp(value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError(f"Timestamp must include timezone: {value}")
        return parsed.astimezone(timezone.utc)

    cutoff = parse_timestamp(cutoff_iso)
    selected = {}

    for row in forecasts:
        start_time = row.get("startTime")
        publish_time = row.get("publishTime")

        if not start_time or not publish_time:
            continue

        published = parse_timestamp(publish_time)

        if published > cutoff:
            continue

        previous = selected.get(start_time)

        if previous is None or published > parse_timestamp(
            previous["publishTime"]
        ):
            selected[start_time] = row

    return sorted(
        selected.values(),
        key=lambda row: row["startTime"],
    )
