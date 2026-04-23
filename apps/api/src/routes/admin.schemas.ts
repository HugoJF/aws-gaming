import { z } from 'zod';
import { parseDateFromUnknown } from '../utils/date.js';
import { isNonEmptyStringArray } from '../utils/type-guards.js';

const createLabelSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      ctx.addIssue({ code: 'custom', message: 'label is required' });
    }
  })
  .transform((value) => (value as string).trim());

const patchLabelSchema = z
  .unknown()
  .optional()
  .superRefine((value, ctx) => {
    if (value !== undefined && (typeof value !== 'string' || value.trim().length === 0)) {
      ctx.addIssue({ code: 'custom', message: 'label must be a non-empty string' });
    }
  })
  .transform((value) => (typeof value === 'string' ? value.trim() : undefined));

const createInstanceIdsSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (!isNonEmptyStringArray(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'instanceIds must be a non-empty array of strings',
      });
    }
  })
  .transform((value) => value as string[]);

const patchInstanceIdsSchema = z
  .unknown()
  .optional()
  .superRefine((value, ctx) => {
    if (value !== undefined && !isNonEmptyStringArray(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'instanceIds must be a non-empty array of strings',
      });
    }
  })
  .transform((value) => (value === undefined ? undefined : (value as string[])));

const maybeExpiresAtSchema = z
  .unknown()
  .optional()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null) return;
    if (typeof value !== 'string' || parseDateFromUnknown(value) === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'expiresAt must be an ISO date string or null',
      });
    }
  })
  .transform((value) => {
    if (value === undefined || value === null) return value;
    return parseDateFromUnknown(value as string) as string;
  });

const createIsAdminSchema = z
  .unknown()
  .optional()
  .superRefine((value, ctx) => {
    if (value !== undefined && typeof value !== 'boolean') {
      ctx.addIssue({
        code: 'custom',
        message: 'isAdmin must be boolean when provided',
      });
    }
  })
  .transform((value) => value as boolean | undefined);

const patchIsAdminSchema = z
  .unknown()
  .optional()
  .superRefine((value, ctx) => {
    if (value !== undefined && typeof value !== 'boolean') {
      ctx.addIssue({ code: 'custom', message: 'isAdmin must be boolean' });
    }
  })
  .transform((value) => value as boolean | undefined);

export const createTokenBodySchema = z.object({
  label: createLabelSchema,
  instanceIds: createInstanceIdsSchema,
  expiresAt: maybeExpiresAtSchema,
  isAdmin: createIsAdminSchema,
});

export const updateTokenBodySchema = z
  .object({
    label: patchLabelSchema,
    instanceIds: patchInstanceIdsSchema,
    expiresAt: maybeExpiresAtSchema,
    isAdmin: patchIsAdminSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.label === undefined &&
      value.instanceIds === undefined &&
      value.expiresAt === undefined &&
      value.isAdmin === undefined
    ) {
      ctx.addIssue({ code: 'custom', message: 'No mutable fields provided' });
    }
  });
