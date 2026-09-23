const BASE = 'http://localhost:8000';

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
  status: 'pending' | 'approved' | 'rejected';
  carriers: Array<{ name: string; score: number; equipment: string; phone: string; email?: string }>;
  review_summary: ReviewSummary;
  [key: string]: unknown;
}

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
  const response = await fetch(`${BASE}/api/pipelines`);
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to reject pipeline');
  }
  return response.json();
}

export type SSEEventType = 'connected' | 'new_load' | 'approved' | 'rejected' | 'status';

export interface SSEEvent {
  type: SSEEventType;
  pipeline_id?: string;
  summary?: ReviewSummary;
  [key: string]: unknown;
}

export type SSECallbacks = {
  onNewLoad?: (event: SSEEvent) => void;
  onApproved?: (event: SSEEvent) => void;
  onRejected?: (event: SSEEvent) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error') => void;
};

export function createSSEConnection(callbacks: SSECallbacks): () => void {
  const es = new EventSource(`${BASE}/api/stream`);

  es.onopen = () => {
    callbacks.onStatusChange?.('connected');
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
    es.close();
  };

  return () => {
    callbacks.onStatusChange?.('disconnected');
    es.close();
  };
}