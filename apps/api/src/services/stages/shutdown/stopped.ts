import type { StageDefinition } from '../types.js';

const stage: StageDefinition<'stopped'> = {
  id: 'stopped',
  label: 'Server fully offline',
  async check() {
    return true;
  },
  async action() {
    // No action needed.
  },
};

export default stage;
