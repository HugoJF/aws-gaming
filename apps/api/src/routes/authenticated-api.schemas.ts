import { z } from 'zod';

export const transitionRequestSchema = z
  .unknown()
  .transform((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as Record<string, unknown>).action;
  })
  .superRefine((action, ctx) => {
    if (action !== 'on' && action !== 'off') {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid action, must be "on" or "off"',
      });
    }
  })
  .transform((action) => ({ action: action as 'on' | 'off' }));
