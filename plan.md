# Plan: MikroTik Netwatch + Telegram Alert Manager

A simple web app to manage Netwatch entries on many MikroTik routers and send Up/Down alerts to Telegram. The app generates the RouterOS scripts and pushes them to the routers through the API. Nobody writes scripts by hand.

## 1. Goals
- Manage many routers from one place (add, edit, delete, test API).
- Manage Telegram bot tokens, each with many chat IDs, with a test button per chat.
- Add, edit, delete, enable/disable Netwatch entries on any router by entering only: token, chats, host IP, name.
- Bulk-create Netwatch entries from an Excel/CSV file (columns: IP, Name).
- Simple, mobile-friendly UI with clear errors and loaders.

## 2. Stack (as built)
| Part | Choice |
|---|---|
| Framework | Next.js 14 (App Router), plain JavaScript |
| Database | SQLite via Node's built-in `node:sqlite` (Node 22.13+, no C++ build tools) |
| RouterOS | `node-routeros` (API 8728, SSL 8729) |
| Auth | JWT cookie (`jose`), `bcryptjs` |
| Excel | `xlsx` (parsed in the browser) |
| UI | Plain CSS, one page with tabs |
| Secrets | AES-256-GCM for router passwords and Telegram tokens, key from `ENCRYPT_KEY` |

## 3. Data model
- `users(id, username, password_hash, role, must_change)`
- `routers(id, name, host, api_user, api_pass_enc, api_port, use_ssl, note)`
- `tokens(id, label, token_enc, bot_username)`
- `chats(id, token_id, label, chat_id)`
- `nw_records(router_id, item_id, host, name, token_id, chat_ids)`: remembers which token and chats an entry uses, so Edit works
- `logs(id, user, action, detail, at)`

## 4. Features and flows
**Login / users**: default `admin/admin` with a "change password" banner. Admin and operator roles. Five wrong logins lock that username for 5 minutes.

**Routers**: name, IP, API user, password, port, SSL. The Test API button shows identity, RouterOS version and uptime, or a readable reason (timeout, refused, wrong password).

**Telegram**: add a token (checked with `getMe`), add chats under it, press Send test per chat. One token can be used on any router.

**Add Netwatch flow**
1. Select router.
2. Select token, then tick one or more of its chats.
3. Enter host IP and name.
4. The app builds the up/down scripts (date, time, emoji, one `/tool fetch` per chat) and calls `/tool/netwatch/add` with `interval=10s` and `comment=TG|<name>`.
5. The record is saved in `nw_records`.

**Edit**: change host, name, token or chats. The scripts are regenerated and pushed with `/tool/netwatch/set`.

**Excel import**: sample download, upload, preview with IP and duplicate checks, pick routers, token and chats, create, then see a per-row result report.

**Activity log**: who added, edited or deleted what.

## 5. API (single catch-all route `app/api/[...p]/route.js`)
`login, logout, me` · `users` · `routers` (+`/:id/test`) · `tokens` (+`/:id/chats`) · `chats/:id/test` · `netwatch/:routerId[/:itemId[/toggle]]` · `import` · `logs`

## 6. Phases
- [x] **Phase 1**: project setup, DB, encryption, login, users, router CRUD, Test API
- [x] **Phase 2**: Telegram tokens, chats, test message
- [x] **Phase 3**: Netwatch list, add, edit, delete, enable/disable, script generator
- [x] **Phase 4**: Excel import with report
- [ ] **Phase 5 (current): stability and UX**
  - [ ] Find the cause of the 400 error on **Add to router** (read the `[netwatch]` line in the terminal running `npm start`)
  - [ ] Always show an error message in the form when Add/Edit fails (never fail silently)
  - [ ] Loaders: spinner and disabled state on every action button, plus a loading state for the netwatch table
  - [ ] Validate before sending: token, at least one chat, valid IP, name
  - [ ] Network error message when the server is unreachable
- [ ] **Phase 6**: dashboard (routers online/offline, total netwatch, up/down counts)
- [ ] **Phase 7**: message template editor (`{name} {host} {date} {time} {router}`) and router name in the alert
- [ ] **Phase 8**: viewer role, SQLite backup/restore button, Docker or PM2 deploy notes
- [ ] **Phase 9 (optional)**: up/down history report, bulk enable/disable across routers, flap protection

## 7. Known issue to fix first
**Symptom**: clicking *Add to router* shows nothing, and the browser console shows `400 Bad Request`.

**Fix tasks**
1. Server: wrap router calls in try/catch, return `{ error: <readable text> }`, and `console.error` the full error.
2. `friendly()` in `lib/ros.js` must never return an empty string. Fall back to `e.error` or `JSON.stringify(e)`.
3. Client: show the error inside the Add form, under the buttons. Do not rely only on a message at the top of the page.
4. Never bind `undefined` to SQLite. Convert the new item id with `String(id ?? host)`.
5. Add a **Preview script** button that shows the generated up/down script before sending, to make RouterOS rejections easy to debug.

**Likely causes to check once the real message is visible**
- The API user lacks the `test`, `write` or `policy` permission.
- RouterOS rejects the script text (quotes or the `$host` variable).
- Entry for that host already exists.
- Router API session timed out.

## 8. RouterOS and network requirements
- `/ip service` has `api` (or `api-ssl`) enabled and reachable from the app server.
- API user policies: `read, write, test, api` (also `policy` if scripts need it).
- The router must reach `api.telegram.org`, because the router sends the alerts, not the server.
- RouterOS v6.45+ or v7.
- Put the app behind HTTPS (Nginx or Caddy) if it is used outside the LAN.

## 9. Security checklist
- [ ] Revoke any bot token that was ever pasted in chat or in an export, using @BotFather `/revoke`
- [ ] Change the default admin password on first login
- [ ] Set a long random `ENCRYPT_KEY` in `.env` and never change it afterwards
- [ ] Restrict router API access to the app server's IP
- [ ] Keep `data/` out of version control and back it up

## 10. Run
```
npm install
copy .env.example .env     (set ENCRYPT_KEY)
rmdir /s /q .next
npm run build && npm start
```
Open http://localhost:3000 and sign in with admin / admin.

## 11. Acceptance tests
- Add a router, press Test API, and see identity and version.
- Add a token, add two chats, press Send test on each, and both receive a message.
- Add a Netwatch for a host with two chats, then take the host down and see one alert per chat. Bring it up and see the UP alert.
- Edit the name and chats; the router scripts update.
- Import an Excel file with 5 rows (one invalid IP, one duplicate). The report shows 3 created and 2 failed with reasons.
- Every failed action shows a clear message, and every slow action shows a spinner.
