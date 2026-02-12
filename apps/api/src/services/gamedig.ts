import { GameDig } from 'gamedig';
import type { GameType, LiveData } from '@aws-gaming/contracts';

const QUERY_TIMEOUT_MS = 5_000;

/** Map our GameType to gamedig's type string */
const GAMEDIG_TYPE: Record<Exclude<GameType, 'generic'>, string> = {
  minecraft: 'minecraft',
  zomboid: 'przomboid',
};

export interface GameDigQueryInput {
  gameType: GameType;
  host: string;
  port: number;
}

export async function queryGameServer(
  input: GameDigQueryInput,
): Promise<LiveData | null> {
  if (input.gameType === 'generic') {
    return null;
  }

  try {
    const result = await GameDig.query({
      type: GAMEDIG_TYPE[input.gameType],
      host: input.host,
      port: input.port,
      socketTimeout: QUERY_TIMEOUT_MS,
      attemptTimeout: QUERY_TIMEOUT_MS,
      givenPortOnly: true,
    });

    return {
      players: result.players.length,
      maxPlayers: result.maxplayers,
      serverName: result.name,
      map: result.map || null,
    };
  } catch {
    return null;
  }
}
