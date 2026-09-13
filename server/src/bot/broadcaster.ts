import { Bot, InlineKeyboard } from 'grammy';
import { getSubscribers } from '../db/database.js';
import { Incident, MaintenanceWindow } from '../types.js';

export interface BroadcastLogItem {
  id: string;
  incidentId: string;
  channelId: string;
  messageId: number;
  action: 'POST' | 'EDIT' | 'RESOLVE' | 'MAINTENANCE' | 'DM_ALERT';
  text: string;
  timestamp: number;
  simulated: boolean;
  subscribersNotified?: number;
}

// In-memory log of recent channel broadcasts (viewable in Admin Cockpit)
export const broadcastHistory: BroadcastLogItem[] = [];

export class ChannelBroadcaster {
  private bot: Bot | null = null;
  private channelId: string;
  private webAppUrl: string;

  constructor(bot: Bot | null, channelId: string, webAppUrl: string) {
    this.bot = bot;
    this.channelId = channelId;
    this.webAppUrl = webAppUrl;
  }

  public setBot(bot: Bot | null): void {
    this.bot = bot;
  }

  public async broadcastIncident(
    incident: Incident,
    affectedComponentNames: string[]
  ): Promise<number | undefined> {
    const text = this.formatIncidentMessage(incident, affectedComponentNames);
    const keyboard = new InlineKeyboard().url(
      '📊 View Live Status Page',
      `${this.webAppUrl}/?page=${incident.pageId}`
    );

    let messageId: number | undefined;

    if (this.bot && this.bot.token && !this.bot.token.startsWith('mock_')) {
      try {
        const msg = await this.bot.api.sendMessage(this.channelId, text, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });
        messageId = msg.message_id;

        this.recordLog({
          incidentId: incident.id,
          channelId: this.channelId,
          messageId: msg.message_id,
          action: 'POST',
          text,
          simulated: false,
        });
      } catch (err) {
        console.warn('[Broadcaster] Telegram sendMessage failed, recording simulation:', err);
      }
    }

    if (!messageId) {
      messageId = Math.floor(1000 + Math.random() * 9000);
      this.recordLog({
        incidentId: incident.id,
        channelId: this.channelId,
        messageId,
        action: 'POST',
        text,
        simulated: true,
      });
    }

    // Direct alerts to registered subscribers
    await this.notifySubscribers(incident, text);

