import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PowerAction, ServerView } from '@aws-gaming/contracts';
import { api } from '@/lib/api';
import { serversQueryKey } from './use-servers-query';

export function usePowerMutation(token: string | null) {
  const qc = useQueryClient();
  const handlePowerMutationSuccess = (serverId: string, server: ServerView): void => {
    qc.setQueryData<ServerView[]>(
      serversQueryKey(token),
      (prev) => prev?.map((s) => (s.id === serverId ? server : s)) ?? prev,
    );
    void qc.invalidateQueries({ queryKey: serversQueryKey(token) });
  };

  const mutation = useMutation({
    mutationFn: (vars: { token: string; serverId: string; action: PowerAction }) =>
      api.transition(vars.token, vars.serverId, vars.action),
    onSuccess: (res, { serverId }) =>
      handlePowerMutationSuccess(serverId, res.data.server),
  });

  const togglePower = useCallback(
    (serverId: string, action: PowerAction) => {
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
