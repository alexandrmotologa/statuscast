import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  Component,
  ComponentStatus,
  DailyUptime,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentUpdate,
  LatencySample,
  MaintenanceStatus,
  MaintenanceWindow,
  StatusPage,
  Subscriber,
} from '../types.js';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(customPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath =
    customPath ||
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), 'data', 'statuscast.sqlite');

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  initSchema(dbInstance);

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS status_pages (
      id TEXT PRIMARY KEY,
      owner_telegram_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      channel_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      name TEXT NOT NULL,
      group_name TEXT DEFAULT 'Services',
      status TEXT DEFAULT 'OPERATIONAL',
      order_index INTEGER NOT NULL,
      uptime_percentage REAL DEFAULT 99.98,
      ping_url TEXT,
      last_ping_at INTEGER,
      heartbeat_token TEXT,
      FOREIGN KEY (page_id) REFERENCES status_pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'INVESTIGATING',
      severity TEXT NOT NULL,
      channel_message_id INTEGER,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      FOREIGN KEY (page_id) REFERENCES status_pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incident_updates (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incident_affected_components (
      incident_id TEXT NOT NULL,
      component_id TEXT NOT NULL,
      PRIMARY KEY (incident_id, component_id),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS uptime_daily (
      id TEXT PRIMARY KEY,
      component_id TEXT NOT NULL,
      date TEXT NOT NULL,
      uptime_pct REAL DEFAULT 100.0,
      outage_minutes INTEGER DEFAULT 0,
      incident_count INTEGER DEFAULT 0,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
      UNIQUE(component_id, date)
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      telegram_user_id INTEGER NOT NULL,
      username TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (page_id) REFERENCES status_pages(id) ON DELETE CASCADE,
      UNIQUE(page_id, telegram_user_id)
    );

    CREATE TABLE IF NOT EXISTS latency_samples (
      id TEXT PRIMARY KEY,
      component_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      latency_ms REAL NOT NULL,
      status_code INTEGER NOT NULL,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      scheduled_start INTEGER NOT NULL,
      scheduled_end INTEGER NOT NULL,
      status TEXT DEFAULT 'SCHEDULED',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (page_id) REFERENCES status_pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS maintenance_affected_components (
      maintenance_id TEXT NOT NULL,
      component_id TEXT NOT NULL,
      PRIMARY KEY (maintenance_id, component_id),
      FOREIGN KEY (maintenance_id) REFERENCES maintenance_windows(id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
    );
  `);
}

// Data Access Object helpers

export function getStatusPage(pageId: string): StatusPage | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id, owner_telegram_id, title, channel_id, created_at FROM status_pages WHERE id = ?')
    .get(pageId) as any;

  if (!row) return null;

  return {
    id: row.id,
    ownerTelegramId: Number(row.owner_telegram_id),
    title: row.title,
    channelId: row.channel_id ?? undefined,
    createdAt: Number(row.created_at),
  };
}

export function getComponents(pageId: string): Component[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT id, page_id, name, group_name, status, order_index, uptime_percentage, ping_url, last_ping_at, heartbeat_token FROM components WHERE page_id = ? ORDER BY order_index ASC'
    )
    .all(pageId) as any[];

  return rows.map((r) => ({
    id: r.id,
    pageId: r.page_id,
    name: r.name,
    groupName: r.group_name || 'Services',
    status: r.status as ComponentStatus,
    orderIndex: Number(r.order_index),
    uptimePercentage: Number(r.uptime_percentage),
    pingUrl: r.ping_url ?? undefined,
    lastPingAt: r.last_ping_at ? Number(r.last_ping_at) : undefined,
    heartbeatToken: r.heartbeat_token ?? undefined,
  }));
}

export function createComponent(params: {
  pageId: string;
  name: string;
  groupName?: string;
  pingUrl?: string;
  heartbeatToken?: string;
}): Component {
  const db = getDatabase();
  const id = `comp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const countRow = db
    .prepare('SELECT COUNT(*) as count FROM components WHERE page_id = ?')
    .get(params.pageId) as any;
  const orderIndex = (countRow?.count || 0) + 1;
  const now = Date.now();

  db.prepare(
    `INSERT INTO components (id, page_id, name, group_name, status, order_index, uptime_percentage, ping_url, last_ping_at, heartbeat_token)
     VALUES (?, ?, ?, ?, 'OPERATIONAL', ?, 100.0, ?, ?, ?)`
  ).run(
    id,
    params.pageId,
    params.name,
    params.groupName || 'Services',
    orderIndex,
    params.pingUrl ?? null,
    now,
    params.heartbeatToken || `token_${id}`
  );

  // Seed initial 90-day 100% history
  const insertUptime = db.prepare(
    `INSERT INTO uptime_daily (id, component_id, date, uptime_pct, outage_minutes, incident_count)
     VALUES (?, ?, ?, 100.0, 0, 0)`
  );

  for (let i = 89; i >= 0; i--) {
    const dateStr = new Date(now - i * 86400000).toISOString().split('T')[0];
    insertUptime.run(`upt-${id}-${dateStr}`, id, dateStr);
  }

  return {
    id,
    pageId: params.pageId,
    name: params.name,
    groupName: params.groupName || 'Services',
    status: 'OPERATIONAL',
    orderIndex,
    uptimePercentage: 100.0,
    pingUrl: params.pingUrl,
    lastPingAt: now,
    heartbeatToken: params.heartbeatToken || `token_${id}`,
  };
}

export function deleteComponent(componentId: string): boolean {
  const db = getDatabase();
  const res = db.prepare('DELETE FROM components WHERE id = ?').run(componentId);
  return res.changes > 0;
}

export function getDailyUptime(componentId: string, limitDays = 90): DailyUptime[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT id, component_id, date, uptime_pct, outage_minutes, incident_count FROM uptime_daily WHERE component_id = ? ORDER BY date DESC LIMIT ?'
    )
    .all(componentId, limitDays) as any[];

  return rows.reverse().map((r) => ({
    id: r.id,
    componentId: r.component_id,
    date: r.date,
    uptimePct: Number(r.uptime_pct),
    outageMinutes: Number(r.outage_minutes),
    incidentCount: Number(r.incident_count),
  }));
}

export function getIncidents(pageId: string, includeResolvedDays = 14): Incident[] {
  const db = getDatabase();
  const cutoff = Date.now() - includeResolvedDays * 24 * 60 * 60 * 1000;

  const incidentRows = db
    .prepare(
      `SELECT id, page_id, title, status, severity, channel_message_id, created_at, resolved_at 
       FROM incidents 
       WHERE page_id = ? AND (resolved_at IS NULL OR resolved_at >= ?)
       ORDER BY created_at DESC`
    )
    .all(pageId, cutoff) as any[];

  return incidentRows.map((inc) => {
    const updateRows = db
      .prepare(
        'SELECT id, incident_id, status, message, created_at FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC'
      )
      .all(inc.id) as any[];

    const affectedRows = db
      .prepare('SELECT component_id FROM incident_affected_components WHERE incident_id = ?')
      .all(inc.id) as any[];

    return {
      id: inc.id,
      pageId: inc.page_id,
      title: inc.title,
      status: inc.status as IncidentStatus,
      severity: inc.severity as IncidentSeverity,
      channelMessageId: inc.channel_message_id ? Number(inc.channel_message_id) : undefined,
      createdAt: Number(inc.created_at),
      resolvedAt: inc.resolved_at ? Number(inc.resolved_at) : null,
      updates: updateRows.map((u) => ({
        id: u.id,
        incidentId: u.incident_id,
        status: u.status as IncidentStatus,
        message: u.message,
        createdAt: Number(u.created_at),
      })),
      affectedComponentIds: affectedRows.map((a) => a.component_id),
    };
  });
}

export function updateComponentStatus(
  componentId: string,
  status: ComponentStatus,
  metadata?: { name?: string; groupName?: string; pingUrl?: string }
): void {
  const db = getDatabase();

  if (metadata) {
    db.prepare(
      `UPDATE components 
       SET status = ?, 
           name = COALESCE(?, name), 
           group_name = COALESCE(?, group_name), 
           ping_url = COALESCE(?, ping_url)
       WHERE id = ?`
    ).run(status, metadata.name ?? null, metadata.groupName ?? null, metadata.pingUrl ?? null, componentId);
  } else {
    db.prepare('UPDATE components SET status = ? WHERE id = ?').run(status, componentId);
  }
}

export function createIncident(params: {
  id?: string;
  pageId: string;
  title: string;
  severity: IncidentSeverity;
  initialMessage: string;
  affectedComponentIds?: string[];
  channelMessageId?: number;
}): Incident {
  const db = getDatabase();
  const id = params.id || `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();

  db.prepare(
    `INSERT INTO incidents (id, page_id, title, status, severity, channel_message_id, created_at, resolved_at)
     VALUES (?, ?, ?, 'INVESTIGATING', ?, ?, ?, NULL)`
  ).run(id, params.pageId, params.title, params.severity, params.channelMessageId ?? null, now);

  const updateId = `upd-${Date.now()}-1`;
  db.prepare(
    `INSERT INTO incident_updates (id, incident_id, status, message, created_at)
     VALUES (?, ?, 'INVESTIGATING', ?, ?)`
  ).run(updateId, id, params.initialMessage, now);

  if (params.affectedComponentIds && params.affectedComponentIds.length > 0) {
    const insertAffected = db.prepare(
      'INSERT OR IGNORE INTO incident_affected_components (incident_id, component_id) VALUES (?, ?)'
    );
    for (const compId of params.affectedComponentIds) {
      insertAffected.run(id, compId);

      const compStatus: ComponentStatus =
        params.severity === 'CRITICAL' ? 'MAJOR_OUTAGE' : 'DEGRADED';
      updateComponentStatus(compId, compStatus);
    }
  }

  return {
    id,
    pageId: params.pageId,
    title: params.title,
    status: 'INVESTIGATING',
    severity: params.severity,
    channelMessageId: params.channelMessageId,
    createdAt: now,
    resolvedAt: null,
    updates: [
      {
        id: updateId,
        incidentId: id,
        status: 'INVESTIGATING',
        message: params.initialMessage,
        createdAt: now,
      },
    ],
    affectedComponentIds: params.affectedComponentIds || [],
  };
}

export function addIncidentUpdate(params: {
  incidentId: string;
  status: IncidentStatus;
  message: string;
}): IncidentUpdate {
  const db = getDatabase();
  const id = `upd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();

  db.prepare(
    `INSERT INTO incident_updates (id, incident_id, status, message, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, params.incidentId, params.status, params.message, now);

  db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(params.status, params.incidentId);

  return {
    id,
    incidentId: params.incidentId,
    status: params.status,
    message: params.message,
    createdAt: now,
  };
}

export function resolveIncident(
  incidentId: string,
  finalMessage?: string
): { resolvedAt: number; durationMinutes: number } {
  const db = getDatabase();
  const now = Date.now();

  const inc = db.prepare('SELECT created_at FROM incidents WHERE id = ?').get(incidentId) as any;
  const createdAt = inc ? Number(inc.created_at) : now;
  const durationMinutes = Math.max(1, Math.round((now - createdAt) / 60000));

  db.prepare(
    'UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ?'
  ).run('RESOLVED', now, incidentId);

  if (finalMessage) {
    const updateId = `upd-${Date.now()}-res`;
    db.prepare(
      `INSERT INTO incident_updates (id, incident_id, status, message, created_at)
       VALUES (?, ?, 'RESOLVED', ?, ?)`
    ).run(updateId, incidentId, finalMessage, now);
  }

  const affected = db
    .prepare('SELECT component_id FROM incident_affected_components WHERE incident_id = ?')
    .all(incidentId) as any[];

  for (const row of affected) {
    const activeOther = db
      .prepare(
        `SELECT COUNT(*) as cnt 
         FROM incidents i 
         JOIN incident_affected_components a ON i.id = a.incident_id 
         WHERE a.component_id = ? AND i.status != 'RESOLVED'`
      )
      .get(row.component_id) as any;

    if (activeOther && activeOther.cnt === 0) {
      updateComponentStatus(row.component_id, 'OPERATIONAL');
    }
  }

  return { resolvedAt: now, durationMinutes };
}

export function setIncidentChannelMessageId(incidentId: string, messageId: number): void {
  const db = getDatabase();
  db.prepare('UPDATE incidents SET channel_message_id = ? WHERE id = ?').run(messageId, incidentId);
}

export function recordHeartbeat(componentId: string): boolean {
  const db = getDatabase();
  const now = Date.now();
  const res = db
    .prepare('UPDATE components SET last_ping_at = ?, status = ? WHERE id = ?')
    .run(now, 'OPERATIONAL', componentId);
  return res.changes > 0;
}

// Latency Samples DAO
export function recordLatencySample(
  componentId: string,
  latencyMs: number,
  statusCode = 200
): void {
  const db = getDatabase();
  const id = `lat-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
  db.prepare(
    `INSERT INTO latency_samples (id, component_id, timestamp, latency_ms, status_code)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, componentId, Date.now(), latencyMs, statusCode);
}

export function getRecentLatencySamples(componentId: string, hours = 24): LatencySample[] {
  const db = getDatabase();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const rows = db
    .prepare(
      `SELECT id, component_id, timestamp, latency_ms, status_code 
       FROM latency_samples 
       WHERE component_id = ? AND timestamp >= ? 
       ORDER BY timestamp ASC`
    )
    .all(componentId, cutoff) as any[];

  return rows.map((r) => ({
    id: r.id,
    componentId: r.component_id,
    timestamp: Number(r.timestamp),
    latencyMs: Number(r.latency_ms),
    statusCode: Number(r.status_code),
  }));
}

// Subscribers DAO
export function addSubscriber(
  pageId: string,
  telegramUserId: number,
  username?: string
): Subscriber {
  const db = getDatabase();
  const id = `sub-${pageId}-${telegramUserId}`;
  const now = Date.now();

  db.prepare(
    `INSERT INTO subscribers (id, page_id, telegram_user_id, username, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(page_id, telegram_user_id) DO UPDATE SET username = excluded.username`
  ).run(id, pageId, telegramUserId, username ?? null, now);

  return { id, pageId, telegramUserId, username, createdAt: now };
}

export function removeSubscriber(pageId: string, telegramUserId: number): boolean {
  const db = getDatabase();
  const res = db
    .prepare('DELETE FROM subscribers WHERE page_id = ? AND telegram_user_id = ?')
    .run(pageId, telegramUserId);
  return res.changes > 0;
}

export function isSubscribed(pageId: string, telegramUserId: number): boolean {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id FROM subscribers WHERE page_id = ? AND telegram_user_id = ?')
    .get(pageId, telegramUserId);
  return Boolean(row);
}

export function getSubscribers(pageId: string): Subscriber[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT id, page_id, telegram_user_id, username, created_at FROM subscribers WHERE page_id = ?'
    )
    .all(pageId) as any[];

  return rows.map((r) => ({
    id: r.id,
    pageId: r.page_id,
    telegramUserId: Number(r.telegram_user_id),
    username: r.username ?? undefined,
    createdAt: Number(r.created_at),
  }));
}

export function getSubscribersCount(pageId: string): number {
  const db = getDatabase();
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM subscribers WHERE page_id = ?')
    .get(pageId) as any;
  return row ? Number(row.cnt) : 0;
}

// Maintenance Windows DAO
export function createMaintenanceWindow(params: {
  pageId: string;
  title: string;
  description: string;
  scheduledStart: number;
  scheduledEnd: number;
  affectedComponentIds?: string[];
}): MaintenanceWindow {
  const db = getDatabase();
  const id = `maint-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
  const now = Date.now();

  db.prepare(
    `INSERT INTO maintenance_windows (id, page_id, title, description, scheduled_start, scheduled_end, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`
  ).run(
    id,
    params.pageId,
    params.title,
    params.description,
    params.scheduledStart,
    params.scheduledEnd,
    now
  );

  if (params.affectedComponentIds && params.affectedComponentIds.length > 0) {
    const insertAffected = db.prepare(
      'INSERT INTO maintenance_affected_components (maintenance_id, component_id) VALUES (?, ?)'
    );
    for (const compId of params.affectedComponentIds) {
      insertAffected.run(id, compId);
    }
  }

  return {
    id,
    pageId: params.pageId,
    title: params.title,
    description: params.description,
    scheduledStart: params.scheduledStart,
    scheduledEnd: params.scheduledEnd,
    status: 'SCHEDULED',
    createdAt: now,
    affectedComponentIds: params.affectedComponentIds || [],
  };
}

export function getMaintenanceWindows(pageId: string): MaintenanceWindow[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT id, page_id, title, description, scheduled_start, scheduled_end, status, created_at
       FROM maintenance_windows 
       WHERE page_id = ? AND status != 'COMPLETED'
       ORDER BY scheduled_start ASC`
    )
    .all(pageId) as any[];

  return rows.map((r) => {
    const affected = db
      .prepare('SELECT component_id FROM maintenance_affected_components WHERE maintenance_id = ?')
      .all(r.id) as any[];

    return {
      id: r.id,
      pageId: r.page_id,
      title: r.title,
      description: r.description,
      scheduledStart: Number(r.scheduled_start),
      scheduledEnd: Number(r.scheduled_end),
      status: r.status as MaintenanceStatus,
      createdAt: Number(r.created_at),
      affectedComponentIds: affected.map((a) => a.component_id),
    };
  });
}

export function updateMaintenanceStatus(id: string, status: MaintenanceStatus): void {
  const db = getDatabase();
  db.prepare('UPDATE maintenance_windows SET status = ? WHERE id = ?').run(status, id);

  // If in progress, mark affected components as MAINTENANCE
  if (status === 'IN_PROGRESS') {
    const affected = db
      .prepare('SELECT component_id FROM maintenance_affected_components WHERE maintenance_id = ?')
      .all(id) as any[];
    for (const a of affected) {
      updateComponentStatus(a.component_id, 'MAINTENANCE');
    }
  } else if (status === 'COMPLETED') {
    const affected = db
      .prepare('SELECT component_id FROM maintenance_affected_components WHERE maintenance_id = ?')
      .all(id) as any[];
    for (const a of affected) {
      updateComponentStatus(a.component_id, 'OPERATIONAL');
    }
  }
}
