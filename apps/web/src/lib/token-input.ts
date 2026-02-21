const TOKEN_PATH_PATTERN = /\/t\/(.+)$/;

export function parseTokenInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const match = trimmed.match(TOKEN_PATH_PATTERN);
  return match ? match[1] : trimmed;
}
