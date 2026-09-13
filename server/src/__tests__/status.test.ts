import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  closeDatabase,
  createIncident,
  getComponents,
  getDailyUptime,
  getDatabase,
  getIncidents,
  getStatusPage,
  recordHeartbeat,
  resolveIncident,
  updateComponentStatus,
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
});
