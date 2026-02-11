export interface GameControlTarget {
  autoScalingGroupName: string;
  ecsClusterArn: string;
  ecsServiceName: string;
}

export interface PowerOnInput extends GameControlTarget {
  desiredCapacity: number;
}

export interface GamePowerController {
  powerOn(input: PowerOnInput): Promise<void>;
  powerOff(target: GameControlTarget): Promise<void>;
}

export class NotImplementedPowerController implements GamePowerController {
  public async powerOn(_: PowerOnInput): Promise<void> {
    throw new Error('Not implemented');
  }

  public async powerOff(_: GameControlTarget): Promise<void> {
    throw new Error('Not implemented');
  }
}
