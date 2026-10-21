import { getToken, clearToken } from "./auth";

const BASE = '';

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export interface CarrierBidRequest {
  carrier_name: string;
  bid_rate: number;
  equipment_type: "Dry Van" | "Reefer" | "Flatbed";
  lane_origin: string;
  lane_destination: string;
  miles: number;
  weight?: number;
  commodity?: string;
  carrier_score?: number;
  fuel_surcharge?: number;
}

export interface NegotiationResponse {
  decision: "ACCEPT" | "COUNTER" | "REJECT";
  recommended_rate: number;
  market_median: number;
  carrier_bid: number;
  variance_pct: number;
  confidence: number;
  rationale: string;
  savings_vs_bid: number;
  equipment_type: string;
  lane: string;
  factors: Record<string, unknown>;
}

export interface FetchPipelinesResponse {
  pipelines: Pipeline[];
  count: number;
}

export async function fetchPipelines(): Promise<FetchPipelinesResponse> {
  const response = await fetch(`${BASE}/api/pipelines`, {
    headers: authHeaders(),
  });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    return { pipelines: [], count: 0 };
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch pipelines: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchHealth(): Promise<{ status: string }> {
  const response = await fetch(`${BASE}/health`);
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    return { status: "error" };
  }
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
    headers: authHeaders(),
    body: JSON.stringify(drafts),
  });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    return { status: "error", pipeline_id: pipelineId };
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to approve pipeline');
  }
  return response.json();
}

export async function rejectPipeline(pipelineId: string): Promise<{ status: string; pipeline_id: string }> {
  const response = await fetch(`${BASE}/api/pipelines/${pipelineId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    return { status: "error", pipeline_id: pipelineId };
  }
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
    headers: authHeaders(),
    body: JSON.stringify(payload || {}),
  });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    return {} as Load;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to renegotiate pipeline');
  }
  return response.json();
}

export async function negotiateRate(
  request: CarrierBidRequest
): Promise<NegotiationResponse> {
  const response = await fetch(`${BASE}/api/copilot/negotiate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    return { decision: "REJECT", recommended_rate: 0, market_median: 0, carrier_bid: 0, variance_pct: 0, confidence: 0, rationale: "", savings_vs_bid: 0, equipment_type: "", lane: "", factors: {} };
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to negotiate rate');
  }
  return response.json();
}

export async function seedDemoLoads(): Promise<{ status: string; count: number; pipeline_ids: string[] }> {
  const response = await fetch(`${BASE}/api/loads/seed`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    return { status: "error", count: 0, pipeline_ids: [] };
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to seed demo loads');
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
  pipeline?: Pipeline;
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
    
    const token = getToken();
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