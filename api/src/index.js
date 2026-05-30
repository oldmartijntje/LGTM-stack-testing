import express from 'express';
import mqtt from 'mqtt';
import pino from 'pino-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry
const resource = Resource.default().merge(
    new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'mqtt-api',
    }),
);

const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
        url: 'http://tempo:4318/v1/traces',
    }),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
            url: 'http://prometheus:4318/v1/metrics',
        }),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const app = express();
app.use(pino());

let mqttClient;

async function connectMqtt() {
    return new Promise((resolve, reject) => {
        mqttClient = mqtt.connect('mqtt://test.mosquitto.org:1883', {
            clientId: 'mqtt-api',
            clean: true,
        });

        mqttClient.on('connect', () => {
            console.log('Connected to MQTT broker');
            mqttClient.subscribe('handler/response', (err) => {
                if (err) {
                    console.error('Failed to subscribe:', err);
                    reject(err);
                } else {
                    console.log('Subscribed to handler/response');
                    resolve();
                }
            });
        });

        mqttClient.on('message', (topic, message) => {
            console.log(`Message from ${topic}:`, message.toString());
        });

        mqttClient.on('error', (err) => {
            console.error('MQTT error:', err);
            reject(err);
        });
    });
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'mqtt-api' });
});

app.post('/send', express.json(), (req, res) => {
    const { message } = req.body;
    console.log('Sending message to handler:', message);

    mqttClient.publish('handler/request', JSON.stringify({
        data: message,
        timestamp: new Date().toISOString(),
    }), (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to publish' });
        }
        res.json({ status: 'sent', message });
    });
});

const PORT = process.env.PORT || 3000;

await connectMqtt();

app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down');
    mqttClient.end();
    process.exit(0);
});