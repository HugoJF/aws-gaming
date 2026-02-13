import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
} from '@aws-sdk/client-auto-scaling';
import {
  EC2Client,
  DescribeLaunchTemplateVersionsCommand,
} from '@aws-sdk/client-ec2';
import {
  EFSClient,
  DescribeFileSystemsCommand,
} from '@aws-sdk/client-efs';
import {
  PricingClient,
  GetProductsCommand,
} from '@aws-sdk/client-pricing';
import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand,
} from '@aws-sdk/client-resource-groups-tagging-api';
import type {
  GameInstance,
  ServerHourlyCostEstimate,
  CostComponent,
} from '@aws-gaming/contracts';

const HOURS_PER_MONTH = 730;
const PRICING_API_REGION = 'us-east-1';

// AWS Pricing "location" strings (partial). Override with AWS_PRICING_LOCATION if needed.
const REGION_TO_PRICING_LOCATION: Record<string, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'sa-east-1': 'South America (Sao Paulo)',
  'eu-west-1': 'EU (Ireland)',
  'eu-central-1': 'EU (Frankfurt)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
};

function toGiB(bytes: number): number {
  return bytes / (1024 ** 3);
}

function parseUsd(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function extractEfsIdFromArn(arn: string): string | null {
  // arn:aws:elasticfilesystem:region:acct:file-system/fs-12345678
  const marker = 'file-system/';
  const idx = arn.indexOf(marker);
  if (idx === -1) return null;
  return arn.slice(idx + marker.length) || null;
}

function minDefined(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

type LaunchTemplateInfo = {
  instanceType: string | null;
  spotMaxPriceUsdPerHour: number | null;
};

type EfsInfo = {
  fileSystemId: string;
  sizeGiB: number;
};

export class CostService {
  private autoscaling: AutoScalingClient;
  private ec2: EC2Client;
  private efs: EFSClient;
  private tagApi: ResourceGroupsTaggingAPIClient;
  private pricing: PricingClient;

  constructor(private region: string) {
    this.autoscaling = new AutoScalingClient({ region });
    this.ec2 = new EC2Client({ region });
    this.efs = new EFSClient({ region });
    this.tagApi = new ResourceGroupsTaggingAPIClient({ region });
    this.pricing = new PricingClient({ region: PRICING_API_REGION });
  }

  async estimateHourlyCosts(instance: GameInstance): Promise<ServerHourlyCostEstimate> {
    const computedAt = new Date().toISOString();
    const pricingLocation =
      process.env.AWS_PRICING_LOCATION ??
      REGION_TO_PRICING_LOCATION[this.region];

    if (!pricingLocation) {
      throw new Error(
        `Unknown pricing location for region ${this.region}. Set AWS_PRICING_LOCATION (example: "US East (N. Virginia)").`,
      );
    }

    const lt = await this.getLaunchTemplateInfo(instance.autoScalingGroupName);
    const efsInfo = await this.getEfsInfoByGameInstanceTag(instance.id);

    const assumptions: string[] = [
      'Estimates include EC2 instance on-demand (or spot max price as worst-case) + EFS One Zone storage only.',
      'Estimates exclude data transfer, CloudWatch Logs ingestion/storage, AWS Backup storage, Route53 query charges, and shared platform costs.',
      'Offline cost assumes EC2 capacity is 0, but persistent EFS storage continues accruing charges.',
    ];

    const componentsOnline: CostComponent[] = [];
    const componentsOffline: CostComponent[] = [];

    // EFS storage (always-on cost if the filesystem exists).
    let efsOneZoneUsdPerGiBMonth: number | null = null;
    let efsPerHourUsd: number | null = null;
    if (efsInfo) {
      efsOneZoneUsdPerGiBMonth = await this.getEfsOneZoneStorageUsdPerGiBMonth(
        pricingLocation,
      );
      efsPerHourUsd = (efsInfo.sizeGiB * efsOneZoneUsdPerGiBMonth) / HOURS_PER_MONTH;
      const comp: CostComponent = {
        id: 'efs_storage_onezone',
        label: 'EFS One Zone storage',
        perHourUsd: efsPerHourUsd,
        detail: `${efsInfo.sizeGiB.toFixed(2)} GiB @ $${efsOneZoneUsdPerGiBMonth}/GiB-month`,
      };
      componentsOnline.push(comp);
      componentsOffline.push(comp);
    } else {
      assumptions.push(
        'EFS filesystem not found via tag lookup (GameInstance=<id>); EFS cost treated as $0/hour.',
      );
    }

    // EC2 compute (only online).
    let ec2OnDemandUsdPerHour: number | null = null;
    let ec2EffectiveUsdPerHour: number | null = null;
    if (lt.instanceType) {
      ec2OnDemandUsdPerHour = await this.getEc2OnDemandUsdPerHour(
        pricingLocation,
        lt.instanceType,
      );

      if (lt.spotMaxPriceUsdPerHour !== null) {
        // Worst-case: spot will not exceed this price, but actual spot is usually lower.
        ec2EffectiveUsdPerHour = minDefined([
          ec2OnDemandUsdPerHour,
          lt.spotMaxPriceUsdPerHour,
        ]);
        assumptions.push(
          'Spot pricing: using min(on-demand, spot max price) as a conservative upper bound for per-hour compute cost.',
        );
      } else {
        ec2EffectiveUsdPerHour = ec2OnDemandUsdPerHour;
      }

      if (ec2EffectiveUsdPerHour === null) {
        throw new Error('Unable to determine effective EC2 hourly price');
      }

      const perHourForFleet = ec2EffectiveUsdPerHour * instance.instanceCount;
      componentsOnline.push({
        id: 'ec2_compute',
        label: 'EC2 compute (ASG capacity)',
        perHourUsd: perHourForFleet,
        detail: `${instance.instanceCount} x ${lt.instanceType} @ $${ec2EffectiveUsdPerHour}/hour`,
      });
    } else {
      assumptions.push(
        'Launch template instanceType could not be determined; EC2 cost treated as $0/hour.',
      );
    }

    const onlinePerHourUsd = componentsOnline.reduce((sum, c) => sum + c.perHourUsd, 0);
    const offlinePerHourUsd = componentsOffline.reduce((sum, c) => sum + c.perHourUsd, 0);

    return {
      currency: 'USD',
      onlinePerHourUsd,
      offlinePerHourUsd,
      breakdownOnline: componentsOnline,
      breakdownOffline: componentsOffline,
      assumptions,
      inputs: {
        awsRegion: this.region,
        pricingLocation,
        instanceType: lt.instanceType,
        instanceCount: instance.instanceCount,
        spotMaxPriceUsdPerHour: lt.spotMaxPriceUsdPerHour,
        ec2OnDemandUsdPerHour,
        ec2EffectiveUsdPerHour,
        efsFileSystemId: efsInfo?.fileSystemId ?? null,
        efsSizeGiB: efsInfo?.sizeGiB ?? null,
        efsOneZoneUsdPerGiBMonth,
        computedAt,
      },
    };
  }

  private async getLaunchTemplateInfo(asgName: string): Promise<LaunchTemplateInfo> {
    const res = await this.autoscaling.send(
      new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: [asgName],
      }),
    );
    const asg = res.AutoScalingGroups?.[0];
    if (!asg) throw new Error(`ASG not found: ${asgName}`);

    const lt =
      asg.LaunchTemplate ??
      asg.MixedInstancesPolicy?.LaunchTemplate?.LaunchTemplateSpecification ??
      null;

    if (!lt?.LaunchTemplateId && !lt?.LaunchTemplateName) {
      return { instanceType: null, spotMaxPriceUsdPerHour: null };
    }

    const ver = lt.Version && lt.Version.trim().length > 0 ? lt.Version : '$Default';
    const ltRes = await this.ec2.send(
      new DescribeLaunchTemplateVersionsCommand({
        ...(lt.LaunchTemplateId
          ? { LaunchTemplateId: lt.LaunchTemplateId }
          : { LaunchTemplateName: lt.LaunchTemplateName! }),
        Versions: [ver],
      }),
    );

    const v = ltRes.LaunchTemplateVersions?.[0];
    const data = v?.LaunchTemplateData;
    const instanceType = data?.InstanceType ?? null;
    const spotMax = parseUsd(data?.InstanceMarketOptions?.SpotOptions?.MaxPrice);
    const isSpot = data?.InstanceMarketOptions?.MarketType === 'spot';

    return {
      instanceType,
      spotMaxPriceUsdPerHour: isSpot ? spotMax : null,
    };
  }

  private async getEfsInfoByGameInstanceTag(gameInstanceId: string): Promise<EfsInfo | null> {
    const res = await this.tagApi.send(
      new GetResourcesCommand({
        ResourceTypeFilters: ['elasticfilesystem:file-system'],
        TagFilters: [{ Key: 'GameInstance', Values: [gameInstanceId] }],
      }),
    );

    const arn = res.ResourceTagMappingList?.[0]?.ResourceARN;
    if (!arn) return null;

    const fsId = extractEfsIdFromArn(arn);
    if (!fsId) return null;

    const fsRes = await this.efs.send(
      new DescribeFileSystemsCommand({ FileSystemId: fsId }),
    );
    const fs = fsRes.FileSystems?.[0];
    const bytes = fs?.SizeInBytes?.Value;
    if (typeof bytes !== 'number') return null;

    return { fileSystemId: fsId, sizeGiB: toGiB(bytes) };
  }

  private async getEc2OnDemandUsdPerHour(
    pricingLocation: string,
    instanceType: string,
  ): Promise<number> {
    const res = await this.pricing.send(
      new GetProductsCommand({
        ServiceCode: 'AmazonEC2',
        Filters: [
          { Type: 'TERM_MATCH', Field: 'location', Value: pricingLocation },
          { Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType },
          { Type: 'TERM_MATCH', Field: 'operatingSystem', Value: 'Linux' },
          { Type: 'TERM_MATCH', Field: 'preInstalledSw', Value: 'NA' },
          { Type: 'TERM_MATCH', Field: 'tenancy', Value: 'Shared' },
          { Type: 'TERM_MATCH', Field: 'capacitystatus', Value: 'Used' },
          { Type: 'TERM_MATCH', Field: 'operation', Value: 'RunInstances' },
        ],
        MaxResults: 25,
      }),
    );

    const priceList = res.PriceList ?? [];
    for (const entry of priceList) {
      if (typeof entry !== 'string') continue;
      try {
        const product = JSON.parse(entry) as any;
        const terms = product?.terms?.OnDemand;
        if (!terms || typeof terms !== 'object') continue;
        for (const termKey of Object.keys(terms)) {
          const term = terms[termKey];
          const dims = term?.priceDimensions;
          if (!dims || typeof dims !== 'object') continue;
          for (const dimKey of Object.keys(dims)) {
            const dim = dims[dimKey];
            const unit = dim?.unit;
            const usd = dim?.pricePerUnit?.USD;
            const price = parseUsd(usd);
            if (unit === 'Hrs' && price !== null && price > 0) return price;
          }
        }
      } catch {
        // Ignore malformed entries.
      }
    }

    throw new Error(
      `Unable to resolve EC2 on-demand hourly price for ${instanceType} in ${pricingLocation}`,
    );
  }

  private async getEfsOneZoneStorageUsdPerGiBMonth(
    pricingLocation: string,
  ): Promise<number> {
    // Start strict; fall back to broader filter if the attribute name/value doesn't match.
    const candidates: Array<{ filters: any[]; note: string }> = [
      {
        note: 'strict',
        filters: [
          { Type: 'TERM_MATCH', Field: 'location', Value: pricingLocation },
          { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Storage' },
          { Type: 'TERM_MATCH', Field: 'storageClass', Value: 'One Zone' },
        ],
      },
      {
        note: 'broad',
        filters: [
          { Type: 'TERM_MATCH', Field: 'location', Value: pricingLocation },
          { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Storage' },
        ],
      },
    ];

    for (const cand of candidates) {
      const res = await this.pricing.send(
        new GetProductsCommand({
          ServiceCode: 'AmazonEFS',
          Filters: cand.filters,
          MaxResults: 100,
        }),
      );

      const priceList = res.PriceList ?? [];
      for (const entry of priceList) {
        if (typeof entry !== 'string') continue;
        try {
          const product = JSON.parse(entry) as any;
          const attrs = product?.product?.attributes ?? {};

          // In broad mode, filter down to One Zone storage class variants.
          if (
            cand.note === 'broad' &&
            typeof attrs.storageClass === 'string' &&
            !attrs.storageClass.toLowerCase().includes('one zone')
          ) {
            continue;
          }

          const terms = product?.terms?.OnDemand;
          if (!terms || typeof terms !== 'object') continue;
          for (const termKey of Object.keys(terms)) {
            const term = terms[termKey];
            const dims = term?.priceDimensions;
            if (!dims || typeof dims !== 'object') continue;
            for (const dimKey of Object.keys(dims)) {
              const dim = dims[dimKey];
              const unit = dim?.unit;
              const usd = dim?.pricePerUnit?.USD;
              const price = parseUsd(usd);
              if ((unit === 'GB-Mo' || unit === 'GB-Month') && price !== null && price > 0) {
                return price;
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    throw new Error(
      `Unable to resolve EFS One Zone storage $/GiB-month for ${pricingLocation}`,
    );
  }
}
