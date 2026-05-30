# MQTT API

An Express.js-based HTTP API that bridges HTTP requests to MQTT communication. This service provides a REST interface for sending messages to an MQTT broker and includes integrated observability with OpenTelemetry for tracing and metrics.

## Features

- **HTTP-to-MQTT Gateway**: Convert HTTP POST requests into MQTT publish operations
- **Health Checks**: Built-in health endpoint to monitor service status
- **OpenTelemetry Integration**: Automatic instrumentation for tracing and metrics collection
- **Structured Logging**: Pino-based logging with pretty-print support
- **MQTT Authentication**: Optional username/password authentication
- **Auto-reconnection**: Configurable reconnection strategies for MQTT broker connection
- **Docker Support**: Included Dockerfile for containerized deployment

## Prerequisites

- Node.js 18+ (ES modules support)
- Access to an MQTT broker (local or remote)
- (Optional) OpenTelemetry collector for trace/metric export

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Configure environment variables (see [Configuration](#configuration) section)

## Configuration

All configuration is done through environment variables. See `.env.example` for defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `MQTT_BROKER_URL` | `mqtt://test.mosquitto.org` | MQTT broker URL (without port) |
| `MQTT_BROKER_PORT` | `1883` | MQTT broker port |
| `MQTT_CLIENT_ID` | `mqtt-api` | Client ID for MQTT connection |
| `MQTT_USERNAME` | - | MQTT broker username (optional) |
| `MQTT_PASSWORD` | - | MQTT broker password (optional) |
| `MQTT_CONNECT_TIMEOUT` | `5000` | Connection timeout in milliseconds |
| `MQTT_RECONNECT_PERIOD` | `5000` | Reconnection interval in milliseconds |
| `MQTT_REQUEST_TOPIC` | `handler/request` | Topic to publish messages to |
| `MQTT_RESPONSE_TOPIC` | `handler/response` | Topic to subscribe to for responses |
| `TEMPO_ENDPOINT` | `http://tempo:4318/v1/traces` | OpenTelemetry Tempo endpoint for traces |
| `PROMETHEUS_ENDPOINT` | `http://prometheus:4318/v1/metrics` | OpenTelemetry Prometheus endpoint for metrics |

## Usage

### Development

Run with auto-reload on file changes:
```bash
npm run dev
```

### Production

Start the service:
```bash
npm start
```

The API will be available at `http://localhost:3000` (or your configured PORT).

## API Endpoints

### Health Check
```http
GET /health
```

Returns the service status and MQTT connection state.

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "mqtt-api",
  "mqttReady": true
}
```

### Send Message
```http
POST /send
Content-Type: application/json

{
  "message": "your message content"
}
```

Publishes a message to the configured MQTT request topic.

**Response (200 OK):**
```json
{
  "success": true
}
```

**Response (503 Service Unavailable):**
```json
{
  "error": "MQTT broker not connected"
}
```

## Docker

Build the image:
```bash
docker build -t mqtt-api:latest .
```

Run the container:
```bash
docker run -p 3000:3000 \
  -e MQTT_BROKER_URL=mqtt://your-broker \
  -e MQTT_BROKER_PORT=1883 \
  mqtt-api:latest
```

## Observability

This service automatically instruments:
- HTTP requests/responses
- MQTT connection events
- Express middleware

Metrics and traces are exported to:
- **Traces**: OpenTelemetry Tempo (default: `http://tempo:4318/v1/traces`)
- **Metrics**: Prometheus (default: `http://prometheus:4318/v1/metrics`)

For local development without an OpenTelemetry collector, you can disable exports by setting invalid endpoints.

## Logging

Logs are output to stdout using Pino with the service name `mqtt-api`. In development, use `npm run dev` for pretty-printed logs.

## Troubleshooting

### MQTT Connection Failures
- Verify the broker URL and port are correct
- Check firewall/network connectivity to the broker
- Ensure MQTT credentials match if authentication is enabled
- Check logs for specific error messages

### Service Unavailable (503)
- Wait for MQTT connection to establish
- Check MQTT broker status
- Review MQTT connection timeout settings

### Trace/Metric Export Issues
- Verify OpenTelemetry endpoints are accessible
- Check collector configuration
- Invalid endpoints will not crash the service but won't export data

## Dependencies

- **express**: Web framework
- **mqtt**: MQTT client library
- **pino**: Logging framework
- **@opentelemetry/\***: OpenTelemetry instrumentation and exporters
- **dotenv**: Environment variable management
- **nodemon**: (dev) Auto-reload during development

## License

ISC
