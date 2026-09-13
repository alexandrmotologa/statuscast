import { getDatabase } from './database.js';

export function seedDemoData(): void {
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM status_pages WHERE id = ?').get('demo');
  if (existing) {
    return;
  }

  const now = Date.now();

  // 1. Create Demo Status Page
  db.prepare(
    `INSERT INTO status_pages (id, owner_telegram_id, title, channel_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    'demo',
    123456789,
    'Cloud Infrastructure & API Status',
    process.env.TELEGRAM_CHANNEL_ID || '@statuscast_updates',
    now - 90 * 24 * 60 * 60 * 1000
  );

  // 2. Create Components
  const components = [
    {
      id: 'comp-api',
      name: 'API Gateway',
      groupName: 'Core Infrastructure',
      status: 'OPERATIONAL',
      orderIndex: 1,
      uptimePercentage: 99.99,
      pingUrl: 'http://localhost:8080/health',
      heartbeatToken: 'token_api_gateway_demo',
    },
    {
      id: 'comp-web',
      name: 'Web Application',
      groupName: 'Frontend & Apps',
      status: 'OPERATIONAL',
      orderIndex: 2,
      uptimePercentage: 99.95,
      pingUrl: undefined,
      heartbeatToken: 'token_web_app_demo',
    },
    {
      id: 'comp-db',
      name: 'Database Cluster',
      groupName: 'Data Stores',
      status: 'OPERATIONAL',
      orderIndex: 3,
      uptimePercentage: 99.98,
      pingUrl: undefined,
      heartbeatToken: 'token_db_cluster_demo',
    },
    {
      id: 'comp-payments',
      name: 'Payment Processor',
      groupName: 'Integrations',
      status: 'DEGRADED',
      orderIndex: 4,
      uptimePercentage: 98.85,
      pingUrl: undefined,
      heartbeatToken: 'token_payments_demo',
    },
  ];

  const insertComp = db.prepare(
    `INSERT INTO components (id, page_id, name, group_name, status, order_index, uptime_percentage, ping_url, last_ping_at, heartbeat_token)
     VALUES (?, 'demo', ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const c of components) {
    insertComp.run(
      c.id,
      c.name,
      c.groupName,
      c.status,
      c.orderIndex,
      c.uptimePercentage,
      c.pingUrl ?? null,
      now - 60000,
      c.heartbeatToken
    );
  }

  // 3. Seed 90 days of historical uptime pills
  const insertUptime = db.prepare(
    `INSERT INTO uptime_daily (id, component_id, date, uptime_pct, outage_minutes, incident_count)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const comp of components) {
    for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
      const dateObj = new Date(now - dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = dateObj.toISOString().split('T')[0];

      let uptimePct = 100.0;
      let outageMinutes = 0;
      let incidentCount = 0;

      // Deterministic variations for realistic demonstration
      if (comp.id === 'comp-payments') {
        if (dayOffset === 0) {
          uptimePct = 96.2;
          outageMinutes = 38;
          incidentCount = 1;
        } else if (dayOffset === 1) {
          uptimePct = 98.4;
          outageMinutes = 15;
          incidentCount = 1;
        } else if (dayOffset === 14) {
          uptimePct = 97.8;
          outageMinutes = 22;
          incidentCount = 1;
        }
      } else if (comp.id === 'comp-web' && dayOffset === 28) {
        uptimePct = 99.1;
        outageMinutes = 12;
        incidentCount = 1;
      } else if (comp.id === 'comp-db' && dayOffset === 3) {
        uptimePct = 99.6;
        outageMinutes = 6;
        incidentCount = 1;
      }

      insertUptime.run(
        `upt-${comp.id}-${dateStr}`,
        comp.id,
        dateStr,
        uptimePct,
        outageMinutes,
        incidentCount
      );
    }
  }

  // 4. Seed Active Incident
  const activeIncId = 'inc-demo-active';
  db.prepare(
    `INSERT INTO incidents (id, page_id, title, status, severity, channel_message_id, created_at, resolved_at)
     VALUES (?, 'demo', ?, 'INVESTIGATING', 'MAJOR', 101, ?, NULL)`
  ).run(
    activeIncId,
    'Payment Gateway Latency Spike & Elevated 504s',
    now - 42 * 60 * 1000
  );

  db.prepare(
    `INSERT INTO incident_updates (id, incident_id, status, message, created_at)
     VALUES (?, ?, 'INVESTIGATING', ?, ?)`
  ).run(
    'upd-demo-active-1',
    activeIncId,
    'We are investigating elevated response times and 504 errors on payment webhook processing. Fallback routing has been enabled.',
    now - 42 * 60 * 1000
  );

  db.prepare(
    'INSERT INTO incident_affected_components (incident_id, component_id) VALUES (?, ?)'
  ).run(activeIncId, 'comp-payments');

  // 5. Seed Past Resolved Incident (3 days ago)
  const resolvedIncId = 'inc-demo-resolved';
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
  db.prepare(
    `INSERT INTO incidents (id, page_id, title, status, severity, channel_message_id, created_at, resolved_at)
     VALUES (?, 'demo', ?, 'RESOLVED', 'MINOR', 88, ?, ?)`
  ).run(
    resolvedIncId,
    'Scheduled Database Index Optimization',
    threeDaysAgo,
    threeDaysAgo + 45 * 60 * 1000
  );

  db.prepare(
    `INSERT INTO incident_updates (id, incident_id, status, message, created_at)
     VALUES (?, ?, 'MONITORING', ?, ?)`
  ).run(
    'upd-demo-res-1',
    resolvedIncId,
    'Database index maintenance started on primary read replicas.',
    threeDaysAgo
  );

  db.prepare(
    `INSERT INTO incident_updates (id, incident_id, status, message, created_at)
     VALUES (?, ?, 'RESOLVED', ?, ?)`
  ).run(
    'upd-demo-res-2',
    resolvedIncId,
    'Index optimization completed successfully. Replica replication lag is at 0ms.',
    threeDaysAgo + 45 * 60 * 1000
  );

  db.prepare(
    'INSERT INTO incident_affected_components (incident_id, component_id) VALUES (?, ?)'
  ).run(resolvedIncId, 'comp-db');
}
