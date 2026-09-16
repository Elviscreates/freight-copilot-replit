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
        setPipelines(data.pipelines);
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
        loadPipelines();
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