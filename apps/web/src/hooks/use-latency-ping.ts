import { useEffect, useRef, useState } from 'react';

/** Ping intervals by server status (ms) */
const PING_INTERVALS: Record<string, number> = {
  online: 10_000,
  booting: 5_000,
  error: 30_000,
};

interface UseLatencyPingOptions {
  /** e.g. "mc-survival.play.example.com:8080" */
  healthEndpoint: string | null;
  status: string;
}

export function useLatencyPing({ healthEndpoint, status }: UseLatencyPingOptions) {
  const [latency, setLatency] = useState<number | null>(null);
  const [pinging, setPinging] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!healthEndpoint) {
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

    const url = `https://${healthEndpoint}/ping`;

    const doPing = async () => {
      if (!mountedRef.current) return;
      setPinging(true);
      const start = performance.now();
      try {
        await fetch(url, { mode: 'cors', cache: 'no-store' });
        const ms = Math.round(performance.now() - start);
        if (mountedRef.current) {
          setLatency(ms);
          setPinging(false);
        }
      } catch {
        if (mountedRef.current) {
          setLatency(null);
          setPinging(false);
        }
      }
    };

    // First ping immediately
    doPing();

    const timer = setInterval(doPing, interval);
    return () => clearInterval(timer);
  }, [healthEndpoint, status]);

  return { latency, pinging };
}
