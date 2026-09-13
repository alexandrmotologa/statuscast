import { Bot, InlineKeyboard } from 'grammy';
import { Incident, IncidentSeverity, IncidentStatus } from '../types.js';

export interface BroadcastLogItem {
  id: string;
  incidentId: string;
  channelId: string;
  messageId: number;
  action: 'POST' | 'EDIT' | 'RESOLVE';
  text: string;
  timestamp: number;
  simulated: boolean;
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

    if (this.bot && this.bot.token && !this.bot.token.startsWith('mock_')) {
      try {
        const msg = await this.bot.api.sendMessage(this.channelId, text, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        this.recordLog({
          incidentId: incident.id,
          channelId: this.channelId,
          messageId: msg.message_id,
          action: 'POST',
          text,
          simulated: false,
        });

        return msg.message_id;
      } catch (err) {
        console.warn('[Broadcaster] Telegram sendMessage failed, recording simulation:', err);
      }
    }

    // Fallback simulation mode
    const simulatedMsgId = Math.floor(1000 + Math.random() * 9000);
    this.recordLog({
      incidentId: incident.id,
      channelId: this.channelId,
      messageId: simulatedMsgId,
      action: 'POST',
      text,
      simulated: true,
    });

    return simulatedMsgId;
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

        return true;
      } catch (err) {
        console.warn('[Broadcaster] Telegram editMessageText failed:', err);
      }
    }

    this.recordLog({
      incidentId: incident.id,
      channelId: this.channelId,
      messageId,
      action: 'EDIT',
      text,
      simulated: true,
    });

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

        return true;
      } catch (err) {
        console.warn('[Broadcaster] Telegram resolve editMessageText failed:', err);
      }
    }

    this.recordLog({
      incidentId: incident.id,
      channelId: this.channelId,
      messageId,
      action: 'RESOLVE',
      text,
      simulated: true,
    });

    return true;
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

  private recordLog(item: Omit<BroadcastLogItem, 'id' | 'timestamp'>): void {
    broadcastHistory.unshift({
      ...item,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
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
