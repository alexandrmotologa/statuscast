import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDatabase, recordHeartbeat } from '../db/database.js';

export async function heartbeatApiRoutes(fastify: FastifyInstance): Promise<void> {
  // Ingest keepalive ping
  fastify.post(
    '/api/heartbeat/:componentId',
    async (
      request: FastifyRequest<{
        Params: { componentId: string };
        Querystring: { token?: string };
        Body?: { token?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { componentId } = request.params;
      const token =
        request.query?.token ||
        (request.body as any)?.token ||
        (request.headers['x-heartbeat-token'] as string | undefined);

      const db = getDatabase();
      const comp = db
        .prepare('SELECT id, heartbeat_token FROM components WHERE id = ?')
        .get(componentId) as any;

      if (!comp) {
        return reply.code(404).send({ error: 'Component not found' });
      }

      // If a heartbeat token is configured on the component, verify it
      if (comp.heartbeat_token && comp.heartbeat_token !== token) {
        return reply.code(403).send({ error: 'Invalid heartbeat token' });
      }

      recordHeartbeat(componentId);

      return reply.send({
        success: true,
        componentId,
        timestamp: Date.now(),
        status: 'OPERATIONAL',
      });
    }
  );
}
