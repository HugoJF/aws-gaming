export type GamePowerState = 'on' | 'off';

export interface GameTemplate {
  id: string;
  displayName: string;
  containerImage: string;
  containerPorts: number[];
}

export interface GameInstance {
  id: string;
  templateId: string;
  displayName: string;
  dnsName?: string;
  state: GamePowerState;
}

export interface SecretAccessToken {
  id: string;
  tokenHash: string;
  gameInstanceIds: string[];
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}
