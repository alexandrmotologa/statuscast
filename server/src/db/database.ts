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
  StatusPage,
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

export function getDailyUptime(componentId: string, limitDays = 90): DailyUptime[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT id, component_id, date, uptime_pct, outage_minutes, incident_count FROM uptime_daily WHERE component_id = ? ORDER BY date DESC LIMIT ?'
    )
    .all(componentId, limitDays) as any[];

  // Return chronological order (oldest to newest for the 90-day bar)
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

      // Auto-set component status based on incident severity if needed
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

  // Restore affected components to OPERATIONAL if no other active incident affects them
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
