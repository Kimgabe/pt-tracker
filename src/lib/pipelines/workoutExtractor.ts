import { callLLM, parseJSON } from '../llm';
import type { TranscriptSegment } from '../youtube';

/** Bump this when workout extraction prompts change to auto-invalidate cached results */
export const WORKOUT_PROMPT_VERSION = 'w-2026-05-14';

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

function parseDescriptionTimestamps(
  description: string,
): Array<{ name: string; timestamp_seconds: number }> {
  const results: Array<{ name: string; timestamp_seconds: number }> = [];
  const re = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/;
  for (const line of description.split('\n')) {
    const m = line.trim().match(re);
    if (!m) continue;
    const hours = m[1] ? parseInt(m[1]) : 0;
    const minutes = parseInt(m[2]);
    const seconds = parseInt(m[3]);
    results.push({
      name: m[4].trim(),
      timestamp_seconds: hours * 3600 + minutes * 60 + seconds,
    });
  }
  return results;
}

async function buildFromDescriptionTimestamps(
  timestamps: Array<{ name: string; timestamp_seconds: number }>,
  videoTitle?: string | null,
  creator?: string | null,
  sourceUrl: string = '',
): Promise<ExtractedWorkout> {
  const exercises: ExtractedExercise[] = [...timestamps]
    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
    .map(t => ({
      name: t.name,
      sets: 1,
      reps: '영상 참고',
      rest_seconds: 10,
      equipment: [],
      target_muscles: [],
      timestamp_seconds: t.timestamp_seconds,
    }));

  const exerciseList = timestamps.map(t => t.name).join(', ');
  const titleHint = videoTitle ? `\nVideo title: "${videoTitle}"` : '';
  const stage3 = parseJSON(await callLLM(
    'You summarize workout metadata.',
    `Workout with exercises: [${exerciseList}]
Workout type: cardio${titleHint}

Produce:
- workout_name: a concrete Korean routine name. If a Video title is provided, base the name on it. NEVER return a generic name like "근력 강화 루틴".
- total_duration_min: total workout time in minutes. If the video title contains a duration (e.g. "12분", "30 min"), use that.

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
    workout_type: 'cardio',
    source_url: sourceUrl,
  };
}

/** Sanitize reps: accept numbers or duration strings (e.g. "30초"), reject ASR garbage */
function sanitizeReps(raw: unknown): string | number {
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Pass through descriptive labels like "영상 참고"
    if (trimmed === '영상 참고') return trimmed;
    // Pure number string
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    // Duration pattern: "30초", "40초", "1분", "1분 30초"
    if (/^\d+\s*(초|분|seconds?|sec|min|minutes?)/.test(trimmed)) return trimmed;
    // Fallback: if it contains a number, extract it
    const numMatch = trimmed.match(/(\d+)/);
    if (numMatch) return Number(numMatch[1]);
  }
  return 10; // default
}

export async function extractWorkout(
  transcriptText: string,
  segments: TranscriptSegment[],
  videoTitle?: string | null,
  creator?: string | null,
  sourceUrl: string = '',
  description?: string | null,
): Promise<ExtractedWorkout> {
  // Description-first path: use timestamps from video description when available
  if (description) {
    const descTimestamps = parseDescriptionTimestamps(description);
    if (descTimestamps.length >= 3) {
      return buildFromDescriptionTimestamps(descTimestamps, videoTitle, creator, sourceUrl);
    }
  }

  // Format with segment indices
  let fullText = transcriptText;
  if (segments.length > 0) {
    fullText = segments.map((seg, i) => `[SEG:${i}] ${seg.text}`).join('\n');
  }
  const truncated = fullText.length > 6000 ? fullText.slice(0, 6000) : fullText;

  // === Stage 1: Extract exercise names ===
  const stage1 = parseJSON(await callLLM(
    'You extract exercise names from workout video transcripts. Be precise, never invent.',
    `From this transcript, list ALL exercises or movements performed.

Rules:
- Include formally named exercises (e.g. "스쿼트", "푸시업", "버피")
- ALSO include movement descriptions used in follow-along/cardio videos (e.g. "제자리 걷기", "무릎 들어올리기", "팔꿈치-무릎 터치", "골반 회전 뛰기")
- For follow-along videos, the instructor often describes movements without formal exercise names — extract these as exercise names
- Do NOT invent exercises not in the transcript
- Return Korean names when possible
- Aim to capture every distinct movement/exercise, even if described informally

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
  const isCardioType = ['cardio', 'hiit', 'dance'].includes(workoutType);
  const stage2 = parseJSON(await callLLM(
    'You structure exercise details from transcripts. Use only information from the transcript.',
    `For these exercises found in the transcript: [${exerciseList}]

Workout type from classification: ${workoutType}

${isCardioType
  ? 'This is a CARDIO/HIIT/DANCE workout. Default to TIME-BASED format unless the transcript explicitly mentions sets and reps (e.g. "3세트 10회").'
  : 'Determine: Is this SET-BASED (e.g. "3 sets of 10 reps") or TIME-BASED (e.g. "30 seconds each")?'}

Return JSON:
{"workout_format": "sets|time",
  "exercises": [
  {"name": "운동명", "sets": 1, "reps": "30초", "rest_seconds": 10, "equipment": ["장비"], "target_muscles": ["부위"], "segment_index": null}
]}

Rules:
- For TIME-BASED workouts (cardio/hiit/dance default):
  - sets: usually 1 (unless the circuit is repeated)
  - reps: use the DURATION as string (e.g. "30초", "40초", "1분"). If no specific duration is mentioned, estimate from the gap between consecutive exercises using segment timing, or return "영상 참고".
  - rest_seconds: extract from transcript if mentioned. Default ${isCardioType ? '10' : '60'} if not mentioned.
- For SET-BASED workouts:
  - sets/reps: Use values from transcript. Default to 3 sets, 10 reps if not mentioned.
  - rest_seconds: Default 60 if not mentioned.
- equipment: Extract from transcript, or infer from exercise type
- target_muscles: Based on exercise type (Korean)
- segment_index: The [SEG:N] number where this exercise is first mentioned. Must be exact.
- reps MUST be either a number (e.g. 10, 15), a duration string (e.g. "30초", "40초", "1분"), or "영상 참고" if unknown. NEVER use broken ASR text as reps value.
- Return ONLY valid JSON.

Transcript:
${truncated}`,
    { jsonMode: true, model: 'gpt-4.1-mini' }
  ));

  const defaultRest = isCardioType ? 10 : 60;
  const exercises: ExtractedExercise[] = ((stage2.exercises as Record<string, unknown>[]) ?? []).map(ex => {
    const segIdx = ex.segment_index as number | null;
    let timestamp: number | null = null;
    if (segIdx !== null && segIdx >= 0 && segIdx < segments.length) {
      timestamp = Math.floor(segments[segIdx].offset);
    }

    return {
      name: (ex.name as string) ?? '',
      sets: Number(ex.sets) || (isCardioType ? 1 : 3),
      reps: sanitizeReps(ex.reps),
      rest_seconds: Number(ex.rest_seconds) || defaultRest,
      equipment: (ex.equipment as string[]) ?? [],
      target_muscles: (ex.target_muscles as string[]) ?? [],
      timestamp_seconds: timestamp,
    };
  }).sort((a, b) => {
    if (a.timestamp_seconds === null) return 1;
    if (b.timestamp_seconds === null) return -1;
    return a.timestamp_seconds - b.timestamp_seconds;
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
- total_duration_min: total workout time in minutes. If the video title contains a duration (e.g. "12분", "30 min"), use that as the primary source. Otherwise estimate from exercise count.

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
