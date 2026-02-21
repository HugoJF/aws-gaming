import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ServerView } from '@aws-gaming/contracts';
import { api } from '@/lib/api';
import { serversQueryKey } from './use-servers-query';

export function usePowerMutation(token: string | null) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (vars: { token: string; serverId: string; action: 'on' | 'off' }) =>
      api.transition(vars.token, vars.serverId, vars.action),
    onSuccess: (res, { serverId }) => {
      const replaceServerOptimistically = (prev: ServerView[] | undefined) =>
        prev?.map((s) => (s.id === serverId ? res.data.server : s)) ?? prev;

      qc.setQueryData<ServerView[]>(serversQueryKey(token), replaceServerOptimistically);
      void qc.invalidateQueries({ queryKey: serversQueryKey(token) });
    },
  });

  const togglePower = useCallback(
    (serverId: string, action: 'on' | 'off') => {
      if (!token) return;
      mutation.mutate({ token, serverId, action });
    },
    [token, mutation],
  );

  return {
    togglePower,
    pendingServerId: mutation.isPending ? (mutation.variables?.serverId ?? null) : null,
    error: mutation.error,
  };
}
