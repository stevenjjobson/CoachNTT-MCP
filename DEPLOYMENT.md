# CoachNTT-MCP Deployment Guide

## Overview

CoachNTT-MCP uses a unified Docker deployment that includes:

- **MCP Server** - For Claude Code integration via WebSocket
- **WebSocket API** - Real-time communication hub
- **Web Dashboard** - Interactive monitoring UI
- **Health Monitoring** - Service health checks

All components run in a single Docker container for simplicity and consistency.

## Prerequisites

- Node.js 18.0.0 or higher
- Git (for session management features)
- 100MB+ free disk space for database

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/CoachNTT-MCP.git
cd CoachNTT-MCP

# Start with Docker (recommended)
docker-compose up -d

# Or build from source first
npm run docker:build
docker-compose up -d
```

## Configuration

### 1. Environment Variables

Create a `.env` file:

```env
# Server Configuration
MCP_WEBSOCKET_HOST=localhost
MCP_WEBSOCKET_PORT=8080
MCP_HEALTH_PORT=8081

# Database
DB_PATH=./data/myworkflow.db

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/server.log

# Context Management
DEFAULT_CONTEXT_BUDGET=100000
WARNING_THRESHOLD=0.8
```

### 2. Configuration File

Create `config/config.yaml`:

```yaml
server:
  name: "MyWorkFlow MCP Server"
  version: "1.0.0"

websocket:
  host: "localhost"
  port: 3001
  authentication: true
  maxConnections: 10

database:
  path: "./data/myworkflow.db"
  backup:
    enabled: true
    interval: 3600
    retention: 7

context:
  defaultBudget: 100000
  warningThreshold: 0.8
  criticalThreshold: 0.95

logging:
  level: "info"
  file: "./logs/server.log"
  console: true
  retention: 30

paths:
  projects: "./projects"
  documentation: "./docs"
  logs: "./logs"
```

## Docker Deployment (Required)

### Starting the Services

```bash
# Development mode with hot reload
npm run docker:dev

# Production mode
docker-compose up -d

# View logs
docker-compose logs -f
```

### Claude Code Configuration

Configure Claude Code to connect via WebSocket:

#### Step 1: Build and Install

```bash
# Build the project
npm run build

# Or install globally (optional)
npm link
```

#### Step 2: Configure Claude Code

Add to your Claude Code settings (usually in `~/.config/claude/settings.json`):

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["/absolute/path/to/CoachNTT-MCP/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "COACH_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

#### Step 3: Verify Integration

In Claude Code, test the connection:

```
Can you check if the CoachNTT MCP server is connected and list available tools?
```

Claude should respond with the 24 available tools including session management, context monitoring, and reality checking.

### Option 2: Standalone MCP Server

For use with other MCP-compatible clients:

```bash
# Start the MCP server
npm start

# The server listens on stdio by default
# Configure your MCP client to connect to:
# command: node
# args: ["/path/to/CoachNTT-MCP/dist/index.js"]
```

### Option 3: WebSocket Server with Dashboard UI

For the full dashboard experience:

```bash
# Install all dependencies
npm run install:all

# Build everything
npm run build:all

# Development mode (recommended for local use)
npm run dev:all

# Or production mode
npm run start:server  # Start WebSocket server
npm run start:ui     # Start UI server

# Access points:
# - Dashboard UI: http://localhost:5173
# - WebSocket: ws://localhost:8080
# - Health check: http://localhost:8081/health
```

#### UI-Only Deployment

If deploying the UI separately:

```bash
cd ui
npm install
npm run build

# The built files will be in ui/dist/
# Serve with any static web server
npx serve -s dist -l 5173
```

#### Environment Configuration

Update the WebSocket URL in the UI if not using default:

```javascript
// ui/src/App.tsx
const ws = new WebSocketService('ws://your-server:8080');
```

### Option 4: Docker Deployment (Recommended)

We provide a complete Docker setup for easy deployment. See [DOCKER_GUIDE.md](DOCKER_GUIDE.md) for detailed instructions.

**Quick Start with Docker:**

```bash
# Development with hot reload
./scripts/docker-dev.sh

# Production
docker-compose up -d
```

**Key Features:**
- 🔧 One-command setup
- 🔄 Hot reload in development
- 🔒 Production-ready security
- 📊 Built-in monitoring
- 🌐 VPS deployment ready
- ✅ Solves WSL networking issues

**Architecture:**
- WebSocket Server (Port 8080)
- UI Dashboard (Port 5173)
- Health Check API (Port 8081)
- Persistent volumes for data

For complete Docker documentation including VPS deployment, see:
- [Docker Guide](DOCKER_GUIDE.md)
- [VPS Setup Guide](VPS_SETUP.md)

### Option 5: VPS Deployment

For production VPS deployment:

```bash
# 1. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clone and setup
git clone https://github.com/your-username/CoachNTT-MCP.git
cd CoachNTT-MCP
npm install
npm run build

