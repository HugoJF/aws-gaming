import {
  Route53Client,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
} from '@aws-sdk/client-route-53';
import type { DnsRecordState } from './types.js';

export class DnsControl {
  private client: Route53Client;

  constructor(region?: string) {
    this.client = new Route53Client({ region });
  }

  /** Upsert an A record pointing to the given IP */
  async upsertARecord(
    zoneId: string,
    dnsName: string,
    ip: string,
    ttl = 30,
  ): Promise<void> {
    await this.client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: zoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: dnsName,
                Type: 'A',
                TTL: ttl,
                ResourceRecords: [{ Value: ip }],
              },
            },
          ],
        },
      }),
    );
  }

  /** Delete the A record for a DNS name */
  async deleteARecord(
    zoneId: string,
    dnsName: string,
  ): Promise<void> {
    const current = await this.getARecord(zoneId, dnsName);
    if (!current.exists || !current.currentIp) return;

    await this.client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: zoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: 'DELETE',
              ResourceRecordSet: {
                Name: dnsName,
                Type: 'A',
                TTL: 30,
                ResourceRecords: [{ Value: current.currentIp }],
              },
            },
          ],
        },
      }),
    );
  }

  /** Check current A record state */
  async getARecord(zoneId: string, dnsName: string): Promise<DnsRecordState> {
    const fqdn = dnsName.endsWith('.') ? dnsName : `${dnsName}.`;

    const res = await this.client.send(
      new ListResourceRecordSetsCommand({
        HostedZoneId: zoneId,
        StartRecordName: fqdn,
        StartRecordType: 'A',
        MaxItems: 1,
      }),
    );

    const record = res.ResourceRecordSets?.find(
      (r) => r.Name === fqdn && r.Type === 'A',
    );

    if (!record || !record.ResourceRecords?.length) {
      return { exists: false, currentIp: null };
    }

    return {
      exists: true,
      currentIp: record.ResourceRecords[0].Value ?? null,
    };
  }

  /** Verify the A record points to the expected IP */
  async verifyRecord(
    zoneId: string,
    dnsName: string,
    expectedIp: string,
  ): Promise<boolean> {
    const state = await this.getARecord(zoneId, dnsName);
    return state.exists && state.currentIp === expectedIp;
  }

  /** Verify that no A record exists for this DNS name */
  async verifyRecordDeleted(zoneId: string, dnsName: string): Promise<boolean> {
    const state = await this.getARecord(zoneId, dnsName);
    return !state.exists;
  }
}
