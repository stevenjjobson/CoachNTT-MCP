# VPS Setup Guide for CoachNTT-MCP

Complete guide for deploying CoachNTT-MCP on a VPS with Docker, SSL, and production optimizations.

## 📋 Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: 20GB+ available
- **CPU**: 2+ cores recommended
- **Network**: Public IP address

### Required Ports
- **80**: HTTP (for Let's Encrypt)
- **443**: HTTPS
- **8080**: WebSocket (optional, can proxy through nginx)
- **8081**: Health check (optional, can proxy through nginx)

### Domain Setup
- Domain name pointing to VPS IP
- DNS A records configured

## 🚀 Step-by-Step Setup

### Step 1: Initial VPS Configuration

```bash
# Connect to VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install essential packages
apt install -y curl git nano ufw fail2ban

# Configure firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8080/tcp  # WebSocket (optional)
ufw allow 8081/tcp  # Health check (optional)
ufw --force enable

# Configure fail2ban for security
systemctl enable fail2ban
systemctl start fail2ban
```

### Step 2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add current user to docker group (if not root)
usermod -aG docker $USER

# Enable Docker service
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Step 3: Clone and Configure CoachNTT-MCP

```bash
# Create application directory
mkdir -p /opt/coachntt-mcp
cd /opt/coachntt-mcp

# Clone repository
git clone https://github.com/yourusername/CoachNTT-MCP.git .

# Create required directories
mkdir -p data logs projects docs/generated backups nginx/ssl

# Copy and configure environment
cp .env.example .env
nano .env
```

### Step 4: Configure Environment Variables

Edit `.env` with your settings:

```bash
# Required Configuration
NODE_ENV=production
MCP_WEBSOCKET_AUTH=your-secure-secret-key-here
DOMAIN_NAME=your-domain.com
PUBLIC_WS_URL=wss://your-domain.com/ws
SSL_EMAIL=admin@your-domain.com

# Optional Configuration
LOG_LEVEL=info
BACKUP_SCHEDULE=0 2 * * *  # 2 AM daily
MAX_MEMORY=512M
MAX_CPU=1.0
```

### Step 5: Initial SSL Certificate Setup

```bash
# Start nginx for initial certificate request
docker-compose -f docker-compose.prod.yml up -d nginx-proxy

# Request SSL certificate
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d your-domain.com -d www.your-domain.com \
  --email admin@your-domain.com \
  --agree-tos --no-eff-email

# Stop nginx
docker-compose -f docker-compose.prod.yml down
```

### Step 6: Update Nginx Configuration

```bash
# Replace domain placeholder in nginx config
sed -i "s/\${DOMAIN_NAME}/your-domain.com/g" nginx/vps.conf

# Verify SSL certificate paths
ls -la nginx/ssl/live/your-domain.com/
```

### Step 7: Build and Start Services

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 8: Verify Deployment

```bash
# Check local health
curl http://localhost:8081/health

# Check through nginx
curl https://your-domain.com/api/health

# Test WebSocket connection
wscat -c wss://your-domain.com/ws
```

## 🔧 Advanced Configuration

### Custom Domain Configuration

For multiple domains or subdomains:

```nginx
# In nginx/vps.conf
server_name app.your-domain.com;

# Update SSL paths
ssl_certificate /etc/nginx/ssl/live/app.your-domain.com/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/live/app.your-domain.com/privkey.pem;
```

### Resource Optimization

Edit `docker-compose.prod.yml`:

```yaml
services:
  websocket-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
```

### Monitoring Setup

```bash
# Install monitoring tools
docker run -d \
  --name node-exporter \
  --net="host" \
  --pid="host" \
  -v "/:/host:ro,rslave" \
  prom/node-exporter

# Check metrics
curl http://localhost:9100/metrics
```

### Backup Configuration

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec backup \
  tar -czf /backups/manual-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  /backup/data /backup/logs /backup/projects

# Restore from backup
tar -xzf /opt/coachntt-mcp/backups/backup-20240120-020000.tar.gz -C /
```

## 🔒 Security Hardening

### 1. SSH Security

```bash
# Change SSH port
sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config

# Disable root login
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Restart SSH
systemctl restart ssh

# Update firewall
ufw delete allow 22/tcp
ufw allow 2222/tcp
```

### 2. Automatic Updates

```bash
# Install unattended upgrades
apt install -y unattended-upgrades

# Enable automatic updates
dpkg-reconfigure -plow unattended-upgrades
```

### 3. Docker Security

```bash
# Enable Docker content trust
echo "export DOCKER_CONTENT_TRUST=1" >> ~/.bashrc

# Limit container capabilities in docker-compose.prod.yml
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
```

## 🔄 Maintenance

### Daily Tasks
- Monitor logs: `docker-compose logs --tail=100`
- Check disk space: `df -h`
- Verify backups: `ls -la backups/`

### Weekly Tasks
- Update containers: `docker-compose pull`
- Review security logs: `grep "Failed password" /var/log/auth.log`
- Check SSL expiry: `docker-compose exec nginx-proxy nginx -t`

### Monthly Tasks
- System updates: `apt update && apt upgrade`
- Docker cleanup: `docker system prune -a`
- Review resource usage: `docker stats`

## 📊 Monitoring Endpoints

After deployment, monitor your application:

- **Public Dashboard**: https://your-domain.com
- **Health Check**: https://your-domain.com/api/health
- **WebSocket Status**: wss://your-domain.com/ws

## 🚨 Troubleshooting

### SSL Certificate Issues

```bash
# Test certificate
docker-compose -f docker-compose.prod.yml exec nginx-proxy \
  openssl s_client -connect localhost:443 -servername your-domain.com

# Force renewal
docker-compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
```

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs websocket-server

# Inspect container
docker inspect coachntt-websocket

# Check resources
free -m
df -h
```

### Network Issues

```bash
# Test internal network
docker network inspect coachntt-network

# Check port bindings
netstat -tulpn | grep -E "(80|443|8080|8081)"

# Verify DNS
dig your-domain.com
```

## 🔄 Updates and Rollbacks

### Updating Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verify update
docker-compose -f docker-compose.prod.yml logs -f
```

### Rollback Procedure

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore previous version
git checkout previous-tag

# Rebuild and start
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Deployment Checklist

- [ ] VPS provisioned and accessible
- [ ] Domain DNS configured
- [ ] Firewall rules configured
- [ ] Docker and Docker Compose installed
- [ ] Repository cloned
- [ ] Environment variables configured
- [ ] SSL certificate obtained
- [ ] Services started successfully
- [ ] Health checks passing
- [ ] Backups configured
- [ ] Monitoring enabled
- [ ] Security hardening complete

## 🆘 Support

If you encounter issues:

1. Check container logs
2. Verify environment configuration
3. Test health endpoints
4. Review nginx error logs
5. Check Docker daemon logs: `journalctl -u docker`

For additional help, create an issue with:
- VPS specifications
- Docker version
- Error logs
- Steps to reproduce