import { callLLM, parseJSON } from '../llm';
import type { TranscriptSegment } from '../youtube';

/** Bump this when recipe extraction prompts change to auto-invalidate cached results */
export const RECIPE_PROMPT_VERSION = 'r-2026-05-14';

export interface ExtractedIngredient {
  name: string;
  amount: string;
}

export interface ExtractedStep {
  description: string;
  timestamp_seconds: number | null;
}

export interface ExtractedNutrition {
  calories: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
}

export interface ExtractedRecipe {
  recipe_name: string;
  goal_category: string;
  ingredients: ExtractedIngredient[];
  steps: ExtractedStep[];
  nutrition: ExtractedNutrition;
  estimated_cost_krw: number;
  cooking_time_min: number;
  difficulty: string;
  meal_type: string;
  tags: string[];
  creator: string;
  source_url: string;
}

export async function extractRecipe(
  transcriptText: string,
  segments: TranscriptSegment[],
  videoTitle?: string | null,
  creator?: string | null,
  sourceUrl: string = '',
): Promise<ExtractedRecipe> {
  let fullText = transcriptText;
  if (segments.length > 0) {
    fullText = segments.map((seg, i) => `[SEG:${i}] ${seg.text}`).join('\n');
  }
  const truncated = fullText.length > 6000 ? fullText.slice(0, 6000) : fullText;

  const titleHint = videoTitle
    ? `\n\nVideo title (use as the dish_name unless transcript clearly says otherwise): "${videoTitle}"`
    : '';

  // === Stage 1: Extract ingredients ===
  const stage1 = parseJSON(await callLLM(
    'You extract ingredients from cooking transcripts. Be precise, never invent.',
    `From this transcript, extract ONLY the ingredients and amounts that are EXPLICITLY mentioned.

Rules:
- List ONLY ingredients clearly mentioned in the transcript
- Do NOT invent ingredients
- Include amounts if mentioned
- If this is not a recipe, return empty ingredients and set is_recipe=false
- For dish_name: prefer the Video title (cleaned up). Avoid generic names.
${titleHint}

Return JSON: {"ingredients": [{"name": "재료명", "amount": "분량"}], "is_recipe": true, "dish_name": "요리 이름"}
Return ONLY valid JSON.

Transcript:
${fullText}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const ingredients: ExtractedIngredient[] = ((stage1.ingredients as Record<string, unknown>[]) ?? []).map(i => ({
    name: (i.name as string) ?? '',
    amount: (i.amount as string) ?? '',
  }));
  const dishName = (stage1.dish_name as string) ?? videoTitle ?? '';

  // === Stage 2: Extract cooking steps ===
  const ingNames = JSON.stringify(ingredients.map(i => i.name));
  const stage2 = parseJSON(await callLLM(
    'You extract cooking steps from transcripts. Use only information from the transcript.',
    `For the dish "${dishName}" with ingredients: ${ingNames}

Extract the cooking steps from this transcript.

Return JSON:
{"steps": [
  {"description": "조리 단계 설명", "segment_index": null}
]}

Rules:
- Extract steps in chronological order from the transcript
- segment_index: The [SEG:N] number where this step starts. Must be exact.
- Use Korean for descriptions
- Return ONLY valid JSON.

Transcript:
${truncated}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const steps: ExtractedStep[] = ((stage2.steps as Record<string, unknown>[]) ?? []).map(s => {
    const segIdx = s.segment_index as number | null;
    let timestamp: number | null = null;
    if (segIdx !== null && segIdx >= 0 && segIdx < segments.length) {
      timestamp = Math.floor(segments[segIdx].offset);
    }
    return {
      description: (s.description as string) ?? '',
      timestamp_seconds: timestamp,
    };
  });

  // === Stage 3: Nutrition + meta ===
  const ingNameList = ingredients.map(i => i.name).join(', ');
  const stage3 = parseJSON(await callLLM(
    'You estimate nutrition info for Korean dishes.',
    `Dish: ${dishName}
Ingredients: ${ingNameList}

Estimate nutrition per serving and classify:

Return JSON:
{
  "nutrition": {"calories": 0, "protein_g": 0, "carb_g": 0, "fat_g": 0},
  "goal_category": "diet|bulking|maintain",
  "estimated_cost_krw": 0,
  "cooking_time_min": 0,
  "difficulty": "easy|medium|hard",
  "meal_type": "breakfast|lunch|dinner|snack|pre_workout|post_workout",
  "tags": []
}
Return ONLY valid JSON.`,
    { jsonMode: true, model: 'gpt-4.1-nano' }
  ));

  const nutrition = stage3.nutrition as Record<string, number> | undefined;

  return {
    recipe_name: dishName,
    goal_category: (stage3.goal_category as string) ?? 'maintain',
    ingredients,
    steps,
    nutrition: {
      calories: Number(nutrition?.calories) || 0,
      protein_g: Number(nutrition?.protein_g) || 0,
      carb_g: Number(nutrition?.carb_g) || 0,
      fat_g: Number(nutrition?.fat_g) || 0,
    },
    estimated_cost_krw: Number(stage3.estimated_cost_krw) || 0,
    cooking_time_min: Number(stage3.cooking_time_min) || 0,
    difficulty: (stage3.difficulty as string) ?? 'medium',
    meal_type: (stage3.meal_type as string) ?? 'lunch',
    tags: (stage3.tags as string[]) ?? [],
    creator: creator ?? '',
    source_url: sourceUrl,
  };
}
