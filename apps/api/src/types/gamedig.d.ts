declare module 'gamedig' {
  interface QueryOptions {
    type: string;
    host: string;
    port?: number;
    socketTimeout?: number;
    attemptTimeout?: number;
    givenPortOnly?: boolean;
  }

  interface Player {
    name?: string;
    raw?: Record<string, unknown>;
  }

  interface QueryResult {
    name: string;
    map: string;
    password: boolean;
    maxplayers: number;
    players: Player[];
    bots: Player[];
    connect: string;
    ping: number;
  }

  const GameDig: {
    query(options: QueryOptions): Promise<QueryResult>;
  };

  export default GameDig;
}
