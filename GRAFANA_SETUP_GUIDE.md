# Grafana Setup Guide for LGTM Stack

This guide walks you through setting up Grafana data sources and dashboards to visualize logs, metrics, and traces from your MQTT API and Handler services.

## Overview of Your Application Telemetry

Your application sends observability data through:

- **Metrics** (Prometheus): Process-level metrics (memory, CPU, file descriptors) + Prometheus internal metrics. *Note: Application metrics require adding a `/metrics` endpoint*
- **Logs** (Loki): HTTP requests (via pino-http), MQTT connection events, message handling, errors, and processing logs
- **Traces** (Tempo): Distributed request flows between API and Handler via MQTT

Services:
- **mqtt-api**: Express API service that publishes messages to MQTT broker (uses pino-http for HTTP logging)
- **mqtt-handler**: MQTT message handler that processes requests and sends responses (uses pino structured logging)

**⚠️ Metrics Status**: Your services have OpenTelemetry instrumentation AND Prometheus `/metrics` endpoints. Just rebuild and restart the services to enable application metrics (HTTP request latency, heap size, etc.).

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

**What you'll query** (Currently Available):
- `up` - Service availability (1 = up, 0 = down) for api and handler
- `process_resident_memory_bytes` - Memory usage for each service
- `process_cpu_seconds_total` - CPU time consumed
- `prometheus_http_request_duration_seconds` - Prometheus internal request latency

**To Enable Application Metrics** (HTTP latency, heap size, event loop lag):
1. Rebuild services: `docker compose down && docker compose up --build`
2. Send a test request:
```bash
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```
3. Check metrics appear: `curl http://localhost:3000/metrics | head -20`

The services now have `/metrics` endpoints configured and Prometheus is set to scrape them.

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
- **API logs** (via pino-http): HTTP requests, responses, latency
- **Handler logs** (via pino): MQTT connection events, message received, response publishing, errors
- Error messages from MQTT connection failures and message parsing
- Message processing logs with payloads and timestamps

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

#### Panel 1: Service Availability
- **Title**: Service Status
- **Data Source**: Prometheus
- **Query**:
  ```
  up{job=~"api|handler"}
  ```
- **Visualization**: Graph
- **Description**: Shows which services are up (1) or down (0)

#### Panel 2: API Request Duration (P95)
- **Title**: API Request Latency (P95)
- **Data Source**: Prometheus
- **Query**:
  ```
  histogram_quantile(0.95, rate(http_request_duration_ms_bucket{job="api"}[5m]))
  ```
- **Visualization**: Graph
- **Unit**: ms
- **Description**: 95th percentile HTTP request latency

#### Panel 3: API Request Duration (P99)
- **Title**: API Request Latency (P99)
- **Data Source**: Prometheus
- **Query**:
  ```
  histogram_quantile(0.99, rate(http_request_duration_ms_bucket{job="api"}[5m]))
  ```
- **Visualization**: Graph
- **Unit**: ms
- **Description**: 99th percentile HTTP request latency

#### Panel 4: Memory Usage (RSS)
- **Title**: Process Memory (RSS)
- **Data Source**: Prometheus
- **Query**:
  ```
  process_resident_memory_bytes{job=~"api|handler"}
  ```
- **Visualization**: Graph
- **Unit**: bytes
- **Description**: Total resident set size memory for each service

#### Panel 5: CPU Usage
- **Title**: CPU Usage
- **Data Source**: Prometheus
- **Query**:
  ```
  rate(process_cpu_seconds_total{job=~"api|handler"}[1m])
  ```
- **Visualization**: Graph
- **Unit**: percentunit
- **Description**: CPU time consumption per service

#### Panel 6: Heap Memory
- **Title**: Heap Memory Usage
- **Data Source**: Prometheus
- **Query**:
  ```
  nodejs_heap_size_used_bytes{job=~"api|handler"}
  ```
- **Visualization**: Graph
- **Unit**: bytes
- **Description**: Active heap memory for each service

**Save this dashboard as**: "LGTM - Metrics Overview"

---

### Dashboard 2: Logs Explorer (Loki)

