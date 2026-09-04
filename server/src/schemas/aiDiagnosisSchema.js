import { z } from 'zod';
import { DIAGNOSIS_CATEGORIES, RECOVERY_ACTIONS } from '../config/constants.js';

export const AIDiagnosisSchema = z.object({
  diagnosisCategory: z.enum(DIAGNOSIS_CATEGORIES),
  rootCauseAnalysis: z.string().min(5).max(400),
  recommendedAction: z.enum(Object.values(RECOVERY_ACTIONS)),
  waitMinutes: z.number().int().min(0).max(2880),
  confidence: z.number().min(0.0).max(1.0),
  reasoning: z.string().min(5).max(600),
  customerMessage: z.object({
    channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'NONE']),
    headline: z.string().min(0).max(100),
    body: z.string().min(0).max(350),
    cta: z.string().min(0).max(50)
  })
});

