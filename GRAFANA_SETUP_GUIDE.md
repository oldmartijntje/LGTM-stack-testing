# Grafana Setup Guide for LGTM Stack

This guide walks you through setting up Grafana data sources and dashboards to visualize logs, metrics, and traces from your MQTT API and Handler services.

## Overview of Your Application Telemetry

Your application sends observability data through:

- **Metrics** (Prometheus): HTTP requests, MQTT connections, message processing rates
- **Logs** (Loki): Connection events, message handling, errors, MQTT subscription confirmations
- **Traces** (Tempo): Distributed request flows between API and Handler via MQTT

Services:
- **mqtt-api**: Express API service that publishes messages to MQTT broker
- **mqtt-handler**: MQTT message handler that processes requests and sends responses

---

## Part 1: Adding Data Sources in Grafana

### Access Grafana
1. Open your browser and go to: **http://localhost:3000**
2. Default login: `admin` / `admin` (or your configured password)

### Add Prometheus Data Source

1. Click **Configuration** (gear icon) → **Data Sources**
2. Click **Add data source**
3. Select **Prometheus**
4. Configure:
   - **Name**: `Prometheus`
   - **URL**: `http://prometheus:9090`
   - **Access**: `Server (default)`
5. Click **Save & Test** (you should see "Data source is working")

**What you'll query**:
- `http_server_request_duration_seconds` - API request latency
- `http_server_requests_total` - Total HTTP requests
- `mqtt_publish_sent_total` - MQTT messages published
- `mqtt_subscribe_sent_total` - MQTT subscriptions
- Node.js metrics: memory, CPU, event loop lag

### Add Loki Data Source

1. Click **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Loki**
4. Configure:
   - **Name**: `Loki`
   - **URL**: `http://loki:3100`
   - **Access**: `Server (default)`
5. Click **Save & Test**

**What you'll query**:
- Logs from both `mqtt-api` and `mqtt-handler` services
- Error messages from MQTT operations
- Connection and subscription confirmations
- Message processing logs

### Add Tempo Data Source

1. Click **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Tempo**
4. Configure:
   - **Name**: `Tempo`
   - **URL**: `http://tempo:3200`
   - **Access**: `Server (default)`
   - **Service Graph**: `Enabled` (optional, shows service dependencies)
5. Click **Save & Test**

**What you'll see**:
- End-to-end traces from API request through MQTT to Handler and response
- Message publishing and subscription traces
- Latency breakdown for each service

---

## Part 2: Creating Dashboards

### Dashboard 1: Metrics Overview (Prometheus)

1. Click **Dashboards** → **New Dashboard**
2. Click **Add Panel**

#### Panel 1: API Request Rate
- **Title**: API Request Rate
- **Data Source**: Prometheus
- **Query**:
  ```
  rate(http_server_requests_total{service_name="mqtt-api"}[1m])
  ```
- **Visualization**: Graph
- **Description**: Shows requests per second to your API

#### Panel 2: API Request Duration (P95)
- **Title**: API Request Duration (P95)
- **Data Source**: Prometheus
- **Query**:
  ```
  histogram_quantile(0.95, rate(http_server_request_duration_seconds_bucket{service_name="mqtt-api"}[5m]))
  ```
- **Visualization**: Graph
- **Unit**: seconds

#### Panel 3: MQTT Messages Published
- **Title**: MQTT Messages Published
- **Data Source**: Prometheus
- **Query**:
  ```
  rate(mqtt_publish_sent_total[1m])
  ```
- **Visualization**: Graph
- **Description**: Messages published to MQTT broker per second

#### Panel 4: MQTT Connection Status
- **Title**: MQTT Connection Status
- **Data Source**: Prometheus
- **Query**:
  ```
  mqtt_client_connected{service_name=~"mqtt-api|mqtt-handler"}
  ```
- **Visualization**: Stat
- **Unit**: short
- **Description**: 1 = connected, 0 = disconnected

#### Panel 5: Node.js Memory Usage
- **Title**: Memory Usage
- **Data Source**: Prometheus
- **Query**:
  ```
  nodejs_heap_size_used_bytes{service_name=~"mqtt-api|mqtt-handler"}
  ```
- **Visualization**: Graph
- **Unit**: bytes

#### Panel 6: HTTP Error Rate
- **Title**: API Error Rate (5xx errors)
- **Data Source**: Prometheus
- **Query**:
  ```
  rate(http_server_requests_total{service_name="mqtt-api", status=~"5.."}[1m])
  ```
- **Visualization**: Graph

**Save this dashboard as**: "LGTM - Metrics Overview"

---

### Dashboard 2: Logs Explorer (Loki)

1. Click **Dashboards** → **New Dashboard**
2. Click **Add Panel**

#### Panel 1: Recent Logs
- **Title**: Application Logs (All Services)
- **Data Source**: Loki
- **Query**:
  ```
  {job=~"mqtt-api|mqtt-handler"}
  ```
- **Visualization**: Logs
- **Description**: Shows all application logs in real-time

#### Panel 2: Error Logs Only
- **Title**: Error Messages
- **Data Source**: Loki
- **Query**:
  ```
  {job=~"mqtt-api|mqtt-handler"} |= "error" or "Error" or "ERROR"
  ```
- **Visualization**: Logs
- **Color Log Levels**: Enabled

#### Panel 3: MQTT Connection Events
- **Title**: MQTT Connection Events
- **Data Source**: Loki
- **Query**:
  ```
  {job=~"mqtt-api|mqtt-handler"} |= "Connected" or "Disconnected" or "MQTT"
  ```
