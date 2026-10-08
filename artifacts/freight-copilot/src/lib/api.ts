const BASE = '';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export interface Pipeline {
  id: string;
  origin: string;
  destination: string;
  originState: string;
  destinationState: string;
  equipment: string;
  rate: number;
  benchmark: number;
  margin: number;
  confidence: number;
  weight: string;
  miles: number;
  commodity: string;
  shipper: string;
  pickup: string;
  delivery: string;
  received: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_negotiation' | 'dispatched';
  carriers: Array<{ name: string; score: number; equipment: string; phone: string; email?: string }>;
  review_summary: ReviewSummary;
  counter_rate?: number;
  draft?: { subject: string; body: string };
  [key: string]: unknown;
}

export type Load = Pipeline;

export interface ReviewSummary {
  shipper_email?: string;
  carrier_contacts?: Array<{ email?: string; name?: string }>;
  [key: string]: unknown;
}

export interface ApprovePayload {
  email_subject: string;
  email_body: string;
  carrier_body: string;
}

export interface FetchPipelinesResponse {
  pipelines: Pipeline[];
  count: number;
}

export async function fetchPipelines(): Promise<FetchPipelinesResponse> {
  const response = await fetch(`${BASE}/api/pipelines`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch pipelines: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchHealth(): Promise<{ status: string }> {
  const response = await fetch(`${BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

export async function approvePipeline(
  pipelineId: string,
  drafts: ApprovePayload
): Promise<{ status: string; pipeline_id: string }> {
  const response = await fetch(`${BASE}/api/pipelines/${pipelineId}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(drafts),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to approve pipeline');
  }
  return response.json();
}

export async function rejectPipeline(pipelineId: string): Promise<{ status: string; pipeline_id: string }> {
  const response = await fetch(`${BASE}/api/pipelines/${pipelineId}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to reject pipeline');
  }
  return response.json();
}

export async function renegotiatePipeline(
  pipelineId: string,
  payload?: { counter_rate?: number; notes?: string }
): Promise<Load> {
  const response = await fetch(`${BASE}/api/pipelines/${pipelineId}/renegotiate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to renegotiate pipeline');
  }
  return response.json();
}

export type SSEEventType = 'connected' | 'new_load' | 'approved' | 'rejected' | 'renegotiated' | 'status';

export interface SSEEvent {
  type: SSEEventType;
  pipeline_id?: string;
  summary?: ReviewSummary;
  counter_rate?: number;
  draft?: { subject: string; body: string };
  [key: string]: unknown;
}

export type SSECallbacks = {
  onNewLoad?: (event: SSEEvent) => void;
  onApproved?: (event: SSEEvent) => void;
  onRejected?: (event: SSEEvent) => void;
  onRenegotiated?: (event: SSEEvent) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'connecting') => void;
  onReconnectFetch?: () => void;
};

export function createSSEConnection(callbacks: SSECallbacks): () => void {
  let reconnectAttempt = 0;
  let es: EventSource | null = null;
  let isIntentionalClose = false;

  const connect = () => {
    if (isIntentionalClose) return;
    
    const token = localStorage.getItem('auth_token');
    const url = token ? `/api/stream?token=${encodeURIComponent(token)}` : '/api/stream';
    
    callbacks.onStatusChange?.('connecting');
    es = new EventSource(url);

    es.onopen = () => {
      reconnectAttempt = 0;
      callbacks.onStatusChange?.('connected');
      // Trigger pipeline refetch on successful reconnect
      callbacks.onReconnectFetch?.();
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        switch (data.type) {
          case 'new_load':
            callbacks.onNewLoad?.(data);
            break;
          case 'approved':
            callbacks.onApproved?.(data);
            break;
          case 'rejected':
            callbacks.onRejected?.(data);
            break;
          case 'renegotiated':
            callbacks.onRenegotiated?.(data);
            break;
          case 'connected':
            callbacks.onStatusChange?.('connected');
            break;
          default:
            break;
        }
      } catch {
        // Ignore parse errors for non-JSON messages (e.g., heartbeat pings)
      }
    };

    es.onerror = () => {
      callbacks.onStatusChange?.('error');
      es?.close();
      
      if (isIntentionalClose) return;

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
      reconnectAttempt++;
      
      console.log(`[SSE] Connection lost. Reconnecting in ${delay}ms (attempt ${reconnectAttempt})...`);
      setTimeout(connect, delay);
    };
  };

  connect();

  return () => {
    isIntentionalClose = true;
    callbacks.onStatusChange?.('disconnected');
    es?.close();
  };
}