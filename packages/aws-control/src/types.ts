export interface AsgStatus {
  desiredCapacity: number;
  minSize: number;
  maxSize: number;
  instances: AsgInstanceInfo[];
}

export interface AsgInstanceInfo {
  instanceId: string;
  lifecycleState: string;
  healthStatus: string;
}

export interface EcsStatus {
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  containerInstanceCount: number;
  healthyTaskCount: number;
  unhealthyTaskCount: number;
  unknownHealthTaskCount: number;
}

export interface Ec2InstanceInfo {
  instanceId: string;
  publicIp: string | null;
  privateIp: string | null;
  state: string;
}

export interface DnsRecordState {
  exists: boolean;
  currentIp: string | null;
}
