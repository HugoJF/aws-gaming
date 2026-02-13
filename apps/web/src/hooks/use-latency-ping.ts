import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/** Ping intervals by server status (ms) */
const PING_INTERVALS: Record<string, number> = {
  online: 10_000,
  booting: 5_000,
  error: 30_000,
};
const PING_TIMEOUT_MS = 4_000;

interface UseLatencyPingOptions {
  token: string | null;
  serverId: string;
  status: string;
}

export function useLatencyPing({ token, serverId, status }: UseLatencyPingOptions) {
  const [latency, setLatency] = useState<number | null>(null);
  const [pinging, setPinging] = useState(false);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !serverId) {
      setLatency(null);
      return;
    }

    // Don't ping offline or shutting-down servers
    if (status === 'offline' || status === 'shutting-down') {
      setLatency(null);
      return;
    }

    const interval = PING_INTERVALS[status];
    if (!interval) {
      setLatency(null);
      return;
    }

    const doPing = async () => {
      if (!mountedRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      setPinging(true);
      const timeout = window.setTimeout(() => {
        // best-effort; api call has its own server-side timeout too
      }, PING_TIMEOUT_MS);

      try {
        const res = await api.pingServer(token, serverId);
        if (mountedRef.current) {
          setLatency(res.latencyMs);
        }
      } catch {
        if (mountedRef.current) {
          setLatency(null);
        }
      } finally {
        window.clearTimeout(timeout);
        if (mountedRef.current) setPinging(false);
        inFlightRef.current = false;
      }
    };

    // First ping immediately
    doPing();

    const timer = setInterval(doPing, interval);
    return () => {
      clearInterval(timer);
      inFlightRef.current = false;
      if (mountedRef.current) setPinging(false);
    };
  }, [token, serverId, status]);

  return { latency, pinging };
}
