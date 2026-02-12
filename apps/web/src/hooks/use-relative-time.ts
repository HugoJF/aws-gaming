import { useEffect, useState } from 'react';

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function useRelativeTime(date: Date | string | null): string | null {
  const [, tick] = useState(0);

  // TODO this can be rewritten using useInterval
  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatRelative(d);
}
