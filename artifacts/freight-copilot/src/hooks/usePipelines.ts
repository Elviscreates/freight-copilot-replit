import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPipelines,
  approvePipeline,
  rejectPipeline,
  renegotiatePipeline,
  createSSEConnection,
  type Pipeline,
  type Load,
  type ApprovePayload,
  type SSEEvent,
} from '@/lib/api';

export type SSEStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

function normalizePipeline(item: any): Pipeline {
  const reviewPackage = item.review_package || {};
  const id = String(item.id || item.pipeline_id || item.load_id || reviewPackage.load_id || Math.random().toString(36).slice(2));

  return {
    id,
    pipeline_id: id,
    origin: reviewPackage.origin || item.origin || '',
    destination: reviewPackage.destination || item.destination || '',
    originState: reviewPackage.origin_state || item.originState || '',
    destinationState: reviewPackage.destination_state || item.destinationState || '',
    equipment: reviewPackage.equipment || item.equipment || '',
    rate: reviewPackage.rate ?? item.rate ?? 0,
    benchmark: reviewPackage.dat_benchmark ?? item.benchmark ?? 0,
    margin: reviewPackage.margin ?? item.margin ?? 0,
    confidence: reviewPackage.confidence ?? item.confidence ?? 0,
    weight: reviewPackage.weight || item.weight || '',
    miles: reviewPackage.miles ?? item.miles ?? 0,
    commodity: reviewPackage.commodity || item.commodity || '',
    shipper: reviewPackage.shipper || item.shipper || '',
    pickup: reviewPackage.pickup || item.pickup || '',
    delivery: reviewPackage.delivery || item.delivery || '',
    received: reviewPackage.received || item.received || '',
    status: (reviewPackage.status || item.status || 'pending') as 'pending' | 'approved' | 'rejected' | 'in_negotiation',
    carriers: reviewPackage.matched_carriers || item.carriers || [],
    review_summary: reviewPackage.review_summary || item.review_summary || {},
    drafts: reviewPackage.drafts || item.drafts || {},
    [Symbol.for('review_package')]: reviewPackage,
  } as Pipeline & { review_package?: any };
}

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<SSEStatus>('connecting');

  const cleanupRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  const loadPipelines = useCallback(async () => {
    try {
      const data = await fetchPipelines();
      if (isMountedRef.current) {
        const normalized = (data.pipelines || []).map(normalizePipeline);
        setPipelines(normalized);
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load pipelines');
        setLoading(false);
      }
    }
  }, []);

  const handleNewLoad = useCallback((event: SSEEvent) => {
    if (event.pipeline_id && event.summary) {
      const normalized = normalizePipeline({
        pipeline_id: event.pipeline_id,
        review_package: event.summary,
      });
      setPipelines((prev) => {
        if (prev.some((p) => p.id === normalized.id)) return prev;
        return [normalized, ...prev];
      });
    } else {
      // Fallback: if event is malformed, do a one-time refetch
      loadPipelines();
    }
  }, [loadPipelines]);

  const handleApproved = useCallback((event: SSEEvent) => {
    if (event.pipeline_id) {
      // If backend sends full pipeline, use it (normalize for type safety); otherwise fall back to filtering
      if (event.pipeline) {
        const normalized = normalizePipeline(event.pipeline);
        setPipelines((prev) =>
          prev.map((p) => (p.id === event.pipeline_id ? normalized : p))
        );
      } else {
        setPipelines((prev) => prev.filter((p) => p.id !== event.pipeline_id));
      }
    }
  }, []);

  const handleRejected = useCallback((event: SSEEvent) => {
    if (event.pipeline_id) {
      // If backend sends full pipeline (with status: rejected), update it; otherwise filter out
      if (event.pipeline) {
        const normalized = normalizePipeline(event.pipeline);
        setPipelines((prev) =>
          prev.map((p) => (p.id === event.pipeline_id ? normalized : p))
        );
      } else {
        setPipelines((prev) => prev.filter((p) => p.id !== event.pipeline_id));
      }
    }
  }, []);

  const handleRenegotiated = useCallback((event: SSEEvent) => {
    if (event.pipeline_id) {
      // If backend sends full pipeline, use it; otherwise merge partial update
      if (event.pipeline) {
        const normalized = normalizePipeline(event.pipeline);
        setPipelines((prev) =>
          prev.map((p) => (p.id === event.pipeline_id ? normalized : p))
        );
      } else {
        setPipelines((prev) =>
          prev.map((p) =>
            p.id === event.pipeline_id
              ? { ...p, status: 'in_negotiation' as const, counter_rate: event.counter_rate, draft: event.draft }
              : p
          )
        );
      }
    }
  }, []);

  const handleReconnectFetch = useCallback(() => {
    if (isMountedRef.current) {
      loadPipelines();
    }
  }, [loadPipelines]);

  useEffect(() => {
    isMountedRef.current = true;
    loadPipelines();

    // NO polling interval - SSE handles real-time updates
    // const interval = setInterval(loadPipelines, 30000); // REMOVED

    cleanupRef.current = createSSEConnection({
      onNewLoad: handleNewLoad,
      onApproved: handleApproved,
      onRejected: handleRejected,
      onRenegotiated: handleRenegotiated,
      onStatusChange: (status: SSEStatus) => {
        if (isMountedRef.current) {
          setSseStatus(status);
        }
      },
      onReconnectFetch: handleReconnectFetch,
    });

    return () => {
      isMountedRef.current = false;
      // clearInterval(interval); // REMOVED - no interval to clear
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [loadPipelines, handleNewLoad, handleApproved, handleRejected, handleRenegotiated, handleReconnectFetch]);

  const approve = useCallback(
    async (pipelineId: string, drafts: ApprovePayload) => {
      try {
        await approvePipeline(pipelineId, drafts);
        // State will be updated via SSE event (broadcasts full pipeline with status: approved)
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to approve';
        setError(message);
        throw err;
      }
    },
    []
  );

  const reject = useCallback(
    async (pipelineId: string) => {
      try {
        await rejectPipeline(pipelineId);
        // State will be updated via SSE event (broadcasts full pipeline with status: rejected)
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reject';
        setError(message);
        throw err;
      }
    },
    []
  );

  const renegotiate = useCallback(
    async (pipelineId: string, payload?: { counter_rate?: number; notes?: string }) => {
      try {
        const updatedPipeline = await renegotiatePipeline(pipelineId, payload);
        // State will be updated via SSE event (broadcasts full pipeline with status: in_negotiation)
        // Return the pipeline for any immediate UI needs (e.g., pre-filling drafts)
        return updatedPipeline;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to renegotiate';
        setError(message);
        throw err;
      }
    },
    []
  );

  return {
    pipelines,
    loading,
    error,
    sseStatus,
    approve,
    reject,
    renegotiate,
    refresh: loadPipelines,
  };
}