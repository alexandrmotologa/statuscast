import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { broadcastHistory, ChannelBroadcaster } from '../bot/broadcaster.js';
import {
  addIncidentUpdate,
  createComponent,
  createIncident,
  createMaintenanceWindow,
  deleteComponent,
  getComponents,
  getDatabase,
  getIncidents,
  getMaintenanceWindows,
  resolveIncident,
  setIncidentChannelMessageId,
  updateComponentStatus,
  updateMaintenanceStatus,
} from '../db/database.js';
import { adminAuthMiddleware } from '../security/auth.js';
import {
  ComponentStatus,
  IncidentSeverity,
  IncidentStatus,
  MaintenanceStatus,
} from '../types.js';

interface UpdateComponentRoute {
  Params: { id: string };
  Body: {
    status: ComponentStatus;
    name?: string;
    groupName?: string;
    pingUrl?: string;
  };
}

interface CreateComponentRoute {
  Body: {
    pageId: string;
    name: string;
    groupName?: string;
    pingUrl?: string;
    heartbeatToken?: string;
  };
}

interface DeleteComponentRoute {
  Params: { id: string };
}

interface CreateIncidentRoute {
  Body: {
    pageId: string;
    title: string;
    severity: IncidentSeverity;
    initialMessage: string;
    affectedComponentIds?: string[];
  };
}

interface UpdateIncidentRoute {
  Params: { id: string };
  Body: {
    status: IncidentStatus;
    message?: string;
    resolved?: boolean;
  };
}

interface CreateMaintenanceRoute {
  Body: {
    pageId: string;
    title: string;
    description: string;
    scheduledStart: number;
    scheduledEnd: number;
    affectedComponentIds?: string[];
  };
}

interface UpdateMaintenanceRoute {
  Params: { id: string };
  Body: {
    status: MaintenanceStatus;
  };
}

