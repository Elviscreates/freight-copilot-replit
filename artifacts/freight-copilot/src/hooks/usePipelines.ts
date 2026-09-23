import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPipelines,
  approvePipeline,
  rejectPipeline,
  createSSEConnection,
  type Pipeline,
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
    status: (reviewPackage.status || item.status || 'pending') as 'pending' | 'approved' | 'rejected',
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

  useEffect(() => {
    isMountedRef.current = true;
    loadPipelines();

    const interval = setInterval(loadPipelines, 30000);

    cleanupRef.current = createSSEConnection({
      onNewLoad: (event: SSEEvent) => {
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
          loadPipelines();
        }
      },
      onApproved: (event: SSEEvent) => {
        if (event.pipeline_id) {
          setPipelines((prev) => prev.filter((p) => p.id !== event.pipeline_id));
        }
      },
      onRejected: (event: SSEEvent) => {
        if (event.pipeline_id) {
          setPipelines((prev) => prev.filter((p) => p.id !== event.pipeline_id));
        }
      },
      onStatusChange: (status: SSEStatus) => {
        if (isMountedRef.current) {
          setSseStatus(status);
        }
      },
    });

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [loadPipelines]);

  const approve = useCallback(
    async (pipelineId: string, drafts: ApprovePayload) => {
      try {
        await approvePipeline(pipelineId, drafts);
        setPipelines((prev) => prev.filter((p) => p.id !== pipelineId));
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
        setPipelines((prev) => prev.filter((p) => p.id !== pipelineId));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reject';
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
    refresh: loadPipelines,
  };
}