# Docker Guide for CoachNTT-MCP

This guide covers everything you need to know about running CoachNTT-MCP with Docker.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Development Setup](#development-setup)
4. [Production Deployment](#production-deployment)
5. [VPS Deployment](#vps-deployment)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)
8. [Architecture](#architecture)

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- Node.js 18+ (for local development)
- Git

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/CoachNTT-MCP.git
cd CoachNTT-MCP

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

### 2. Start with Docker

```bash
# Development mode (with hot reload)
./scripts/docker-dev.sh

# Production mode
docker-compose up -d
```

### 3. Access the Application

- **Dashboard UI**: http://localhost:5173
- **WebSocket API**: ws://localhost:8080
- **Health Check**: http://localhost:8081/health

## Development Setup

### Starting Development Environment

```bash
# Start with hot reload
./scripts/docker-dev.sh

# Or manually with docker-compose
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Development Features

- **Hot Reload**: Changes to UI code automatically refresh
- **Volume Mounts**: Source code mounted for live updates
- **Debug Logs**: Set `LOG_LEVEL=debug` in .env
- **Separate Containers**: UI and server run independently

### Useful Development Commands

```bash
# View logs
docker-compose logs -f

# Restart a service
docker-compose restart websocket-server

# Execute commands in container
docker-compose exec websocket-server sh

# Rebuild after dependency changes
docker-compose build --no-cache
```

## Production Deployment

### Building for Production

```bash
# Build all images
./scripts/docker-build.sh

# Or manually
docker build -f Dockerfile.server -t coachntt-websocket:latest .
docker build -f ui/Dockerfile -t coachntt-ui:latest ./ui
```

### Running in Production

```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# With specific version
VERSION=1.0.0 docker-compose -f docker-compose.prod.yml up -d
```

### Production Features

- Resource limits enforced
- Health checks enabled
- Automatic restarts
- Log rotation
- Named volumes for data persistence

## VPS Deployment

### Prerequisites

- VPS with Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- Domain name pointed to VPS IP
- Ports 80, 443, 8080, 8081 open

### Automated Deployment

```bash
# Set environment variables
export VPS_HOST=your-vps-ip
export VPS_USER=root
export DOMAIN_NAME=your-domain.com

# Deploy to VPS
./scripts/deploy-vps.sh
```

### Manual VPS Setup

1. **SSH to VPS**
```bash
ssh root@your-vps-ip
```

2. **Install Docker**
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
```

3. **Clone Repository**
```bash
git clone https://github.com/yourusername/CoachNTT-MCP.git /opt/coachntt-mcp
cd /opt/coachntt-mcp
```

4. **Configure Environment**
```bash
cp .env.example .env
nano .env  # Edit with your domain and settings
```

5. **Set Up SSL Certificate**
```bash
# Initial certificate
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d your-domain.com -d www.your-domain.com \
  --email admin@your-domain.com --agree-tos

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### SSL Certificate Renewal

Certificates auto-renew via the certbot container. To manually renew:

```bash
docker-compose -f docker-compose.prod.yml run --rm certbot renew
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# General
NODE_ENV=production
LOG_LEVEL=info

# Security
MCP_WEBSOCKET_AUTH=your-secret-key

# VPS Deployment
DOMAIN_NAME=your-domain.com
PUBLIC_WS_URL=wss://your-domain.com/ws
SSL_EMAIL=admin@your-domain.com

# Docker Registry (optional)
DOCKER_REGISTRY=ghcr.io
DOCKER_ORG=yourusername
VERSION=latest

# Resources
MAX_MEMORY=512M
MAX_CPU=1.0
```

### Volume Mappings

| Volume | Purpose | Persistence |
|--------|---------|-------------|
| `./data` | SQLite database | Required |
| `./logs` | Application logs | Recommended |
| `./projects` | Project files | Required |
| `./docs/generated` | Generated docs | Optional |
| `./templates` | Doc templates | Required |

## Troubleshooting

### Common Issues

#### 1. **Port Already in Use**
```bash
# Find process using port
lsof -i :8080

# Or change port in docker-compose.yml
ports:
  - "8090:8080"
```

#### 2. **Permission Denied**
```bash
# Fix permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

#### 3. **Container Won't Start**
```bash
# Check logs
docker-compose logs websocket-server

# Verify build
docker-compose build --no-cache

# Check health
docker-compose ps
```

#### 4. **WebSocket Connection Failed**
- Ensure `VITE_WS_URL` matches your WebSocket server URL
- Check firewall rules for port 8080
- Verify nginx configuration for `/ws` location

#### 5. **Out of Memory**
```bash
# Increase limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
```

### Debug Commands

```bash
# Interactive shell in container
docker-compose exec websocket-server sh

# View real-time logs
docker-compose logs -f --tail=100

# Check container resources
docker stats

# Inspect network
docker network inspect coachntt-network
```

## Architecture

### Container Structure

```
┌─────────────────────────────────────────┐
│            Docker Network               │
├─────────────────────┬───────────────────┤
│   websocket-server  │   ui-dashboard    │
│   - Port 8080 (WS)  │   - Port 5173/80  │
│   - Port 8081 (API) │   - Nginx server  │
│   - Node.js app     │   - React app     │
│   - SQLite DB       │                   │
└─────────────────────┴───────────────────┘
         │                      │
         └──────────┬───────────┘
                    │
            ┌───────────────┐
            │    Volumes    │
            │ - data        │
            │ - logs        │
            │ - projects    │
            └───────────────┘
```

### Service Communication

- UI → WebSocket Server: Direct WebSocket connection
- Nginx → Services: Reverse proxy for production
- Services → Volumes: Persistent data storage

### Security Considerations

1. **Network Isolation**: Services communicate on internal network
2. **Non-root User**: Containers run as non-root user
3. **Read-only Mounts**: Templates mounted as read-only
4. **SSL/TLS**: Enforced in production via nginx
5. **Rate Limiting**: Configured in nginx
6. **Secret Management**: Use Docker secrets or environment variables

## Best Practices

1. **Always use .env files** - Never hardcode secrets
2. **Regular backups** - Use the backup service or external solutions
3. **Monitor logs** - Set up log aggregation for production
4. **Update regularly** - Keep Docker images updated
5. **Resource limits** - Set appropriate limits for your VPS
6. **Health checks** - Monitor endpoint availability

## Integration with Claude Code

The MCP server component still runs separately via stdio when Claude Code starts it. The Docker setup provides:

1. **WebSocket Server**: For UI communication
2. **Dashboard**: For monitoring and control
3. **Persistence**: For session and project data

This architecture ensures CoachNTT-MCP works seamlessly with Claude Code while providing additional monitoring capabilities.

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review container logs
3. Open an issue on GitHub
4. Check Docker Desktop diagnostics