export function createAdminApiRoutes(broadcaster: ChannelBroadcaster) {
  return async function (fastify: FastifyInstance): Promise<void> {
    // 1. Update Component Status
    fastify.put<UpdateComponentRoute>(
      '/api/components/:id',
      { preHandler: adminAuthMiddleware },
      async (request, reply) => {
        const { id } = request.params;
        const { status, name, groupName, pingUrl } = request.body;

        if (!status) {
          return reply.code(400).send({ error: 'Missing required field: status' });
        }

        updateComponentStatus(id, status, { name, groupName, pingUrl });

        return reply.send({
          success: true,
          component: { id, status, name, groupName, pingUrl },
        });
      }
    );

    // 2. Create Component (CRUD)
    fastify.post<CreateComponentRoute>(
      '/api/components',
      { preHandler: adminAuthMiddleware },
      async (request, reply) => {
        const { pageId, name, groupName, pingUrl, heartbeatToken } = request.body;
        if (!pageId || !name) {
          return reply.code(400).send({ error: 'Missing pageId or name' });
        }

        const component = createComponent({
          pageId,
          name,
          groupName,
          pingUrl,
          heartbeatToken,
        });

        return reply.code(201).send({ success: true, component });
      }
    );

    // 3. Delete Component (CRUD)
    fastify.delete<DeleteComponentRoute>(
      '/api/components/:id',
      { preHandler: adminAuthMiddleware },
      async (request, reply) => {
        const { id } = request.params;
        const deleted = deleteComponent(id);
        if (!deleted) {
          return reply.code(404).send({ error: 'Component not found' });
        }
        return reply.send({ success: true, deletedId: id });
      }
    );

    // 4. Create Incident & Broadcast
    fastify.post<CreateIncidentRoute>(
      '/api/incidents',
      { preHandler: adminAuthMiddleware },
      async (request, reply) => {
        const { pageId, title, severity, initialMessage, affectedComponentIds } =
          request.body;

        if (!pageId || !title || !severity || !initialMessage) {
          return reply.code(400).send({
            error: 'Missing required fields: pageId, title, severity, initialMessage',
          });
        }

        const incident = createIncident({
          pageId,
          title,
          severity,
          initialMessage,
          affectedComponentIds,
        });

        // Resolve component names for Telegram broadcast
        const allComponents = getComponents(pageId);
        const affectedNames = allComponents
          .filter((c) => affectedComponentIds?.includes(c.id))
          .map((c) => c.name);

        const channelMessageId = await broadcaster.broadcastIncident(
          incident,
          affectedNames
        );

        if (channelMessageId) {
          setIncidentChannelMessageId(incident.id, channelMessageId);
          incident.channelMessageId = channelMessageId;
        }

        return reply.code(201).send({
          success: true,
          incident,
          channelMessageId,
        });
      }
    );

    // 5. Add Incident Update or Resolve
    fastify.patch<UpdateIncidentRoute>(
      '/api/incidents/:id',
      { preHandler: adminAuthMiddleware },
      async (request, reply) => {
        const { id } = request.params;
        const { status, message, resolved } = request.body;

        const db = getDatabase();
        const existingInc = db
          .prepare('SELECT id, page_id, title, channel_message_id FROM incidents WHERE id = ?')
          .get(id) as any;

        if (!existingInc) {
          return reply.code(404).send({ error: 'Incident not found' });
        }

        const allComponents = getComponents(existingInc.page_id);
        const affectedRows = db
          .prepare('SELECT component_id FROM incident_affected_components WHERE incident_id = ?')
          .all(id) as any[];
        const affectedNames = allComponents
          .filter((c) => affectedRows.some((a) => a.component_id === c.id))
          .map((c) => c.name);

        if (resolved || status === 'RESOLVED') {
          const res = resolveIncident(id, message || 'Incident resolved.');
          const incidents = getIncidents(existingInc.page_id, 14);
          const fullInc = incidents.find((i) => i.id === id);

          if (fullInc && existingInc.channel_message_id) {
            await broadcaster.resolveIncidentMessage(
              fullInc,
              affectedNames,
              Number(existingInc.channel_message_id),
              res.durationMinutes
            );
          }

          return reply.send({
            success: true,
            incident: fullInc,
            durationMinutes: res.durationMinutes,
          });
        } else {
          if (!message) {
            return reply.code(400).send({ error: 'Message is required for ongoing updates' });
          }

          addIncidentUpdate({ incidentId: id, status, message });
          const incidents = getIncidents(existingInc.page_id, 14);
          const fullInc = incidents.find((i) => i.id === id);

          if (fullInc && existingInc.channel_message_id) {
            await broadcaster.updateIncidentMessage(
              fullInc,
              affectedNames,
              Number(existingInc.channel_message_id)
            );
          }

          return reply.send({
            success: true,
            incident: fullInc,
          });
        }
      }
    );

    // 6. Schedule Maintenance Window & Broadcast
    fastify.post<CreateMaintenanceRoute>(
      '/api/maintenance',
      { preHandler: adminAuthMiddleware },
      async (request, reply) => {
        const { pageId, title, description, scheduledStart, scheduledEnd, affectedComponentIds } =
          request.body;

        if (!pageId || !title || !scheduledStart || !scheduledEnd) {
          return reply.code(400).send({
            error: 'Missing required fields for scheduled maintenance',
          });
        }

        const maint = createMaintenanceWindow({
          pageId,
          title,
          description: description || '',
          scheduledStart,
          scheduledEnd,
          affectedComponentIds,
        });

        const allComponents = getComponents(pageId);
        const affectedNames = allComponents
          .filter((c) => affectedComponentIds?.includes(c.id))
          .map((c) => c.name);

        await broadcaster.broadcastMaintenance(maint, affectedNames);

        return reply.code(201).send({ success: true, maintenance: maint });
      }
    );

    // 7. Update Maintenance Window Status
    fastify.patch<UpdateMaintenanceRoute>(
      '/api/maintenance/:id',
      { preHandler: adminAuthMiddleware },
      async (request, reply) => {
        const { id } = request.params;
        const { status } = request.body;

        if (!status) {
          return reply.code(400).send({ error: 'Missing status' });
        }

        updateMaintenanceStatus(id, status);
        return reply.send({ success: true, id, status });
      }
    );

    // 8. Retrieve Broadcast History
    fastify.get(
      '/api/admin/broadcast-logs',
      { preHandler: adminAuthMiddleware },
      async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({ logs: broadcastHistory });
      }
    );
  };
}
