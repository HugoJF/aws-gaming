import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DashboardHeader } from '@/components/dashboard-header';
import { EmptyState } from '@/components/empty-state';
import { UnauthedScreen } from '@/components/unauthed-screen';
import {
  ServerCard,
  type ServerData,
  type ServerStatus,
} from '@/components/server-card';

const now = new Date();

const INITIAL_SERVERS: ServerData[] = [
  {
    id: 'srv-1',
    name: 'Survival SMP',
    game: 'minecraft',
    gameLabel: 'Minecraft 1.21.4',
    ip: 'play.myservers.gg:25565',
    location: 'Frankfurt, DE',
    players: { current: 12, max: 32 },
    status: 'online',
    latency: 24,
    lastUpdatedAt: new Date(now.getTime() - 8_000).toISOString(),
    healthChecks: [
      { name: 'Game Process', status: 'healthy', latency: '2ms' },
      { name: 'Query Port', status: 'healthy', latency: '14ms' },
      { name: 'RCON', status: 'healthy', latency: '8ms' },
      { name: 'Disk Usage', status: 'healthy' },
    ],
  },
  {
    id: 'srv-2',
    name: 'Vikings Unite',
    game: 'valheim',
    gameLabel: 'Valheim Dedicated',
    ip: '185.92.220.28:2456',
    location: 'Frankfurt, DE',
    players: { current: 4, max: 10 },
    status: 'online',
    latency: 87,
    lastUpdatedAt: new Date(now.getTime() - 23_000).toISOString(),
    healthChecks: [
      { name: 'Game Process', status: 'healthy', latency: '3ms' },
      { name: 'Query Port', status: 'degraded', latency: '120ms' },
      { name: 'World Save', status: 'healthy' },
    ],
  },
  {
    id: 'srv-3',
    name: 'Competitive 5v5',
    game: 'csgo',
    gameLabel: 'CS2 128-tick',
    ip: '104.21.55.3:27015',
    location: 'Ashburn, US',
    players: { current: 0, max: 10 },
    status: 'online',
    latency: 182,
    lastUpdatedAt: new Date(now.getTime() - 4_000).toISOString(),
    healthChecks: [
      { name: 'Game Process', status: 'healthy', latency: '1ms' },
      { name: 'Query Port', status: 'healthy', latency: '9ms' },
      { name: 'RCON', status: 'unhealthy' },
      { name: 'SourceTV', status: 'healthy', latency: '11ms' },
    ],
  },
  {
    id: 'srv-4',
    name: 'Wipe Day',
    game: 'rust',
    gameLabel: 'Rust (Modded)',
    ip: '104.21.55.17:28015',
    location: 'Ashburn, US',
    players: { current: 0, max: 100 },
    status: 'offline',
    lastUpdatedAt: new Date(now.getTime() - 120_000).toISOString(),
    healthChecks: [
      { name: 'Game Process', status: 'unhealthy' },
      { name: 'Query Port', status: 'unhealthy' },
      { name: 'RCON', status: 'unhealthy' },
    ],
  },
];

export function App() {
  const { isAuthenticated, login } = useAuth();
  const [servers, setServers] = useState<ServerData[]>(INITIAL_SERVERS);

  const handleStatusChange = useCallback(
    (id: string, newStatus: ServerStatus) => {
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)),
      );
    },
    [],
  );

  if (!isAuthenticated) {
    return <UnauthedScreen onTokenSubmit={login} />;
  }

  const onlineCount = servers.filter(
    (s) => s.status === 'online' || s.status === 'booting',
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        serverCount={servers.length}
        onlineCount={onlineCount}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Your Servers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your game servers in one place
          </p>
        </div>

        {servers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
