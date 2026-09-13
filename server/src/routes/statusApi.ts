import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  getComponents,
  getDailyUptime,
  getIncidents,
  getStatusPage,
} from '../db/database.js';
import { ComponentStatus, StatusPageResponse } from '../types.js';

export async function statusApiRoutes(fastify: FastifyInstance): Promise<void> {
  // Public status page details
  fastify.get(
    '/api/status/:pageId',
    async (request: FastifyRequest<{ Params: { pageId: string } }>, reply: FastifyReply) => {
      const { pageId } = request.params;
      const page = getStatusPage(pageId);

      if (!page) {
        return reply.code(404).send({ error: 'Status page not found', pageId });
      }

      const components = getComponents(pageId);
      const incidents = getIncidents(pageId, 14);

      // Fetch 90-day uptime history for each component
      const componentsWithHistory = components.map((c) => ({
        ...c,
        uptimeHistory: getDailyUptime(c.id, 90),
      }));

      // Calculate overall system status
      let overallStatus: ComponentStatus = 'OPERATIONAL';
      const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');

      if (
        components.some((c) => c.status === 'MAJOR_OUTAGE') ||
        activeIncidents.some((i) => i.severity === 'CRITICAL')
      ) {
        overallStatus = 'MAJOR_OUTAGE';
      } else if (
        components.some((c) => c.status === 'PARTIAL_OUTAGE') ||
        activeIncidents.some((i) => i.severity === 'MAJOR')
      ) {
        overallStatus = 'PARTIAL_OUTAGE';
      } else if (
        components.some((c) => c.status === 'DEGRADED') ||
        activeIncidents.some((i) => i.severity === 'MINOR')
      ) {
        overallStatus = 'DEGRADED';
      } else if (components.some((c) => c.status === 'MAINTENANCE')) {
        overallStatus = 'MAINTENANCE';
      }

      const response: StatusPageResponse = {
        page,
        overallStatus,
        components: componentsWithHistory,
        incidents,
      };

      return reply.send(response);
    }
  );

  // SVG Status Badge (for GitHub READMEs or external embedding)
  fastify.get(
    '/api/status/:pageId/badge',
    async (request: FastifyRequest<{ Params: { pageId: string } }>, reply: FastifyReply) => {
      const { pageId } = request.params;
      const components = getComponents(pageId);
      const incidents = getIncidents(pageId, 1);
      const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');

      let statusText = 'Operational';
      let statusColor = '#10b981'; // Emerald

      if (
        components.some((c) => c.status === 'MAJOR_OUTAGE') ||
        activeIncidents.some((i) => i.severity === 'CRITICAL')
      ) {
        statusText = 'Major Outage';
        statusColor = '#ef4444'; // Rose
      } else if (
        components.some((c) => c.status === 'DEGRADED' || c.status === 'PARTIAL_OUTAGE') ||
        activeIncidents.length > 0
      ) {
        statusText = 'Degraded';
        statusColor = '#f59e0b'; // Amber
      }

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="138" height="20" role="img" aria-label="Status: ${statusText}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="138" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="55" height="20" fill="#24292e"/>
    <rect x="55" width="83" height="20" fill="${statusColor}"/>
    <rect width="138" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="285" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="450">status</text>
    <text x="285" y="140" transform="scale(.1)" fill="#fff" textLength="450">status</text>
    <text aria-hidden="true" x="955" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="730">${statusText}</text>
    <text x="955" y="140" transform="scale(.1)" fill="#fff" textLength="730">${statusText}</text>
  </g>
</svg>
      `.trim();

      reply.header('Content-Type', 'image/svg+xml');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      return reply.send(svg);
    }
  );

  // Public JSON Feed for external aggregators
  fastify.get(
    '/api/status/:pageId/feed.json',
    async (request: FastifyRequest<{ Params: { pageId: string } }>, reply: FastifyReply) => {
      const { pageId } = request.params;
      const page = getStatusPage(pageId);
      if (!page) {
        return reply.code(404).send({ error: 'Status page not found' });
      }

      const incidents = getIncidents(pageId, 30);
      return reply.send({
        title: `${page.title} Feed`,
        homePageUrl: `http://${request.headers.host}/?page=${pageId}`,
        feedUrl: `http://${request.headers.host}/api/status/${pageId}/feed.json`,
        items: incidents.map((inc) => ({
          id: inc.id,
          title: inc.title,
          status: inc.status,
          severity: inc.severity,
          datePublished: new Date(inc.createdAt).toISOString(),
          dateModified: inc.resolvedAt ? new Date(inc.resolvedAt).toISOString() : undefined,
          updates: inc.updates,
        })),
      });
    }
  );
}
