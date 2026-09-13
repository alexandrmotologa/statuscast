export type ComponentStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'PARTIAL_OUTAGE'
  | 'MAJOR_OUTAGE'
  | 'MAINTENANCE';

export type IncidentStatus =
  | 'INVESTIGATING'
  | 'IDENTIFIED'
  | 'MONITORING'
  | 'RESOLVED';

export type IncidentSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface StatusPage {
  id: string;
  ownerTelegramId: number;
  title: string;
  channelId?: string;
  createdAt: number;
}

export interface Component {
  id: string;
  pageId: string;
  name: string;
  groupName: string;
  status: ComponentStatus;
  orderIndex: number;
  uptimePercentage: number;
  pingUrl?: string;
  lastPingAt?: number;
  heartbeatToken?: string;
}

export interface DailyUptime {
  id: string;
  componentId: string;
  date: string; // YYYY-MM-DD
  uptimePct: number;
  outageMinutes: number;
  incidentCount: number;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  status: IncidentStatus;
  message: string;
  createdAt: number;
}

export interface Incident {
  id: string;
  pageId: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  channelMessageId?: number;
  createdAt: number;
  resolvedAt?: number | null;
  updates: IncidentUpdate[];
  affectedComponentIds: string[];
}

export interface StatusPageResponse {
  page: StatusPage;
  overallStatus: ComponentStatus;
  components: (Component & { uptimeHistory: DailyUptime[] })[];
  incidents: Incident[];
}
