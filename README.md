# Wind Forecast Insight

A dashboard for evaluating UK wind generation forecasts against actual generation data from the Elexon BMRS API.

## Overview

Wind generation is variable, so energy procurement teams need to understand how reliable a forecast was at the time a decision was made. This application lets users select a delivery date and a forecast publication cutoff, then evaluates the latest eligible wind forecast against actual generation.

## Features

- Retrieves UK wind generation actuals and forecasts from Elexon.
- Selects the latest forecast published on or before the selected cutoff.
- Compares forecast and actual generation over matched delivery intervals.
- Calculates MAE, RMSE and forecast bias.
- Displays matched-period results in a React dashboard.
- Provides a FastAPI backend and Docker-based local deployment.

## Technology stack

- Frontend: React
- Backend: Python, FastAPI
- HTTP client: HTTPX
- Data source: Elexon BMRS API
- Containerisation: Docker and Docker Compose

## Data source

All generation data used by the application is sourced from Elexon BMRS.

- `FUELHH`: actual generation by fuel type, including WIND.
- `WINDFOR`: wind generation forecasts, including publication and delivery timestamps.

API base URL: https://data.elexon.co.uk/bmrs/api/v1

## Forecast selection and evaluation

For each delivery interval, the application selects the latest forecast whose publication timestamp is less than or equal to the user-selected cutoff.

This prevents forecasts published after the decision cutoff from being used in the evaluation.

The current comparison aligns hourly wind forecasts with hourly actual generation, calculated as the mean of available half-hourly actual observations within each hour. Missing actual values are not replaced with zero. Only intervals with both a valid forecast and an actual value are included.

### Metrics

Let `forecast` be the forecast generation and `actual` be actual generation. Errors are defined as:

`error = forecast - actual`

- **MAE (Mean Absolute Error):** average absolute forecast error. Lower is better.
- **RMSE (Root Mean Squared Error):** square root of the mean squared error. Larger errors receive greater weight.
- **Forecast bias:** mean signed error. Positive values indicate over-forecasting; negative values indicate under-forecasting.
- **Matched intervals:** number of delivery intervals included in the metric calculation.

### Example evaluation

For delivery date `2026-01-15` and cutoff `2026-01-14T11:00:00Z`, the observed API response returned:

- MAE: approximately 1,110.3 MW
- RMSE: approximately 1,212.2 MW
- Bias: approximately +1,110.3 MW
- Matched hourly intervals: 24

These values are an example for this date and cutoff, not a general forecast-performance guarantee.

## Project structure

```text
wind-forecast-insight/
├── backend/
│   ├── app/
│   │   ├── analytics/
│   │   ├── services/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## Run locally

### Backend

Python 3.9 or later is required for the application code.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`.

Interactive API documentation: `http://localhost:8000/docs`.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

Configure the frontend API base URL as needed for your environment.

## Run with Docker

Ensure Docker Desktop is running, then execute these commands from the project root:

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`

Stop the containers with:

```bash
docker compose down
```

## API endpoints

### Health check

`GET /health`

Returns the backend service status.

### Actual generation

`GET /api/actuals?date=2026-01-15`

Returns actual wind generation records for the selected delivery date.

### Wind forecasts

`GET /api/forecasts?date=2026-01-15`

Returns available wind forecast records for the selected delivery date.

### Forecast accuracy

`GET /api/accuracy?date=2026-01-15&cutoff=2026-01-14T11:00:00Z`

Returns the selected forecasts, matched forecast/actual pairs and evaluation metrics. The cutoff must be an ISO-8601 timestamp with a timezone.

## Tests

Run the backend tests from the repository root:

```bash
PYTHONPATH=backend python -m pytest backend/tests -v
```

## Limitations and assumptions

- Forecast accuracy depends on the chosen publication cutoff.
- Forecast and actual datasets may have different time granularities; this implementation aggregates available half-hourly actual values to hourly values.
- Incomplete data can reduce the number of matched intervals.
- Metrics describe the selected date and cutoff and should not be generalised to all operating conditions.
- The application depends on Elexon API availability and response formats.
- The deployment configuration is intended as a starting point; production hosting requires platform-specific configuration and monitoring.

## AI disclosure

AI assistance was used during development for coding guidance, debugging, documentation and project-structure suggestions. The implementation and outputs should be reviewed and tested by the project author. Any further AI-generated code or content should be disclosed accurately according to the assignment requirements.

## Future improvements

- Compare multiple delivery dates and forecast cutoffs.
- Add additional performance visualisations.
- Improve handling of incomplete and revised source records.
- Add automated CI checks and production monitoring.

## Licence

Add the licence required by the project or assignment before publishing the repository.
