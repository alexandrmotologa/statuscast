import { Bot, InlineKeyboard } from 'grammy';
import { getComponents, getIncidents, getStatusPage } from '../db/database.js';
import { ChannelBroadcaster } from './broadcaster.js';

export function setupTelegramBot(
  token: string | undefined,
  channelId: string,
  webAppUrl: string
): { bot: Bot | null; broadcaster: ChannelBroadcaster } {
  const broadcaster = new ChannelBroadcaster(null, channelId, webAppUrl);

  if (!token || token.startsWith('mock_') || token.length < 10) {
    console.log('[Bot] Running in local simulation mode (TELEGRAM_BOT_TOKEN is not configured)');
    return { bot: null, broadcaster };
  }

  try {
    const bot = new Bot(token);
    broadcaster.setBot(bot);

    bot.command('start', async (ctx) => {
      const keyboard = new InlineKeyboard().webApp(
        '📊 Open Status Mini App',
        `${webAppUrl}/?page=demo`
      );

      await ctx.reply(
        `👋 Welcome to <b>StatusCast</b>!\n\n` +
          `Track real-time system uptime, active incidents, and maintenance schedules directly in Telegram.\n\n` +
          `Tap below to open the live Status Page:`,
        {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        }
      );
    });

    bot.command('status', async (ctx) => {
      const page = getStatusPage('demo');
      if (!page) {
        return ctx.reply('Status page is not initialized yet.');
      }

      const components = getComponents('demo');
      const degraded = components.filter((c) => c.status !== 'OPERATIONAL');

      let text = `<b>System Status: ${page.title}</b>\n\n`;
      if (degraded.length === 0) {
        text += `🟢 <b>All Systems Operational</b>\nAll ${components.length} services are reporting 100% normal health.\n`;
      } else {
        text += `⚠️ <b>Degraded Performance Detected</b>\n`;
        for (const c of degraded) {
          text += `• <b>${c.name}</b>: ${c.status}\n`;
        }
      }

      const keyboard = new InlineKeyboard().webApp(
        '📊 View Live Mini App',
        `${webAppUrl}/?page=demo`
      );

      await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'HTML' });
    });

    bot.command('incidents', async (ctx) => {
      const incidents = getIncidents('demo', 7);
      const active = incidents.filter((i) => i.status !== 'RESOLVED');

      if (active.length === 0) {
        return ctx.reply('🟢 <b>No active incidents.</b> All services running smoothly.', {
          parse_mode: 'HTML',
        });
      }

      let text = `🚨 <b>Active Incidents (${active.length}):</b>\n\n`;
      for (const inc of active) {
        text += `• <b>${inc.title}</b> (${inc.severity})\nStatus: ${inc.status}\n`;
        if (inc.updates.length > 0) {
          text += `Latest: <i>${inc.updates[inc.updates.length - 1].message}</i>\n`;
        }
        text += `\n`;
      }

      await ctx.reply(text, { parse_mode: 'HTML' });
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(
        `<b>StatusCast Bot Commands:</b>\n\n` +
          `/start - Open the Telegram Mini App\n` +
          `/status - Summary of all monitored components\n` +
          `/incidents - View active and recent incident reports\n` +
          `/help - Display this command reference`,
        { parse_mode: 'HTML' }
      );
    });

    // Start long polling asynchronously
    bot.start({
      onStart: (botInfo) => {
        console.log(`[Bot] Telegram bot @${botInfo.username} started in long-polling mode.`);
      },
    }).catch((err) => {
      console.warn('[Bot] Long polling could not connect (offline or invalid token):', err.message);
    });

    return { bot, broadcaster };
  } catch (err: any) {
    console.warn('[Bot] Failed to initialize grammY bot:', err.message);
    return { bot: null, broadcaster };
  }
}