# 3. Setup systemd service
sudo tee /etc/systemd/system/myworkflow.service << EOF
[Unit]
Description=MyWorkFlow MCP Server
After=network.target

[Service]
Type=simple
User=myworkflow
WorkingDirectory=/opt/myworkflow
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 4. Enable and start service
sudo systemctl enable myworkflow
sudo systemctl start myworkflow

# 5. Setup nginx reverse proxy (optional)
sudo tee /etc/nginx/sites-available/myworkflow << EOF
server {
    listen 80;
    server_name your-domain.com;

    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location /health {
        proxy_pass http://localhost:3002;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/myworkflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Claude Code Configuration

### Advanced Settings

For optimal Claude Code integration, consider these settings:

```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["/path/to/CoachNTT-MCP/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "COACH_PROJECT_ROOT": "${workspaceFolder}",
        "DEFAULT_CONTEXT_BUDGET": "100000",
        "AUTO_CHECKPOINT": "true",
        "CHECKPOINT_INTERVAL": "25"
      }
    }
  }
}
```

### Environment Variables

- `COACH_PROJECT_ROOT`: Automatically set to current workspace
- `DEFAULT_CONTEXT_BUDGET`: Default token budget for new sessions
- `AUTO_CHECKPOINT`: Enable automatic checkpointing
- `CHECKPOINT_INTERVAL`: Checkpoint when this % of context is used

### Claude Code Commands

Common commands to use with CoachNTT-MCP:

```
# Start a new session
"Start a development session for [project] with [estimated lines]"

# Check context status
"How much context have I used in this session?"

# Create checkpoint
"Create a checkpoint for the work we've done so far"

# Reality check
"Perform a reality check on the current implementation"

# Generate handoff
"Create a handoff document for the next session"
```

## Monitoring

### Health Checks

```bash
# Check server health
curl http://localhost:3002/health

# Response:
{
  "status": "healthy",
  "timestamp": "2024-07-20T12:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "healthy",
    "websocket": "healthy",
    "filesystem": "healthy"
  }
}
```

### Logs

Monitor logs:

```bash
# Server logs
tail -f logs/server.log

# Database queries (debug mode)
tail -f logs/queries.log

# WebSocket connections
tail -f logs/websocket.log
```

### Metrics

Use the built-in metrics endpoint:

```bash
# Get server metrics
curl http://localhost:3002/metrics
```

## Security

### Production Checklist

- [ ] Change default WebSocket authentication secret
- [ ] Enable HTTPS/WSS for production
- [ ] Set up firewall rules
- [ ] Configure log rotation
- [ ] Set up database backups
- [ ] Monitor disk space
- [ ] Set up alerting

### Environment-Specific Settings

```bash
# Production
NODE_ENV=production
LOG_LEVEL=warn
WS_AUTH_SECRET=your-secure-secret

# Development
NODE_ENV=development
LOG_LEVEL=debug
WS_AUTH_SECRET=dev-secret
```

## Troubleshooting

### Common Issues

1. **Database locked errors**
   ```bash
   # Stop all processes
   systemctl stop myworkflow
   # Remove lock files
   rm data/*.db-wal data/*.db-shm
   # Restart
   systemctl start myworkflow
   ```

2. **WebSocket connection failures**
   - Check firewall rules
   - Verify nginx configuration
   - Check authentication secret

3. **High memory usage**
   - Adjust context budgets in config
   - Enable context optimization
   - Monitor session cleanup

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

## Backup & Recovery

### Automated Backups

```bash
# Add to crontab
0 */6 * * * /opt/myworkflow/scripts/backup.sh
```

### Manual Backup

```bash
# Backup database
sqlite3 data/myworkflow.db ".backup data/backup-$(date +%Y%m%d).db"

# Backup configuration
tar -czf config-backup.tar.gz config/
```

### Recovery

```bash
# Restore database
cp data/backup-20240720.db data/myworkflow.db

# Restore config
tar -xzf config-backup.tar.gz
```

## Performance Tuning

### Database Optimization

```sql
-- Run monthly
VACUUM;
ANALYZE;
```

### Memory Settings

```javascript
// In config/config.yaml
performance:
  maxSessionsInMemory: 10
  cacheTimeout: 3600
  compressionEnabled: true
```

## Support

- GitHub Issues: https://github.com/your-username/CoachNTT-MCP/issues
- Documentation: https://docs.myworkflow.dev
- Email: support@myworkflow.dev