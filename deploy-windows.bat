@echo off
setlocal enabledelayedexpansion

echo =================================================================
echo          Netwatch Manager - Windows One-Click Deployer
echo =================================================================
echo.

REM 1. Check if Docker command exists
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Docker was not detected on your system.
    echo.
    echo To install Docker Desktop on Windows, run the following command
    echo in an Administrator PowerShell or Command Prompt:
    echo.
    echo     winget install Docker.DockerDesktop
    echo.
    echo Or download the official installer directly from:
    echo     https://www.docker.com/products/docker-desktop/
    echo.
    echo After installing Docker Desktop, launch it, wait for the whale
    echo icon to become green in your taskbar, and run this script again.
    echo.
    pause
    exit /b 1
)

REM 2. Check if Docker daemon is running
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Docker is installed, but Docker Desktop is not currently running.
    echo Please start "Docker Desktop" from your Start Menu and wait until it is ready.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is running.
echo.

REM 3. Create .env if missing
if not exist .env (
    if exist .env.example (
        echo [*] Creating .env from .env.example...
        copy .env.example .env >nul
    ) else (
        echo [*] Writing default .env...
        echo PORT=3000 > .env
        echo ENCRYPT_KEY=5c0f2edcf74b7e27a70a141ed9433f53f264bdcf95be94e772afef8ab526cc04 >> .env
        echo JWT_SECRET=88a183515ca4c845f94d93540ae3fbdb91eb582236fa120539c3c5ee7c6883ba >> .env
    )
    echo [OK] .env configured.
)

REM 4. Ensure data folder exists
if not exist data mkdir data

REM 5. Build and launch container
echo [*] Building and launching Netwatch container with Docker Compose...
docker compose down >nul 2>nul
docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start container. Check output above.
    pause
    exit /b 1
)

echo.
echo =================================================================
echo   SUCCESS! Netwatch Manager is now running inside Docker.
echo =================================================================
echo URL:              http://localhost:3000
echo Default Username: admin
echo Default Password: admin
echo.
echo Opening browser...
start http://localhost:3000

echo.
echo To view container logs at any time, run:
echo     docker compose logs -f
echo.
pause

