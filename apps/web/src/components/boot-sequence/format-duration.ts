export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const ss = String(seconds).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');

  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}
