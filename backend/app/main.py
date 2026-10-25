
from datetime import date, datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from app.analytics.metrics import calculate_metrics, select_forecasts
from app.services.elexon import (
    ElexonAPIError,
    fetch_actuals,
    fetch_forecasts,
)

app = FastAPI(
    title="Wind Forecast Insight API",
    description="UK wind generation forecast analysis using Elexon data.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://wind-forecast-insight-nvd6-k5bs5m1iy-ab-4504.vercel.app",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def numeric_generation(row: dict) -> Optional[float]:
    value = row.get("generation")
    if value is None:
        return None
    try:
        result = float(value)
        return result if result == result and abs(result) != float("inf") else None
    except (TypeError, ValueError):
        return None


@app.get("/health")
def health():
    return {"status": "ok", "service": "wind-forecast-insight"}


@app.get("/api/actuals")
def get_actuals(day: date = Query(..., alias="date")):
    try:
        rows = fetch_actuals(day)
        return {
            "date": day.isoformat(),
            "count": len(rows),
            "data": rows,
        }
    except ElexonAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/forecasts")
def get_forecasts(day: date = Query(..., alias="date")):
    try:
        rows = fetch_forecasts(day)
        return {
            "date": day.isoformat(),
            "count": len(rows),
            "data": rows,
        }
    except ElexonAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/accuracy")
def get_accuracy(
    day: date = Query(..., alias="date"),
    cutoff: str = Query(
        ...,
        description="ISO-8601 cutoff timestamp with timezone, e.g. 2026-01-14T11:00:00Z",
    ),
):
    try:
        cutoff_dt = parse_timestamp(cutoff)
        actual_rows = fetch_actuals(day)
        forecast_rows = fetch_forecasts(day)

        selected = select_forecasts(forecast_rows, cutoff_dt.isoformat())

        actual_values_by_hour = {}
        for row in actual_rows:
            start = row.get("startTime")
            generation = numeric_generation(row)
            if not start or generation is None:
                continue
            timestamp = parse_timestamp(start)
            hour = timestamp.replace(minute=0, second=0, microsecond=0)
            actual_values_by_hour.setdefault(hour, []).append(generation)
               #actual_by_time[parse_timestamp(start)] = generation
            actual_by_hour = {
             hour: sum(values) / len(values)
             for hour, values in actual_values_by_hour.items()
         }
        pairs = []
        for row in selected:
            start = row.get("startTime")
            forecast = numeric_generation(row)

            if not start or forecast is None:
                continue

            timestamp = parse_timestamp(start)
            actual = actual_by_hour.get(timestamp)

            if actual is not None:
                pairs.append({
                    "startTime": timestamp.isoformat(),
                    "forecast": forecast,
                    "actual": actual,
                    "error_mw": forecast - actual,
                })

        return {
            "delivery_date": day.isoformat(),
            "cutoff": cutoff_dt.isoformat(),
            "metrics": calculate_metrics(pairs),
            "data": pairs,
            "selected_forecasts": len(selected),
            "actual_intervals": len(actual_rows),
        }

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ElexonAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
