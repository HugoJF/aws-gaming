import type { GameInstance, BootStageId, ShutdownStageId } from '@aws-gaming/contracts';
import type { AsgControl, EcsControl, Ec2Control, DnsControl } from '@aws-gaming/aws-control';

export interface StageContext {
  instance: GameInstance;
  asg: AsgControl;
  ecs: EcsControl;
  ec2: Ec2Control;
  dns: DnsControl;
}

export interface StageDefinition<Id extends BootStageId | ShutdownStageId = BootStageId | ShutdownStageId> {
  id: Id;
  label: string;
  /** Whether this stage applies to the given instance. Defaults to true. */
  appliesTo?(instance: GameInstance): boolean;
  /** Returns true when the stage condition is satisfied. */
  check(ctx: StageContext): Promise<boolean>;
  /** Fires the AWS mutation to achieve this stage's condition. Idempotent. */
  action(ctx: StageContext): Promise<void>;
}
