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

export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface StatusPage {
  id: string;
  ownerTelegramId: number;
  title: string;
  channelId?: string;
  createdAt: number;
}

export interface DailyUptime {
  id: string;
  componentId: string;
  date: string;
  uptimePct: number;
  outageMinutes: number;
  incidentCount: number;
}

export interface LatencySample {
  id: string;
  componentId: string;
  timestamp: number;
  latencyMs: number;
  statusCode: number;
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
  uptimeHistory: DailyUptime[];
  latencyHistory?: LatencySample[];
  averageLatencyMs?: number;
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

export interface MaintenanceWindow {
  id: string;
  pageId: string;
  title: string;
  description: string;
  scheduledStart: number;
  scheduledEnd: number;
  status: MaintenanceStatus;
  createdAt: number;
  affectedComponentIds: string[];
}

export interface Subscriber {
  id: string;
  pageId: string;
  telegramUserId: number;
  username?: string;
  createdAt: number;
}

export interface StatusPageResponse {
  page: StatusPage;
  overallStatus: ComponentStatus;
  components: Component[];
  incidents: Incident[];
  maintenances?: MaintenanceWindow[];
  subscribersCount?: number;
}

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
