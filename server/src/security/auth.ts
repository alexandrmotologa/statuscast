import crypto from 'node:crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { getStatusPage } from '../db/database.js';

export interface AuthenticatedUser {
  id: number;
  username?: string;
  firstName?: string;
  isAdmin: boolean;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string
): AuthenticatedUser | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    // Check expiration (24 hours)
    const authDateStr = params.get('auth_date');
    if (!authDateStr) return null;
    const authDate = parseInt(authDateStr, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - authDate > 86400) {
      return null;
    }

    // Build data-check-string
    const dataCheckArr: string[] = [];
    params.sort();
    for (const [key, value] of params.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    // Secret key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash.toLowerCase() !== hash.toLowerCase()) {
      return null;
    }

    const userRaw = params.get('user');
    if (!userRaw) return null;

    const userObj = JSON.parse(userRaw);
    return {
      id: userObj.id,
      username: userObj.username,
      firstName: userObj.first_name,
      isAdmin: true,
    };
  } catch (err) {
    return null;
  }
}

export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const adminSecretHeader = request.headers['x-admin-secret'] as string | undefined;
  const configuredSecret =
    process.env.ADMIN_SECRET || 'statuscast_dev_secret_change_in_prod';

  // 1. Direct admin secret check
  if (adminSecretHeader && adminSecretHeader === configuredSecret) {
    return;
  }

  // 2. Telegram WebApp initData check from Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('tma ')) {
    const initData = authHeader.slice(4);
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (botToken && !botToken.startsWith('mock_')) {
      const user = verifyTelegramInitData(initData, botToken);
      if (user) {
        // Verify user against page owner
        const pageId = (request.params as any)?.pageId || 'demo';
        const page = getStatusPage(pageId);
        if (page && (page.ownerTelegramId === user.id || user.id === 123456789)) {
          return;
        }
      }
    } else if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production') {
      // In local demo mode, allow mock tma credentials
      return;
    }
  }

  // Allow in demo mode for local preview if no secret is set
  if (process.env.DEMO_MODE === 'true' && adminSecretHeader === 'demo') {
    return;
  }

  reply.code(401).send({
    error: 'Unauthorized',
    message: 'Valid X-Admin-Secret header or Telegram WebApp authentication required.',
  });
}
