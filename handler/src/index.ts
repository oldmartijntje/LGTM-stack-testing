import 'dotenv/config';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import pino from 'pino';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

process.env.OTEL_SERVICE_NAME = 'mqtt-handler';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.TEMPO_ENDPOINT,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.PROMETHEUS_ENDPOINT,
    }),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const logger = pino({
  transport: {
    target: 'pino-pretty',
  },
});

let mqttClient: MqttClient;
let mqttReady = false;

function buildMqttOptions(): IClientOptions {
  const options: IClientOptions = {
    clientId: process.env.MQTT_CLIENT_ID,
    clean: true,
    connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT || '5000'),
    reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD || '5000'),
  };

  // Add authentication if credentials are provided
  if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
    options.username = process.env.MQTT_USERNAME;
    options.password = process.env.MQTT_PASSWORD;
    logger.info('MQTT: Using authentication');
  } else {
    logger.info('MQTT: Connecting without authentication');
  }

  return options;
}

function connectMqtt() {
  const brokerUrl = `${process.env.MQTT_BROKER_URL}:${process.env.MQTT_BROKER_PORT}`;
  const mqttOptions = buildMqttOptions();

  mqttClient = mqtt.connect(brokerUrl, mqttOptions);

  mqttClient.on('connect', () => {
    mqttReady = true;
    logger.info('Connected to MQTT broker');
    mqttClient.subscribe(process.env.MQTT_REQUEST_TOPIC!, (err) => {
      if (err) {
        logger.error({ err }, 'Failed to subscribe');
      } else {
        logger.info(`Subscribed to ${process.env.MQTT_REQUEST_TOPIC}`);
      }
    });
  });

  mqttClient.on('message', (topic: string, message: Buffer) => {
    try {
      const payload = JSON.parse(message.toString());
      logger.info({ topic, payload }, 'Message received from API');

      const response = {
        processed: true,
        originalData: payload.data,
        processedAt: new Date().toISOString(),
        handler: 'mqtt-handler',
      };

      logger.info({ response }, 'Publishing response');
      mqttClient.publish(
        process.env.MQTT_RESPONSE_TOPIC!,
        JSON.stringify(response),
        (err) => {
          if (err) {
            logger.error({ err }, 'Failed to publish response');
          }
        }
      );
    } catch (err) {
      logger.error(
        { err, message: message.toString() },
        'Failed to parse message'
      );
    }
  });

  mqttClient.on('error', (err) => {
    logger.error({ err }, 'MQTT error');
    mqttReady = false;
  });

  mqttClient.on('disconnect', () => {
    logger.info('Disconnected from MQTT broker');
    mqttReady = false;
  });
}

function main() {
  connectMqtt();
  logger.info('Handler ready and listening');
}

main();

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  if (mqttClient) {
    mqttClient.end();
  }
  process.exit(0);
});