    return messageId;
  }

  public async updateIncidentMessage(
    incident: Incident,
    affectedComponentNames: string[],
    messageId: number
  ): Promise<boolean> {
    const text = this.formatIncidentMessage(incident, affectedComponentNames);
    const keyboard = new InlineKeyboard().url(
      '📊 View Live Status Page',
      `${this.webAppUrl}/?page=${incident.pageId}`
    );

    if (this.bot && this.bot.token && !this.bot.token.startsWith('mock_')) {
      try {
        await this.bot.api.editMessageText(this.channelId, messageId, text, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        this.recordLog({
          incidentId: incident.id,
          channelId: this.channelId,
          messageId,
          action: 'EDIT',
          text,
          simulated: false,
        });
      } catch (err) {
        console.warn('[Broadcaster] Telegram editMessageText failed:', err);
      }
    } else {
      this.recordLog({
        incidentId: incident.id,
        channelId: this.channelId,
        messageId,
        action: 'EDIT',
        text,
        simulated: true,
      });
    }

    await this.notifySubscribers(incident, text);
    return true;
  }

  public async resolveIncidentMessage(
    incident: Incident,
    affectedComponentNames: string[],
    messageId: number,
    durationMinutes: number
  ): Promise<boolean> {
    const text = this.formatResolutionMessage(incident, affectedComponentNames, durationMinutes);
    const keyboard = new InlineKeyboard().url(
      '📊 View Live Status Page',
      `${this.webAppUrl}/?page=${incident.pageId}`
    );

    if (this.bot && this.bot.token && !this.bot.token.startsWith('mock_')) {
      try {
        await this.bot.api.editMessageText(this.channelId, messageId, text, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        this.recordLog({
          incidentId: incident.id,
          channelId: this.channelId,
          messageId,
          action: 'RESOLVE',
          text,
          simulated: false,
        });
      } catch (err) {
        console.warn('[Broadcaster] Telegram resolve editMessageText failed:', err);
      }
    } else {
      this.recordLog({
        incidentId: incident.id,
        channelId: this.channelId,
        messageId,
        action: 'RESOLVE',
        text,
        simulated: true,
      });
    }

    await this.notifySubscribers(incident, text);
    return true;
  }

  public async broadcastMaintenance(
    maint: MaintenanceWindow,
    affectedNames: string[]
  ): Promise<number> {
    const startDate = new Date(maint.scheduledStart).toUTCString();
    const endDate = new Date(maint.scheduledEnd).toUTCString();
    const affected = affectedNames.length > 0 ? affectedNames.join(', ') : 'All Infrastructure';

    const text =
      `🛠️ <b>[SCHEDULED MAINTENANCE] ${escapeHtml(maint.title)}</b>\n\n` +
      `<b>Window:</b> <code>${startDate}</code> – <code>${endDate}</code>\n` +
      `<b>Affected Services:</b> ${escapeHtml(affected)}\n\n` +
      `<i>${escapeHtml(maint.description)}</i>`;

    const keyboard = new InlineKeyboard().url(
      '📊 View Live Status Page',
      `${this.webAppUrl}/?page=${maint.pageId}`
    );

    let messageId = Math.floor(1000 + Math.random() * 9000);

    if (this.bot && this.bot.token && !this.bot.token.startsWith('mock_')) {
      try {
        const msg = await this.bot.api.sendMessage(this.channelId, text, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });
        messageId = msg.message_id;
      } catch (err) {
        console.warn('[Broadcaster] Failed to broadcast maintenance:', err);
      }
    }

    this.recordLog({
      incidentId: maint.id,
      channelId: this.channelId,
      messageId,
      action: 'MAINTENANCE',
      text,
      simulated: !Boolean(this.bot && this.bot.token && !this.bot.token.startsWith('mock_')),
    });

    return messageId;
  }

  private async notifySubscribers(incident: Incident, alertText: string): Promise<void> {
    const subscribers = getSubscribers(incident.pageId);
    if (subscribers.length === 0) return;

    let notifiedCount = 0;
    const isLive = Boolean(this.bot && this.bot.token && !this.bot.token.startsWith('mock_'));

    if (isLive && this.bot) {
      for (const sub of subscribers) {
        try {
          await this.bot.api.sendMessage(
            sub.telegramUserId,
            `🔔 <b>StatusCast Personal Alert</b>\n\n${alertText}`,
            { parse_mode: 'HTML' }
          );
          notifiedCount++;
        } catch (err) {
          // Ignore failed DMs to individual users (e.g. blocked bot)
        }
      }
    } else {
      notifiedCount = subscribers.length;
    }

    this.recordLog({
      incidentId: incident.id,
      channelId: `DM Alerts (${subscribers.length} subscribers)`,
      messageId: 0,
      action: 'DM_ALERT',
      text: `Sent DM notification to ${notifiedCount} registered subscriber(s).`,
      timestamp: Date.now(),
      simulated: !isLive,
      subscribersNotified: notifiedCount,
    });
  }

  private formatIncidentMessage(incident: Incident, affectedNames: string[]): string {
    const severityEmoji =
      incident.severity === 'CRITICAL' ? '🔴' : incident.severity === 'MAJOR' ? '🟠' : '🟡';
    const statusEmoji =
      incident.status === 'INVESTIGATING'
        ? '🔍'
        : incident.status === 'IDENTIFIED'
          ? '🎯'
          : incident.status === 'MONITORING'
            ? '👀'
            : '🟢';

    const affectedList =
      affectedNames.length > 0 ? affectedNames.join(', ') : 'All Systems';
    const latestUpdate =
      incident.updates.length > 0
        ? incident.updates[incident.updates.length - 1].message
        : 'Remediation is underway.';

    return (
      `🚨 <b>[INCIDENT] ${escapeHtml(incident.title)}</b>\n\n` +
      `<b>Severity:</b> ${severityEmoji} ${incident.severity}\n` +
      `<b>Status:</b> ${statusEmoji} ${incident.status}\n` +
      `<b>Affected Components:</b> ${escapeHtml(affectedList)}\n\n` +
      `<b>Latest Update:</b>\n<i>${escapeHtml(latestUpdate)}</i>\n\n` +
      `🕒 <code>${new Date().toUTCString()}</code>`
    );
  }

  private formatResolutionMessage(
    incident: Incident,
    affectedNames: string[],
    durationMinutes: number
  ): string {
    const affectedList =
      affectedNames.length > 0 ? affectedNames.join(', ') : 'All Systems';
    const latestUpdate =
      incident.updates.length > 0
        ? incident.updates[incident.updates.length - 1].message
        : 'All systems returned to nominal operation.';

    return (
      `🟢 <b>[RESOLVED] ${escapeHtml(incident.title)}</b>\n\n` +
      `<b>Status:</b> 🟢 RESOLVED\n` +
      `<b>Duration:</b> ${durationMinutes} minutes\n` +
      `<b>Affected Components:</b> ${escapeHtml(affectedList)}\n\n` +
      `<b>Resolution Notes:</b>\n<i>${escapeHtml(latestUpdate)}</i>\n\n` +
      `🕒 <code>${new Date().toUTCString()}</code>`
    );
  }

  private recordLog(item: Omit<BroadcastLogItem, 'id' | 'timestamp'> & { timestamp?: number }): void {
    broadcastHistory.unshift({
      ...item,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: item.timestamp || Date.now(),
    });

    if (broadcastHistory.length > 50) {
      broadcastHistory.pop();
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
