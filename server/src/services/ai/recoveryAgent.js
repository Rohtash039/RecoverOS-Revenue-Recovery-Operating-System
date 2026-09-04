import { ENV } from '../../config/env.js';
import { AIDiagnosisSchema } from '../../schemas/aiDiagnosisSchema.js';
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder.js';
import { getFallbackDiagnosis } from './fallbackEngine.js';

export async function diagnoseRecoveryCase(transaction, customer, score = 50) {
  // If deterministic mode or no API key, use fallback engine immediately
  if (ENV.AI_MODE !== 'live' || !ENV.GEMINI_API_KEY) {
    return getFallbackDiagnosis(transaction, customer);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.AI_TIMEOUT_MS);

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(transaction, customer, score);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${ENV.GEMINI_API_KEY}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nAnalyze this case:\n${userPrompt}` }] }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[AI Agent] Gemini API returned HTTP ${response.status}. Switching to fallback.`);
      return getFallbackDiagnosis(transaction, customer);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.warn('[AI Agent] Empty response from Gemini. Switching to fallback.');
      return getFallbackDiagnosis(transaction, customer);
    }

    const parsedJson = JSON.parse(rawText.trim());
    const validated = AIDiagnosisSchema.safeParse(parsedJson);

    if (!validated.success) {
      console.warn('[AI Agent] Zod validation failed for Gemini output:', validated.error.format());
      return getFallbackDiagnosis(transaction, customer);
    }

    return {
      ...validated.data,
      fallbackUsed: false
    };
  } catch (error) {
    clearTimeout(timeout);
    console.warn(`[AI Agent] Error calling LLM (${error.message}). Using deterministic fallback.`);
    return getFallbackDiagnosis(transaction, customer);
  }
}
