import { performance } from 'node:perf_hooks';
import { getDatabase, recordLatencySample, updateComponentStatus } from '../db/database.js';

export class MonitorService {
  private intervalTimer: NodeJS.Timeout | null = null;
  private failureCounts: Map<string, number> = new Map();
  private isRunning = false;

  public start(intervalSeconds = 60): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[MonitorService] Background health check worker started (interval: ${intervalSeconds}s)`);

    // Run initial check after 5 seconds
    setTimeout(() => this.runHealthChecks(), 5000);

    this.intervalTimer = setInterval(() => {
      this.runHealthChecks();
    }, intervalSeconds * 1000);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('[MonitorService] Background health check worker stopped');
  }

  private async runHealthChecks(): Promise<void> {
    try {
      const db = getDatabase();
      const componentsWithPing = db
        .prepare('SELECT id, name, ping_url, status FROM components WHERE ping_url IS NOT NULL')
        .all() as any[];

      for (const comp of componentsWithPing) {
        if (!comp.ping_url) continue;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const startTime = performance.now();

          const res = await fetch(comp.ping_url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'StatusCast-HealthCheck/1.0' },
          });
          clearTimeout(timeoutId);
          const latencyMs = Math.round(performance.now() - startTime);

          if (res.ok) {
            this.failureCounts.set(comp.id, 0);
            db.prepare('UPDATE components SET last_ping_at = ? WHERE id = ?').run(
              Date.now(),
              comp.id
            );

            // Record latency sample for 24h sparklines
            recordLatencySample(comp.id, latencyMs, res.status);
          } else {
            recordLatencySample(comp.id, latencyMs, res.status);
            this.handleFailure(comp.id, comp.name, comp.status, `HTTP ${res.status}`);
          }
        } catch (err: any) {
          recordLatencySample(comp.id, 5000, 0);
          this.handleFailure(comp.id, comp.name, comp.status, err.message);
        }
      }
    } catch (err) {
      console.warn('[MonitorService] Health check cycle encountered an error:', err);
    }
  }

  private handleFailure(
    componentId: string,
    name: string,
    currentStatus: string,
    reason: string
  ): void {
    const currentFailures = (this.failureCounts.get(componentId) || 0) + 1;
    this.failureCounts.set(componentId, currentFailures);

    console.warn(
      `[MonitorService] Ping failed for ${name} (${componentId}) [${currentFailures}/3]: ${reason}`
    );

    if (currentFailures >= 3 && currentStatus === 'OPERATIONAL') {
      console.warn(`[MonitorService] Marking component ${name} as DEGRADED due to 3 consecutive failures`);
      updateComponentStatus(componentId, 'DEGRADED');
    }
  }
}

export const monitorService = new MonitorService();
