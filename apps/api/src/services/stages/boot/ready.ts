import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'ready'> = {
  id: 'ready',
  label: 'Server ready for players',
  async check() {
    return true;
  },
  async action() {
    // No action needed.
  },
};

export default stage;
