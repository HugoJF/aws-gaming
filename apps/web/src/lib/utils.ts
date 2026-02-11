import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return iso;

  const diffMs = target - now;
  const absDiff = Math.abs(diffMs);
  const future = diffMs > 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let label: string;
  if (minutes < 1) label = 'just now';
  else if (hours < 1) label = `${minutes}m`;
  else if (days < 1) label = `${hours}h`;
  else if (months < 1) label = `${days}d`;
  else if (years < 1) label = `${months}mo`;
  else label = `${years}y`;

  if (label === 'just now') return label;
  return future ? `in ${label}` : `${label} ago`;
}
