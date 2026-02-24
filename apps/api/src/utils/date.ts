export function parseDateFromUnknown(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed.toISOString();
}
