# Grafana dashboard for ARTSA Prometheus metrics

Import `artsa-dashboard.json` into Grafana:

1. **Configuration → Data sources** — add Prometheus scraping `http://<artsa-api>:8000/api/v1/metrics/prometheus`
2. **Dashboards → Import** — upload `artsa-dashboard.json`
3. Select your Prometheus datasource when prompted

## Example Prometheus scrape config

```yaml
scrape_configs:
  - job_name: artsa
    metrics_path: /api/v1/metrics/prometheus
    static_configs:
      - targets: ["artsa-api:8000"]
```

## Panels

| Panel | Metric |
|-------|--------|
| ARTSA Up | `artsa_up` |
| Active Sessions | `artsa_active_sessions` |
| WebSocket Connections | `artsa_websocket_connections` |
| Ingest Rate | `rate(artsa_ingest_total[5m])` |
| Avg Ingest Latency | `rate(artsa_ingest_latency_ms_sum[5m]) / rate(artsa_ingest_total[5m])` |
| Severity breakdown | `artsa_events_severity_*` |
| Benchmark runs | `increase(artsa_benchmark_runs_total[1h])` |
