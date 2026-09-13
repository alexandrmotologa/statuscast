import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  addSubscriber,
  closeDatabase,
  createComponent,
  createIncident,
  createMaintenanceWindow,
  deleteComponent,
  getComponents,
  getDailyUptime,
  getDatabase,
  getIncidents,
  getMaintenanceWindows,
  getRecentLatencySamples,
  getStatusPage,
  getSubscribersCount,
  isSubscribed,
  recordHeartbeat,
  recordLatencySample,
  removeSubscriber,
  resolveIncident,
  updateComponentStatus,
  updateMaintenanceStatus,
} from '../db/database.js';
import { seedDemoData } from '../db/seeder.js';
import { verifyTelegramInitData } from '../security/auth.js';

const testDbPath = path.join(process.cwd(), 'data', 'test_statuscast.sqlite');

describe('StatusCast Database & Domain Logic', () => {
  beforeAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    process.env.DATABASE_PATH = testDbPath;
    getDatabase(testDbPath);
    seedDemoData();
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  it('should seed demo page with 4 components and 90-day history', () => {
    const page = getStatusPage('demo');
    expect(page).toBeDefined();
    expect(page?.title).toBe('Cloud Infrastructure & API Status');

    const components = getComponents('demo');
    expect(components.length).toBe(4);

    const apiComp = components.find((c) => c.id === 'comp-api');
    expect(apiComp).toBeDefined();
    expect(apiComp?.status).toBe('OPERATIONAL');

    const history = getDailyUptime('comp-api', 90);
    expect(history.length).toBe(90);
  });

  it('should create an incident and mark affected component as degraded', () => {
    const inc = createIncident({
      pageId: 'demo',
      title: 'Cache Latency Regression',
      severity: 'MAJOR',
      initialMessage: 'Investigating Redis cluster memory usage',
      affectedComponentIds: ['comp-db'],
    });

    expect(inc.id).toBeDefined();
    expect(inc.status).toBe('INVESTIGATING');

    const components = getComponents('demo');
    const dbComp = components.find((c) => c.id === 'comp-db');
    expect(dbComp?.status).toBe('DEGRADED');

    const incidents = getIncidents('demo', 7);
    const found = incidents.find((i) => i.id === inc.id);
    expect(found).toBeDefined();
    expect(found?.updates.length).toBe(1);
  });

  it('should resolve incident and restore component to operational', () => {
    const inc = createIncident({
      pageId: 'demo',
      title: 'Temporary CDN Flap',
      severity: 'MINOR',
      initialMessage: 'Edge nodes reconnecting',
      affectedComponentIds: ['comp-web'],
    });

    let components = getComponents('demo');
    expect(components.find((c) => c.id === 'comp-web')?.status).toBe('DEGRADED');

    const res = resolveIncident(inc.id, 'Edge nodes synchronized and healthy');
    expect(res.durationMinutes).toBeGreaterThanOrEqual(1);

    components = getComponents('demo');
    expect(components.find((c) => c.id === 'comp-web')?.status).toBe('OPERATIONAL');
  });

  it('should accept heartbeat keepalive ping', () => {
    updateComponentStatus('comp-api', 'DEGRADED');
    const updated = recordHeartbeat('comp-api');
    expect(updated).toBe(true);

    const components = getComponents('demo');
    const apiComp = components.find((c) => c.id === 'comp-api');
    expect(apiComp?.status).toBe('OPERATIONAL');
    expect(apiComp?.lastPingAt).toBeGreaterThan(0);
  });

  it('should correctly validate cryptographic Telegram WebApp initData', () => {
    const mockBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
    const authDate = Math.floor(Date.now() / 1000);
    const userJson = JSON.stringify({ id: 123456789, first_name: 'Alex' });

    // Generate valid HMAC
    const params = new URLSearchParams();
    params.set('auth_date', authDate.toString());
    params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc');
    params.set('user', userJson);
    params.sort();

    const dataCheckArr: string[] = [];
    for (const [k, v] of params.entries()) {
      dataCheckArr.push(`${k}=${v}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(mockBotToken)
      .digest();

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    params.set('hash', hash);
    const validInitData = params.toString();

    const user = verifyTelegramInitData(validInitData, mockBotToken);
    expect(user).toBeDefined();
    expect(user?.id).toBe(123456789);

    // Invalid hash check
    const invalidData = validInitData + 'invalid';
    expect(verifyTelegramInitData(invalidData, mockBotToken)).toBeNull();
  });

  it('should manage direct alert subscribers', () => {
    const sub = addSubscriber('demo', 987654321, 'test_user');
    expect(sub).toBeDefined();
    expect(sub.telegramUserId).toBe(987654321);

    expect(isSubscribed('demo', 987654321)).toBe(true);
    expect(isSubscribed('demo', 999999999)).toBe(false);
    expect(getSubscribersCount('demo')).toBeGreaterThanOrEqual(1);

    const removed = removeSubscriber('demo', 987654321);
    expect(removed).toBe(true);
    expect(isSubscribed('demo', 987654321)).toBe(false);
  });

  it('should record and fetch 24h latency samples', () => {
    recordLatencySample('comp-api', 32.5, 200);
    recordLatencySample('comp-api', 45.1, 200);

    const samples = getRecentLatencySamples('comp-api', 24);
    expect(samples.length).toBeGreaterThanOrEqual(2);
    const last = samples[samples.length - 1];
    expect(last.latencyMs).toBe(45.1);
    expect(last.statusCode).toBe(200);
  });

  it('should create, schedule and update maintenance windows', () => {
    const now = Date.now();
    const maint = createMaintenanceWindow({
      pageId: 'demo',
      title: 'Database Engine Major Upgrade',
      description: 'Upgrading database storage engines to version 17.',
      scheduledStart: now + 3600000,
      scheduledEnd: now + 7200000,
      affectedComponentIds: ['comp-db'],
    });

    expect(maint.id).toBeDefined();
    expect(maint.status).toBe('SCHEDULED');

    let list = getMaintenanceWindows('demo');
    expect(list.some((m) => m.id === maint.id)).toBe(true);

    updateMaintenanceStatus(maint.id, 'IN_PROGRESS');
    const dbComp = getComponents('demo').find((c) => c.id === 'comp-db');
    expect(dbComp?.status).toBe('MAINTENANCE');

    updateMaintenanceStatus(maint.id, 'COMPLETED');
    const dbCompRestored = getComponents('demo').find((c) => c.id === 'comp-db');
    expect(dbCompRestored?.status).toBe('OPERATIONAL');
  });

  it('should create and delete components via admin CRUD', () => {
    const newComp = createComponent({
      pageId: 'demo',
      name: 'Search & Analytics Engine',
      groupName: 'Search Services',
      pingUrl: 'http://localhost:8080/health',
    });

    expect(newComp.id).toBeDefined();
    expect(newComp.name).toBe('Search & Analytics Engine');

    let all = getComponents('demo');
    expect(all.some((c) => c.id === newComp.id)).toBe(true);

    const history = getDailyUptime(newComp.id, 90);
    expect(history.length).toBe(90);

    const deleted = deleteComponent(newComp.id);
    expect(deleted).toBe(true);

    all = getComponents('demo');
    expect(all.some((c) => c.id === newComp.id)).toBe(false);
  });
});

