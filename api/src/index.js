import 'dotenv/config';
import express from 'express';
import mqtt from 'mqtt';
import pino from 'pino-http';
import promClient from 'prom-client';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

process.env.OTEL_SERVICE_NAME = 'mqtt-api';

// Only enable tracing, not metrics (use prom-client for metrics instead)
const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
        url: process.env.TEMPO_ENDPOINT,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const app = express();
app.use(pino());

// Prometheus metrics middleware
const register = promClient.register;
const defaultMetrics = promClient.collectDefaultMetrics;
defaultMetrics({ register });

// HTTP request duration histogram
const httpDuration = new promClient.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        httpDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
    });
    next();
});

let mqttClient;
let mqttReady = false;

function buildMqttOptions() {
    const options = {
        clientId: process.env.MQTT_CLIENT_ID,
        clean: true,
        connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT),
        reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD),
    };

    // Add authentication if credentials are provided
    if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
        options.username = process.env.MQTT_USERNAME;
        options.password = process.env.MQTT_PASSWORD;
        console.log('MQTT: Using authentication');
    } else {
        console.log('MQTT: Connecting without authentication');
    }

    return options;
}

function connectMqtt() {
    const brokerUrl = `${process.env.MQTT_BROKER_URL}:${process.env.MQTT_BROKER_PORT}`;
    const mqttOptions = buildMqttOptions();

    mqttClient = mqtt.connect(brokerUrl, mqttOptions);

    mqttClient.on('connect', () => {
        mqttReady = true;
        console.log('Connected to MQTT broker');
        mqttClient.subscribe(process.env.MQTT_RESPONSE_TOPIC, (err) => {
            if (err) {
                console.error('Failed to subscribe:', err);
            } else {
                console.log(`Subscribed to ${process.env.MQTT_RESPONSE_TOPIC}`);
            }
        });
    });

    mqttClient.on('message', (topic, message) => {
        console.log(`Message from ${topic}:`, message.toString());
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT error:', err.message);
        mqttReady = false;
    });

    mqttClient.on('disconnect', () => {
        console.log('Disconnected from MQTT broker');
        mqttReady = false;
    });
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'mqtt-api', mqttReady });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

app.post('/send', express.json(), (req, res) => {
    if (!mqttReady) {
        return res.status(503).json({ error: 'MQTT broker not connected' });
    }

    const { message } = req.body;
    console.log('Sending message to handler:', message);

    mqttClient.publish(
        process.env.MQTT_REQUEST_TOPIC,
        JSON.stringify({
            data: message,
            timestamp: new Date().toISOString(),
        }),
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to publish' });
            }
            res.json({ status: 'sent', message });
        }
    );
});

const PORT = process.env.PORT || 3000;

connectMqtt();

app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down');
    if (mqttClient) {
        mqttClient.end();
    }
    process.exit(0);
});