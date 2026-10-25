
import { useState } from "react";
import {
  Wind,
  RefreshCw,
  CalendarDays,
  Clock3,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import "./App.css";

const API_BASE = "https://wind-forecast-insight-gamma.vercel.app" || "http://127.0.0.1:8000";

function formatNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return Number(value).toLocaleString("en-GB", {
    maximumFractionDigits: 1,
  });
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function MetricCard({ label, value, unit, detail, icon: Icon }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon"><Icon size={19} /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom">
        <span>{unit}</span>
        <span>{detail}</span>
      </div>
    </article>
  );
}

export default function App() {
  const [date, setDate] = useState("2026-01-15");
  const [cutoff, setCutoff] = useState("2026-01-14T11:00");
  const [result, setResult] = useState(null);
  const [actualCount, setActualCount] = useState(null);
  const [forecastCount, setForecastCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(event) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    // datetime-local input is interpreted as UTC because the cutoff is explicitly UTC.
    const cutoffUtc = `${cutoff}:00Z`;
    const queryDate = encodeURIComponent(date);
    const queryCutoff = encodeURIComponent(cutoffUtc);

    try {
      const urls = [
        `${API_BASE}/api/actuals?date=${queryDate}`,
        `${API_BASE}/api/forecasts?date=${queryDate}`,
        `${API_BASE}/api/accuracy?date=${queryDate}&cutoff=${queryCutoff}`,
      ];

      const responses = await Promise.all(urls.map((url) => fetch(url)));

      for (const response of responses) {
        if (!response.ok) {
          let message = `API request failed (${response.status})`;
          try {
            const body = await response.json();
            if (body.detail) message = body.detail;
          } catch {
            // Keep the HTTP status message.
          }
          throw new Error(message);
        }
      }

      const [actuals, forecasts, accuracy] = await Promise.all(
        responses.map((response) => response.json())
      );

      setActualCount(actuals.count ?? actuals.data?.length ?? 0);
      setForecastCount(forecasts.count ?? forecasts.data?.length ?? 0);
      setResult(accuracy);
    } catch (err) {
      setError(
        `${err.message}. Check that the backend is running at ${API_BASE}.`
      );
    } finally {
      setLoading(false);
    }
  }

  const metrics = result?.metrics;
  const chartData = (result?.data ?? []).map((row) => ({
    ...row,
    time: formatTime(row.startTime),
    forecast: Number(row.forecast),
    actual: Number(row.actual),
  }));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Wind size={25} /></div>
          <div>
            <h1>Wind Forecast Insight</h1>
            <p>UK electricity generation · Elexon data</p>
          </div>
        </div>
        <div className="live-tag">
          <span className="status-dot" />
          API-connected dashboard
        </div>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">FORECAST PERFORMANCE</p>
          <h2>Wind generation overview</h2>
          <p className="page-description">
            Compare the latest eligible forecast with measured wind generation.
          </p>
        </div>
        <div className="data-source">
          <Activity size={17} />
          <span>Source: Elexon BMRS</span>
        </div>
      </section>

      <form className="filter-panel" onSubmit={loadDashboard}>
        <label className="field">
          <span><CalendarDays size={16} /> Delivery date</span>
          <input
            type="date"
            value={date}
            min="2026-01-01"
            max="2026-01-31"
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span><Clock3 size={16} /> Forecast cutoff (UTC)</span>
          <input
            type="datetime-local"
            value={cutoff}
            onChange={(event) => setCutoff(event.target.value)}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          <RefreshCw size={17} className={loading ? "spin" : ""} />
          {loading ? "Loading data…" : "Analyse forecast"}
        </button>
      </form>

      {error && (
        <div className="notice error-notice" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Could not load dashboard</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="result-meta">
            <div className="success-label">
              <CheckCircle2 size={17} />
              Analysis response received
            </div>
            <span>Delivery date: {result.delivery_date}</span>
            <span>Cutoff: {result.cutoff}</span>
          </div>

          <section className="metrics-grid">
            <MetricCard
              label="Mean absolute error"
              value={formatNumber(metrics?.mae_mw)}
              unit="MW"
              detail="Lower is better"
              icon={Activity}
            />
            <MetricCard
              label="Root mean squared error"
              value={formatNumber(metrics?.rmse_mw)}
              unit="MW"
              detail="Penalises larger errors"
              icon={TrendingUp}
            />
            <MetricCard
              label="Forecast bias"
              value={formatNumber(metrics?.bias_mw)}
              unit="MW"
              detail="Forecast − actual"
              icon={Wind}
            />
            <MetricCard
              label="Matched intervals"
              value={formatNumber(metrics?.matched_periods)}
              unit="intervals"
              detail="Valid pairs only"
              icon={CheckCircle2}
            />
          </section>

          <section className="chart-panel">
            <div className="panel-heading">
              <div>
                <h3>Forecast vs actual generation</h3>
                <p>Generation in MW · timestamps shown in UTC</p>
              </div>
              <span className="interval-count">
                {chartData.length} matched points
              </span>
            </div>

            {chartData.length > 0 ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 12, right: 18, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6ece8" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: "#6d7d75" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      width={65}
                      tick={{ fontSize: 12, fill: "#6d7d75" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value.toLocaleString("en-GB")}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${formatNumber(value)} MW`,
                        name === "forecast" ? "Forecast" : "Actual",
                      ]}
                      labelFormatter={(label) => `${label} UTC`}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e9e4",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="Forecast"
                      stroke="#19866b"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="#e6a23c"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><Activity size={25} /></div>
                <h4>No matched intervals yet</h4>
                <p>
                  The API returned no valid forecast/actual pairs for this
                  cutoff. Verify historical forecast coverage and interval
                  alignment in the backend.
                </p>
              </div>
            )}
          </section>

          <section className="data-status-grid">
            <div className="status-card">
              <span className="status-label">Actual records returned</span>
              <strong>{actualCount ?? "—"}</strong>
            </div>
            <div className="status-card">
              <span className="status-label">Forecast records returned</span>
              <strong>{forecastCount ?? "—"}</strong>
            </div>
            <div className="status-card">
              <span className="status-label">Eligible forecasts selected</span>
              <strong>{result.selected_forecasts ?? "—"}</strong>
            </div>
            <div className="status-card">
              <span className="status-label">Actual intervals available</span>
              <strong>{result.actual_intervals ?? "—"}</strong>
            </div>
          </section>

          <p className="method-note">
            Metrics are computed only on matched intervals. Bias is defined as
            forecast minus actual; positive bias indicates over-forecasting.
            Missing values are not treated as zero.
          </p>
        </>
      )}

      {!result && !error && (
        <section className="welcome-panel">
          <div className="welcome-icon"><Wind size={31} /></div>
          <h3>Ready to analyse wind forecasts</h3>
          <p>
            Choose a delivery date and the decision-time cutoff, then run the
            analysis to load the metrics and chart from your backend.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => loadDashboard()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load 15 January example"}
          </button>
        </section>
      )}

      <footer className="footer">
        <span>Wind Forecast Insight</span>
        <span>Historical analysis · Elexon data</span>
      </footer>
    </main>
  );
}
