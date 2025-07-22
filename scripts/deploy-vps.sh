#!/bin/bash

# VPS deployment script for CoachNTT-MCP
set -e

# Configuration
VPS_HOST=${VPS_HOST:-"your-vps-ip"}
VPS_USER=${VPS_USER:-"root"}
VPS_PATH=${VPS_PATH:-"/opt/coachntt-mcp"}
DOMAIN_NAME=${DOMAIN_NAME:-"your-domain.com"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying CoachNTT-MCP to VPS${NC}"

# Check prerequisites
if [ "$VPS_HOST" = "your-vps-ip" ]; then
    echo -e "${RED}❌ Error: Please set VPS_HOST environment variable${NC}"
    exit 1
fi

# Build images
echo -e "${YELLOW}📦 Building Docker images...${NC}"
./scripts/docker-build.sh

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
mkdir -p deploy_tmp
cp docker-compose.prod.yml deploy_tmp/docker-compose.yml
cp -r nginx deploy_tmp/
cp -r templates deploy_tmp/
cp .env.example deploy_tmp/

# Create setup script
cat > deploy_tmp/setup.sh << 'EOF'
#!/bin/bash
set -e

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create directories
mkdir -p data logs projects docs/generated backups nginx/ssl

# Set up environment
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
fi

echo "✅ VPS setup complete!"
EOF

chmod +x deploy_tmp/setup.sh

# Copy files to VPS
echo -e "${YELLOW}📤 Copying files to VPS...${NC}"
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p ${VPS_PATH}"
scp -r deploy_tmp/* ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/

# Run setup on VPS
echo -e "${YELLOW}🔧 Running setup on VPS...${NC}"
ssh ${VPS_USER}@${VPS_HOST} "cd ${VPS_PATH} && ./setup.sh"

# Clean up
rm -rf deploy_tmp

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. SSH to your VPS: ssh ${VPS_USER}@${VPS_HOST}"
echo "2. Navigate to: cd ${VPS_PATH}"
echo "3. Edit .env file with your configuration"
echo "4. Set up SSL certificate:"
echo "   docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d ${DOMAIN_NAME} -d www.${DOMAIN_NAME}"
echo "5. Start services: docker-compose up -d"
echo ""
echo "🔗 Your app will be available at: https://${DOMAIN_NAME}"