# CoachNTT-MCP Troubleshooting Guide

## Docker Setup Issues

### 1. Port Already Allocated Error

**Error**: `Bind for 0.0.0.0:5173 failed: port is already allocated`

**Solutions**:
1. Check what's using the port:
   ```bash
   lsof -i :5173
   # or
   docker ps --format "table {{.Names}}\t{{.Ports}}"
   ```

2. Stop conflicting containers:
   ```bash
   docker-compose down
   docker network prune
   ```

3. Use alternative port (already configured):
   - UI is mapped to port 5174 instead of 5173
   - Access at http://localhost:5174

### 2. Module Not Found: 'glob'

**Error**: `Error: Cannot find module 'glob'`

**Solution**:
```bash
# Already fixed in package.json, but if occurs:
npm install glob @types/glob
npm run build
docker-compose build --no-cache websocket-server
```

### 3. Missing tsconfig.node.json

**Error**: `parsing /app/tsconfig.node.json failed: Error: ENOENT`

**Solution**:
- File is already created at `ui/tsconfig.node.json`
- Ensure it's mounted in docker-compose.dev.yml (already fixed)

### 4. WebSocket Server Not Starting

**Symptoms**: 
- Health check fails
- Container keeps restarting

**Debugging Steps**:
```bash
# Check logs
docker logs coachntt-websocket-dev

# Check if database directory exists
ls -la data/

# Create if missing
mkdir -p data logs projects docs/generated

# Check environment variables
docker-compose config
```

### 5. UI Can't Connect to WebSocket

**Symptoms**:
- UI loads but shows connection error
- WebSocket connection fails in browser console

**Solutions**:
1. Verify WebSocket server is running:
   ```bash
   curl http://localhost:8081/health
   ```

2. Check CORS and WebSocket URL:
   - UI connects to `ws://localhost:8080`
   - Ensure no firewall blocking

3. Check browser console for errors

### 6. Docker Compose Version Warning

**Warning**: `the attribute 'version' is obsolete`

**Solution**: Already fixed - removed version field from docker-compose files

## Database Issues

### 1. Database I/O Error

**Error**: `SQLITE_IOERR: disk I/O error`

**Solutions**:
```bash
# Check permissions
ls -la data/

# Fix permissions
chmod 755 data/
chmod 644 data/*.db

# For Docker
docker-compose down
rm -rf data/*.db
docker-compose up
```

### 2. Database Locked

**Error**: `SQLITE_BUSY: database is locked`

**Solution**:
- Ensure only one instance is running
- Check for zombie processes:
  ```bash
  ps aux | grep node
  pkill -f "node.*server"
  ```

## Build Issues

### 1. TypeScript Build Fails

**Solution**:
```bash
# Clean build
rm -rf dist/
npm run build

# Check for type errors
npm run typecheck
```

### 2. Docker Build Fails

**Solutions**:
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Check Docker disk space
docker system df
```

## Network Issues

### 1. WSL Can't Access Localhost

**Solutions**:
1. Use Docker Desktop (recommended)
2. Access via Windows IP:
   ```bash
   # Get Windows IP from WSL
   cat /etc/resolv.conf | grep nameserver
   ```
3. Use host.docker.internal in configs

### 2. VPS Connection Issues

**Check**:
- Firewall rules (ports 80, 443, 8080, 8081)
- DNS propagation
- SSL certificate validity
- Nginx configuration

## Quick Fixes

### Reset Everything
```bash
# Stop all services
docker-compose down

# Clean up
docker system prune -a
rm -rf node_modules ui/node_modules
rm -rf dist ui/dist
rm -rf data/*.db

# Reinstall and rebuild
npm run install:all
npm run build:all
npm run docker:dev
```

### Check Service Status
```bash
# List running containers
docker ps

# Check specific service logs
docker logs coachntt-websocket-dev -f
docker logs coachntt-ui-dev -f

# Check network
docker network inspect coachntt-network
```

### Environment Variables
```bash
# Create .env from template
cp .env.example .env

# Generate secure auth token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env
nano .env
```

## Common Development Workflows

### 1. Making Code Changes

**WebSocket Server**:
- Changes require rebuild:
  ```bash
  npm run build
  docker-compose restart websocket-server
  ```

**UI Changes**:
- Hot reload works automatically
- If not, check volume mounts in docker-compose.dev.yml

### 2. Adding Dependencies

```bash
# Stop containers
docker-compose down

# Add dependency
npm install package-name

# Rebuild
npm run build
docker-compose build
docker-compose up
```

### 3. Debugging Inside Container

```bash
# Access container shell
docker exec -it coachntt-websocket-dev sh

# Check environment
env | grep MCP

# Test database
cd /app/data && ls -la
```

## Getting Help

1. Check logs first:
   ```bash
   docker-compose logs -f --tail=100
   ```

2. Enable debug logging:
   - Set `LOG_LEVEL=debug` in .env

3. Check GitHub issues for similar problems

4. When reporting issues, include:
   - Error messages from logs
   - Docker and Node.js versions
   - Operating system
   - Steps to reproduce