import { useEffect, useRef, useState } from 'react';

/** Ping intervals by server status (ms) */
const PING_INTERVALS: Record<string, number> = {
  online: 10_000,
  booting: 5_000,
  error: 30_000,
};
const PING_TIMEOUT_MS = 4_000;

interface UseLatencyPingOptions {
  /** e.g. "1.2.3.4:8080" or "minecraft.aws.hugo.dev.br:8080" */
  healthEndpoint: string | null;
  status: string;
}

export function useLatencyPing({ healthEndpoint, status }: UseLatencyPingOptions) {
  const [latency, setLatency] = useState<number | null>(null);
  const [pinging, setPinging] = useState(false);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const buildPingUrl = (endpoint: string): string => {
    const trimmed = endpoint.trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(trimmed)) return `${trimmed}/ping`;

    // Health sidecar is plain HTTP in current infra.
    return `http://${trimmed}/ping`;
  };

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

    const url = buildPingUrl(healthEndpoint);

    const doPing = async () => {
      if (!mountedRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      setPinging(true);

      const start = performance.now();
      const controller = new AbortController();
      controllerRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

      try {
        await fetch(url, {
          method: 'GET',
          // Latency probe only; avoid requiring CORS headers on sidecar.
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        const ms = Math.round(performance.now() - start);
        if (mountedRef.current) setLatency(ms);
      } catch {
        if (mountedRef.current) setLatency(null);
      } finally {
        window.clearTimeout(timeout);
        if (mountedRef.current) setPinging(false);
        inFlightRef.current = false;
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    };

    doPing();
    const timer = setInterval(doPing, interval);
    return () => {
      clearInterval(timer);
      controllerRef.current?.abort();
      controllerRef.current = null;
      inFlightRef.current = false;
      if (mountedRef.current) setPinging(false);
    };
  }, [healthEndpoint, status]);

  return { latency, pinging };
}

