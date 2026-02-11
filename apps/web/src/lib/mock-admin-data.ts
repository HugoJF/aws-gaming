import type { GameType, ServerStatus } from '@aws-gaming/contracts';

/* ------------------------------------------------------------------ */
/*  Admin-specific view types                                         */
/* ------------------------------------------------------------------ */

export type TokenStatus = 'active' | 'revoked' | 'expired';

export interface AdminTokenView {
  id: string;
  label: string;
  tokenPrefix: string; // first 8 chars shown in UI
  status: TokenStatus;
  instanceIds: string[];
  createdAt: string;
  expiresAt: string | null; // null = never expires
  revokedAt?: string;
}

export interface AdminInstanceView {
  id: string;
  displayName: string;
  game: GameType;
  gameLabel: string;
  location: string;
  status: ServerStatus;
  address: string;
  maxPlayers: number;
}

/* ------------------------------------------------------------------ */
/*  Mock instances                                                    */
/* ------------------------------------------------------------------ */

export const MOCK_INSTANCES: AdminInstanceView[] = [
  {
    id: 'inst_mc01',
    displayName: 'Survival SMP',
    game: 'minecraft',
    gameLabel: 'Minecraft',
    location: 'us-east-1',
    status: 'online',
    address: 'mc.example.gg',
    maxPlayers: 20,
  },
  {
    id: 'inst_vh01',
    displayName: 'Viking Realm',
    game: 'valheim',
    gameLabel: 'Valheim',
    location: 'eu-west-1',
    status: 'offline',
    address: 'vh.example.gg',
    maxPlayers: 10,
  },
  {
    id: 'inst_cs01',
    displayName: 'Competitive 5v5',
    game: 'cs2',
    gameLabel: 'Counter-Strike 2',
    location: 'us-west-2',
    status: 'online',
    address: 'cs.example.gg',
    maxPlayers: 10,
  },
  {
    id: 'inst_rs01',
    displayName: 'Rust Wipe Thursday',
    game: 'rust',
    gameLabel: 'Rust',
    location: 'us-east-1',
    status: 'booting',
    address: 'rust.example.gg',
    maxPlayers: 100,
  },
  {
    id: 'inst_ak01',
    displayName: 'ARK PvE Cluster',
    game: 'ark',
    gameLabel: 'ARK: Survival',
    location: 'ap-southeast-1',
    status: 'offline',
    address: 'ark.example.gg',
    maxPlayers: 40,
  },
];

/* ------------------------------------------------------------------ */
/*  Mock tokens                                                       */
/* ------------------------------------------------------------------ */

export const MOCK_TOKENS: AdminTokenView[] = [
  {
    id: 'tok_001',
    label: 'Hugo personal',
    tokenPrefix: 'sk_hu8x',
    status: 'active',
    instanceIds: ['inst_mc01', 'inst_vh01'],
    createdAt: '2025-12-01T10:00:00Z',
    expiresAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'tok_002',
    label: 'Stream overlay bot',
    tokenPrefix: 'sk_st3r',
    status: 'active',
    instanceIds: ['inst_cs01'],
    createdAt: '2026-01-15T08:30:00Z',
    expiresAt: '2026-04-15T08:30:00Z',
  },
  {
    id: 'tok_003',
    label: 'Old shared link',
    tokenPrefix: 'sk_ol2d',
    status: 'revoked',
    instanceIds: ['inst_mc01', 'inst_cs01', 'inst_rs01'],
    createdAt: '2025-09-10T12:00:00Z',
    expiresAt: '2026-03-10T12:00:00Z',
    revokedAt: '2025-11-20T14:00:00Z',
  },
  {
    id: 'tok_004',
    label: 'Beta tester access',
    tokenPrefix: 'sk_bt9a',
    status: 'expired',
    instanceIds: ['inst_vh01', 'inst_ak01'],
    createdAt: '2025-06-01T00:00:00Z',
    expiresAt: '2025-12-01T00:00:00Z',
  },
  {
    id: 'tok_005',
    label: 'Permanent infra bot',
    tokenPrefix: 'sk_pr7m',
    status: 'active',
    instanceIds: ['inst_mc01', 'inst_cs01', 'inst_rs01', 'inst_vh01', 'inst_ak01'],
    createdAt: '2025-10-01T00:00:00Z',
    expiresAt: null,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export function instanceName(id: string): string {
  return MOCK_INSTANCES.find((i) => i.id === id)?.displayName ?? id;
}

export function instanceGame(id: string): GameType | undefined {
  return MOCK_INSTANCES.find((i) => i.id === id)?.game;
}

export function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
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
