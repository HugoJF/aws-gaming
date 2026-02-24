import { z } from 'zod';

export const bootstrapAdminBodySchema = z.object({
  label: z
    .unknown()
    .optional()
    .transform((value) => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }),
});
