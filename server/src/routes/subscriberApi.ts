import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  addSubscriber,
  getSubscribersCount,
  isSubscribed,
  removeSubscriber,
} from '../db/database.js';

export async function subscriberApiRoutes(fastify: FastifyInstance): Promise<void> {
  // Subscribe to personal DM alerts
  fastify.post(
    '/api/subscriptions/subscribe',
    async (
      request: FastifyRequest<{
        Body: {
          pageId: string;
          telegramUserId: number;
          username?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { pageId, telegramUserId, username } = request.body || {};
      if (!pageId || !telegramUserId) {
        return reply.code(400).send({
          error: 'Missing required parameters: pageId, telegramUserId',
        });
      }

      const sub = addSubscriber(pageId, Number(telegramUserId), username);
      const totalCount = getSubscribersCount(pageId);

      return reply.send({
        success: true,
        subscribed: true,
        subscriber: sub,
        totalSubscribers: totalCount,
      });
    }
  );

  // Unsubscribe
  fastify.post(
    '/api/subscriptions/unsubscribe',
    async (
      request: FastifyRequest<{
        Body: {
          pageId: string;
          telegramUserId: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { pageId, telegramUserId } = request.body || {};
      if (!pageId || !telegramUserId) {
        return reply.code(400).send({
          error: 'Missing required parameters: pageId, telegramUserId',
        });
      }

      const removed = removeSubscriber(pageId, Number(telegramUserId));
      const totalCount = getSubscribersCount(pageId);

      return reply.send({
        success: true,
        subscribed: false,
        removed,
        totalSubscribers: totalCount,
      });
    }
  );

  // Check subscription status
  fastify.get(
    '/api/subscriptions/status',
    async (
      request: FastifyRequest<{
        Querystring: {
          pageId: string;
          userId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { pageId, userId } = request.query || {};
      if (!pageId || !userId) {
        return reply.code(400).send({ error: 'Missing pageId or userId' });
      }

      const subscribed = isSubscribed(pageId, parseInt(userId, 10));
      const totalCount = getSubscribersCount(pageId);

      return reply.send({
        pageId,
        userId: parseInt(userId, 10),
        subscribed,
        totalSubscribers: totalCount,
      });
    }
  );
}
