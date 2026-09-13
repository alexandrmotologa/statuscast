import { useCallback, useEffect, useState } from 'react';
import {
  BroadcastLogItem,
  ComponentStatus,
  IncidentSeverity,
  IncidentStatus,
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

  return {
    data,
    loading,
    error,
    lastRefreshed,
    broadcastLogs,
    refetch: fetchData,
    fetchBroadcastLogs,
    updateComponent,
    createNewIncident,
    updateIncident,
  };
}
