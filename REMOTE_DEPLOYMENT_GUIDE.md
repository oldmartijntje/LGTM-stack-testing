# Running LGTM Stack Testing on Remote Linux via SSH

This guide explains how to deploy and run the LGTM stack testing project on another Linux device via SSH.

## Prerequisites

- **Local Machine**: Git installed
- **Remote Machine**: 
  - Docker installed
  - Docker Compose installed
  - SSH server running
  - Sufficient disk space (at least 1GB for container images and volumes)

## Step 1: SSH into the Remote Device

```bash
ssh user@remote_host
# Example: ssh ubuntu@192.168.1.100
```

Replace `user` with the remote username and `remote_host` with the IP address or hostname of the remote device.

## Step 2: Clone the Repository

On the remote machine, clone the repository:

```bash
git clone https://github.com/oldmartijntje/LGTM-stack-testing.git
cd LGTM-stack-testing
```

## Step 3: Configure Environment Variables

The project uses environment variables for the `api` and `handler` services. Create `.env` files based on the provided `.env.example` files:

### API Environment Variables

```bash
cp api/.env.example api/.env
```

Then edit `api/.env` and update the values as needed:

```bash
PORT=3003
MQTT_BROKER_URL=mqtt://your.broker.address
MQTT_BROKER_PORT=1883
MQTT_CLIENT_ID=mqtt-api
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password
MQTT_CONNECT_TIMEOUT=5000
MQTT_RECONNECT_PERIOD=5000
MQTT_REQUEST_TOPIC=handler/request
MQTT_RESPONSE_TOPIC=handler/response
TEMPO_ENDPOINT=http://tempo:4318/v1/traces
PROMETHEUS_ENDPOINT=http://prometheus:4318/v1/metrics
```

### Handler Environment Variables

```bash
cp handler/.env.example handler/.env
```

Then edit `handler/.env` and update the values as needed:

```bash
MQTT_BROKER_URL=mqtt://your.broker.address
MQTT_BROKER_PORT=1883
MQTT_CLIENT_ID=mqtt-handler
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password
MQTT_CONNECT_TIMEOUT=5000
MQTT_RECONNECT_PERIOD=5000
MQTT_REQUEST_TOPIC=handler/request
MQTT_RESPONSE_TOPIC=handler/response
TEMPO_ENDPOINT=http://tempo:4318/v1/traces
PROMETHEUS_ENDPOINT=http://prometheus:4318/v1/metrics
```

> **Note**: If you already have configured `.env` files from your local development machine, copy them directly to the remote device:
> ```bash
> scp path/to/local/api/.env user@remote_host:/path/to/LGTM-stack-testing/api/
> scp path/to/local/handler/.env user@remote_host:/path/to/LGTM-stack-testing/handler/
> ```

## Step 4: Start the Docker Stack

Navigate to the project root and start all services:

```bash
sudo docker compose up -d
```

The `-d` flag runs containers in detached mode (background).

### Services Started

| Service | Port(s) | Purpose |
|---------|---------|---------|
| **Grafana** | `3050` | Visualization & dashboards |
| **Prometheus** | `9090` | Metrics collection |
| **Loki** | `3100` | Log aggregation |
| **Tempo** | `3200, 4317, 4318` | Distributed tracing |
| **API** | `3001` | Application API service |
| **Handler** | - | Background handler service |

## Step 5: Access Services from Local Machine

### Option A: SSH Tunneling (Recommended for Secure Access)

Create SSH tunnels to access remote services locally:

```bash
# Forward Grafana (3050)
ssh -L 3050:localhost:3050 user@remote_host -N

# In separate terminals, forward other services:
ssh -L 9090:localhost:9090 user@remote_host -N  # Prometheus
ssh -L 3100:localhost:3100 user@remote_host -N  # Loki
ssh -L 3200:localhost:3200 user@remote_host -N  # Tempo
ssh -L 3001:localhost:3001 user@remote_host -N  # API
```

