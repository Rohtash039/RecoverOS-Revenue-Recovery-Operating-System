import { ENV } from '../../config/env.js';
import { AIDiagnosisSchema } from '../../schemas/aiDiagnosisSchema.js';
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder.js';
import { getFallbackDiagnosis } from './fallbackEngine.js';

export async function diagnoseRecoveryCase(transaction, customer, score = 50) {

  if (ENV.AI_MODE !== 'live' || !ENV.GROK_API_KEY) {
    return getFallbackDiagnosis(transaction, customer);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.AI_TIMEOUT_MS);

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(transaction, customer, score);

    const endpoint = 'https://api.x.ai/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.GROK_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: ENV.GROK_MODEL || 'grok-2-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this recovery case and return structured JSON:\n${userPrompt}` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[AI Agent: Grok] API returned HTTP ${response.status}. Switching to fallback.`);
      return getFallbackDiagnosis(transaction, customer);
    }

    const data = await response.json();
    let rawText = data?.choices?.[0]?.message?.content;

    if (!rawText) {
      console.warn('[AI Agent: Grok] Empty response from Grok. Switching to fallback.');
      return getFallbackDiagnosis(transaction, customer);
    }

    rawText = rawText.trim();
    if (rawText.startsWith('```json')) {
      rawText = rawText.slice(7, rawText.lastIndexOf('```')).trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.slice(3, rawText.lastIndexOf('```')).trim();
    }

    const parsedJson = JSON.parse(rawText);
    const validated = AIDiagnosisSchema.safeParse(parsedJson);

    if (!validated.success) {
      console.warn('[AI Agent: Grok] Zod validation failed for Grok output:', validated.error.format());
      return getFallbackDiagnosis(transaction, customer);
    }

    return {
      ...validated.data,
      fallbackUsed: false
    };
  } catch (error) {
    clearTimeout(timeout);
    console.warn(`[AI Agent: Grok] Error calling LLM (${error.message}). Using deterministic fallback.`);
    return getFallbackDiagnosis(transaction, customer);
  }
}

