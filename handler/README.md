# MQTT Handler

A TypeScript-based MQTT message handler that listens for requests from the API service, processes them, and publishes responses back. This service is part of the LGTM stack and includes integrated observability with OpenTelemetry for tracing and metrics.

## Features

- **Message Processing**: Listen for messages on MQTT request topic and process them
- **Response Publishing**: Publish processed results back to response topic
- **TypeScript**: Full type safety with TypeScript 6.0+
- **OpenTelemetry Integration**: Automatic instrumentation for tracing and metrics collection
- **Structured Logging**: Pino-based logging with pretty-print support
- **MQTT Authentication**: Optional username/password authentication
- **Auto-reconnection**: Configurable reconnection strategies for MQTT broker connection
- **Graceful Shutdown**: Proper signal handling (SIGTERM)
- **Docker Support**: Included Dockerfile for containerized deployment

## Prerequisites

- Node.js 18+ (CommonJS modules)
- TypeScript knowledge for development
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
| `MQTT_BROKER_URL` | `mqtt://test.mosquitto.org` | MQTT broker URL (without port) |
| `MQTT_BROKER_PORT` | `1883` | MQTT broker port |
| `MQTT_CLIENT_ID` | `mqtt-handler` | Client ID for MQTT connection |
| `MQTT_USERNAME` | - | MQTT broker username (optional) |
| `MQTT_PASSWORD` | - | MQTT broker password (optional) |
| `MQTT_CONNECT_TIMEOUT` | `5000` | Connection timeout in milliseconds |
| `MQTT_RECONNECT_PERIOD` | `5000` | Reconnection interval in milliseconds |
| `MQTT_REQUEST_TOPIC` | `handler/request` | Topic to listen for incoming messages |
| `MQTT_RESPONSE_TOPIC` | `handler/response` | Topic to publish processed responses to |
| `TEMPO_ENDPOINT` | `http://tempo:4318/v1/traces` | OpenTelemetry Tempo endpoint for traces |
| `PROMETHEUS_ENDPOINT` | `http://prometheus:4318/v1/metrics` | OpenTelemetry Prometheus endpoint for metrics |

## Usage

### Development

Run with auto-reload on file changes:
```bash
npm run dev
```

### Build

Compile TypeScript to JavaScript:
```bash
npm run build
```

### Production

Start the service:
```bash
npm start
```

The handler will run in the foreground and listen for MQTT messages on the configured request topic.

## How It Works

1. **Connection**: Connects to the MQTT broker at startup
2. **Subscription**: Subscribes to `MQTT_REQUEST_TOPIC` to listen for incoming messages
3. **Processing**: 
   - Receives JSON messages from the API service
   - Parses the payload
   - Creates a response object with:
     - `processed: true`
     - `originalData`: The original message data
     - `processedAt`: ISO timestamp of processing
     - `handler`: Service identifier (`mqtt-handler`)
4. **Response**: Publishes the response to `MQTT_RESPONSE_TOPIC`

### Message Format

**Incoming Message (from API on `MQTT_REQUEST_TOPIC`):**
```json
{
  "message": "your message content",
  "data": { /* optional data */ }
}
```

**Outgoing Response (published to `MQTT_RESPONSE_TOPIC`):**
```json
{
  "processed": true,
  "originalData": { /* original data */ },
  "processedAt": "2026-05-30T10:30:45.123Z",
  "handler": "mqtt-handler"
}
```

## Error Handling

- **Parsing Errors**: If a message cannot be parsed as JSON, it's logged and skipped
- **Publishing Errors**: Failed responses are logged but don't stop the handler
- **Connection Errors**: Logged and will attempt to reconnect based on `MQTT_RECONNECT_PERIOD`
- **Graceful Shutdown**: Responds to SIGTERM by closing MQTT connection and exiting

## Docker

Build the image:
```bash
docker build -t mqtt-handler:latest .
```

Run the container:
```bash
docker run \
  -e MQTT_BROKER_URL=mqtt://your-broker \
  -e MQTT_BROKER_PORT=1883 \
  mqtt-handler:latest
```

## Observability

This service automatically instruments:
- MQTT operations
- Message parsing and processing
- Response publishing

Metrics and traces are exported to:
- **Traces**: OpenTelemetry Tempo (default: `http://tempo:4318/v1/traces`)
- **Metrics**: Prometheus (default: `http://prometheus:4318/v1/metrics`)

For local development without an OpenTelemetry collector, you can disable exports by setting invalid endpoints.

## Logging

Logs are output to stdout using Pino with the service name `mqtt-handler`. The output includes:
- Service initialization
- MQTT connection state changes
- Incoming messages and responses
- Any errors encountered

In development, use `npm run dev` for pretty-printed logs.

## Troubleshooting

### MQTT Connection Failures
- Verify the broker URL and port are correct
- Check firewall/network connectivity to the broker
- Ensure MQTT credentials match if authentication is enabled
- Check logs for specific error messages

### Message Processing Issues
- Verify the message format is valid JSON
- Check `MQTT_REQUEST_TOPIC` is correctly configured
- Review logs for parsing errors

### Trace/Metric Export Issues
- Verify OpenTelemetry endpoints are accessible
- Check collector configuration
- Invalid endpoints will not crash the service but won't export data

## Project Structure

```
handler/
├── src/
│   └── index.ts          # Main handler logic
├── dist/                 # Compiled JavaScript (after npm run build)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variables template
├── Dockerfile            # Docker build configuration
└── README.md             # This file
```

## Dependencies

- **mqtt**: MQTT client library
- **pino**: Logging framework
- **@opentelemetry/\***: OpenTelemetry instrumentation and exporters
- **dotenv**: Environment variable management
- **typescript**: TypeScript compiler
- **tsx**: (dev) TypeScript executor for development
- **@types/\***: (dev) TypeScript type definitions

## License

ISC
