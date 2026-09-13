# StatusCast API Reference

This document lists all REST endpoints exposed by the Fastify backend.

## Base URL

By default, the server runs on `http://localhost:8080`.

## Authentication

Protected routes require one of the following:
- `X-Admin-Secret: <ADMIN_SECRET>` header.
- `Authorization: tma <initData>` header containing valid Telegram WebApp initialization data.

---

## Public Endpoints

### 1. Health Check

```http
GET /health
```

#### Response `200 OK`
```json
{
  "status": "ok",
  "timestamp": 1773494400000,
  "uptime": 124.5
}
```

---

### 2. Get Status Page

Retrieves current component statuses, active and recent incidents, and 90-day uptime records.

```http
GET /api/status/:pageId
```

#### Parameters
- `pageId` (path, string): Unique identifier of the status page (e.g. `demo`).

#### Response `200 OK`
```json
{
  "page": {
    "id": "demo",
    "title": "Cloud Infrastructure & API Status",
    "ownerTelegramId": 123456789,
    "channelId": "@statuscast_updates"
  },
  "overallStatus": "DEGRADED",
  "components": [
    {
      "id": "comp-api",
      "name": "API Gateway",
      "groupName": "Core Services",
      "status": "OPERATIONAL",
      "orderIndex": 1,
      "uptimePercentage": 99.98,
      "uptimeHistory": [
        {
          "date": "2026-09-13",
          "uptimePct": 100,
          "outageMinutes": 0,
          "incidentCount": 0
        }
      ]
    }
  ],
  "incidents": [
    {
      "id": "inc-01",
      "title": "Elevated Error Rates on Checkout",
      "status": "INVESTIGATING",
      "severity": "MAJOR",
      "createdAt": 1773491000000,
      "resolvedAt": null,
      "updates": [
        {
          "id": "upd-01",
          "status": "INVESTIGATING",
          "message": "Engineers are investigating latency in payment webhook processing.",
          "createdAt": 1773491000000
        }
      ],
      "affectedComponentIds": ["comp-payments"]
    }
  ]
}
```

---

### 3. SVG Status Badge

Generates a Shields.io style SVG badge showing overall system status.

```http
GET /api/status/:pageId/badge
```

#### Response `200 OK`
Content-Type: `image/svg+xml`

---

## Admin Endpoints

### 1. Update Component Status

```http
PUT /api/components/:id
```

#### Headers
- `X-Admin-Secret: your_secret` or `Authorization: tma <initData>`

#### Request Body
```json
{
  "status": "DEGRADED",
  "name": "API Gateway",
  "groupName": "Core Services",
  "pingUrl": "https://api.example.com/health"
}
```

#### Allowed Status Values
- `OPERATIONAL`
- `DEGRADED`
- `PARTIAL_OUTAGE`
- `MAJOR_OUTAGE`
- `MAINTENANCE`

#### Response `200 OK`
```json
{
  "success": true,
  "component": {
    "id": "comp-api",
    "status": "DEGRADED"
  }
}
```

---

### 2. Create Incident

Creates an incident, stores the record, updates affected component states, and broadcasts an alert to the linked Telegram channel.

```http
POST /api/incidents
```

#### Request Body
```json
{
  "pageId": "demo",
  "title": "Database Connection Pool Exhaustion",
  "severity": "MAJOR",
  "initialMessage": "Increased traffic caused connection pool limits to be reached.",
  "affectedComponentIds": ["comp-db"]
}
```

#### Severity Values
- `MINOR`
- `MAJOR`
- `CRITICAL`

#### Response `201 Created`
```json
{
  "success": true,
  "incidentId": "inc-1773495000",
  "channelMessageId": 452
}
```

---

### 3. Add Incident Update / Resolve

Appends an update to an ongoing incident and optionally resolves it. Automatically edits the channel message in place.

```http
PATCH /api/incidents/:id
```

#### Request Body
```json
{
  "status": "RESOLVED",
  "message": "Additional database connection pool capacity provisioned. Error rates returned to normal.",
  "resolved": true
}
```

#### Incident Status Values
- `INVESTIGATING`
- `IDENTIFIED`
- `MONITORING`
- `RESOLVED`

#### Response `200 OK`
```json
{
  "success": true,
  "incident": {
    "id": "inc-1773495000",
    "status": "RESOLVED",
    "resolvedAt": 1773497200000
  }
}
```

---

## Heartbeat Endpoint

### Ingest Keepalive Ping

Allows external workers, shell scripts, or cron jobs to report healthy execution.

```http
POST /api/heartbeat/:componentId
```

#### Query / Header Authentication
- `token` parameter matching the component's heartbeat secret.

#### Response `200 OK`
```json
{
  "success": true,
  "timestamp": 1773495000000,
  "status": "OPERATIONAL"
}
```

---

## Direct Alerts & Subscriptions

### 1. Subscribe User
Registers a Telegram user ID to receive direct incident push alerts.

```http
POST /api/subscriptions/subscribe
```

#### Request Body
```json
{
  "pageId": "demo",
  "telegramUserId": 123456789,
  "telegramUsername": "alexander"
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "subscribed": true,
  "subscriber": {
    "id": "sub-demo-123456789",
    "pageId": "demo",
    "telegramUserId": 123456789,
    "createdAt": 1773495000000
  },
  "totalSubscribers": 42
}
```

### 2. Unsubscribe User
```http
POST /api/subscriptions/unsubscribe
```

---

## Scheduled Maintenance

### 1. Schedule Maintenance Window
Requires admin authentication. Broadcasts advance warning to the Telegram channel and alerts subscribers.

```http
POST /api/maintenance
```

#### Request Body
```json
{
  "pageId": "demo",
  "title": "Core Router Upgrade",
  "description": "Upgrading core switch firmware to patch security CVE.",
  "scheduledStart": 1773595000000,
  "scheduledEnd": 1773602200000,
  "affectedComponentIds": ["comp-api"]
}
```

### 2. Update Maintenance Status
```http
PATCH /api/maintenance/:id
```

---

## Component Management (CRUD)

### 1. Create Component
```http
POST /api/components
```

#### Request Body
```json
{
  "pageId": "demo",
  "name": "Search Engine",
  "groupName": "Data Services",
  "pingUrl": "https://search.example.com/health"
}
```

### 2. Delete Component
```http
DELETE /api/components/:id
```

---

## Post-Mortem Reports

### Generate Incident Post-Mortem
Retrieves a markdown post-mortem report summarizing duration, timeline, affected services, and preventative action items.

```http
GET /api/incidents/:id/post-mortem
```

#### Response `200 OK`
```json
{
  "success": true,
  "incidentId": "inc-demo-resolved",
  "markdown": "# Incident Post-Mortem: ...",
  "durationMinutes": 45
}
```
