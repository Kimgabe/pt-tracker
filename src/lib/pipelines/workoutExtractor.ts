import { callLLM, parseJSON } from '../llm';
import type { TranscriptSegment } from '../youtube';

export interface ExtractedExercise {
  name: string;
  sets: number;
  reps: string | number;
  rest_seconds: number;
  equipment: string[];
  target_muscles: string[];
  timestamp_seconds: number | null;
}

export interface ExtractedWorkout {
  workout_name: string;
  exercises: ExtractedExercise[];
  total_duration_min: number;
  estimated_calories: number;
  creator: string;
  workout_type: string;
  source_url: string;
}

export async function extractWorkout(
  transcriptText: string,
  segments: TranscriptSegment[],
  videoTitle?: string | null,
  creator?: string | null,
  sourceUrl: string = '',
): Promise<ExtractedWorkout> {
  // Format with segment indices
  let fullText = transcriptText;
  if (segments.length > 0) {
    fullText = segments.map((seg, i) => `[SEG:${i}] ${seg.text}`).join('\n');
  }
  const truncated = fullText.length > 6000 ? fullText.slice(0, 6000) : fullText;

  // === Stage 1: Extract exercise names ===
  const stage1 = parseJSON(await callLLM(
    'You extract exercise names from transcripts. Be precise, never invent.',
    `From this transcript, list ONLY the exercise names that are EXPLICITLY mentioned.

Rules:
- List ONLY exercises that are clearly named in the transcript
- Do NOT invent or guess exercises
- If no specific exercises are named (e.g. it's a follow-along dance/cardio), return empty list
- Return Korean names when possible

Return JSON: {"exercises": ["운동명1", "운동명2"], "workout_type": "strength|cardio|hiit|yoga|dance|stretching"}
Return ONLY valid JSON.

Transcript:
${fullText}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const exerciseNames = (stage1.exercises as string[]) ?? [];
  const workoutType = (stage1.workout_type as string) ?? 'strength';

  if (exerciseNames.length === 0) {
    return {
      workout_name: videoTitle ?? '',
      exercises: [],
      total_duration_min: 0,
      estimated_calories: 0,
      creator: creator ?? '',
      workout_type: workoutType,
      source_url: sourceUrl,
    };
  }

  // === Stage 2: Get details for each exercise ===
  const exerciseList = exerciseNames.join(', ');
  const stage2 = parseJSON(await callLLM(
    'You structure exercise details from transcripts. Use only information from the transcript.',
    `For these exercises found in the transcript: [${exerciseList}]

First determine: Is this a SET-BASED workout (e.g. "3 sets of 10 reps") or a TIME-BASED workout (e.g. "30 seconds each exercise")?

Return JSON:
{"workout_format": "sets|time",
  "exercises": [
  {"name": "운동명", "sets": 1, "reps": "30초", "rest_seconds": 10, "equipment": ["장비"], "target_muscles": ["부위"], "segment_index": null}
]}

Rules:
- FIRST check if the transcript mentions specific durations per exercise (e.g. "30 seconds", "40 seconds", "1 minute"). If yes, this is TIME-BASED.
- For TIME-BASED workouts:
  - sets: usually 1 (unless the circuit is repeated)
  - reps: use the DURATION as string (e.g. "30초", "40초", "1분")
  - rest_seconds: extract from transcript (e.g. "10 second rest" = 10)
- For SET-BASED workouts:
  - sets/reps: Use values from transcript. Default to 3 sets, 10 reps if not mentioned.
  - rest_seconds: Default 60 if not mentioned.
- equipment: Extract from transcript, or infer from exercise type
- target_muscles: Based on exercise type (Korean)
- segment_index: The [SEG:N] number where this exercise is first mentioned. Must be exact.
- Return ONLY valid JSON.

Transcript:
${truncated}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const exercises: ExtractedExercise[] = ((stage2.exercises as Record<string, unknown>[]) ?? []).map(ex => {
    const segIdx = ex.segment_index as number | null;
    let timestamp: number | null = null;
    if (segIdx !== null && segIdx >= 0 && segIdx < segments.length) {
      timestamp = Math.floor(segments[segIdx].offset);
    }

    return {
      name: (ex.name as string) ?? '',
      sets: Number(ex.sets) || 3,
      reps: (typeof ex.reps === 'string' || typeof ex.reps === 'number') ? ex.reps : 10,
      rest_seconds: Number(ex.rest_seconds) || 60,
      equipment: (ex.equipment as string[]) ?? [],
      target_muscles: (ex.target_muscles as string[]) ?? [],
      timestamp_seconds: timestamp,
    };
  });

  // === Stage 3: Meta info ===
  const titleHint = videoTitle ? `\nVideo title: "${videoTitle}"` : '';
  const creatorHint = creator ? `\nCreator: "${creator}"` : '';
  const stage3 = parseJSON(await callLLM(
    'You summarize workout metadata.',
    `Workout with exercises: [${exerciseList}]
Workout type: ${workoutType}${titleHint}${creatorHint}

Produce:
- workout_name: a concrete Korean routine name. If a Video title is provided, base the
  name on it (you may shorten or simplify, but keep the specific topic). NEVER return a generic name like "근력 강화 루틴".
- total_duration_min: total workout time in minutes (estimate if unsure).

Return JSON: {"workout_name": "...", "total_duration_min": 30}
Return ONLY valid JSON.`,
    { jsonMode: true, model: 'gpt-4.1-nano' }
  ));

  return {
    workout_name: (stage3.workout_name as string) ?? videoTitle ?? '',
    exercises,
    total_duration_min: Number(stage3.total_duration_min) || 0,
    estimated_calories: 0,
    creator: creator ?? '',
    workout_type: workoutType,
    source_url: sourceUrl,
  };
}
