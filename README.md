# 🌐 MikroTik Netwatch Manager & Telegram Alert Suite

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square&logo=docker)](https://www.docker.com/)
[![RouterOS](https://img.shields.io/badge/MikroTik-RouterOS_v6_&_v7-red?style=flat-square)](https://mikrotik.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

An enterprise-grade, commercial web management suite for **MikroTik RouterOS Netwatch monitoring** and **automated Telegram alert dispatching**. Featuring real-time bidirectional router synchronization, zero-dependency SQLite persistence, automated Excel batch importing, and an **Admin One** dashboard interface.

---

## 🎯 Building Purpose & Mission

Managing dozens or hundreds of target hosts across multiple MikroTik routers typically requires tedious terminal scripting, error-prone manual copy-pasting, and fragile alert scripts. Common issues include:
- **Telegram Emoji Corruption:** RouterOS `/tool fetch` commands frequently corrupt multi-byte UTF-8 emojis into `?` or `??` symbols.
- **Credential Fragmentation:** When a Telegram bot token or chat ID changes, network engineers have to manually edit every single Netwatch item across every router.
- **Lack of Centralized Audit & Visualization:** Standalone WinBox gives no central history of who added hosts, whether devices responded, or when alerts fired.

**MikroTik Netwatch Manager** was built to solve these problems by providing:
1. **Centralized Fleet Orchestration:** Manage multiple edge, core, and distribution routers from a single pane of glass.
2. **Automated Alert Generation:** Generates RFC 3986 percent-encoded RouterOS scripts with verified Telegram emoji support (`✅`, `🟢`, `🔴`, `🔻`), preserving RouterOS dynamic variables (`$date`, `$time`).
3. **Auto-Propagating Updates:** When you edit a Bot Token or Chat ID in the web console, changes are pushed across all connected MikroTik routers automatically.
4. **Commercial Self-Hosted Architecture:** Lightweight standalone Docker container (~140MB) powered by Node.js 22 built-in `node:sqlite`, requiring zero external database services.

---

## ✨ Key Features

- **📊 Modern Admin One Dashboard:**
  - High-contrast dark sidebar with grouped navigation (`GENERAL`, `NETWORK & MONITORING`, `COMMERCIAL & SYSTEM`).
  - Real-time KPI widget cards with status trend indicators.
  - Light and Dark theme toggling.
  - Mobile-responsive sliding drawer menu.

- **⚡ MikroTik Netwatch Auto-Discovery & Sync:**
  - Connects over RouterOS API (`8728` plain or `8729` SSL).
  - Automatically queries and reconciles existing Netwatch items created manually in WinBox or terminal.
  - One-click **Update Alert Scripts** button to re-encode and fix alert scripts across the entire router.

- **💬 Telegram Bot & Chat Dispatcher:**
  - Multi-bot and multi-channel configuration.
  - Live test alert dispatcher (`Send Test`) directly to Telegram channels.
  - Automatic token validation using Telegram's `getMe` API.

- **📑 Bulk Excel / CSV Import:**
  - Drag-and-drop batch upload supporting `.xlsx`, `.xls`, and `.csv`.
  - Built-in live row syntax and IPv4 validator.
  - Batch creation of hundreds of Netwatch items in seconds.

- **🔒 Enterprise Security & RBAC:**
  - AES-256-GCM hardware encryption for all stored router passwords.
  - Mandatory password change on first login.
  - Role-Based Access Control (`admin`, `operator`, `auditor`, and custom roles).
  - Tamper-evident immutable audit log of all configuration changes and user sessions.

- **💾 Zero-Config Data Persistence:**
  - Uses native Node.js 22 `node:sqlite` in WAL mode.
  - Fast, reliable single-file storage (`data/netwatch.db`).
  - Web-based one-click database download and snapshot restore.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14 (App Router)** | Server Components, Client Modals, Route Handlers |
| **UI Library** | **React 18 & Tailwind CSS** | Clean Admin One component design system |
| **Icons** | **Lucide React** | Consistent iconography across views and tables |
| **Backend Runtime** | **Node.js 22 LTS** | Native ES modules and built-in SQLite engine |
| **Database** | **`node:sqlite` (DatabaseSync)** | Zero-compilation built-in SQLite with WAL mode |
| **Router Protocol** | **`node-routeros`** | Raw TCP socket connection to MikroTik API |
| **Cryptography** | **Node Crypto & bcryptjs** | AES-256-GCM password encryption & JWT tokens |
| **Excel Parser** | **SheetJS (xlsx)** | Client-side spreadsheet parsing and generation |
| **Containerization** | **Docker & Docker Compose** | Multi-stage Alpine container with non-root security |

---

## 🔄 How It Works (Architecture & Flow)

```
[ Web Browser ]
      │ (HTTPS / HTTP)
      ▼
[ Netwatch Manager Container ]
      │
      ├─► [ Local SQLite DB (data/netwatch.db) ] ◄── Encrypted Credentials & Settings
      │
      ├─► [ Telegram Bot API ] ◄── Direct test messages & token verification
      │
      └─► [ MikroTik RouterOS API (TCP 8728/8729) ]
                │
                ├─► Pushes /tool/netwatch entries
                │
                └─► Injects Up/Down Script:
                      /tool fetch url="https://api.telegram.org/bot<TOKEN>/sendMessage?..."
```

When a network target (e.g. `192.168.1.1`) changes state:
1. MikroTik's native Netwatch daemon detects the ICMP packet change.
2. MikroTik executes the injected script directly on the router.
3. The script dispatches an HTTP request via `/tool fetch` to Telegram.
4. Telegram delivers the alert instantly to your designated network engineers and operations channels.

---

## 🚀 Quick Deployment Guide

### Option 1: Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mmdjjahid/mikrotik-netwatch-manager.git
   cd mikrotik-netwatch-manager
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env    # On Windows: copy .env.example .env
   ```

3. **Launch the container:**
   ```bash
   docker compose up -d --build
   ```

4. **Access the dashboard:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   - **Default Username:** `admin`
   - **Default Password:** `admin` *(You will be prompted to change it on first login)*

---

### Option 2: One-Click Deploy Scripts

#### On Linux (Ubuntu / Debian / CentOS / RHEL):
```bash
chmod +x deploy-linux.sh
./deploy-linux.sh
```
*Automatically installs Docker if missing, sets permissions, and starts the container.*

#### On Windows:
Double-click **`deploy-windows.bat`**, or run in PowerShell:
```powershell
.\deploy-windows.ps1
```

---

### Option 3: Manual Node.js Local Development

```bash
# 1. Install dependencies
npm install

# 2. Build Next.js application
npm run build

# 3. Start production server
npm start
```

---

## ⚙️ MikroTik RouterOS Configuration

To allow Netwatch Manager to communicate with your router:

1. Open **WinBox** or SSH into your MikroTik router.
2. Enable the API service:
   ```routeros
   /ip service enable api
   /ip service set api port=8728
   ```
3. Create a dedicated API user:
   ```routeros
   /user group add name=netwatch-api policy=api,read,write,test,policy
   /user add name=netwatch-user group=netwatch-api password="YourSecurePassword"
   ```
4. In **Netwatch Manager**, navigate to **Routers** → **+ Add Router**, enter your credentials, and click **Test API**.

---

## 🧪 Automated Testing

The repository includes a comprehensive 16-step end-to-end integration test suite verifying authentication, settings mutations, router API handshakes, Telegram test alerts, Netwatch item creation/toggle/deletion, and audit logging:

```bash
npm run test:e2e
```

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute commercially.

Developed with ❤️ by [Jahid (mmdjjahid)](https://github.com/mmdjjahid).
