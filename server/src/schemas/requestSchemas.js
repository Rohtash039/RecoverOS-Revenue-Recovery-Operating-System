import { z } from 'zod';

export const caseActionSchema = z.object({
  action: z.enum(['APPROVE_ESCALATION', 'REJECT_ESCALATION', 'FORCE_STOP'], {
    errorMap: () => ({ message: "Action must be one of: 'APPROVE_ESCALATION', 'REJECT_ESCALATION', 'FORCE_STOP'" })
  }),
  operatorId: z.string({ required_error: 'operatorId is required' })
    .trim()
    .min(1, 'operatorId cannot be empty')
});

export const batchRunSchema = z.object({
  speed: z.enum(['FAST', 'ANIMATED'], {
    errorMap: () => ({ message: "Speed must be either 'FAST' or 'ANIMATED'" })
  }).optional().default('FAST')
});

export const resetSchema = z.object({
  seed: z.string().trim().optional()
});

