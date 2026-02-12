import { useReducer } from 'react';
import { useInterval } from 'usehooks-ts';
import { formatDistanceToNowStrict } from 'date-fns';

export function useRelativeTime(isoString?: string): string {
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useInterval(tick, isoString ? 5_000 : null);

  if (!isoString) return '';
  return formatDistanceToNowStrict(isoString, { addSuffix: true });
}
