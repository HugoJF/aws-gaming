import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  GameTemplate,
  GameInstance,
  TransitionIntent,
  CachedServerStatus,
  SecretAccessToken,
} from '@aws-gaming/contracts';

const FRESHNESS_MS = 5_000;
const STATUS_TTL_S = 3600; // 1 hour
const POWER_ACTION_TTL_S = 86400; // 24 hours

export class Repository {
  private doc: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string, region?: string) {
    const client = new DynamoDBClient({ region });
    this.doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = tableName;
  }

  /* ---------------------------------------------------------------- */
  /*  GameTemplate                                                     */
  /* ---------------------------------------------------------------- */

  async getTemplate(id: string): Promise<GameTemplate | null> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `TEMPLATE#${id}`, sk: 'TEMPLATE' },
      }),
    );
    return (res.Item as GameTemplate | undefined) ?? null;
  }

  async listTemplates(): Promise<GameTemplate[]> {
    const res = await this.doc.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :et',
        ExpressionAttributeValues: { ':et': 'GameTemplate' },
      }),
    );
    return (res.Items as GameTemplate[]) ?? [];
  }

  async putTemplate(template: GameTemplate): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `TEMPLATE#${template.id}`,
          sk: 'TEMPLATE',
          entityType: 'GameTemplate',
          ...template,
        },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /*  GameInstance                                                      */
  /* ---------------------------------------------------------------- */

  async getInstance(id: string): Promise<GameInstance | null> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `INSTANCE#${id}`, sk: 'INSTANCE' },
      }),
    );
    return (res.Item as GameInstance | undefined) ?? null;
  }

  async listInstances(): Promise<GameInstance[]> {
    const res = await this.doc.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :et',
        ExpressionAttributeValues: { ':et': 'GameInstance' },
      }),
    );
    return (res.Items as GameInstance[]) ?? [];
  }

  async putInstance(instance: GameInstance): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `INSTANCE#${instance.id}`,
          sk: 'INSTANCE',
          entityType: 'GameInstance',
          ...instance,
        },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /*  TransitionIntent                                                  */
  /* ---------------------------------------------------------------- */

  async getTransition(instanceId: string): Promise<TransitionIntent | null> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `INSTANCE#${instanceId}`, sk: 'TRANSITION' },
      }),
    );
    return (res.Item as (TransitionIntent & { pk: string }) | undefined)
      ? (res.Item as unknown as TransitionIntent)
      : null;
  }

  async putTransition(
    instanceId: string,
    intent: TransitionIntent,
  ): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + POWER_ACTION_TTL_S;
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `INSTANCE#${instanceId}`,
          sk: 'TRANSITION',
          entityType: 'TransitionIntent',
          ttl,
          ...intent,
        },
      }),
    );
  }

  async deleteTransition(instanceId: string): Promise<void> {
    await this.doc.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: `INSTANCE#${instanceId}`, sk: 'TRANSITION' },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /*  CachedStatus                                                     */
  /* ---------------------------------------------------------------- */

  async getCachedStatus(
    instanceId: string,
  ): Promise<CachedServerStatus | null> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `INSTANCE#${instanceId}`, sk: 'STATUS_CACHE' },
      }),
    );
    const item = res.Item as (CachedServerStatus & { pk: string }) | undefined;
    if (!item) return null;

    // Check freshness
    const age = Date.now() - new Date(item.fetchedAt).getTime();
    if (age > FRESHNESS_MS) return null;

    return item as unknown as CachedServerStatus;
  }

  async putCachedStatus(status: CachedServerStatus): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `INSTANCE#${status.instanceId}`,
          sk: 'STATUS_CACHE',
          entityType: 'CachedStatus',
          ...status,
          ttl: Math.floor(Date.now() / 1000) + STATUS_TTL_S,
        },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /*  SecretAccessToken                                                */
  /* ---------------------------------------------------------------- */

  async getTokenByHash(tokenHash: string): Promise<SecretAccessToken | null> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `TOKEN#${tokenHash}`, sk: 'TOKEN' },
      }),
    );
    return (res.Item as SecretAccessToken | undefined) ?? null;
  }

  async putToken(token: SecretAccessToken): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `TOKEN#${token.tokenHash}`,
          sk: 'TOKEN',
          entityType: 'SecretAccessToken',
          ...token,
        },
      }),
    );
  }

  async deleteToken(tokenHash: string): Promise<void> {
    await this.doc.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: `TOKEN#${tokenHash}`, sk: 'TOKEN' },
      }),
    );
  }

  async listTokens(): Promise<SecretAccessToken[]> {
    const res = await this.doc.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :et',
        ExpressionAttributeValues: { ':et': 'SecretAccessToken' },
      }),
    );
    return (res.Items as SecretAccessToken[]) ?? [];
  }

  async getTokenById(id: string): Promise<SecretAccessToken | null> {
    let startKey: Record<string, unknown> | undefined;

    do {
      const res = await this.doc.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'entityType = :et AND id = :id',
          ExpressionAttributeValues: {
            ':et': 'SecretAccessToken',
            ':id': id,
          },
          ExclusiveStartKey: startKey,
          ConsistentRead: true,
        }),
      );

      const match = res.Items?.[0] as SecretAccessToken | undefined;
      if (match) return match;

      startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (startKey);

    return null;
  }

  async updateTokenByHash(
    tokenHash: string,
    patch: Partial<
      Pick<
        SecretAccessToken,
        'label' | 'gameInstanceIds' | 'expiresAt' | 'isAdmin' | 'revokedAt'
      >
    >,
  ): Promise<SecretAccessToken | null> {
    const existing = await this.getTokenByHash(tokenHash);
    if (!existing) return null;

    const updated: SecretAccessToken = {
      ...existing,
      ...patch,
    };

    await this.putToken(updated);
    return updated;
  }

  async revokeTokenByHash(
    tokenHash: string,
    revokedAt: string,
  ): Promise<SecretAccessToken | null> {
    return this.updateTokenByHash(tokenHash, { revokedAt });
  }
}
