import { useCallback, useEffect, useState } from 'react';
import {
  BroadcastLogItem,
  ComponentStatus,
  IncidentSeverity,
  IncidentStatus,
  MaintenanceStatus,
  StatusPageResponse,
} from '../types.js';

export function useStatusData(pageId = 'demo', initData = '', adminSecret = '') {
  const [data, setData] = useState<StatusPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLogItem[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (initData) {
      headers['Authorization'] = `tma ${initData}`;
    }
    if (adminSecret) {
      headers['X-Admin-Secret'] = adminSecret;
    }
    return headers;
  }, [initData, adminSecret]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/status/${pageId}`);
      if (!res.ok) {
        throw new Error(`Failed to load status page: HTTP ${res.status}`);
      }
      const json: StatusPageResponse = await res.json();
      setData(json);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Error loading status information');
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  const fetchBroadcastLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/broadcast-logs', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setBroadcastLogs(json.logs || []);
      }
    } catch (err) {
      // Ignore broadcast log fetch errors
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateComponent = async (
    componentId: string,
    status: ComponentStatus,
    metadata?: { name?: string; groupName?: string; pingUrl?: string }
  ) => {
    const res = await fetch(`/api/components/${componentId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, ...metadata }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to update component');
    }

    await fetchData();
    return res.json();
  };

  const createComponent = async (params: {
    name: string;
    groupName: string;
    pingUrl?: string;
    heartbeatToken?: string;
  }) => {
    const res = await fetch('/api/components', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pageId, ...params }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to create component');
    }

    await fetchData();
    return res.json();
  };

  const deleteComponent = async (componentId: string) => {
    const res = await fetch(`/api/components/${componentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to delete component');
    }

    await fetchData();
    return res.json();
  };

  const createNewIncident = async (params: {
    title: string;
    severity: IncidentSeverity;
    initialMessage: string;
    affectedComponentIds: string[];
  }) => {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        pageId,
        ...params,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to publish incident');
    }

    await fetchData();
    await fetchBroadcastLogs();
    return res.json();
  };

  const updateIncident = async (
    incidentId: string,
    params: {
      status: IncidentStatus;
      message?: string;
      resolved?: boolean;
    }
  ) => {
    const res = await fetch(`/api/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to update incident');
    }

    await fetchData();
    await fetchBroadcastLogs();
    return res.json();
  };

  const scheduleMaintenance = async (params: {
    title: string;
    description: string;
    scheduledStart: number;
    scheduledEnd: number;
    affectedComponentIds?: string[];
  }) => {
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pageId, ...params }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to schedule maintenance');
    }

    await fetchData();
    await fetchBroadcastLogs();
    return res.json();
  };

  const updateMaintenance = async (id: string, status: MaintenanceStatus) => {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to update maintenance');
    }

    await fetchData();
    return res.json();
  };

  const fetchPostMortem = async (incidentId: string) => {
    const res = await fetch(`/api/incidents/${incidentId}/post-mortem`);
    if (!res.ok) {
      throw new Error('Failed to load incident post-mortem');
    }
    return res.json();
  };

  const subscribeAlerts = async (telegramUserId: number, username?: string) => {
    const res = await fetch('/api/subscriptions/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, telegramUserId, username }),
    });
    if (!res.ok) throw new Error('Subscription failed');
    await fetchData();
    return res.json();
  };

  const unsubscribeAlerts = async (telegramUserId: number) => {
    const res = await fetch('/api/subscriptions/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, telegramUserId }),
    });
    if (!res.ok) throw new Error('Unsubscription failed');
    await fetchData();
    return res.json();
  };

  const checkSubscription = async (userId: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/subscriptions/status?pageId=${pageId}&userId=${userId}`);
      if (res.ok) {
        const json = await res.json();
        return Boolean(json.subscribed);
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    data,
    loading,
    error,
    lastRefreshed,
    broadcastLogs,
    refetch: fetchData,
    fetchBroadcastLogs,
    updateComponent,
    createComponent,
    deleteComponent,
    createNewIncident,
    updateIncident,
    scheduleMaintenance,
    updateMaintenance,
    fetchPostMortem,
    subscribeAlerts,
    unsubscribeAlerts,
    checkSubscription,
  };
}
