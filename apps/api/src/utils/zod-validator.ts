import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';

type ZodValidationOptions = {
  invalidBodyMessage?: string;
};

export function jsonZodValidator<Schema extends ZodType>(
  schema: Schema,
  options: ZodValidationOptions = {},
) {
  return zValidator('json', schema, (result, c) => {
    if (result.success) return;

    const firstIssue = result.error.issues[0];
    const isRootTypeIssue =
      firstIssue !== undefined &&
      firstIssue.path.length === 0 &&
      firstIssue.code === 'invalid_type';
    const message =
      isRootTypeIssue && options.invalidBodyMessage
        ? options.invalidBodyMessage
        : (firstIssue?.message ?? options.invalidBodyMessage ?? 'Invalid request body');

    return c.json({ error: message }, 400);
  });
}
