import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: { jsonMode?: boolean; model?: string }
): Promise<string> {
  const model = options?.model ?? 'gpt-4.1-mini';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 2000,
    ...(options?.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  });

  return response.choices[0]?.message?.content ?? '';
}

export function parseJSON(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  // Remove markdown code blocks
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = blockMatch ? blockMatch[1].trim() : trimmed;
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON object in response
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    return {};
  }
}
