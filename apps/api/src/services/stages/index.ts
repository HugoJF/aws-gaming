import type { BootStageId, ShutdownStageId } from '@aws-gaming/contracts';
import type { StageDefinition } from './types.js';

import scaling from './boot/scaling.js';
import registering from './boot/registering.js';
import starting from './boot/starting.js';
import taskHealthy from './boot/task-healthy.js';
import dnsUpdate from './boot/dns-update.js';
import dnsResolve from './boot/dns-resolve.js';
import gameReady from './boot/game-ready.js';
import ready from './boot/ready.js';

import stopping from './shutdown/stopping.js';
import dnsClear from './shutdown/dns-clear.js';
import scalingDown from './shutdown/scaling-down.js';
import draining from './shutdown/draining.js';
import stopped from './shutdown/stopped.js';

export type { StageDefinition, StageContext } from './types.js';

export const BOOT_STAGES: readonly StageDefinition<BootStageId>[] = [
  scaling,
  registering,
  starting,
  dnsUpdate,
  dnsResolve,
  taskHealthy,
  gameReady,
  ready,
];

export const SHUTDOWN_STAGES: readonly StageDefinition<ShutdownStageId>[] = [
  stopping,
  dnsClear,
  scalingDown,
  draining,
  stopped,
];