1. Click **Dashboards** → **New Dashboard**
2. Click **AddHTTP Request Logs (API)
- **Title**: API Request Logs
- **Data Source**: Loki
- **Query**:
  ```
  {job="mqtt-api"}
  ```
- **Visualization**: Logs
- **Description**: HTTP requests logged by pino-http middleware

#### Panel 2: Handler Activity Logs
- **Title**: Handler Processing Logs
- **Data Source**: Loki
- **Query**:
  ```
  {job="mqtt-handler"}
  ```
- **Visualization**: Logs
- **Description**: Message received, response publishing, and handler events

#### Panel 3: Error Logs Only
- **Title**: Error Messages
- **Data Source**: Loki
- **Query**:
  ```
  {job=~"mqtt-api|mqtt-handler"} | json | level="error"
  ```
- **Visualization**: Logs
- **Color Log Levels**: Enabled

#### Panel 4: MQTT Connection Events
- **Title**: MQTT Connection Events
- **Data Source**: Loki
- **Query**:
  ```
  {job=~"mqtt-api|mqtt-handler"} |= "Connected" or "Disconnected" or "Failed to subscribe"
  ```
- **Visualization**: Logs

#### Panel 5: Message Payload Logs
- **Title**: Message Details
- **Data Source**: Loki
- **Query**:
  ```
  {job="mqtt-handler"} |= "Message received" or "Publishing response"
  ```
- **Visualization**: Logs
- **Description**: Detailed message payloads and processing
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

## Part 3A: Available Metrics Reference

**Available Metrics** (after rebuild):

The services are already configured with `prom-client` and `/metrics` endpoints:
- **API**: Exposes `/metrics` on port 3000
- **Handler**: Exposes `/metrics` on port 3001
- **Prometheus**: Configured to scrape both endpoints

### HTTP Metrics (Express/Node.js auto-instrumented)
- **`http_server_duration_seconds`** - Request duration in seconds (histogram with _bucket, _count, _sum suffixes)
  - Query: `histogram_quantile(0.95, rate(http_server_duration_seconds_bucket[5m]))`
  - Use for: Request latency analysis, percentiles, performance SLOs
- **`http_server_request_body_size_bytes`** - Request body size in bytes
- **`http_server_response_body_size_bytes`** - Response body size in bytes

### Node.js Runtime Metrics
- **`nodejs_heap_size_used_bytes`** - Heap memory in use
- **`nodejs_heap_size_limit_bytes`** - Maximum heap size
- **`nodejs_external_memory_bytes`** - External memory
- **`nodejs_gc_duration_seconds`** - Garbage collection duration (histogram)
- **`nodejs_eventloop_lag_seconds`** - Event loop lag (histogram)
  - High values indicate blocking operations

### Process Metrics (from all services)
- **`process_resident_memory_bytes`** - RSS memory (total process memory)
- **`process_virtual_memory_bytes`** - Virtual memory
- **`process_cpu_seconds_total`** - CPU time consumed
  - Query: `rate(process_cpu_seconds_total[1m])` for CPU usage %
- **`process_open_fds`** - Open file descriptors
- **`process_max_fds`** - Maximum file descriptors
- **`up`** - Service availability (1 = up, 0 = down)

### Prometheus Internal Metrics
- **`prometheus_http_request_duration_seconds`** - Prometheus API request latency (histogram)
- **`prometheus_http_requests_total`** - Total HTTP requests to Prometheus
- **`prometheus_config_last_reload_successful`** - Config reload status

---

**To Get Application Metrics**:

Just rebuild and start the services:

```bash
docker compose down
docker compose up --build
```

Then send a test request to generate metrics:

```bash
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

Verify metrics are available:

```bash
# API metrics
curl http://localhost:3000/metrics 2>/dev/null | head -20

