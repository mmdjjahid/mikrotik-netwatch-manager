# 🚀 Netwatch Manager — Production Docker Deployment Guide

A commercial, production-ready guide to deploying **Netwatch Manager** on **Windows** and **Linux** systems using **Docker** and **Docker Compose**.

---

## 📑 Table of Contents
1. [Overview & System Architecture](#1-overview--system-architecture)
2. [Prerequisites & System Requirements](#2-prerequisites--system-requirements)
3. [Installing Docker on Windows](#3-installing-docker-on-windows)
4. [Installing Docker on Linux (Ubuntu, Debian, CentOS, RHEL)](#4-installing-docker-on-linux)
5. [One-Click Automated Deployment](#5-one-click-automated-deployment)
6. [Manual Deployment with Docker Compose (Recommended)](#6-manual-deployment-with-docker-compose)
7. [Manual Deployment with Standalone Docker CLI](#7-manual-deployment-with-standalone-docker-cli)
8. [Database Persistence & Backups](#8-database-persistence--backups)
9. [Production Security & Environment Configuration](#9-production-security--environment-configuration)
10. [MikroTik RouterOS Setup Guide](#10-mikrotik-routeros-setup-guide)
11. [Reverse Proxy (Nginx + SSL / HTTPS)](#11-reverse-proxy-nginx--ssl--https)
12. [Maintenance, Troubleshooting & Logs](#12-maintenance-troubleshooting--logs)

---

## 1. Overview & System Architecture

Netwatch Manager runs as a high-performance, containerized service:
- **Framework:** Next.js 14 App Router (Standalone Node.js Server).
- **Engine:** Node.js 22 LTS Alpine base with zero native compilation dependencies.
- **Database:** High-speed SQLite in WAL (Write-Ahead-Logging) mode powered by native `node:sqlite` (`DatabaseSync`), requiring zero external database servers (no MySQL or PostgreSQL containers needed).
- **Network Pipeline:** Native TCP socket routeros connector (`node-routeros`) communicating directly with MikroTik RouterOS API (`8728` / `8729`).
- **Telegram Dispatcher:** Direct outbound HTTPS to `api.telegram.org` with automatic emoji percent-encoding.

```
                      +---------------------------------------+
                      |          Host Browser / Admin         |
                      +---------------------------------------+
                                          |
                                    Port 3000 (HTTP)
                                          v
                      +---------------------------------------+
                      |   Netwatch Docker Container (Alpine)  |
                      |                                       |
                      |  Next.js Standalone Node.js 22 Server |
                      |  Non-root: nextjs:nodejs (UID 1001)   |
                      +---------------------------------------+
                            |                           |
                 (Volume: ./data:/app/data)      (Outbound HTTPS)
                            |                           |
                            v                           v
                 +---------------------+     +--------------------+
                 | Host: netwatch.db   |     | Telegram Bot API   |
                 | (Persistent SQLite) |     | api.telegram.org   |
                 +---------------------+     +--------------------+
                            |
                   (RouterOS API: TCP)
                            |
                            v
                 +---------------------+
                 | MikroTik Routers    |
                 | Ports 8728 / 8729   |
                 +---------------------+
```

---

## 2. Prerequisites & System Requirements

### Hardware Requirements
| Resource | Minimum | Recommended |
| :--- | :--- | :--- |
| **CPU** | 1 vCPU / Core | 2 vCPUs |
| **RAM** | 512 MB | 1 GB - 2 GB |
| **Disk Space** | 1 GB free space | 5 GB+ (for long-term audit logs) |
| **Network** | Outbound internet (for Telegram alerts) + TCP access to MikroTik API | Static IP or WireGuard VPN |

---

## 3. Installing Docker on Windows

### Method A: Automated via Windows Package Manager (`winget`)
Open **PowerShell as Administrator** and execute:
```powershell
winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
```
Once installation finishes, **restart your computer**.

### Method B: Manual Installer
1. Download **Docker Desktop for Windows** from the official site:
   [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Run `Docker Desktop Installer.exe`.
3. Check the box for **"Use WSL 2 instead of Hyper-V"** (recommended).
4. After setup completes, reboot Windows.
5. Launch **Docker Desktop** from the Start menu and wait until the bottom-left whale icon turns green (**"Engine running"**).

---

## 4. Installing Docker on Linux

### Automated Installation (Ubuntu, Debian, CentOS, Rocky Linux, AlmaLinux, Fedora)
Run the official Docker convenience script:
```bash
# 1. Download and run Docker install script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Add current user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# 3. Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# 4. Verify installation
docker --version
docker compose version
```

> **Note:** If you added yourself to the `docker` group, log out and log back in, or run `newgrp docker` to apply the permissions.

---

## 5. One-Click Automated Deployment

The project includes automated deployment scripts that configure `.env`, prepare directories, and build the container:

### On Linux:
```bash
# Make script executable
chmod +x deploy-linux.sh

# Run deployer
./deploy-linux.sh
```

### On Windows:
Double-click `deploy-windows.bat`, or run from PowerShell:
```powershell
.\deploy-windows.ps1
```

The script will automatically detect Docker, build the container, mount the database directory, and launch the web interface at `http://localhost:3000`.

---

## 6. Manual Deployment with Docker Compose (Recommended)

Docker Compose is the recommended deployment method for both Windows and Linux because it automatically manages restart policies, port forwarding, and persistent storage.

### Step 1: Clone or Copy Project Files
Ensure your project directory contains:
```
Netwatch/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── package.json
└── ...
```

### Step 2: Configure Environment Secrets
Create a `.env` file from the provided template:
```bash
# Linux / macOS
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` and verify your cryptographic keys:
```ini
PORT=3000
ENCRYPT_KEY=5c0f2edcf74b7e27a70a141ed9433f53f264bdcf95be94e772afef8ab526cc04
JWT_SECRET=88a183515ca4c845f94d93540ae3fbdb91eb582236fa120539c3c5ee7c6883ba
```
*(To generate fresh 64-character random keys, run: `openssl rand -hex 32`)*

### Step 3: Build and Start Container
```bash
docker compose up -d --build
```

### Step 4: Verify Container Status
```bash
docker compose ps
```
Output:
```
NAME           IMAGE                    COMMAND                  SERVICE    CREATED          STATUS                    PORTS
netwatch-app   netwatch-manager:latest  "node server.js"         netwatch   10 seconds ago   Up 9 seconds (healthy)    0.0.0.0:3000->3000/tcp
```

### Step 5: Access the Web Application
Open your browser and navigate to:
```
http://localhost:3000
```
- **Default Username:** `admin`
- **Default Password:** `admin` *(The system will prompt you to set a secure password upon initial login)*

---

## 7. Manual Deployment with Standalone Docker CLI

If you prefer not using Docker Compose, you can build and run using pure Docker commands:

### 1. Build the Docker Image
```bash
docker build -t netwatch-manager:latest .
```

### 2. Run the Container
```bash
# Linux
docker run -d \
  --name netwatch-app \
  --restart unless-stopped \
  -p 3000:3000 \
  -e PORT=3000 \
  -e HOSTNAME="0.0.0.0" \
  -e ENCRYPT_KEY="5c0f2edcf74b7e27a70a141ed9433f53f264bdcf95be94e772afef8ab526cc04" \
  -e JWT_SECRET="88a183515ca4c845f94d93540ae3fbdb91eb582236fa120539c3c5ee7c6883ba" \
  -v $(pwd)/data:/app/data \
  netwatch-manager:latest

# Windows (PowerShell)
docker run -d `
  --name netwatch-app `
  --restart unless-stopped `
  -p 3000:3000 `
  -e PORT=3000 `
  -e HOSTNAME="0.0.0.0" `
  -e ENCRYPT_KEY="5c0f2edcf74b7e27a70a141ed9433f53f264bdcf95be94e772afef8ab526cc04" `
  -e JWT_SECRET="88a183515ca4c845f94d93540ae3fbdb91eb582236fa120539c3c5ee7c6883ba" `
  -v ${PWD}/data:/app/data `
  netwatch-manager:latest
```

---

## 8. Database Persistence & Backups

All system data (connected MikroTik routers, encrypted credentials, Telegram tokens, alert channels, Netwatch items, audit logs, and settings) is stored in SQLite file format inside `./data/netwatch.db`.

### Automatic Persistence
Because the container mounts `./data:/app/data`, all changes are saved directly to your host disk. When you rebuild or update the container image:
```bash
docker compose down
docker compose pull # or rebuild
docker compose up -d
```
**No data is lost.** The database continues exactly where it left off.

### Live Backup Method 1 (Web Dashboard):
1. Navigate to **Dashboard** → **Settings** → **Backup / Restore** tab.
2. Click **Download .db File**.
3. Save the snapshot file to your local computer.

### Live Backup Method 2 (Host File System):
```bash
# Copy database file to backup location
cp data/netwatch.db /backups/netwatch-$(date +%Y%m%d-%H%M%S).db
```

### Restoring Database:
Simply overwrite `data/netwatch.db` with your backup copy and restart the container:
```bash
docker compose restart
```

---

## 9. Production Security & Environment Configuration

For enterprise production deployments, observe these best practices:

1. **Change Default Administrator Credentials:**
   Upon first login with `admin / admin`, change the password to a strong phrase (minimum 8 characters).
2. **Rotate Cryptographic Keys in `.env`:**
   Generate unique 32-byte hex keys:
   ```bash
   openssl rand -hex 32
   ```
   Paste the generated values into `ENCRYPT_KEY` and `JWT_SECRET`.
3. **Firewall Access:**
   Only expose port `3000` (or `443` if using Nginx) to trusted management networks or VPNs.
4. **Non-Root Execution:**
   The Docker container runs as unprivileged user `nextjs` (UID `1001`), preventing container-breakout escalation.

---

## 10. MikroTik RouterOS Setup Guide

To allow Netwatch Manager to communicate with your MikroTik routers:

### Step 1: Enable the RouterOS API Service
In WinBox, open **New Terminal** and run:
```routeros
# For standard Plain API (Default port 8728)
/ip service enable api
/ip service set api port=8728

# For encrypted API-SSL (Default port 8729)
/ip service enable api-ssl
/ip service set api-ssl port=8729
```

### Step 2: Create a Dedicated Monitoring User
```routeros
# Create group with read, write, test, policy permissions
/user group add name=netwatch-admin policy=api,read,write,test,policy

# Create user (replace YOUR_PASSWORD with a strong secret)
/user add name=netwatch-user group=netwatch-admin password="YOUR_PASSWORD"
```

### Step 3: Register in Netwatch Dashboard
1. Go to **Dashboard** → **Routers** → Click **+ Add Router**.
2. Enter the router's IP, API port (`8728` or `8729`), user, and password.
3. Click **Test Connection** to verify live communication.
4. Click **Connect Router**.

---

## 11. Reverse Proxy (Nginx + SSL / HTTPS)

To expose Netwatch Manager over a domain with Let's Encrypt SSL (`https://netwatch.yourdomain.com`), place Nginx in front of Docker:

```nginx
server {
    listen 80;
    server_name netwatch.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name netwatch.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/netwatch.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/netwatch.yourdomain.com/privkey.pem;

    # Optimal SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 12. Maintenance, Troubleshooting & Logs

### Useful Docker Commands:
```bash
# View real-time container logs
docker compose logs -f

# Check container resource usage (CPU/RAM)
docker stats netwatch-app

# Restart the service
docker compose restart

# Stop the container
docker compose down

# Rebuild container after updating code
docker compose up -d --build
```

### Common Issues & Solutions:
| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `Cannot connect to MikroTik router` | Port 8728 blocked by firewall or API disabled | Run `/ip service print` in RouterOS and ensure `api` is active and reachable from Docker host. |
| `Telegram message ? characters` | Character set encoding mismatch | Fixed in this build: scripts automatically encode emojis as percent-encoded UTF-8 hex sequences. Click **Update Alert Scripts** in the dashboard. |
| `Port 3000 already in use` | Another process occupies port 3000 | In `.env`, change `PORT=3001` (or any available port) and rerun `docker compose up -d`. |
| `Permission denied on ./data` (Linux) | Host data folder owned by root | Run `sudo chown -R 1001:1001 data` to match container user permissions. |