Then access services locally:
- Grafana: http://localhost:3050 (admin/admin)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100
- Tempo: http://localhost:3200
- API: http://localhost:3001

### Option B: Direct Access

If the remote device is on the same network or has firewall rules allowing it, access services directly:

- Grafana: http://remote_host:3050
- Prometheus: http://remote_host:9090
- Loki: http://remote_host:3100
- Tempo: http://remote_host:3200
- API: http://remote_host:3001

## Step 6: Monitor Container Status

While SSH'd into the remote machine:

```bash
# View running containers
sudo docker compose ps

# View logs from all services
sudo docker compose logs -f

# View logs from specific service
sudo docker compose logs -f grafana
sudo docker compose logs -f api
sudo docker compose logs -f handler
```

## Step 7: Stop the Stack

When finished, stop all services:

```bash
sudo docker compose down
```

To also remove volumes (data):

```bash
sudo docker compose down -v
```

## Common Management Commands

### Rebuild Services

If code changes:

```bash
sudo docker compose build --no-cache
sudo docker compose up -d
```

### View Specific Service Logs

```bash
sudo docker compose logs api
sudo docker compose logs handler
```

### Restart a Service

```bash
sudo docker compose restart api
```

### Execute Command in Running Container

```bash
sudo docker compose exec api npm run some-command
sudo docker compose exec handler npm run some-command
```

## Troubleshooting

### Services Won't Start

1. Check logs: `sudo docker compose logs`
2. Ensure Docker daemon is running: `sudo systemctl status docker`
3. Verify port availability: `sudo netstat -tulpn | grep LISTEN`

### Containers Crashing

```bash
# View container status
sudo docker compose ps

# Check logs for errors
sudo docker compose logs service_name

# Increase log verbosity if available
```

### Port Already in Use

If a port is already occupied on the remote machine:

1. Find the process using the port:
   ```bash
   sudo lsof -i :PORT_NUMBER
   ```

2. Either stop the conflicting process or modify the port mappings in `docker-compose.yml`:
   ```yaml
   ports:
     - "NEW_PORT:INTERNAL_PORT"
   ```

3. Rebuild and restart:
   ```bash
   sudo docker compose up -d
   ```

### Data Persistence Issues

Volumes are defined in `docker-compose.yml` and persist between container restarts:
- `prometheus_data`: Metrics storage
- `loki_data`: Log storage
- `tempo_data`: Trace storage
- `grafana_data`: Grafana configuration

To clear all data and start fresh:

```bash
sudo docker compose down -v
sudo docker compose up -d
```

### Connection Issues

If you can't connect to services via SSH tunnel:

1. Verify SSH connection works: `ssh -v user@remote_host`
2. Check firewall on remote machine: `sudo ufw status`
3. Allow SSH if needed: `sudo ufw allow 22`
4. Test port connectivity: `nc -zv localhost 3050`

## Performance Considerations

- **Memory**: The stack typically requires 2-4GB RAM
- **Storage**: ~2-5GB for container images and initial volumes
- **CPU**: Minimal CPU requirements; scale based on load
- **Network**: Ensure stable connection for log/metric streaming

## Production Deployment

For production use, consider:

1. **Security**:
   - Use SSH keys instead of passwords
   - Configure firewall rules
   - Use `docker-compose.prod.yml` if available

2. **Persistence**:
   - Use external storage volumes
   - Configure backups for important data

3. **Monitoring**:
   - Set up alerts in Prometheus/Grafana
   - Monitor container health

4. **Resource Limits**:
   - Add memory/CPU limits in docker-compose.yml
   - Monitor resource usage

## Getting Help

For issues specific to each service:

- **Grafana**: Check logs and visit the UI
- **Prometheus**: Review `lgtm/prometheus.yml` configuration
- **Loki**: Review `lgtm/loki-config.yml` configuration
- **Tempo**: Review `lgtm/tempo-config.yml` configuration
- **API/Handler**: Check `.env` files and application logs