- **Visualization**: Logs

#### Panel 4: Message Processing Activity
- **Title**: Message Processing Logs
- **Data Source**: Loki
- **Query**:
  ```
  {job="mqtt-handler"} |= "Message received" or "Publishing response"
  ```
- **Visualization**: Logs

#### Panel 5: API Request Logs
- **Title**: API Request Logs
- **Data Source**: Loki
- **Query**:
  ```
  {job="mqtt-api"} 
  ```
- **Visualization**: Logs

**Save this dashboard as**: "LGTM - Logs Explorer"

---

### Dashboard 3: Distributed Traces (Tempo)

1. Click **Dashboards** → **New Dashboard**
2. Click **Add Panel** → **Select Tempo data source**

#### Panel 1: Service Map
- **Title**: Service Dependencies
- **Data Source**: Tempo
- **Use**: Service Graph visualization
- **Description**: Shows how mqtt-api and mqtt-handler communicate via MQTT broker

#### Panel 2: Trace Search
- **Title**: Recent Traces
- **Data Source**: Tempo
- **Query Type**: Search (TraceQL)
- **Filter**: 
  ```
  { service.name = "mqtt-api" }
  ```
- **Visualization**: Traces
- **Description**: Click any trace to see detailed span breakdown

#### Panel 3: Trace Latency Distribution
- **Title**: Trace Latency by Service
- **Data Source**: Tempo
- **Query**: 
  ```
  { service.name = "mqtt-api" || service.name = "mqtt-handler" }
  ```
- **Visualization**: Table
- **Show**: trace duration, service name, operation

---

## Part 3: Understanding the Data Flow

### Example: User Sends a Message via API

**What happens**:
1. **Log** (Loki): `POST /send` request logged by pino-http middleware
2. **Trace** (Tempo): Span created for incoming HTTP request
3. **Metric** (Prometheus): `http_server_requests_total` incremented
4. **Log** (Loki): "Sending message to handler: {message}" logged
5. **Metric** (Prometheus): `mqtt_publish_sent_total` incremented
6. **Trace** (Tempo): MQTT publish operation traced
7. Handler receives message:
   - **Log** (Loki): "Message received from API" with topic and payload
   - **Trace** (Tempo): Span created for message processing
   - **Metric** (Prometheus): Message processing metrics
8. Handler publishes response:
   - **Metric** (Prometheus): `mqtt_publish_sent_total` again
   - **Log** (Loki): "Publishing response" logged
9. API receives response:
   - **Trace** (Tempo): Trace completed, showing full latency
   - **Metric** (Prometheus): Request duration recorded in histogram
   - **Log** (Loki): Response logged (if instrumented)

### To Trace a Complete Request in Tempo:
1. Go to **Explore** → Select **Tempo** data source
2. Switch to **TraceQL** tab
3. Search: `{ service.name = "mqtt-api" }`
4. Click a trace to see:
   - HTTP request span → MQTT publish span
   - Time each operation took
   - Any errors in the chain

---

## Part 4: Useful Queries for Your Application

### Prometheus Queries

**MQTT Connection Health**:
```
mqtt_client_connected{service_name=~"mqtt-api|mqtt-handler"} * on(instance) group_left(service_name) (1 / time())
```

**Message Processing Throughput**:
```
rate(mqtt_publish_sent_total[5m])
```

**API Response Time P99**:
```
histogram_quantile(0.99, rate(http_server_request_duration_seconds_bucket{service_name="mqtt-api"}[5m]))
```

**System Health**:
```
{job=~"mqtt-api|mqtt-handler", __name__=~"up|process_.*"}
```

### Loki Queries

**Failed Message Processing**:
```
{job="mqtt-handler"} |= "Failed" or "error"
```

**Connection Issues**:
```
{job=~"mqtt-api|mqtt-handler"} |= "error" |= "MQTT" or "broker"
```

**All Handler Activity**:
```
{job="mqtt-handler"}
| json
```

### Tempo Queries

**Slow Requests (>1s)**:
```
{ service.name = "mqtt-api" && duration > 1s }
```

**Failed Spans**:
```
{ status = error }
```

**API to Handler Communication**:
```
{ (service.name = "mqtt-api" || service.name = "mqtt-handler") }
```

---

## Part 5: Tips & Troubleshooting

### No Data Appearing?

1. **Check services are running**:
   ```bash
   docker ps | grep -E "prometheus|loki|tempo|mqtt"
   ```

2. **Check application is sending data**:
   - For API: `curl http://localhost:3003/health`
   - Check logs: `docker logs <container_name>`

3. **Verify endpoints**:
   - Prometheus: `http://localhost:9090`
   - Loki: `http://localhost:3100/loki/api/v1/query`
   - Tempo: `http://localhost:3200/api/traces/1234` (replace with trace ID)

### Want to Generate Test Data?

Your application sends data when you:
```bash
# Send a test message to the API
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"message": "test message"}'
```

This will generate:
- Logs in Loki
- Metrics in Prometheus
- Traces in Tempo

All visible in Grafana within seconds!

---

## Dashboard JSON Export/Import

You can export dashboards as JSON for backup or sharing. To import a dashboard:

1. Click **Dashboards** → **Import**
2. Paste JSON or upload JSON file
3. Select data sources
4. Click **Import**

To export: Dashboard menu (top left) → **Share** → **Export** → **Save JSON**
