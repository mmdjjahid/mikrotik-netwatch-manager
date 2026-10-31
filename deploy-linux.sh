#!/usr/bin/env bash
# =============================================================================
# Netwatch Manager — Linux Auto-Deploy Script
# Supports: Ubuntu, Debian, CentOS, RHEL, Fedora, Rocky, AlmaLinux
# =============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================================${NC}"
echo -e "${BLUE}         Netwatch Manager — Linux One-Click Deployer             ${NC}"
echo -e "${BLUE}=================================================================${NC}"

# 1. Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}[!] Docker not found. Installing official Docker Engine...${NC}"
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm -f get-docker.sh
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}[✔] Docker successfully installed!${NC}"
else
  echo -e "${GREEN}[✔] Docker is already installed: $(docker --version)${NC}"
fi

# 2. Check Docker Compose
if ! docker compose version &> /dev/null; then
  echo -e "${YELLOW}[!] Installing Docker Compose plugin...${NC}"
  if command -v apt-get &> /dev/null; then
    apt-get update && apt-get install -y docker-compose-plugin
  elif command -v yum &> /dev/null; then
    yum install -y docker-compose-plugin
  fi
fi
echo -e "${GREEN}[✔] Docker Compose is ready: $(docker compose version)${NC}"

# 3. Setup .env file
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "${BLUE}[*] Creating .env from .env.example...${NC}"
    cp .env.example .env
  else
    echo -e "${YELLOW}[*] Generating new .env with cryptographic keys...${NC}"
    ENC_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
    JWT_SEC=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
    cat <<EOF > .env
PORT=3000
ENCRYPT_KEY=${ENC_KEY}
JWT_SECRET=${JWT_SEC}
EOF
  fi
  echo -e "${GREEN}[✔] .env file configured.${NC}"
fi

# 4. Prepare data directory for persistent SQLite database
mkdir -p data
chmod 775 data

# 5. Build and run container with Docker Compose
echo -e "${BLUE}[*] Building and starting Netwatch container...${NC}"
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}  ✔ Netwatch Manager successfully deployed and running!         ${NC}"
echo -e "${GREEN}=================================================================${NC}"
echo -e "Access URL:          ${BLUE}http://$(hostname -I | awk '{print $1}'):3000${NC} (or http://localhost:3000)"
echo -e "Default Username:    ${YELLOW}admin${NC}"
echo -e "Default Password:    ${YELLOW}admin${NC}"
echo ""
echo -e "Helpful commands:"
echo -e "  View logs:         ${BLUE}docker compose logs -f${NC}"
echo -e "  Restart service:   ${BLUE}docker compose restart${NC}"
echo -e "  Stop service:      ${BLUE}docker compose down${NC}"
echo -e "  Backup DB file:    ${BLUE}cp data/netwatch.db /backup/location/${NC}"
echo -e "${GREEN}=================================================================${NC}"

