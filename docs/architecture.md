# StatusCast Architecture

This document describes the architectural layout of StatusCast, data flows between components, and security boundaries.

## System Overview

StatusCast combines three primary components:
1. Fastify HTTP backend with an embedded SQLite database (WAL mode).
2. Background engine that monitors external endpoints and runs the Telegram bot via long polling.
3. React 19 single-page application that runs both as a standalone web page and as a Telegram Mini App inside Telegram desktop and mobile clients.

## Data Flow Diagram

```
+-------------------------------------------------------------+
|                     Client Surface                          |
|                                                             |
|   +--------------------------+   +----------------------+   |
|   | Telegram Desktop / Mobile|   | Standard Web Browser |   |
|   | (Telegram Mini App SDK)  |   | (Simulated Mode)     |   |
|   +--------------------------+   +----------------------+   |
+------------------------------+------------------------------+
                               |
                        HTTPS / HTTP REST
                               |
                               v
+-------------------------------------------------------------+
|                      Fastify Server                         |
|                                                             |
|   [Auth Middleware: HMAC-SHA256 initData or Admin Secret]   |
|                                                             |
|   Routes:                                                   |
|   - /api/status/:pageId        (Public read)                |
|   - /api/components/:id        (Admin status update)        |
|   - /api/incidents             (Admin incident management)  |
|   - /api/heartbeat/:id         (External ping receiver)     |
|   - Static Assets              (Serves web/dist)            |
+------------------------------+------------------------------+
                               |
         +---------------------+---------------------+
         |                                           |
         v                                           v
+-------------------+                       +------------------+
|   SQLite (WAL)    |                       | grammY Bot Engine|
|                   |                       |                  |
| - status_pages    |                       | Long polling     |
| - components      |                       | getUpdates loop  |
| - incidents       |                       +--------+---------+
| - incident_updates|                                |
| - uptime_daily    |                                | Bot API
+-------------------+                                v
                                            +------------------+
                                            | Telegram Channel |
                                            |                  |
                                            | Sends alert on   |
                                            | incident start.  |
                                            | Edits message on |
                                            | state changes.   |
                                            +------------------+
```

## Database Design

StatusCast uses SQLite with Write-Ahead Logging (`PRAGMA journal_mode = WAL`). WAL mode allows concurrent readers while a write is occurring, avoiding database lock errors during active health checks and status queries.

### Entity Relationships

1. **status_pages**:
   - Holds page configuration, owner identifier, page title, and linked Telegram channel.
2. **components**:
   - Belongs to a status page.
   - Holds the component name, status (`OPERATIONAL`, `DEGRADED`, `PARTIAL_OUTAGE`, `MAJOR_OUTAGE`, `MAINTENANCE`), optional ping URL, and 90-day calculated uptime percentage.
3. **incidents**:
   - Belongs to a status page.
   - Stores severity (`MINOR`, `MAJOR`, `CRITICAL`), status (`INVESTIGATING`, `IDENTIFIED`, `MONITORING`, `RESOLVED`), and the Telegram channel `message_id`.
4. **incident_updates**:
   - Belongs to an incident.
   - Stores timestamped narrative entries describing current remediation steps.
5. **uptime_daily**:
   - Stores pre-computed daily availability (date string, uptime percentage, outage minutes) for the 90-day historical pill bar.

## In-Place Telegram Broadcaster

Standard notification bots spam channels by sending a new message for every status change. StatusCast keeps the channel clean by using message editing:

1. **Incident Creation:**
   When an admin creates an incident, the broadcaster posts an initial alert with an inline button that links directly to the Mini App. The Telegram Bot API returns a `message_id`. This ID is saved in the incident record.
2. **Progress Updates:**
   When an admin posts an update (such as moving from Investigating to Identified), the bot edits the original message using `bot.api.editMessageText`.
3. **Resolution:**
   When the incident is resolved, the bot updates the original message header to a resolved banner, calculates incident duration, and edits the message in place.

## Authentication and Security

StatusCast supports two authentication paths:

1. **Telegram WebApp initData Verification:**
   When accessed inside Telegram, the frontend provides `window.Telegram.WebApp.initData`. The server verifies the cryptographic signature:
   - Derives a secret key using HMAC-SHA256 with the bot token and constant string `"WebAppData"`.
   - Hashes all data fields alphabetically and validates against the provided `hash`.
   - Checks that `auth_date` is not older than 24 hours to prevent replay attacks.
   - Verifies the user ID against the page owner ID in SQLite.
2. **Admin Secret Header:**
   For local scripts or automated CI/CD pipelines, requests can provide `X-Admin-Secret` matching the server's `ADMIN_SECRET` environment variable.
