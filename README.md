# Our Calendar

A joint calendar for two people. Each of you connects your own Google Calendar; the app shows both
calendars merged into one view, and lets you create events on either person's calendar (or a
"shared" event that's added to both calendars at once). Day, week, month, and year views, installable
as a PWA on your phone. Built with React, shadcn/ui, and Tailwind on the frontend, and a small Go API
that talks to the Google Calendar API and stores nothing except OAuth tokens and (optionally) a link
between the two copies of a "shared" event, in Postgres.

## How it works

- **Two calendar slots, "A" and "B"** — one per person. Each of you signs in with Google once
  from the app's Settings panel; the server stores a refresh token for your slot and uses it to
  read/write your **primary** Google Calendar.
- **Shared events** are created on both calendars at once (two linked Google Calendar events), so
  they show up natively in your own Google Calendar / phone / widgets too, not just in this app.
- **The whole app sits behind a single shared password** (`APP_PASSWORD`) since it's reachable on
  the public internet. There's no per-person login beyond that — it's meant for two people who
  trust each other with one calendar.

## Stack

- `frontend/` — React + Vite + TypeScript, shadcn/ui, Tailwind CSS v4.
- `backend/` — Go, standard `net/http`, `pgx` (Postgres), `google.golang.org/api/calendar`.
- `postgres` — stores OAuth tokens and shared-event links.
- `Caddyfile` — reverse proxy with automatic HTTPS (Let's Encrypt) for your domain.
- `docker-compose.yml` — wires up `postgres`, `web`, `backend`, and `caddy`.

## 1. Point a domain at your server

Create a DNS `A` (and `AAAA` if you have IPv6) record for the domain/subdomain you want to use
(e.g. `calendar.yourdomain.com`) pointing at the public IP of the machine that will run Docker.
Ports **80** and **443** on that machine need to be reachable from the internet — Caddy uses port
80 for the Let's Encrypt HTTP challenge and serves the app on 443.

## 2. Create a Google OAuth Client

Each of you will connect your own Google account, so you need one shared OAuth client that both of
you use to sign in:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project
   (or reuse one).
2. **APIs & Services → Library** — enable the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** — choose **External**, fill in an app name (e.g.
   "Our Calendar") and your email as the support/developer contact. Under **Test users**, add both
   of your Google account emails (while the app is in "Testing" status, only listed test users can
   sign in — that's fine, it's just the two of you, and it avoids Google's app review process).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: add exactly
     `https://YOUR_DOMAIN/api/accounts/google/callback`
     (replace `YOUR_DOMAIN` with the domain from step 1)
5. Copy the generated **Client ID** and **Client Secret** — you'll need them in the next step.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | What it is |
|---|---|
| `DOMAIN` | The domain from step 1, e.g. `calendar.yourdomain.com` |
| `ACME_EMAIL` | Your email, used by Let's Encrypt for expiry notices |
| `APP_PASSWORD` | A password only the two of you know — protects the whole app |
| `SESSION_SECRET` | Random string for signing session cookies — generate with `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Password for the Postgres container |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From step 2 |
| `PARTNER_A_NAME` / `PARTNER_B_NAME` | Your display names, e.g. `Rasmus` and `...` |

## 4. Run it

```bash
make up
```

This builds the Docker images and starts everything in the background. First boot can take a
minute while Caddy requests the TLS certificate. Then:

```bash
make logs   # watch logs
make ps     # check status
make down   # stop everything
```

Visit `https://YOUR_DOMAIN`, enter `APP_PASSWORD`, open **Settings** (gear icon), and have each of
you click **Connect** next to your name to sign in with Google.

## Local development (without Docker)

```bash
# Terminal 1 — Postgres (or point DATABASE_URL at any Postgres you already have)
docker compose up -d postgres

# Terminal 2 — backend
cd backend
cp .env.example .env   # adjust DATABASE_URL if needed
go run ./cmd/server     # http://localhost:4000

# Terminal 3 — frontend
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api to :4000
```

For local dev you can skip the Google OAuth setup entirely — the app runs fine with the shared
password (`APP_PASSWORD`, defaults to `change-me`). Whenever `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
aren't set (and `APP_ENV` isn't `production`), the backend automatically serves a set of generated
fake events instead of calling Google, so you can try out every view with real-looking data. Set
`MOCK_EVENTS=false` in `backend/.env` if you want to see the real "not connected" state instead.
For local OAuth testing, set `PUBLIC_API_URL=http://localhost:4000` and add
`http://localhost:4000/api/accounts/google/callback` as an authorized redirect URI in Google Cloud
Console.

## Progressive Web App

The frontend is installable. On iOS Safari: Share → **Add to Home Screen**. On Android Chrome /
desktop Chrome & Edge: the browser will show an **Install** prompt (or use the install icon in the
address bar). Installed, it opens full-screen with no browser chrome. The app shell (JS/CSS/icons)
is precached by a service worker for fast/offline loading, but calendar data itself is always
fetched fresh from the network — nothing about your events is cached offline.

## Data & backups

The only data this app stores itself is in Postgres (Google OAuth refresh tokens, and the link
between the two halves of a "shared" event) in the `postgres_data` Docker volume. Everything
else — event titles, times, etc. — lives in your actual Google Calendars. Back up the database with:

```bash
docker compose exec postgres pg_dump -U familycalendar familycalendar > backup.sql
```
