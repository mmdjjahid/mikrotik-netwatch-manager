# =============================================================================
# Netwatch Manager — PowerShell Deployer for Windows
# =============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "       Netwatch Manager — Windows PowerShell Deployer            " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Docker CLI was not found." -ForegroundColor Yellow
    Write-Host "Would you like to install Docker Desktop using winget? (y/n): " -NoNewline
    $ans = Read-Host
    if ($ans -eq 'y' -or $ans -eq 'Y') {
        Write-Host "[*] Launching winget install for Docker Desktop..." -ForegroundColor Cyan
        winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
        Write-Host "[*] Installation completed. Please log out or reboot Windows, launch Docker Desktop, and re-run this script." -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "You can download Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor White
        exit 1
    }
}

# 2. Check if Docker daemon is running
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Docker is installed, but the Docker Desktop daemon is not running." -ForegroundColor Yellow
    Write-Host "Please start 'Docker Desktop' from your Start Menu, wait for the engine to initialize, and try again." -ForegroundColor White
    exit 1
}

Write-Host "[✔] Docker daemon is running." -ForegroundColor Green

# 3. Prepare .env
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Host "[✔] Created .env from .env.example." -ForegroundColor Green
    }
}

# 4. Prepare data folder
if (-not (Test-Path data)) {
    New-Item -ItemType Directory -Path data | Out-Null
}

# 5. Build and launch container
Write-Host "[*] Building and starting Netwatch container..." -ForegroundColor Cyan
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "  ✔ Netwatch Manager is now running inside Docker!               " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "URL:              http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Default User:     admin" -ForegroundColor Yellow
    Write-Host "Default Password: admin" -ForegroundColor Yellow
    Write-Host ""
    Start-Process "http://localhost:3000"
} else {
    Write-Host "[ERROR] Failed to start container with Docker Compose." -ForegroundColor Red
}