# Handler metrics  
curl http://localhost:3001/metrics 2>/dev/null | head -20
```

You should see output like:

```
# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes{job="api"} 123456789
...
# HELP http_server_duration_seconds HTTP request duration in seconds
# TYPE http_server_duration_seconds histogram
http_server_duration_seconds_bucket{job="api",le="0.005"} 0
...
```

After these steps, you'll have access to:

### HTTP Metrics (once /metrics endpoint added)
- **`http_server_duration_seconds`** - Request duration in seconds (histogram with _bucket, _count, _sum suffixes)
  - Query: `histogram_quantile(0.95, rate(http_server_duration_seconds_bucket[5m]))`
  - Use for: Request latency analysis, percentiles, performance SLOs
- **`http_server_request_body_size_bytes`** - Request body size in bytes
- **`http_server_response_body_size_bytes`** - Response body size in bytes

### Node.js Runtime Metrics (once /metrics endpoint added)
- **`nodejs_heap_size_used_bytes`** - Heap memory in use
- **`nodejs_heap_size_limit_bytes`** - Maximum heap size
- **`nodejs_external_memory_bytes`** - External memory
- **`nodejs_gc_duration_seconds`** - Garbage collection duration (histogram)
- **`nodejs_eventloop_lag_seconds`** - Event loop lag (histogram)
  - High values indicate blocking operations

**Note**: These metrics appear with labels like `job`, `instance` once the `/metrics` endpoint is in place.

---

### Example: User Sends a Message via API

**What happens and where it appears** (with current setup):

1. **API receives POST /send request**:
   - **Log** (Loki): pino-http logs the incoming HTTP request with method, URL, headers
   - **Trace** (Tempo): Span created for incoming HTTP request
   - **Metric** (Prometheus): `up{job="api"}` = 1 (service is responding)

2. **API publishes to MQTT**:
   - **Log** (Loki): "Sending message to handler: {message}" logged
   - **Trace** (Tempo): MQTT publish operation captured by OpenTelemetry
   - **Metric** (Prometheus): `process_resident_memory_bytes` may increase slightly

3. **Handler receives MQTT message**:
   - **Log** (Loki): pino logger logs "Message received from API" with topic and payload as JSON
   - **Trace** (Tempo): Span created for message handling
   - **Metric** (Prometheus): `process_cpu_seconds_total` increases, process metrics update

4. **Handler publishes response**:
   - **Log** (Loki): pino logger logs "Publishing response" with response object as JSON
   - **Metric** (Prometheus): `process_resident_memory_bytes` may change
   - **Trace** (Tempo): MQTT publish span

5. **Traces complete**:
   - **Trace** (Tempo): End-to-end trace shows HTTP request → MQTT publish → Handler processing → MQTT response
   - Shows latency breakdown for each operation
   - **Metric** (Prometheus): Process metrics (CPU, memory) recorded for both services

**To see HTTP request latency and detailed application metrics**: Add `/metrics` endpoint following the "To Enable Application Metrics" section above.

### To Trace a Complete Request in Tempo:
1. Go to **Explore** → Select **Tempo** data source
2. Switch to **TraceQL** tab
3. Search: `{ service.name = "mqtt-api" }` to find API requests
4. Click a trace to see the full request flow:
   - HTTP request span (pino-http logged)
   - Request processing in Node.js
   - MQTT publish span
   - Overall request duration
5. Cross-reference with Loki logs for that same time window to see detailed structured logs

---

## Part 4: Useful Queries for Your Application

### Prometheus Queries (Now Working)

**Service Availability**:
```
up{job=~"api|handler"}
```

**HTTP Request Duration (P95)**:
```
histogram_quantile(0.95, rate(http_request_duration_ms_bucket{job="api"}[5m]))
```

**HTTP Request Duration (P99)**:
```
histogram_quantile(0.99, rate(http_request_duration_ms_bucket{job="api"}[5m]))
```

**HTTP Request Rate** (requests per second):
```
rate(http_request_duration_ms_count{job=~"api|handler"}[1m])
```

**Memory Usage (RSS)**:
```
process_resident_memory_bytes{job=~"api|handler"}
```

**CPU Usage**:
```
rate(process_cpu_seconds_total{job=~"api|handler"}[1m])
```

**Heap Memory**:
```
nodejs_heap_size_used_bytes{job=~"api|handler"}
```

**Open File Descriptors**:
```
process_open_fds{job=~"api|handler"}
```

**Event Loop Lag**:
```
rate(nodejs_eventloop_lag_seconds{job=~"api|handler"}[1m])
```

**Garbage Collection Duration**:
```
rate(nodejs_gc_duration_seconds{job=~"api|handler"}[5m])
```

### Loki Queries

**All API Request Logs**:
```
{job="mqtt-api"}
```

**All Handler Activity Logs**:
```
{job="mqtt-handler"}
```

**Failed Message Processing**:
```
{job="mqtt-handler"} | json | level="error"
```

**Connection Issues**:
```
{job=~"mqtt-api|mqtt-handler"} |= "error" or "Failed"
```

**MQTT Connection Events**:
```
{job=~"mqtt-api|mqtt-handler"} |= "Connected" or "Disconnected"
```

**Message Received Events**:
```
{job="mqtt-handler"} |= "Message received"
```

**Response Publishing**:
```
{job="mqtt-handler"} |= "Publishing response"
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

