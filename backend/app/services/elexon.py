
import os
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from typing import Optional
import httpx

BASE_URL = os.getenv(
    "ELEXON_BASE_URL",
    "https://data.elexon.co.uk/bmrs/api/v1",
)

TIMEOUT = 30.0


class ElexonAPIError(RuntimeError):
    """Raised when the Elexon API request fails."""


def _extract_records(payload: Any) -> list[dict]:
    """Support common list and wrapped-JSON response formats."""
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]

    if isinstance(payload, dict):
        for key in ("data", "results", "result"):
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]

    raise ElexonAPIError(
        f"Unexpected Elexon response format: {type(payload).__name__}"
    )

def fetch_dataset(
    dataset: str,
    start: datetime,
    end: datetime,
) -> list[dict]:
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("Timestamps must include timezone")
    if start >= end:
        raise ValueError("start must be before end")

    url = f"{BASE_URL}/datasets/{dataset}/stream"
    params = {
        "publishDateTimeFrom": start.astimezone(timezone.utc).isoformat(),
        "publishDateTimeTo": end.astimezone(timezone.utc).isoformat(),
    }

    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ElexonAPIError(
            f"Failed to fetch {dataset}: {exc}"
        ) from exc

    return _extract_records(payload)


def _delivery_day(row: dict) -> Optional[str]:
    value = row.get("startTime")
    if not value:
        return None

    try:
        timestamp = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
        if timestamp.tzinfo is None:
            return None
        return timestamp.astimezone(timezone.utc).date().isoformat()
    except ValueError:
        return None



def fetch_actuals(day: date):
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=2)

    rows = fetch_dataset("FUELHH", start, end)

    # FUELHH has half-hourly actual generation.
    # Filter by delivery date, not publication date.
    wind_rows = [
        row for row in rows
        if str(row.get("fuelType", "")).upper() == "WIND"
        and row.get("settlementDate") == day.isoformat()
    ]

    return sorted(
        wind_rows,
        key=lambda row: row.get("startTime", "")
    )


def fetch_forecasts(day: date) -> list[dict]:
    # Retrieve forecasts published around the day-ahead decision.
    start = datetime.combine(
        day - timedelta(days=1),
        time.min,
        tzinfo=timezone.utc,
    )
    end = datetime.combine(
        day + timedelta(days=1),
        time.min,
        tzinfo=timezone.utc,
    )

    rows = fetch_dataset("WINDFOR", start, end)

    forecasts = [
        row for row in rows
        if _delivery_day(row) == day.isoformat()
        and row.get("publishTime")
    ]

    return sorted(
        forecasts,
        key=lambda row: (
            row.get("startTime", ""),
            row.get("publishTime", ""),
        ),
    )
    """Fetch wind forecast records for one UTC delivery day."""
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    rows = fetch_dataset("WINDFOR", start, end)

    return sorted(
        rows,
        key=lambda row: (
            row.get("startTime", ""),
            row.get("publishTime", ""),
        ),
    )