### No Application Metrics Appearing?

**If metrics aren't showing in Prometheus after rebuild**:

1. **Verify services are running**:
   ```bash
   docker ps | grep -E "api|handler"
   ```

2. **Check /metrics endpoints directly**:
   ```bash
   curl http://localhost:3000/metrics 2>/dev/null | head -10
   curl http://localhost:3001/metrics 2>/dev/null | head -10
   ```
   Should return Prometheus format metrics.

3. **Check Prometheus is scraping**:
   - Go to http://localhost:9090/targets
   - Verify `api` and `handler` targets show as "UP"
   - If down, check service logs: `docker logs mqtt-api` and `docker logs mqtt-handler`

4. **Send test traffic** (metrics need at least one request):
   ```bash
   curl -X POST http://localhost:3003/send \
     -H "Content-Type: application/json" \
     -d '{"message": "test"}'
   ```

5. **Wait 15-30 seconds** (Prometheus scrape interval is 15s)

### No Data Appearing?

1. **Check services are running**:
   ```bash
   docker ps | grep -E "prometheus|loki|tempo|mqtt|api|handler"
   ```

2. **Check application logs**:
   ```bash
   docker logs mqtt-api
   docker logs mqtt-handler
   ```
   Look for "Connected to MQTT broker" and listen for any errors.

3. **Verify endpoints**:
   - **Prometheus**: `http://localhost:9090/api/v1/query?query=up`
   - **Loki**: `http://localhost:3100/loki/api/v1/query?query={job="mqtt-api"}`
   - **Tempo**: `http://localhost:3200/api/search`

4. **Send test data**:
   ```bash
   curl -X POST http://localhost:3003/send \
     -H "Content-Type: application/json" \
     -d '{"message": "test"}'
   ```
   Then check API logs: `docker logs mqtt-api`

5. **Check Prometheus metrics**:
   - Go to Prometheus (http://localhost:9090)
   - Query: `up{job=~"api|handler"}`
   - Should see service status metrics

### Want to Generate Test Data?

Your application sends data when you:
```bash
# Send a test message to the API
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"message": "test message from curl"}'
```

This will generate:
1. **Logs in Loki**:
   - API: pino-http logs the POST request
   - API: "Sending message to handler: test message from curl"
   - Handler: pino logs "Message received from API" with the payload
   - Handler: pino logs "Publishing response" with the response object

2. **Metrics in Prometheus** (current):
   - `up` metric shows 1 for running services
   - `process_resident_memory_bytes` and `process_cpu_seconds_total` update
   - **After adding /metrics**: HTTP latency histograms and Node.js metrics appear

3. **Traces in Tempo**:
   - Complete trace showing HTTP request to API service
   - Visible within seconds in Grafana

All visible in Grafana within seconds after the request completes!

---

## Dashboard JSON Export/Import

You can export dashboards as JSON for backup or sharing. To import a dashboard:

1. Click **Dashboards** → **Import**
2. Paste JSON or upload JSON file
3. Select data sources
4. Click **Import**

To export: Dashboard menu (top left) → **Share** → **Export** → **Save JSON**
